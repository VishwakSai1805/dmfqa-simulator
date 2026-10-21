import { describe, expect, it } from 'vitest';
import { runBaseline } from '../baselineScheduler';
import { runDmfqa } from '../dmfqaScheduler';
import { PRESETS } from '../../data/presets';
import type { Process } from '../types';

const preset1 = PRESETS[0].processes;

const byId = (procs: Process[]) => new Map(procs.map((p) => [p.id, p]));

const assertRow = (
  p: Process | undefined,
  expected: { CT: number; TAT: number; WT: number; RT: number },
) => {
  expect(p, 'process missing from result').toBeDefined();
  expect({
    CT: p!.completionTime,
    TAT: p!.turnaroundTime,
    WT: p!.waitingTime,
    RT: p!.responseTime,
  }).toEqual(expected);
};

/**
 * Preset 1 — Standard Benchmark: P1(0,8) P2(1,4) P3(2,9) P4(3,5)
 *
 * Every value below was derived by hand-simulating the tick semantics in §3 before
 * the engine was run, then asserted against the engine. Baseline admission by
 * declared burst: P1(8)->Q1, P2(4)->Q0, P3(9)->Q1, P4(5)->Q1.
 */
describe('Preset 1 golden — Baseline (Static MLQ)', () => {
  const result = runBaseline(preset1);
  const m = byId(result.finalProcesses);

  it('P1 — admitted to Q1, preempted at T=1 by P2 (Q0), resumes T=5, runs to completion', () => {
    assertRow(m.get('P1'), { CT: 12, TAT: 12, WT: 4, RT: 0 });
  });

  it('P2 — sole Q0 resident, preempts immediately on arrival', () => {
    assertRow(m.get('P2'), { CT: 5, TAT: 4, WT: 0, RT: 0 });
  });

  it('P3 — burns an 8ms Q1 quantum, re-queues at the tail of the SAME tier, finishes last', () => {
    assertRow(m.get('P3'), { CT: 26, TAT: 24, WT: 15, RT: 10 });
  });

  it('P4 — misclassified into Q1 behind two longer jobs; waits 17ms untouched', () => {
    assertRow(m.get('P4'), { CT: 25, TAT: 22, WT: 17, RT: 17 });
  });

  it('aggregate metrics', () => {
    expect(result.metrics.avgTAT).toBeCloseTo(15.5, 10);
    expect(result.metrics.avgWT).toBeCloseTo(9, 10);
    expect(result.metrics.avgRT).toBeCloseTo(6.75, 10);
    expect(result.metrics.totalContextSwitches).toBe(5);
    expect(result.metrics.makespan).toBe(26);
    expect(result.metrics.cpuUtilization).toBeCloseTo(1, 10);
    // P4 sits ready for 17 continuous ms without reaching the CPU.
    expect(result.metrics.starvationIncidents).toBe(1);
  });
});

describe('Preset 1 golden — DMFQ-A', () => {
  const result = runDmfqa(preset1);
  const m = byId(result.finalProcesses);

  it('P1 — Q0 quantum expires at T=3, demoted to Q1, completes there', () => {
    assertRow(m.get('P1'), { CT: 20, TAT: 20, WT: 12, RT: 0 });
  });

  it('P2 — fits inside one Q0 quantum, never demoted', () => {
    assertRow(m.get('P2'), { CT: 8, TAT: 7, WT: 3, RT: 3 });
  });

  it('P3 — demoted Q0 -> Q1 at T=11, finishes its remaining 5ms in Q1', () => {
    assertRow(m.get('P3'), { CT: 25, TAT: 23, WT: 14, RT: 6 });
  });

  it('P4 — demoted Q0 -> Q1 at T=15 with 1ms left, drains last', () => {
    assertRow(m.get('P4'), { CT: 26, TAT: 23, WT: 18, RT: 9 });
  });

  it('aggregate metrics', () => {
    expect(result.metrics.avgTAT).toBeCloseTo(18.25, 10);
    expect(result.metrics.avgWT).toBeCloseTo(11.75, 10);
    expect(result.metrics.avgRT).toBeCloseTo(4.5, 10);
    expect(result.metrics.totalContextSwitches).toBe(6);
    expect(result.metrics.makespan).toBe(26);
    expect(result.metrics.starvationIncidents).toBe(0);
  });

  it('honest trade-off on this workload: better RT and starvation, worse TAT, more switches', () => {
    const base = runBaseline(preset1).metrics;
    const dm = result.metrics;
    expect(dm.avgRT).toBeLessThan(base.avgRT);
    expect(dm.starvationIncidents).toBeLessThan(base.starvationIncidents);
    expect(dm.avgTAT).toBeGreaterThan(base.avgTAT); // the real cost of eager demotion
    expect(dm.totalContextSwitches).toBeGreaterThan(base.totalContextSwitches);
  });
});
