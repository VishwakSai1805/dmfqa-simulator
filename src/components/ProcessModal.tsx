import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ProcessInput } from '../engine/types';
import { assignBaselineQueue } from '../engine/baselineScheduler';
import { colorAt, styleAt, swatchBackground } from '../lib/palette';
import type { DraftRow } from '../lib/validation';
import { LIMITS, toDraftRows, toProcessInputs, validateAll } from '../lib/validation';

interface Props {
  open: boolean;
  initial: ProcessInput[];
  onClose: () => void;
  onApply: (processes: ProcessInput[]) => void;
}

let keySeq = 0;
const newKey = () => `row-${keySeq++}`;

const field =
  'h-7 w-full rounded border bg-canvas px-2 font-mono text-[11.5px] text-ink outline-none transition focus:border-accent';

export function ProcessModal({ open, initial, onClose, onApply }: Props) {
  const [rows, setRows] = useState<DraftRow[]>(() => toDraftRows(initial));
  const [seen, setSeen] = useState(false);

  if (open && !seen) {
    setSeen(true);
    setRows(toDraftRows(initial));
  }
  if (!open && seen) setSeen(false);

  const { errors, formError } = useMemo(() => validateAll(rows), [rows]);
  const valid = !formError && errors.every((e) => Object.keys(e).length === 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (key: string, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((rs) =>
      rs.length >= LIMITS.MAX_PROCESSES
        ? rs
        : [
            ...rs,
            {
              key: newKey(),
              id: `P${rs.length + 1}`,
              arrivalTime: '0',
              burstTime: '5',
              initialQueueOverride: '',
              color: colorAt(rs.length),
            },
          ],
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="border-line bg-surface flex max-h-full w-full max-w-[720px] flex-col rounded-lg border shadow-2xl">
        <header className="border-line flex shrink-0 items-start justify-between gap-6 border-b px-5 py-3.5">
          <div>
            <h2 className="text-ink text-[13.5px] font-semibold">Custom workload</h2>
            <p className="text-ink-3 mt-1 max-w-[520px] text-[11.5px] leading-[1.6]">
              Whole numbers only — arrival {LIMITS.MIN_AT}–{LIMITS.MAX_AT} ms, burst {LIMITS.MIN_BT}–
              {LIMITS.MAX_BT} ms, up to {LIMITS.MAX_PROCESSES} processes. The queue override applies
              to the <span className="text-ink-2">baseline engine only</span>; DMFQ-A admits every
              process to Q0 by definition. Left on auto, admission follows the static rule
              (bt ≤ 4 → Q0, bt ≤ 12 → Q1, else Q2).
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-4 hover:bg-raised hover:text-ink shrink-0 rounded p-1 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-ink-4 text-[10.5px]">
                <th className="w-6 pb-1.5" />
                <th className="pb-1.5 text-left font-normal">Process</th>
                <th className="w-[110px] pb-1.5 pl-2 text-left font-normal">Arrival</th>
                <th className="w-[110px] pb-1.5 pl-2 text-left font-normal">Burst</th>
                <th className="w-[150px] pb-1.5 pl-2 text-left font-normal">Baseline queue</th>
                <th className="w-8 pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const e = errors[i] ?? {};
                const bt = Number(r.burstTime);
                const autoQ = Number.isFinite(bt) && bt > 0 ? assignBaselineQueue(bt) : null;
                return (
                  <tr key={r.key} className="align-top">
                    <td className="py-1">
                      <span
                        className="mt-2 inline-block h-2.5 w-2.5 rounded-[2px]"
                        style={{ background: swatchBackground(styleAt(i)) }}
                      />
                    </td>
                    <td className="py-1">
                      <input
                        className={`${field} ${e.id ? 'border-s8' : 'border-line'}`}
                        value={r.id}
                        onChange={(ev) => update(r.key, { id: ev.target.value })}
                      />
                      {e.id && <p className="text-s8 mt-1 text-[10px]">{e.id}</p>}
                    </td>
                    <td className="py-1 pl-2">
                      <input
                        className={`${field} ${e.arrivalTime ? 'border-s8' : 'border-line'}`}
                        value={r.arrivalTime}
                        onChange={(ev) => update(r.key, { arrivalTime: ev.target.value })}
                      />
                      {e.arrivalTime && <p className="text-s8 mt-1 text-[10px]">{e.arrivalTime}</p>}
                    </td>
                    <td className="py-1 pl-2">
                      <input
                        className={`${field} ${e.burstTime ? 'border-s8' : 'border-line'}`}
                        value={r.burstTime}
                        onChange={(ev) => update(r.key, { burstTime: ev.target.value })}
                      />
                      {e.burstTime && <p className="text-s8 mt-1 text-[10px]">{e.burstTime}</p>}
                    </td>
                    <td className="py-1 pl-2">
                      <select
                        className={`${field} border-line`}
                        value={r.initialQueueOverride}
                        onChange={(ev) =>
                          update(r.key, {
                            initialQueueOverride:
                              ev.target.value as DraftRow['initialQueueOverride'],
                          })
                        }
                      >
                        <option value="" className="bg-surface">
                          auto{autoQ !== null ? ` — Q${autoQ}` : ''}
                        </option>
                        <option value="0" className="bg-surface">force Q0</option>
                        <option value="1" className="bg-surface">force Q1</option>
                        <option value="2" className="bg-surface">force Q2</option>
                      </select>
                    </td>
                    <td className="py-1">
                      <button
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        className="text-ink-4 hover:bg-raised hover:text-s8 mt-0.5 rounded p-1.5 transition"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            onClick={addRow}
            disabled={rows.length >= LIMITS.MAX_PROCESSES}
            className="border-line text-ink-2 hover:border-line-strong hover:text-ink mt-2.5 inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-[11.5px] transition disabled:pointer-events-none disabled:opacity-35"
          >
            <Plus className="h-3.5 w-3.5" />
            Add process
            <span className="text-ink-4">
              {rows.length}/{LIMITS.MAX_PROCESSES}
            </span>
          </button>
        </div>

        <footer className="border-line flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3">
          <span className="text-s8 text-[11.5px]">{formError ?? ''}</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="border-line text-ink-2 hover:border-line-strong hover:text-ink h-8 rounded border px-3 text-[12px] transition"
            >
              Cancel
            </button>
            <button
              disabled={!valid}
              onClick={() => {
                onApply(toProcessInputs(rows));
                onClose();
              }}
              className="bg-accent h-8 rounded px-3.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-35"
            >
              Run
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
