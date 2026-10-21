import { describe, expect, it } from 'vitest';
import { runBaseline } from '../baselineScheduler';
import { runDmfqa } from '../dmfqaScheduler';
import { PRESETS } from '../../data/presets';
import type { ProcessInput, SimulationResult } from '../types';

const ENGINES: Array<{ name: string; run: (p: ProcessInput[]) => SimulationResult }> = [
  { name: 'Baseline', run: runBaseline },
  { name: 'DMFQ-A', run: runDmfqa },
];

function assertInvariants(inputs: ProcessInput[], result: SimulationResult, label: string) {
  const { finalProcesses, snapshots, metrics } = result;

  // Every process terminates exactly once.
  expect(finalProcesses.length, `${label}: process count`).toBe(inputs.length);
  for (const p of finalProcesses) {
    expect(p.state, `${label}: ${p.id} state`).toBe('TERMINATED');
    expect(p.remainingTime, `${label}: ${p.id} remaining`).toBe(0);
    expect(p.firstExecutionTime, `${label}: ${p.id} firstExecutionTime`).not.toBeNull();

    // Identity invariants, exactly.
    expect(p.turnaroundTime, `${label}: ${p.id} TAT === CT - AT`).toBe(
      p.completionTime - p.arrivalTime,
    );
    expect(p.waitingTime, `${label}: ${p.id} WT === TAT - BT`).toBe(
      p.turnaroundTime - p.burstTime,
    );
    expect(p.responseTime, `${label}: ${p.id} RT === FT - AT`).toBe(
      (p.firstExecutionTime as number) - p.arrivalTime,
    );
    expect(p.waitingTime, `${label}: ${p.id} WT >= 0`).toBeGreaterThanOrEqual(0);
    expect(p.responseTime, `${label}: ${p.id} RT >= 0`).toBeGreaterThanOrEqual(0);
    expect(p.completionTime, `${label}: ${p.id} CT > AT`).toBeGreaterThan(p.arrivalTime);
  }

  // No CPU time invented or lost.
  const gantt = snapshots[snapshots.length - 1].gantt;
  const busy = gantt
    .filter((b) => b.processId !== 'IDLE')
    .reduce((s, b) => s + (b.endTime - b.startTime), 0);
  const totalBurst = inputs.reduce((s, p) => s + p.burstTime, 0);
  expect(busy, `${label}: busy ticks === sum(burstTime)`).toBe(totalBurst);

  // Per-process CPU time equals its burst time.
  for (const p of inputs) {
    const own = gantt
      .filter((b) => b.processId === p.id)
      .reduce((s, b) => s + (b.endTime - b.startTime), 0);
    expect(own, `${label}: ${p.id} CPU time === BT`).toBe(p.burstTime);
  }

  // Gantt blocks are contiguous, non-overlapping, and cover [0, makespan].
  expect(gantt[0].startTime, `${label}: gantt starts at 0`).toBe(0);
  for (let i = 1; i < gantt.length; i++) {
    expect(gantt[i].startTime, `${label}: gantt contiguous at block ${i}`).toBe(
      gantt[i - 1].endTime,
    );
    expect(gantt[i].endTime, `${label}: gantt block ${i} has positive width`).toBeGreaterThan(
      gantt[i].startTime,
    );
  }
  expect(gantt[gantt.length - 1].endTime, `${label}: gantt ends at makespan`).toBe(
    metrics.makespan,
  );

  // Makespan equals the last completion time; one snapshot per tick.
  const lastCT = Math.max(...finalProcesses.map((p) => p.completionTime));
  expect(metrics.makespan, `${label}: makespan === max CT`).toBe(lastCT);
  expect(snapshots.length, `${label}: one snapshot per tick`).toBe(metrics.makespan);
  snapshots.forEach((s, i) => {
    expect(s.time, `${label}: snapshot ${i} time`).toBe(i);
  });

  // Utilisation is a real fraction.
  expect(metrics.cpuUtilization).toBeGreaterThan(0);
  expect(metrics.cpuUtilization).toBeLessThanOrEqual(1);
  expect(metrics.cpuUtilization).toBeCloseTo(totalBurst / metrics.makespan, 10);
}

describe('Identity invariants across all presets and both engines', () => {
  for (const preset of PRESETS) {
    for (const engine of ENGINES) {
      it(`${preset.name} / ${engine.name}`, () => {
        assertInvariants(
          preset.processes,
          engine.run(preset.processes),
          `${preset.name}/${engine.name}`,
        );
      });
    }
  }
});

const p = (id: string, at: number, bt: number): ProcessInput => ({
  id,
  arrivalTime: at,
  burstTime: bt,
  color: '#38bdf8',
});

describe('Edge cases', () => {
  const cases: Array<{ name: string; procs: ProcessInput[] }> = [
    { name: 'single process', procs: [p('P1', 0, 7)] },
    { name: 'single process arriving late', procs: [p('P1', 12, 3)] },
    {
      name: 'identical arrival times',
      procs: [p('P1', 0, 6), p('P2', 0, 6), p('P3', 0, 6), p('P4', 0, 6)],
    },
    { name: 'BT=1 against BT=100', procs: [p('P1', 0, 1), p('P2', 0, 100)] },
    { name: 'BT=100 admitted first, then BT=1', procs: [p('P1', 0, 100), p('P2', 0, 1)] },
    {
      name: 'process arriving after the CPU has gone idle',
      procs: [p('P1', 0, 3), p('P2', 20, 4)],
    },
    {
      name: 'every process arrives into an idle CPU, back to back',
      procs: [p('P1', 0, 2), p('P2', 10, 2), p('P3', 20, 2)],
    },
    {
      name: 'max fan-out — 15 processes',
      procs: Array.from({ length: 15 }, (_, i) => p(`P${i + 1}`, i * 2, ((i * 7) % 13) + 1)),
    },
  ];

  for (const c of cases) {
    for (const engine of ENGINES) {
      it(`${c.name} / ${engine.name}`, () => {
        assertInvariants(c.procs, engine.run(c.procs), `${c.name}/${engine.name}`);
      });
    }
  }

  it('an empty input set produces an empty, well-formed result', () => {
    for (const engine of ENGINES) {
      const r = engine.run([]);
      expect(r.snapshots).toHaveLength(0);
      expect(r.finalProcesses).toHaveLength(0);
      expect(r.metrics.makespan).toBe(0);
      expect(r.metrics.cpuUtilization).toBe(0);
    }
  });

  it('idle ticks are emitted as IDLE blocks and excluded from utilisation', () => {
    const r = runDmfqa([p('P1', 0, 3), p('P2', 20, 4)]);
    const idle = r.snapshots[r.snapshots.length - 1].gantt.filter((b) => b.processId === 'IDLE');
    expect(idle.reduce((s, b) => s + (b.endTime - b.startTime), 0)).toBe(17);
    expect(r.metrics.cpuUtilization).toBeCloseTo(7 / 24, 10);
  });

  it('idle transitions do not count as context switches', () => {
    // P1 runs alone, CPU idles, P2 runs alone. Occupant changes twice but never
    // between two real processes.
    const r = runDmfqa([p('P1', 0, 3), p('P2', 20, 3)]);
    expect(r.metrics.totalContextSwitches).toBe(0);
  });
});
