import type { GanttBlock, PerformanceMetrics, Process } from './types';
import { AGING_THRESHOLD } from './types';

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

export function computeMetrics(
  finalProcesses: Process[],
  gantt: GanttBlock[],
  totalContextSwitches: number,
): PerformanceMetrics {
  const makespan = gantt.length === 0 ? 0 : gantt[gantt.length - 1].endTime;
  const busyTicks = gantt
    .filter((b) => b.processId !== 'IDLE')
    .reduce((sum, b) => sum + (b.endTime - b.startTime), 0);

  return {
    avgTAT: mean(finalProcesses.map((p) => p.turnaroundTime)),
    avgWT: mean(finalProcesses.map((p) => p.waitingTime)),
    avgRT: mean(finalProcesses.map((p) => p.responseTime)),
    totalContextSwitches,
    cpuUtilization: makespan === 0 ? 0 : busyTicks / makespan,
    // Counted per PROCESS, not per event: a process that ever sat ready for a
    // continuous AGING_THRESHOLD ms without reaching the CPU contributes exactly 1.
    starvationIncidents: finalProcesses.filter((p) => p.maxContinuousWait >= AGING_THRESHOLD).length,
    makespan,
  };
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;
