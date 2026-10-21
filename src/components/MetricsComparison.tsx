import type { PerformanceMetrics, SimulationResult } from '../engine/types';
import { round2 } from '../engine/metrics';
import { ENGINE_COLOR } from '../lib/palette';
import { Panel, Tip } from './Panel';

type Better = 'lower' | 'higher';

interface Row {
  key: keyof PerformanceMetrics;
  label: string;
  better: Better;
  fmt: (n: number) => string;
  tip?: string;
}

const ROWS: Row[] = [
  { key: 'avgTAT', label: 'Turnaround', better: 'lower', fmt: (n) => round2(n).toFixed(2) },
  { key: 'avgWT', label: 'Waiting', better: 'lower', fmt: (n) => round2(n).toFixed(2) },
  { key: 'avgRT', label: 'Response', better: 'lower', fmt: (n) => round2(n).toFixed(2) },
  {
    key: 'totalContextSwitches',
    label: 'Context switches',
    better: 'lower',
    fmt: String,
    tip: 'Counted when the process occupying the CPU at tick T differs from the one at tick T−1 and both are real processes. Idle→process and process→idle transitions are excluded.',
  },
  {
    key: 'cpuUtilization',
    label: 'CPU utilisation',
    better: 'higher',
    fmt: (n) => `${(n * 100).toFixed(1)}%`,
    tip: 'busyTicks / totalTicks across the whole run. With identical inputs and no idling on either side this row ties by construction.',
  },
  {
    key: 'starvationIncidents',
    label: 'Starvation',
    better: 'lower',
    fmt: String,
    tip: 'Number of processes that experienced at least one continuous ready-queue wait of 16 ms or more without being dispatched. Counted per process, not per event.',
  },
  { key: 'makespan', label: 'Makespan', better: 'lower', fmt: (n) => String(n) },
];

export function verdict(b: number, d: number, better: Better): 'baseline' | 'dmfqa' | 'tie' {
  if (b === d) return 'tie';
  return (better === 'lower' ? d < b : d > b) ? 'dmfqa' : 'baseline';
}

interface Props {
  baseline: SimulationResult;
  dmfqa: SimulationResult;
}

/**
 * No win/lose colour wash: the two engines keep their own series colours, the
 * better figure is marked with weight plus an explicit caret, and the signed
 * delta says by how much. Colour never carries the verdict on its own.
 */
export function MetricsComparison({ baseline, dmfqa }: Props) {
  return (
    <Panel title="Metrics" meta="▸ better · computed per run, never targeted" bodyClassName="overflow-auto px-3 pb-2">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-ink-4 text-[10.5px]">
            <th className="pb-1 text-left font-normal">ms unless noted</th>
            <th className="pb-1 pl-2 text-right font-normal">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-[1px]"
                  style={{ background: ENGINE_COLOR.baseline }}
                />
                Baseline
              </span>
            </th>
            <th className="pb-1 pl-2 text-right font-normal">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-[1px]"
                  style={{ background: ENGINE_COLOR.dmfqa }}
                />
                DMFQ-A
              </span>
            </th>
            <th className="w-12 pb-1 pl-2 text-right font-normal">Δ</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const b = baseline.metrics[r.key];
            const d = dmfqa.metrics[r.key];
            const v = verdict(b, d, r.better);
            const delta = b === 0 ? (d === 0 ? 0 : 100) : ((d - b) / Math.abs(b)) * 100;
            return (
              <tr key={r.key} className="border-line/60 border-t">
                <td className="text-ink-3 py-[2px] text-[11.5px]">
                  {r.tip ? (
                    <Tip text={r.tip}>
                      <span className="decoration-line-strong underline decoration-dotted underline-offset-2">
                        {r.label}
                      </span>
                    </Tip>
                  ) : (
                    r.label
                  )}
                </td>
                <Cell text={r.fmt(b)} best={v === 'baseline'} />
                <Cell text={r.fmt(d)} best={v === 'dmfqa'} />
                <td
                  className={`py-[2px] pl-2 text-right font-mono text-[10.5px] tabular-nums ${
                    v === 'tie' ? 'text-ink-4' : 'text-ink-3'
                  }`}
                >
                  {v === 'tie' ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function Cell({ text, best }: { text: string; best: boolean }) {
  return (
    <td className="py-[2px] pl-2 text-right font-mono text-[12px] tabular-nums">
      <span className={best ? 'text-ink font-medium' : 'text-ink-2'}>
        {best && <span className="text-ink-3 mr-1 text-[10px]">▸</span>}
        {text}
      </span>
    </td>
  );
}

/** Reads the live metrics and states which algorithm won on which axis. */
export function Interpretation({ baseline, dmfqa }: Props) {
  const b = baseline.metrics;
  const d = dmfqa.metrics;

  const axes: Array<{ label: string; b: number; d: number; better: Better }> = [
    { label: 'response time', b: b.avgRT, d: d.avgRT, better: 'lower' },
    { label: 'turnaround', b: b.avgTAT, d: d.avgTAT, better: 'lower' },
    { label: 'waiting time', b: b.avgWT, d: d.avgWT, better: 'lower' },
    { label: 'context switches', b: b.totalContextSwitches, d: d.totalContextSwitches, better: 'lower' },
    { label: 'starvation', b: b.starvationIncidents, d: d.starvationIncidents, better: 'lower' },
  ];

  const wins = axes.filter((a) => verdict(a.b, a.d, a.better) === 'dmfqa').map((a) => a.label);
  const losses = axes.filter((a) => verdict(a.b, a.d, a.better) === 'baseline').map((a) => a.label);

  const worstB = Math.max(0, ...baseline.finalProcesses.map((p) => p.maxContinuousWait));
  const worstD = Math.max(0, ...dmfqa.finalProcesses.map((p) => p.maxContinuousWait));

  const identical = axes.every((a) => a.b === a.d);

  return (
    <div className="border-line text-ink-3 flex max-h-[68px] shrink-0 items-start gap-6 overflow-y-auto border-t px-4 py-2 text-[11.5px] leading-[1.6]">
      {identical ? (
        <p>
          Both engines produce an identical schedule on this workload — nothing exhausts a quantum or
          waits long enough for the two policies to diverge.
        </p>
      ) : (
        <>
          <p className="min-w-0 flex-1">
            <span className="text-ink-2">DMFQ-A ahead on</span>{' '}
            {wins.length ? (
              <span className="text-ink">{wins.join(', ')}</span>
            ) : (
              <span className="text-ink-4">nothing on this workload</span>
            )}
            <span className="text-ink-4"> · </span>
            <span className="text-ink-2">baseline ahead on</span>{' '}
            {losses.length ? (
              <span className="text-ink">{losses.join(', ')}</span>
            ) : (
              <span className="text-ink-4">nothing</span>
            )}
            .
          </p>
          <p className="min-w-0 flex-1">
            <span className="text-ink-2">Worst continuous wait</span>{' '}
            <span className="text-ink font-mono tabular-nums">{worstB} ms</span> baseline vs{' '}
            <span className="text-ink font-mono tabular-nums">{worstD} ms</span> DMFQ-A
            {worstD < worstB
              ? ' — aging is measurably capping the tail.'
              : worstD > worstB
                ? ' — aging did not help; the static classification already suited this workload.'
                : ' — identical, nothing aged.'}
          </p>
          <p className="min-w-0 flex-[1.4]">
            {d.avgTAT > b.avgTAT
              ? 'The honest cost: turnaround is worse under DMFQ-A here. Demotion pushes long jobs down before aging can pull them back, and a small non-overloaded set gives that too little runtime to pay off — the real trade-off, not a defect.'
              : 'Adaptive placement also beats static classification on turnaround here. That will not hold for every input; the table reports computed figures rather than an expected result.'}
          </p>
        </>
      )}
    </div>
  );
}
