import { useMemo } from 'react';
import type { EngineId, Process, ProcessInput, SimulationSnapshot } from '../engine/types';
import { AGING_THRESHOLD } from '../engine/types';
import { styleMap, swatchBackground, type Style } from '../lib/palette';
import { Panel } from './Panel';

const LANE_H = 42;
const PILL_W = 104;
const GAP = 6;
const GUTTER = 116;

const LANES = [
  { label: 'CPU', hint: '' },
  { label: 'Q0', hint: 'RR q=4' },
  { label: 'Q1', hint: 'RR q=8' },
  { label: 'Q2', hint: 'FCFS' },
  { label: 'Done', hint: '' },
];

interface Placed {
  p: Process;
  lane: number;
  slot: number;
  running: boolean;
  done: boolean;
}

interface Props {
  snapshot: SimulationSnapshot | undefined;
  engine: EngineId;
  processes: ProcessInput[];
}

export function QueueVisualizer({ snapshot, engine, processes }: Props) {
  const styles = useMemo(() => styleMap(processes), [processes]);

  const placed = useMemo<Placed[]>(() => {
    if (!snapshot) return [];
    const out: Placed[] = [];
    const r = snapshot.runningProcess;
    if (r && r.state !== 'TERMINATED') out.push({ p: r, lane: 0, slot: 0, running: true, done: false });
    const lanes = [snapshot.queues.q0, snapshot.queues.q1, snapshot.queues.q2];
    lanes.forEach((q, li) =>
      q.forEach((p, i) => out.push({ p, lane: li + 1, slot: i, running: false, done: false })),
    );
    snapshot.terminated.forEach((p, i) =>
      out.push({ p, lane: 4, slot: i, running: false, done: true }),
    );
    return out;
  }, [snapshot]);

  const widest = placed.reduce((m, x) => Math.max(m, x.slot), 0);
  const trackW = (widest + 1) * (PILL_W + GAP);

  return (
    <Panel
      title="Queues"
      meta={
        engine === 'dmfqa'
          ? 'all arrivals admitted to Q0 · demotion on quantum expiry · aging at 16 ms'
          : 'admission fixed by declared burst · no demotion, no aging'
      }
      bodyClassName="overflow-x-auto overflow-y-hidden"
    >
      <div className="relative" style={{ height: LANES.length * LANE_H, minWidth: GUTTER + trackW }}>
        {LANES.map((lane, i) => (
          <div
            key={lane.label}
            className="border-line/70 absolute inset-x-0 flex items-center border-t"
            style={{ top: i * LANE_H, height: LANE_H }}
          >
            <div className="flex w-[116px] shrink-0 items-baseline gap-2 pl-4">
              <span className="text-ink-2 text-[12px] font-medium">{lane.label}</span>
              <span className="text-ink-4 font-mono text-[10px]">{lane.hint}</span>
            </div>
          </div>
        ))}

        {/* One coordinate space for every pill, so a move between lanes is a
            transform transition rather than a remount. */}
        {placed.map(({ p, lane, slot, running, done }) => (
          <Pill
            key={p.id}
            p={p}
            style={styles.get(p.id) ?? { color: p.color, textured: false }}
            engine={engine}
            running={running}
            done={done}
            x={GUTTER + slot * (PILL_W + GAP)}
            y={lane * LANE_H + 5}
          />
        ))}
      </div>
    </Panel>
  );
}

function Pill({
  p,
  style,
  engine,
  running,
  done,
  x,
  y,
}: {
  p: Process;
  style: Style;
  engine: EngineId;
  running: boolean;
  done: boolean;
  x: number;
  y: number;
}) {
  const wait = p.queueWaitTime;
  const showBar = engine === 'dmfqa' && !running && !done && p.currentQueue > 0;
  const critical = wait >= AGING_THRESHOLD;
  const hot = wait > 12;

  return (
    <div
      className={`bg-raised border-line absolute overflow-hidden rounded border transition-transform duration-300 ease-out ${
        done ? 'opacity-60' : ''
      }`}
      style={{ width: PILL_W, height: LANE_H - 10, transform: `translate3d(${x}px, ${y}px, 0)` }}
      title={`${p.id} — AT ${p.arrivalTime}, BT ${p.burstTime}, queue Q${p.currentQueue}, ${wait} ms waited in tier, ${p.maxContinuousWait} ms worst continuous wait`}
    >
      {/* Identity bar: colour, plus a hatch for slot 9+ rather than a ninth hue. */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: done ? 'var(--color-ink-4)' : swatchBackground(style) }}
      />
      <div className="flex h-full flex-col justify-center pr-2 pl-2.5">
        <div className="flex items-baseline justify-between gap-1">
          <span className={`text-[12px] font-medium ${done ? 'text-ink-3' : 'text-ink'}`}>
            {p.id}
          </span>
          <span className="text-ink-3 font-mono text-[10.5px] tabular-nums">
            {done ? `ct ${p.completionTime}` : running ? 'running' : `${p.remainingTime} ms`}
          </span>
        </div>

        {showBar ? (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="bg-line-strong h-[3px] flex-1 overflow-hidden rounded-full">
              <span
                className={`block h-full rounded-full ${critical ? 'wait-critical' : ''}`}
                style={{
                  width: `${Math.min(100, (wait / AGING_THRESHOLD) * 100)}%`,
                  background: critical
                    ? 'var(--color-s8)'
                    : hot
                      ? 'var(--color-s4)'
                      : 'var(--color-ink-4)',
                }}
              />
            </span>
            <span
              className={`shrink-0 font-mono text-[9.5px] tabular-nums ${
                hot ? 'text-ink-2' : 'text-ink-4'
              }`}
            >
              {wait}/{AGING_THRESHOLD}
            </span>
          </div>
        ) : (
          <div className="text-ink-4 mt-0.5 font-mono text-[9.5px] tabular-nums">
            {done ? (
              `tat ${p.turnaroundTime}`
            ) : running ? (
              `${p.remainingTime} ms left`
            ) : (
              <span className={critical ? 'text-s8' : ''}>waited {wait} ms</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
