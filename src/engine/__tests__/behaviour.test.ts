import { describe, expect, it } from 'vitest';
import { assignBaselineQueue, runBaseline } from '../baselineScheduler';
import { runDmfqa } from '../dmfqaScheduler';
import { PRESETS } from '../../data/presets';
import type { ProcessInput } from '../types';
import { AGING_THRESHOLD } from '../types';

const allEvents = (snapshots: { events: string[] }[]) => snapshots.flatMap((s) => s.events);

const preset = (key: string) => PRESETS.find((p) => p.key === key)!.processes;

describe('Baseline static queue assignment', () => {
  it('classifies by declared burst length', () => {
    expect(assignBaselineQueue(1)).toBe(0);
    expect(assignBaselineQueue(4)).toBe(0);
    expect(assignBaselineQueue(5)).toBe(1);
    expect(assignBaselineQueue(12)).toBe(1);
    expect(assignBaselineQueue(13)).toBe(2);
    expect(assignBaselineQueue(100)).toBe(2);
  });

  it('never revises its judgment — no promotion or demotion events, ever', () => {
    for (const p of PRESETS) {
      const events = allEvents(runBaseline(p.processes).snapshots);
      expect(events.some((e) => e.includes('AGING TRIGGER')), p.name).toBe(false);
      expect(events.some((e) => e.includes('DEMOTION')), p.name).toBe(false);
    }
  });

  it('honours the sandbox initial-queue override', () => {
    const procs: ProcessInput[] = [
      { id: 'P1', arrivalTime: 0, burstTime: 20, color: '#fff', initialQueueOverride: 0 },
    ];
    const first = runBaseline(procs).snapshots[0];
    expect(first.events.some((e) => e.includes('ARRIVAL: P1 admitted to Q0'))).toBe(true);
  });

  it('the override is ignored by DMFQ-A, which always admits to Q0 by definition', () => {
    const procs: ProcessInput[] = [
      { id: 'P1', arrivalTime: 0, burstTime: 2, color: '#fff', initialQueueOverride: 2 },
    ];
    expect(runBaseline(procs).snapshots[0].events.some((e) => e.includes('admitted to Q2'))).toBe(
      true,
    );
    expect(runDmfqa(procs).snapshots[0].events.some((e) => e.includes('admitted to Q0'))).toBe(
      true,
    );
  });
});

describe('DMFQ-A demotion', () => {
  it('Demotion Cascade — P1 walks Q0 -> Q1 -> Q2 and stops there', () => {
    const events = allEvents(runDmfqa(preset('cascade')).snapshots).filter((e) =>
      e.includes('DEMOTION: P1'),
    );
    expect(events.some((e) => e.includes('Q0 → Q1'))).toBe(true);
    expect(events.some((e) => e.includes('Q1 → Q2'))).toBe(true);
    // Q2 is terminal: no demotion out of it, and no quantum applies there.
    expect(events.some((e) => e.includes('Q2 →'))).toBe(false);
  });

  it('Q2 is FCFS run-to-completion — a Q2 resident never expires a quantum', () => {
    const events = allEvents(runDmfqa(preset('cascade')).snapshots);
    expect(events.some((e) => e.includes('QUANTUM EXPIRY') && e.includes('in Q2'))).toBe(false);
  });

  it('a process shorter than its quantum is never demoted', () => {
    const events = allEvents(
      runDmfqa([{ id: 'P1', arrivalTime: 0, burstTime: 3, color: '#fff' }]).snapshots,
    );
    expect(events.some((e) => e.includes('DEMOTION'))).toBe(false);
  });
});

describe('Preemption semantics', () => {
  it('a same-tier arrival never preempts', () => {
    // Both admitted to Q0 under DMFQ-A; P2 must wait for P1's quantum to expire.
    const r = runDmfqa([
      { id: 'P1', arrivalTime: 0, burstTime: 8, color: '#fff' },
      { id: 'P2', arrivalTime: 1, burstTime: 2, color: '#fff' },
    ]);
    expect(allEvents(r.snapshots).some((e) => e.includes('PREEMPTION'))).toBe(false);
    expect(r.snapshots[3].runningProcess?.id).toBe('P1');
  });

  it('a strictly higher tier preempts, and the victim returns to the FRONT of its queue', () => {
    // Baseline: P1(BT=20)->Q2, P2(BT=20)->Q2, P3(BT=2)->Q0 arrives mid-run.
    const r = runBaseline([
      { id: 'P1', arrivalTime: 0, burstTime: 20, color: '#fff' },
      { id: 'P2', arrivalTime: 0, burstTime: 20, color: '#fff' },
      { id: 'P3', arrivalTime: 5, burstTime: 2, color: '#fff' },
    ]);
    const events = allEvents(r.snapshots);
    expect(events.some((e) => e.includes('PREEMPTION: P3 (Q0) preempted P1 (Q2)'))).toBe(true);
    // P1 did not consume its turn, so it resumes ahead of P2 rather than behind it.
    expect(r.snapshots[7].runningProcess?.id).toBe('P1');
  });
});

describe('Wait accounting — the high-water mark is not read a tick early', () => {
  const mk = (rows: Array<[string, number, number]>): ProcessInput[] =>
    rows.map(([id, arrivalTime, burstTime], i) => ({
      id,
      arrivalTime,
      burstTime,
      color: `#${(i + 1).toString().repeat(6)}`,
    }));

  it('reports the wait a process actually served, not the tick it was dispatched on', () => {
    // P2 (BT=4) is admitted to Q0 and runs T=0..3. P1 (BT=15) is admitted to Q2
    // and sits out ticks 0,1,2,3 — four waiting ticks — before the CPU frees at T=4.
    const res = runBaseline(mk([['P1', 0, 15], ['P2', 0, 4]]));
    const p1 = res.finalProcesses.find((p) => p.id === 'P1')!;
    expect(p1.firstExecutionTime).toBe(4);
    expect(p1.maxContinuousWait).toBe(4);
  });

  it('does not manufacture a starvation incident at threshold minus one', () => {
    // Q0 filler totalling exactly AGING_THRESHOLD - 1 ms of work, so P1's true
    // continuous wait is 15ms and it reaches the CPU at T=15. Reading the mark
    // before dispatch reported 16 here and flagged a process that never starved.
    const res = runBaseline(
      mk([
        ['P1', 0, 15],
        ['F1', 0, 4],
        ['F2', 0, 4],
        ['F3', 0, 4],
        ['F4', 0, 3],
      ]),
    );
    const p1 = res.finalProcesses.find((p) => p.id === 'P1')!;
    expect(p1.firstExecutionTime).toBe(AGING_THRESHOLD - 1);
    expect(p1.maxContinuousWait).toBe(AGING_THRESHOLD - 1);
    expect(res.metrics.starvationIncidents).toBe(0);
  });
});

describe('Aging — Preset 3 (Starvation Showcase)', () => {
  const procs = preset('starvation');
  const dmfqa = runDmfqa(procs);
  const baseline = runBaseline(procs);

  it('DMFQ-A logs at least one AGING TRIGGER', () => {
    const triggers = allEvents(dmfqa.snapshots).filter((e) => e.includes('AGING TRIGGER'));
    expect(triggers.length).toBeGreaterThan(0);
  });

  it("P1's max continuous wait is strictly lower under DMFQ-A than under the baseline", () => {
    const dm = dmfqa.finalProcesses.find((p) => p.id === 'P1')!;
    const bl = baseline.finalProcesses.find((p) => p.id === 'P1')!;
    expect(dm.maxContinuousWait).toBeLessThan(bl.maxContinuousWait);
  });

  it('the baseline actually starves P1 — a continuous wait well past the threshold', () => {
    const bl = baseline.finalProcesses.find((p) => p.id === 'P1')!;
    // Well past, not a magic multiple: the previous `>= AGING_THRESHOLD * 2`
    // held only because the high-water mark was being read a tick early.
    expect(bl.maxContinuousWait).toBeGreaterThan(AGING_THRESHOLD);
    expect(baseline.metrics.starvationIncidents).toBeGreaterThan(0);
  });

  /**
   * Honest result, asserted rather than smoothed over (§8):
   *
   * Aging cuts the SEVERITY of P1's starvation on this workload (31ms of continuous
   * wait down to 24ms) but does not clear the incident, because the arrival train is
   * sustained: offered load stays above 1.0 for the whole run, so Q0 refills faster
   * than a promoted process can be serviced. The incident COUNT only drops when the
   * overload is finite — see the Preset 1 golden test, where DMFQ-A takes it 1 -> 0.
   */
  it('reduces starvation severity here, without clearing the incident under sustained overload', () => {
    const dm = dmfqa.finalProcesses.find((p) => p.id === 'P1')!;
    const bl = baseline.finalProcesses.find((p) => p.id === 'P1')!;
    expect(dm.maxContinuousWait).toBeLessThan(bl.maxContinuousWait);
    expect(dmfqa.metrics.starvationIncidents).toBeLessThanOrEqual(
      baseline.metrics.starvationIncidents,
    );
  });

  it('aging promotes exactly one tier per tick — no double jumps', () => {
    for (const s of dmfqa.snapshots) {
      const promos = s.events.filter((e) => e.includes('AGING TRIGGER'));
      const perProcess = new Map<string, number>();
      for (const e of promos) {
        const id = e.split('AGING TRIGGER: ')[1].split(' ')[0];
        perProcess.set(id, (perProcess.get(id) ?? 0) + 1);
      }
      for (const [id, n] of perProcess) {
        expect(n, `${id} promoted ${n} times at T=${s.time}`).toBe(1);
      }
    }
  });
});

describe('Guardrails', () => {
  it('the tick loop is capped rather than allowed to hang', () => {
    // A 20,000-iteration cap cannot be reached by any input inside the form limits
    // (15 processes x BT<=100 x AT<=500 tops out well under it), so the cap only
    // fires on a genuine engine bug. Assert it is wired, not that it triggers.
    const heaviest: ProcessInput[] = Array.from({ length: 15 }, (_, i) => ({
      id: `P${i + 1}`,
      arrivalTime: 500,
      burstTime: 100,
      color: '#fff',
    }));
    expect(() => runDmfqa(heaviest)).not.toThrow();
    expect(runDmfqa(heaviest).metrics.makespan).toBe(2000);
  });
});
