import type { ProcessInput, QueueId, SimulationResult } from './types';
import { runSimulation } from './core';

/**
 * Static MLQ admission rule.
 *
 * The static MLQ models a system that classifies jobs by their *declared* burst
 * length at admission — short/interactive to Q0, medium to Q1, long/batch to Q2 —
 * and never revises that judgment for the life of the process. That inability to
 * revise is exactly what DMFQ-A fixes: a misclassified job in the static system
 * stays misclassified forever, while DMFQ-A discovers a job's real behaviour by
 * running it and moves it accordingly.
 *
 * Without this rule the baseline admits everything to Q0 as well, the two engines
 * collapse into nearly the same algorithm, and the comparison means nothing.
 */
export function assignBaselineQueue(bt: number): QueueId {
  if (bt <= 4) return 0;
  if (bt <= 12) return 1;
  return 2;
}

/**
 * Baseline (Static MLQ): queue fixed at arrival, no demotion, no aging.
 * Quantum expiry re-queues at the tail of the SAME tier.
 */
export function runBaseline(processes: ProcessInput[]): SimulationResult {
  return runSimulation(processes, {
    engine: 'baseline',
    assignInitialQueue: (p) => p.initialQueueOverride ?? assignBaselineQueue(p.burstTime),
    agingEnabled: false,
    onQuantumExpiry: (q) => q,
  });
}
