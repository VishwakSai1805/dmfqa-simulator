import type { ProcessInput, QueueId } from '../engine/types';

export const LIMITS = {
  MAX_PROCESSES: 15,
  MIN_AT: 0,
  MAX_AT: 500,
  MIN_BT: 1,
  MAX_BT: 100,
} as const;

export interface DraftRow {
  key: string;
  id: string;
  arrivalTime: string;
  burstTime: string;
  initialQueueOverride: '' | '0' | '1' | '2';
  color: string;
}

export type RowErrors = Partial<Record<'id' | 'arrivalTime' | 'burstTime', string>>;

const INT_RE = /^-?\d+$/;

function checkInt(raw: string, label: string, min: number, max: number): string | undefined {
  const s = raw.trim();
  if (s === '') return `${label} is required`;
  if (!INT_RE.test(s)) return `${label} must be a whole number`;
  const n = Number(s);
  if (!Number.isFinite(n)) return `${label} must be numeric`;
  if (n < min || n > max) return `${label} must be ${min}–${max}`;
  return undefined;
}

export function validateRow(row: DraftRow, allRows: DraftRow[]): RowErrors {
  const errors: RowErrors = {};

  const id = row.id.trim();
  if (id === '') errors.id = 'ID is required';
  else if (id.length > 6) errors.id = 'ID must be ≤ 6 characters';
  else if (allRows.filter((r) => r.id.trim().toUpperCase() === id.toUpperCase()).length > 1)
    errors.id = 'ID must be unique';

  const at = checkInt(row.arrivalTime, 'Arrival', LIMITS.MIN_AT, LIMITS.MAX_AT);
  if (at) errors.arrivalTime = at;

  const bt = checkInt(row.burstTime, 'Burst', LIMITS.MIN_BT, LIMITS.MAX_BT);
  if (bt) errors.burstTime = bt;

  return errors;
}

export function validateAll(rows: DraftRow[]): { errors: RowErrors[]; formError: string | null } {
  const errors = rows.map((r) => validateRow(r, rows));
  let formError: string | null = null;
  if (rows.length === 0) formError = 'Add at least one process.';
  else if (rows.length > LIMITS.MAX_PROCESSES)
    formError = `Maximum ${LIMITS.MAX_PROCESSES} processes.`;
  return { errors, formError };
}

export function toProcessInputs(rows: DraftRow[]): ProcessInput[] {
  return rows.map((r) => ({
    id: r.id.trim(),
    arrivalTime: Number(r.arrivalTime),
    burstTime: Number(r.burstTime),
    color: r.color,
    ...(r.initialQueueOverride !== ''
      ? { initialQueueOverride: Number(r.initialQueueOverride) as QueueId }
      : {}),
  }));
}

export function toDraftRows(processes: ProcessInput[]): DraftRow[] {
  return processes.map((p, i) => ({
    key: `${p.id}-${i}`,
    id: p.id,
    arrivalTime: String(p.arrivalTime),
    burstTime: String(p.burstTime),
    initialQueueOverride:
      p.initialQueueOverride === undefined
        ? ''
        : (String(p.initialQueueOverride) as '0' | '1' | '2'),
    color: p.color,
  }));
}
