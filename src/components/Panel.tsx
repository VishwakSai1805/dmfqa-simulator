import type { ReactNode } from 'react';

interface PanelProps {
  title?: string;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * A region of the page, separated by a hairline rather than boxed in a card.
 * Headings are sentence case at text weight — the content is what should carry
 * visual weight, not eight identical uppercase labels.
 */
export function Panel({
  title,
  meta,
  right,
  children,
  className = '',
  bodyClassName = '',
}: PanelProps) {
  return (
    <section className={`flex h-full min-h-0 min-w-0 flex-col ${className}`}>
      {title && (
        <header className="flex h-7 shrink-0 items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="text-ink-2 shrink-0 text-[11.5px] font-medium whitespace-nowrap">
              {title}
            </h2>
            {meta && <span className="text-ink-4 min-w-0 truncate text-[11px]">{meta}</span>}
          </div>
          {right}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex cursor-help items-center">
      {children}
      <span className="border-line-strong bg-raised text-ink-2 pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 hidden w-64 rounded border px-2.5 py-1.5 text-[11px] leading-[1.5] font-normal normal-case shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

/** A count that deserves its own reading, not a bar on a shared axis. */
export function StatTile({
  label,
  values,
  note,
}: {
  label: string;
  values: Array<{ name: string; value: string; color: string; better?: boolean }>;
  note?: string;
}) {
  return (
    <div className="border-line min-w-0 flex-1 rounded border px-2.5 py-1.5">
      <div className="text-ink-3 truncate text-[10.5px]">{label}</div>
      <div className="mt-1 flex items-baseline gap-3">
        {values.map((v) => (
          <span key={v.name} className="flex items-baseline gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-[1px]"
              style={{ background: v.color }}
            />
            <span
              className={`font-mono text-[15px] tabular-nums ${
                v.better ? 'text-ink font-medium' : 'text-ink-2'
              }`}
            >
              {v.value}
            </span>
          </span>
        ))}
      </div>
      {note && <div className="text-ink-4 mt-0.5 truncate text-[10px]">{note}</div>}
    </div>
  );
}
