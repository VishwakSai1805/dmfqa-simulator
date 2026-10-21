import type { ProcessInput, QueueId, SimulationResult } from './types';
import { runSimulation } from './core';

/**
 * Enhanced (DMFQ-A): every process is admitted to Q0 regardless of declared burst
 * length — the scheduler makes no assumption about a job it has not run yet.
 *
 *  - Demotion: quantum exhausted without completing -> down one tier. Q2 is terminal.
 *  - Aging:    AGING_THRESHOLD ms of continuous wait in a tier -> up one tier.
 *
 * The Custom Sandbox's initial-queue override is intentionally ignored here:
 * admitting to Q0 is definitional for this architecture, not a tunable.
 */
export function runDmfqa(processes: ProcessInput[]): SimulationResult {
  return runSimulation(processes, {
    engine: 'dmfqa',
    assignInitialQueue: () => 0,
    agingEnabled: true,
    onQuantumExpiry: (q) => Math.min(q + 1, 2) as QueueId,
  });
}
