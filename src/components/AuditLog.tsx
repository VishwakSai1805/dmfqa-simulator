import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimulationResult } from '../engine/types';
import { Panel } from './Panel';

const TYPES = [
  'ARRIVAL',
  'DISPATCH',
  'PREEMPTION',
  'QUANTUM EXPIRY',
  'DEMOTION',
  'AGING TRIGGER',
  'REQUEUE',
  'TERMINATION',
  'IDLE',
] as const;

type EventType = (typeof TYPES)[number];

/** Events that change a process's tier get the one accent; everything else is ink.
 *  The log is a transcript, not a colour chart. */
const ACCENTED: ReadonlySet<EventType> = new Set(['AGING TRIGGER', 'DEMOTION', 'PREEMPTION']);

const SHORT: Record<EventType, string> = {
  ARRIVAL: 'arrive',
  DISPATCH: 'dispatch',
  PREEMPTION: 'preempt',
  'QUANTUM EXPIRY': 'quantum',
  DEMOTION: 'demote',
  'AGING TRIGGER': 'age',
  REQUEUE: 'requeue',
  TERMINATION: 'exit',
  IDLE: 'idle',
};

function typeOf(entry: string): EventType {
  const body = entry.slice(entry.indexOf('] ') + 2);
  const tag = body.slice(0, body.indexOf(':'));
  return (TYPES as readonly string[]).includes(tag) ? (tag as EventType) : 'DISPATCH';
}

const split = (entry: string) => {
  const close = entry.indexOf('] ');
  const body = entry.slice(close + 2);
  const colon = body.indexOf(': ');
  return {
    time: entry.slice(3, close - 2),
    tag: body.slice(0, colon),
    rest: body.slice(colon + 2),
  };
};

interface Props {
  result: SimulationResult;
  index: number;
}

export function AuditLog({ result, index }: Props) {
  const [filter, setFilter] = useState<EventType | 'ALL'>('ALL');
  const [follow, setFollow] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  const entries = useMemo(() => {
    const out: Array<{ text: string; type: EventType }> = [];
    for (let i = 0; i <= index && i < result.snapshots.length; i++) {
      for (const e of result.snapshots[i].events) out.push({ text: e, type: typeOf(e) });
    }
    return filter === 'ALL' ? out : out.filter((e) => e.type === filter);
  }, [result, index, filter]);

  useEffect(() => {
    if (follow) endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length, follow]);

  const present = useMemo(() => {
    const s = new Set<EventType>();
    for (const snap of result.snapshots) for (const e of snap.events) s.add(typeOf(e));
    return s;
  }, [result]);

  return (
    <Panel
      title="Event log"
      meta={`${entries.length} · to ${index} ms`}
      right={
        <label className="text-ink-4 hover:text-ink-3 flex cursor-pointer items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
            className="accent-accent h-3 w-3"
          />
          follow
        </label>
      }
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="border-line flex shrink-0 flex-wrap gap-1 border-y px-3 py-1.5">
        <Chip active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="all" />
        {TYPES.filter((t) => present.has(t)).map((t) => (
          <Chip key={t} active={filter === t} onClick={() => setFilter(t)} label={SHORT[t]} />
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-1.5">
        {entries.length === 0 ? (
          <p className="text-ink-4 py-6 text-center text-[11px]">Nothing logged yet.</p>
        ) : (
          entries.map((e, i) => {
            const { time, tag, rest } = split(e.text);
            return (
              <div key={i} className="flex gap-2 py-[1px] font-mono text-[10.5px] leading-[1.55]">
                <span className="text-ink-4 w-9 shrink-0 text-right tabular-nums">{time}</span>
                <span
                  className={`w-[52px] shrink-0 ${
                    ACCENTED.has(e.type) ? 'text-accent' : 'text-ink-4'
                  }`}
                >
                  {SHORT[typeOf(e.text)]}
                </span>
                <span className="text-ink-2 min-w-0 break-words">{rest || tag}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </Panel>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
        active ? 'bg-raised text-ink' : 'text-ink-4 hover:text-ink-2 hover:bg-raised/60'
      }`}
    >
      {label}
    </button>
  );
}
