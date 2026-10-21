import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GanttBlock, ProcessInput, SimulationResult } from '../engine/types';
import { ENGINE_COLOR, styleMap, swatchBackground } from '../lib/palette';
import { Panel } from './Panel';

const RULER_H = 20;
const PAD = 1;

interface Props {
  primary: SimulationResult;
  primaryLabel: string;
  primaryKey: 'baseline' | 'dmfqa';
  secondary: SimulationResult;
  secondaryLabel: string;
  secondaryKey: 'baseline' | 'dmfqa';
  currentTime: number;
  processes: ProcessInput[];
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 900, h: 260 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

export function GanttChart({
  primary,
  primaryLabel,
  primaryKey,
  secondary,
  secondaryLabel,
  secondaryKey,
  currentTime,
  processes,
}: Props) {
  const { ref, w, h } = useSize<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const styles = useMemo(() => styleMap(processes), [processes]);
  const span = Math.max(primary.metrics.makespan, secondary.metrics.makespan, 1);
  const pxPerMs = Math.max(6, Math.min(220, (w - 24) / span));
  const chartW = span * pxPerMs + PAD * 2;

  // Both strips grow to fill whatever vertical room the panel is given.
  const avail = h - RULER_H - 34;
  const barH = Math.max(18, Math.min(132, Math.floor(avail / 2) - 12));

  const yA = 12;
  const yRuler = yA + barH;
  const yB = yRuler + RULER_H + 16;
  const svgH = yB + barH + 6;

  const blocksA = primary.snapshots[primary.snapshots.length - 1]?.gantt ?? [];
  const blocksB = secondary.snapshots[secondary.snapshots.length - 1]?.gantt ?? [];

  let step = 1;
  for (const c of [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]) {
    step = c;
    if (c * pxPerMs >= 42) break;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const x = PAD + currentTime * pxPerMs;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 60) {
      el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), behavior: 'smooth' });
    }
  }, [currentTime, pxPerMs]);

  const strip = (blocks: GanttBlock[], y: number, dim: boolean) =>
    blocks.map((b, i) => {
      const x = PAD + b.startTime * pxPerMs;
      // 2px surface gap between adjacent fills so segment edges read cleanly.
      const wBar = Math.max(1, (b.endTime - b.startTime) * pxPerMs - 2);
      const common = {
        onMouseMove: (e: React.MouseEvent) =>
          setTip({
            x: e.nativeEvent.offsetX,
            y: e.nativeEvent.offsetY,
            text:
              b.processId === 'IDLE'
                ? `idle · ${b.startTime}→${b.endTime} ms`
                : `${b.processId} · Q${b.queueId} · ${b.startTime}→${b.endTime} ms`,
          }),
        onMouseLeave: () => setTip(null),
      };

      if (b.processId === 'IDLE') {
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={wBar}
            height={barH}
            rx={3}
            fill="url(#idle)"
            opacity={dim ? 0.45 : 0.9}
            {...common}
          />
        );
      }

      const st = styles.get(b.processId);
      const color = st?.color ?? '#8a8880';
      return (
        <g key={i} opacity={dim ? 0.4 : 1}>
          <rect x={x} y={y} width={wBar} height={barH} rx={3} fill={color} {...common} />
          {st?.textured && (
            <rect
              x={x}
              y={y}
              width={wBar}
              height={barH}
              rx={3}
              fill="url(#hatch)"
              pointerEvents="none"
            />
          )}
          {wBar > 22 && (
            <text
              x={x + wBar / 2}
              y={y + barH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#131312"
              fontSize={Math.min(12, Math.max(9, barH / 4))}
              fontWeight={600}
              pointerEvents="none"
            >
              {b.processId}
            </text>
          )}
          {wBar > 22 && barH >= 44 && (
            <text
              x={x + wBar / 2}
              y={y + barH - 7}
              textAnchor="middle"
              fill="#131312"
              fontSize={9}
              opacity={0.65}
              pointerEvents="none"
            >
              Q{b.queueId}
            </text>
          )}
        </g>
      );
    });

  const playX = PAD + currentTime * pxPerMs;

  return (
    <Panel
      title="Timeline"
      meta={`${span} ms makespan`}
      right={
        <div className="text-ink-3 flex items-center gap-3 text-[11px]">
          <Key color={ENGINE_COLOR[primaryKey]} label={primaryLabel} />
          <Key color={ENGINE_COLOR[secondaryKey]} label={secondaryLabel} dim />
        </div>
      }
      bodyClassName="min-h-0 flex flex-col"
    >
      <div ref={ref} className="min-h-0 flex-1 px-3">
        <div ref={scrollRef} className="relative h-full overflow-x-auto overflow-y-hidden">
          <svg width={chartW} height={svgH} className="block">
            <defs>
              <pattern
                id="idle"
                width={7}
                height={7}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width={7} height={7} fill="#212120" />
                <line x1={0} y1={0} x2={0} y2={7} stroke="#3a3a36" strokeWidth={2.5} />
              </pattern>
              <pattern
                id="hatch"
                width={6}
                height={6}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1={0} y1={0} x2={0} y2={6} stroke="#131312" strokeWidth={2.5} opacity={0.42} />
              </pattern>
            </defs>

            <text x={PAD} y={8} fill="#7e7c74" fontSize={9.5}>
              {primaryLabel.toUpperCase()}
            </text>
            {strip(blocksA, yA, false)}

            {Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => i * step).map((t) => (
              <g key={t}>
                <line
                  x1={PAD + t * pxPerMs}
                  x2={PAD + t * pxPerMs}
                  y1={yRuler + 3}
                  y2={yRuler + 7}
                  stroke="#3a3a36"
                />
                <text
                  x={PAD + t * pxPerMs}
                  y={yRuler + 17}
                  textAnchor="middle"
                  fontSize={9.5}
                  fill="#7e7c74"
                  fontFamily="ui-monospace, monospace"
                >
                  {t}
                </text>
              </g>
            ))}

            <text x={PAD} y={yB - 4} fill="#7e7c74" fontSize={9.5}>
              {secondaryLabel.toUpperCase()}
            </text>
            {strip(blocksB, yB, true)}

            <line
              x1={playX}
              x2={playX}
              y1={2}
              y2={svgH - 2}
              stroke="#f2f1ec"
              strokeWidth={1}
              opacity={0.75}
            />
          </svg>

          {tip && (
            <div
              className="border-line-strong bg-raised text-ink-2 pointer-events-none absolute z-30 rounded border px-2 py-1 font-mono text-[10.5px] whitespace-nowrap shadow-lg"
              style={{ left: tip.x + 12, top: Math.max(0, tip.y - 26) }}
            >
              {tip.text}
            </div>
          )}
        </div>
      </div>

      <div className="text-ink-3 flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-1 px-3 pt-1.5 pb-2 text-[10.5px]">
        {processes.map((p, i) => {
          const st = styles.get(p.id)!;
          return (
            <span key={p.id} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-[1px]"
                style={{ background: swatchBackground(st) }}
              />
              {p.id}
              {i >= 8 && <span className="text-ink-4">(hatched)</span>}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <span className="border-line-strong bg-raised inline-block h-2 w-2 rounded-[1px] border" />
          idle
        </span>
      </div>
    </Panel>
  );
}

function Key({ color, label, dim }: { color: string; label: string; dim?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-[1px]"
        style={{ background: color, opacity: dim ? 0.4 : 1 }}
      />
      {label}
      {dim && <span className="text-ink-4">(reference)</span>}
    </span>
  );
}
