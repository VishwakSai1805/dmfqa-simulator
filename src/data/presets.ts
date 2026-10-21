import type { ProcessInput } from '../engine/types';
import { colorAt } from '../lib/palette';
const mk = (rows: Array<[string, number, number]>): ProcessInput[] =>
  rows.map(([id, arrivalTime, burstTime], i) => ({
    id,
    arrivalTime,
    burstTime,
    color: colorAt(i),
  }));

export interface Preset {
  key: string;
  name: string;
  blurb: string;
  processes: ProcessInput[];
}

export const PRESETS: Preset[] = [
  {
    key: 'benchmark',
    name: 'Standard Benchmark',
    blurb: 'Four short jobs. Small enough to verify the engine against hand calculation.',
    processes: mk([
      ['P1', 0, 8],
      ['P2', 1, 4],
      ['P3', 2, 9],
      ['P4', 3, 5],
    ]),
  },
  {
    key: 'cascade',
    name: 'Demotion Cascade',
    blurb: 'P1 walks Q0 → Q1 → Q2 under DMFQ-A while the short jobs clear ahead of it.',
    processes: mk([
      ['P1', 0, 20],
      ['P2', 2, 2],
      ['P3', 4, 3],
    ]),
  },
  {
    key: 'starvation',
    name: 'Starvation Showcase',
    blurb:
      'A sustained arrival train (4ms of work every 3ms, offered load > 1.0) saturates Q0 ' +
      'and strands the long-running Q2 resident. Three arrivals would not starve anything.',
    processes: mk([
      ['P1', 0, 24],
      ['P2', 2, 4],
      ['P3', 5, 4],
      ['P4', 8, 4],
      ['P5', 11, 4],
      ['P6', 14, 4],
      ['P7', 17, 4],
      ['P8', 20, 4],
      ['P9', 23, 4],
    ]),
  },
];

export const DEFAULT_PRESET_KEY = 'benchmark';
