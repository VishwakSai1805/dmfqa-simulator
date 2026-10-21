import type {
  EngineId,
  GanttBlock,
  Process,
  ProcessInput,
  QueueId,
  SimulationResult,
  SimulationSnapshot,
} from './types';
import { AGING_THRESHOLD, MAX_TICKS, QUANTUM } from './types';
import { computeMetrics } from './metrics';

/**
 * Internal working record. `continuousReadyWait` is deliberately separate from
 * `queueWaitTime`:
 *
 *  - `queueWaitTime`      fuels aging. Per spec it resets on dispatch, promotion
 *                         AND demotion, so it measures residency in the *current*
 *                         tier only.
 *  - `continuousReadyWait` fuels the starvation metric, which is defined as a
 *                         continuous ready wait without *being dispatched*. A
 *                         promotion is not a dispatch, so this accumulator survives
 *                         tier changes and only resets when the process gets the CPU.
 *
 * Collapsing the two would make every aged process register as starved, which would
 * be an artifact of the bookkeeping rather than a property of the algorithm.
 */
interface WorkProcess extends Process {
  continuousReadyWait: number;
  inputIndex: number;
}

export interface EngineConfig {
  engine: EngineId;
  /** Tier a process is admitted to on arrival. */
  assignInitialQueue: (p: ProcessInput) => QueueId;
  /** DMFQ-A only: promote on AGING_THRESHOLD continuous wait in the current tier. */
  agingEnabled: boolean;
  /** Where a process goes when it burns its quantum without finishing. */
  onQuantumExpiry: (q: QueueId) => QueueId;
}

const fmt = (t: number) => `[T=${t}ms]`;

function toProcess(w: WorkProcess): Process {
  return {
    id: w.id,
    arrivalTime: w.arrivalTime,
    burstTime: w.burstTime,
    ...(w.initialQueueOverride !== undefined
      ? { initialQueueOverride: w.initialQueueOverride }
      : {}),
    color: w.color,
    state: w.state,
    remainingTime: w.remainingTime,
    currentQueue: w.currentQueue,
    queueWaitTime: w.queueWaitTime,
    maxContinuousWait: w.maxContinuousWait,
    firstExecutionTime: w.firstExecutionTime,
    completionTime: w.completionTime,
    turnaroundTime: w.turnaroundTime,
    waitingTime: w.waitingTime,
    responseTime: w.responseTime,
  };
}

/**
 * Shared discrete-event tick loop. Pure: no React state, no timers, no randomness.
 * The two architectures differ only through `EngineConfig`.
 */
export function runSimulation(inputs: ProcessInput[], config: EngineConfig): SimulationResult {
  if (inputs.length === 0) {
    return {
      snapshots: [],
      metrics: computeMetrics([], [], 0),
      finalProcesses: [],
    };
  }

  const table = new Map<string, WorkProcess>();
  inputs.forEach((p, i) => {
    table.set(p.id, {
      ...p,
      state: 'NEW',
      remainingTime: p.burstTime,
      currentQueue: 0,
      queueWaitTime: 0,
      maxContinuousWait: 0,
      continuousReadyWait: 0,
      firstExecutionTime: null,
      completionTime: -1,
      turnaroundTime: -1,
      waitingTime: -1,
      responseTime: -1,
      inputIndex: i,
    });
  });

  // Ready queues hold process IDs; index 0 is the head.
  const queues: [string[], string[], string[]] = [[], [], []];
  const gantt: GanttBlock[] = [];
  const snapshots: SimulationSnapshot[] = [];
  const terminatedOrder: string[] = [];

  let running: WorkProcess | null = null;
  let quantumUsed = 0;
  let contextSwitches = 0;
  let previousCpuOccupant: string | null = null;

  const push = (q: QueueId, id: string, toFront = false) => {
    if (toFront) queues[q].unshift(id);
    else queues[q].push(id);
  };

  const highestNonEmpty = (): QueueId | null => {
    for (const q of [0, 1, 2] as QueueId[]) if (queues[q].length > 0) return q;
    return null;
  };

  let T = 0;
  while (terminatedOrder.length < inputs.length) {
    if (T > MAX_TICKS) {
      throw new Error(
        `[${config.engine}] Tick loop exceeded ${MAX_TICKS} iterations at T=${T}. ` +
          `Engine invariant violated — aborting instead of hanging the UI.`,
      );
    }

    const events: string[] = [];

    // ---- 1. ARRIVAL -------------------------------------------------------
    // Ties broken by input order (unique), then process ID.
    for (const input of inputs) {
      const p = table.get(input.id)!;
      if (p.arrivalTime === T && p.state === 'NEW') {
        const q = config.assignInitialQueue(input);
        p.state = 'READY';
        p.currentQueue = q;
        p.queueWaitTime = 0;
        p.continuousReadyWait = 0;
        push(q, p.id);
        events.push(
          `${fmt(T)} ARRIVAL: ${p.id} admitted to Q${q} (AT=${p.arrivalTime}, BT=${p.burstTime})`,
        );
      }
    }

    // ---- 2. AGING ---------------------------------------------------------
    // Wait accounting runs for BOTH engines (the starvation metric is comparative);
    // only DMFQ-A acts on it by promoting.
    for (const q of [0, 1, 2] as QueueId[]) {
      for (const id of queues[q]) {
        const p = table.get(id)!;
        p.queueWaitTime += 1;
        p.continuousReadyWait += 1;
      }
    }

    if (config.agingEnabled) {
      // Q1 -> Q0 FIRST, then Q2 -> Q1. The PRD's stated order (Q2 first) would let a
      // single process climb two tiers in one tick; that is a bug, not a feature.
      for (const from of [1, 2] as QueueId[]) {
        const to = (from - 1) as QueueId;
        const promoted = queues[from].filter((id) => table.get(id)!.queueWaitTime >= AGING_THRESHOLD);
        if (promoted.length === 0) continue;
        queues[from] = queues[from].filter((id) => !promoted.includes(id));
        for (const id of promoted) {
          const p = table.get(id)!;
          p.currentQueue = to;
          p.queueWaitTime = 0; // aging fuel resets; continuousReadyWait deliberately does not
          push(to, id);
          events.push(`${fmt(T)} AGING TRIGGER: ${p.id} promoted Q${from} → Q${to}`);
        }
      }
    }

    // ---- 3. DISPATCH ------------------------------------------------------
    const candidateQueue = highestNonEmpty();

    if (running !== null && candidateQueue !== null && candidateQueue < running.currentQueue) {
      // Strictly higher tier only. A same-queue arrival never preempts; RR
      // turn-taking happens at quantum expiry.
      const victim = running;
      victim.state = 'READY';
      push(victim.currentQueue, victim.id, true); // front: it did not consume its turn
      quantumUsed = 0;
      running = null;
      const nextId = queues[candidateQueue][0];
      events.push(
        `${fmt(T)} PREEMPTION: ${nextId} (Q${candidateQueue}) preempted ${victim.id} (Q${victim.currentQueue})`,
      );
    }

    if (running === null) {
      const q = highestNonEmpty();
      if (q !== null) {
        const id = queues[q].shift()!;
        const p = table.get(id)!;
        p.state = 'RUNNING';
        p.queueWaitTime = 0;
        p.continuousReadyWait = 0; // reached the CPU — starvation clock restarts
        running = p;
        quantumUsed = 0;
        events.push(`${fmt(T)} DISPATCH: ${p.id} dispatched from Q${q} (rem=${p.remainingTime}ms)`);
      }
    }

    // ---- 3b. WAIT HIGH-WATER MARK -----------------------------------------
    // Recorded AFTER dispatch, and only for processes still sitting in a queue.
    //
    // The phase-2 increment is speculative: it counts the tick currently in
    // progress before the dispatcher has decided who runs. Recording the
    // high-water mark there credits a process with a waiting tick it never
    // actually waited, which inflates every reported worst-wait figure by
    // exactly 1ms and manufactures a starvation incident for any true
    // continuous wait of AGING_THRESHOLD - 1. Taking the reading here instead
    // means a process that reaches the CPU this tick contributes nothing for
    // it, while a process that genuinely sits out the whole tick still does.
    for (const q of [0, 1, 2] as QueueId[]) {
      for (const id of queues[q]) {
        const p = table.get(id)!;
        if (p.continuousReadyWait > p.maxContinuousWait) {
          p.maxContinuousWait = p.continuousReadyWait;
        }
      }
    }

    // ---- 4. EXECUTE -------------------------------------------------------
    const occupant = running;
    if (occupant !== null) {
      if (occupant.firstExecutionTime === null) occupant.firstExecutionTime = T;
      occupant.remainingTime -= 1;
      quantumUsed += 1;

      const last = gantt[gantt.length - 1];
      if (last && last.processId === occupant.id && last.queueId === occupant.currentQueue && last.endTime === T) {
        last.endTime = T + 1;
      } else {
        gantt.push({
          processId: occupant.id,
          queueId: occupant.currentQueue,
          startTime: T,
          endTime: T + 1,
        });
      }
    } else {
      const last = gantt[gantt.length - 1];
      if (last && last.processId === 'IDLE' && last.endTime === T) {
        last.endTime = T + 1;
      } else {
        gantt.push({ processId: 'IDLE', queueId: null, startTime: T, endTime: T + 1 });
        events.push(`${fmt(T)} IDLE: no ready process`);
      }
    }

    // Context switch = the CPU's occupant changed between two consecutive ticks and
    // BOTH occupants are real processes. Idle->process and process->idle do not count.
    const currentOccupant = occupant?.id ?? null;
    if (
      previousCpuOccupant !== null &&
      currentOccupant !== null &&
      previousCpuOccupant !== currentOccupant
    ) {
      contextSwitches += 1;
    }
    previousCpuOccupant = currentOccupant;

    // ---- 5. TRANSITION ----------------------------------------------------
    if (occupant !== null) {
      if (occupant.remainingTime === 0) {
        occupant.state = 'TERMINATED';
        occupant.completionTime = T + 1;
        occupant.turnaroundTime = occupant.completionTime - occupant.arrivalTime;
        occupant.waitingTime = occupant.turnaroundTime - occupant.burstTime;
        occupant.responseTime = (occupant.firstExecutionTime ?? T) - occupant.arrivalTime;
        terminatedOrder.push(occupant.id);
        running = null;
        quantumUsed = 0;
        events.push(
          `${fmt(T)} TERMINATION: ${occupant.id} completed ` +
            `(CT=${occupant.completionTime}, TAT=${occupant.turnaroundTime}, ` +
            `WT=${occupant.waitingTime}, RT=${occupant.responseTime})`,
        );
      } else {
        const quantum = QUANTUM[occupant.currentQueue];
        if (quantum !== null && quantumUsed >= quantum) {
          const from = occupant.currentQueue;
          const to = config.onQuantumExpiry(from);
          events.push(`${fmt(T)} QUANTUM EXPIRY: ${occupant.id} used ${quantum}ms in Q${from}`);
          occupant.state = 'READY';
          occupant.currentQueue = to;
          occupant.queueWaitTime = 0;
          push(to, occupant.id); // tail
          if (to !== from) {
            events.push(`${fmt(T)} DEMOTION: ${occupant.id} demoted Q${from} → Q${to}`);
          } else {
            events.push(`${fmt(T)} REQUEUE: ${occupant.id} re-queued at tail of Q${from}`);
          }
          running = null;
          quantumUsed = 0;
        }
      }
    }

    // ---- SNAPSHOT ---------------------------------------------------------
    snapshots.push({
      time: T,
      runningProcess: occupant ? toProcess(occupant) : null,
      queues: {
        q0: queues[0].map((id) => toProcess(table.get(id)!)),
        q1: queues[1].map((id) => toProcess(table.get(id)!)),
        q2: queues[2].map((id) => toProcess(table.get(id)!)),
      },
      terminated: terminatedOrder.map((id) => toProcess(table.get(id)!)),
      // Closed blocks are never mutated again, so they can be shared by reference;
      // only the tail block needs cloning to keep earlier snapshots frozen.
      gantt: gantt.map((b, i) => (i === gantt.length - 1 ? { ...b } : b)),
      contextSwitches,
      events,
    });

    T += 1;
  }

  const finalProcesses = inputs.map((p) => toProcess(table.get(p.id)!));

  return {
    snapshots,
    metrics: computeMetrics(finalProcesses, gantt, contextSwitches),
    finalProcesses,
  };
}
