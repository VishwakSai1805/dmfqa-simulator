export type ProcessState = 'NEW' | 'READY' | 'RUNNING' | 'TERMINATED';

export type QueueId = 0 | 1 | 2;

export type EngineId = 'baseline' | 'dmfqa';

export interface ProcessInput {
  id: string;
  arrivalTime: number;
  burstTime: number;
  /** Applies to the BASELINE engine only. DMFQ-A always admits to Q0 by definition. */
  initialQueueOverride?: QueueId;
  color: string;
}

export interface Process extends ProcessInput {
  state: ProcessState;
  remainingTime: number;
  currentQueue: QueueId;
  /** Continuous wait in the current queue, reset on dispatch / promotion / demotion. */
  queueWaitTime: number;
  /** Longest continuous ready-queue wait observed — drives the starvation metric. */
  maxContinuousWait: number;
  firstExecutionTime: number | null;
  completionTime: number;
  turnaroundTime: number;
  waitingTime: number;
  responseTime: number;
}

export interface GanttBlock {
  processId: string | 'IDLE';
  queueId: QueueId | null;
  startTime: number;
  endTime: number;
}

export interface SimulationSnapshot {
  time: number;
  runningProcess: Process | null;
  queues: { q0: Process[]; q1: Process[]; q2: Process[] };
  terminated: Process[];
  gantt: GanttBlock[];
  contextSwitches: number;
  events: string[];
}

export interface PerformanceMetrics {
  avgTAT: number;
  avgWT: number;
  avgRT: number;
  totalContextSwitches: number;
  cpuUtilization: number;
  starvationIncidents: number;
  makespan: number;
}

export interface SimulationResult {
  snapshots: SimulationSnapshot[];
  metrics: PerformanceMetrics;
  finalProcesses: Process[];
}

/** Round-robin time quantum per tier. Q2 is FCFS: run to completion, no quantum. */
export const QUANTUM: Record<QueueId, number | null> = { 0: 4, 1: 8, 2: null };

/** A process waiting this long (continuously, in one queue) is aged / counted as starved. */
export const AGING_THRESHOLD = 16;

/** Hard cap so an engine bug surfaces as a labelled error, not a frozen tab. */
export const MAX_TICKS = 20_000;

export const QUEUE_LABELS: Record<QueueId, string> = {
  0: 'Q0 (RR q=4)',
  1: 'Q1 (RR q=8)',
  2: 'Q2 (FCFS)',
};
