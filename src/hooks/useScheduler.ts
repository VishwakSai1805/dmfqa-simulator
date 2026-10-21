import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineId, ProcessInput, SimulationResult } from '../engine/types';
import { runBaseline } from '../engine/baselineScheduler';
import { runDmfqa } from '../engine/dmfqaScheduler';

export const SPEEDS = [
  { label: '0.5×', ms: 640 },
  { label: '1×', ms: 320 },
  { label: '2×', ms: 160 },
  { label: '4×', ms: 70 },
  { label: 'Max', ms: 12 },
] as const;

const EMPTY: SimulationResult = {
  snapshots: [],
  finalProcesses: [],
  metrics: {
    avgTAT: 0,
    avgWT: 0,
    avgRT: 0,
    totalContextSwitches: 0,
    cpuUtilization: 0,
    starvationIncidents: 0,
    makespan: 0,
  },
};

export interface SchedulerApi {
  baseline: SimulationResult;
  dmfqa: SimulationResult;
  active: SimulationResult;
  other: SimulationResult;
  engine: EngineId;
  setEngine: (e: EngineId) => void;
  index: number;
  setIndex: (i: number) => void;
  maxIndex: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBack: () => void;
  reset: () => void;
  speedIndex: number;
  setSpeedIndex: (i: number) => void;
  error: string | null;
}

/**
 * The entire timeline for BOTH engines is precomputed whenever the input set
 * changes. Playback is pure index-scrubbing over a frozen SimulationSnapshot[] —
 * nothing is mutated during playback, which is what makes step-backward,
 * arbitrary scrubbing and instant full-run metrics possible.
 */
export function useScheduler(processes: ProcessInput[]): SchedulerApi {
  const [engine, setEngine] = useState<EngineId>('dmfqa');
  const [index, setIndexRaw] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);

  const { baseline, dmfqa, error } = useMemo(() => {
    try {
      return { baseline: runBaseline(processes), dmfqa: runDmfqa(processes), error: null };
    } catch (e) {
      return {
        baseline: EMPTY,
        dmfqa: EMPTY,
        error: e instanceof Error ? e.message : 'Unknown simulation failure',
      };
    }
  }, [processes]);

  const active = engine === 'baseline' ? baseline : dmfqa;
  const other = engine === 'baseline' ? dmfqa : baseline;
  const maxIndex = Math.max(0, active.snapshots.length - 1);

  // A new input set or a engine swap rewinds to T=0 and stops playback.
  useEffect(() => {
    setIndexRaw(0);
    setIsPlaying(false);
  }, [processes, engine]);

  const setIndex = useCallback(
    (i: number) => setIndexRaw(Math.max(0, Math.min(maxIndex, Math.round(i)))),
    [maxIndex],
  );

  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      if (indexRef.current >= maxIndex) {
        setIsPlaying(false);
        return;
      }
      setIndexRaw((i) => Math.min(maxIndex, i + 1));
    }, SPEEDS[speedIndex].ms);
    return () => window.clearInterval(id);
  }, [isPlaying, speedIndex, maxIndex]);

  const play = useCallback(() => {
    if (maxIndex === 0) return;
    if (indexRef.current >= maxIndex) setIndexRaw(0);
    setIsPlaying(true);
  }, [maxIndex]);

  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => (isPlaying ? pause() : play()), [isPlaying, pause, play]);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setIndexRaw((i) => Math.min(maxIndex, i + 1));
  }, [maxIndex]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    setIndexRaw((i) => Math.max(0, i - 1));
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setIndexRaw(0);
  }, []);

  return {
    baseline,
    dmfqa,
    active,
    other,
    engine,
    setEngine,
    index: Math.min(index, maxIndex),
    setIndex,
    maxIndex,
    isPlaying,
    play,
    pause,
    togglePlay,
    stepForward,
    stepBack,
    reset,
    speedIndex,
    setSpeedIndex,
    error,
  };
}
