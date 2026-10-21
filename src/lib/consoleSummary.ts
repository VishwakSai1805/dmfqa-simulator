import { runBaseline } from '../engine/baselineScheduler';
import { runDmfqa } from '../engine/dmfqaScheduler';
import { PRESETS } from '../data/presets';

/**
 * Prints the metrics each engine ACTUALLY produces for every preset. Nothing here is
 * a target or an expectation — if a figure looks unflattering for DMFQ-A, that is the
 * result, and it is reported as-is.
 */
export function printPresetSummary(): void {
  /* eslint-disable no-console */
  console.groupCollapsed(
    '%cDMFQ-A Simulator · computed preset metrics',
    'color:#38bdf8;font-weight:600',
  );
  for (const preset of PRESETS) {
    const rows = (
      [
        ['Baseline', runBaseline(preset.processes)],
        ['DMFQ-A', runDmfqa(preset.processes)],
      ] as const
    ).map(([name, r]) => ({
      Engine: name,
      'Avg TAT': +r.metrics.avgTAT.toFixed(2),
      'Avg WT': +r.metrics.avgWT.toFixed(2),
      'Avg RT': +r.metrics.avgRT.toFixed(2),
      CS: r.metrics.totalContextSwitches,
      Starvation: r.metrics.starvationIncidents,
      Makespan: r.metrics.makespan,
      'CPU %': +(r.metrics.cpuUtilization * 100).toFixed(1),
      'Worst wait': Math.max(...r.finalProcesses.map((p) => p.maxContinuousWait)),
    }));
    console.groupCollapsed(preset.name);
    console.table(rows);
    console.groupEnd();
  }
  console.groupEnd();
  /* eslint-enable no-console */
}
