import { Pause, Play, RotateCcw, SkipBack, SkipForward, SlidersHorizontal } from 'lucide-react';
import type { SchedulerApi } from '../hooks/useScheduler';
import { SPEEDS } from '../hooks/useScheduler';
import { PRESETS } from '../data/presets';
import { ENGINE_COLOR } from '../lib/palette';
import { Tip } from './Panel';

interface Props {
  scheduler: SchedulerApi;
  activePresetKey: string | null;
  onPreset: (key: string) => void;
  onOpenSandbox: () => void;
  processCount: number;
}

const ghost =
  'inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-ink-2 transition hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-30';

export function Header({ activePresetKey, onPreset, onOpenSandbox, scheduler }: Props) {
  const { engine, setEngine } = scheduler;

  return (
    <div className="border-line flex h-12 shrink-0 items-center gap-6 border-b px-4">
      <div className="flex items-baseline gap-2.5">
        <span className="text-ink text-[13.5px] font-semibold tracking-tight">DMFQ-A</span>
        <span className="text-ink-3 text-[11.5px]">
          Static MLQ vs. dynamic multilevel feedback queue with aging
        </span>
      </div>

      <nav className="ml-auto flex items-center gap-0.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onPreset(p.key)}
            title={p.blurb}
            className={`h-7 rounded px-2.5 text-[12px] transition ${
              activePresetKey === p.key
                ? 'bg-raised text-ink'
                : 'text-ink-3 hover:text-ink-2 hover:bg-raised/60'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={onOpenSandbox}
          className={`ml-1 inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[12px] transition ${
            activePresetKey === null
              ? 'bg-raised text-ink'
              : 'text-ink-3 hover:text-ink-2 hover:bg-raised/60'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Custom
        </button>
      </nav>

      <div className="border-line flex h-7 overflow-hidden rounded border">
        {(['baseline', 'dmfqa'] as const).map((e) => (
          <button
            key={e}
            onClick={() => setEngine(e)}
            className={`flex items-center gap-1.5 px-2.5 text-[11.5px] transition ${
              engine === e ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-[1px]"
              style={{ background: ENGINE_COLOR[e], opacity: engine === e ? 1 : 0.4 }}
            />
            {e === 'dmfqa' ? 'DMFQ-A' : 'Baseline'}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Transport({ scheduler, processCount }: Props) {
  const {
    active,
    index,
    setIndex,
    maxIndex,
    isPlaying,
    togglePlay,
    stepForward,
    stepBack,
    reset,
    speedIndex,
    setSpeedIndex,
    engine,
  } = scheduler;

  const snap = active.snapshots[index];
  const running = snap?.runningProcess ?? null;

  return (
    <div className="border-line flex h-11 shrink-0 items-center gap-4 border-b px-4">
      <div className="flex items-center gap-0.5">
        <button className={ghost} onClick={reset} title="Reset to T=0">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button className={ghost} onClick={stepBack} disabled={index === 0} title="Step back (←)">
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button
          className={`${ghost} bg-raised text-ink w-[68px]`}
          onClick={togglePlay}
          disabled={maxIndex === 0}
          title="Play / pause (space)"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span className="text-[12px]">{isPlaying ? 'Pause' : 'Play'}</span>
        </button>
        <button
          className={ghost}
          onClick={stepForward}
          disabled={index >= maxIndex}
          title="Step forward (→)"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>

      <select
        value={speedIndex}
        onChange={(e) => setSpeedIndex(Number(e.target.value))}
        className="border-line text-ink-2 hover:text-ink focus:border-line-strong h-7 rounded border bg-transparent px-1.5 text-[11.5px] outline-none"
        title="Playback speed"
      >
        {SPEEDS.map((s, i) => (
          <option key={s.label} value={i} className="bg-surface">
            {s.label}
          </option>
        ))}
      </select>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="min-w-0 flex-1"
          aria-label="Timeline position"
        />
        <span className="text-ink-2 w-[92px] shrink-0 text-right font-mono text-[11.5px] tabular-nums">
          {index}
          <span className="text-ink-4"> / {maxIndex} ms</span>
        </span>
      </div>

      <div className="border-line text-ink-3 flex shrink-0 items-center gap-4 border-l pl-4 text-[11.5px]">
        <span className="flex items-center gap-1.5">
          CPU
          {running ? (
            <span className="text-ink-2 flex items-center gap-1.5 font-mono">
              <span
                className="inline-block h-2 w-2 rounded-[1px]"
                style={{ background: running.color }}
              />
              {running.id}
              <span className="text-ink-4">Q{running.currentQueue}</span>
            </span>
          ) : (
            <span className="text-ink-4 font-mono">idle</span>
          )}
        </span>
        <Tip text="Counted when the process occupying the CPU at tick T differs from the one at tick T−1 and both are real processes. Idle→process and process→idle transitions are not counted.">
          <span className="decoration-line-strong flex items-center gap-1.5 underline decoration-dotted underline-offset-2">
            switches
            <span className="text-ink-2 font-mono tabular-nums">{snap?.contextSwitches ?? 0}</span>
          </span>
        </Tip>
        <span className="flex items-center gap-1.5">
          done
          <span className="text-ink-2 font-mono tabular-nums">
            {snap?.terminated.length ?? 0}/{processCount}
          </span>
        </span>
        <span className="text-ink-4 font-mono">
          {engine === 'dmfqa' ? 'dynamic' : 'static'}
        </span>
      </div>
    </div>
  );
}
