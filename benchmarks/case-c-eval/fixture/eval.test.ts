import { describe, expect, it } from 'vitest';

import { aggregateResults, formatMetricsTable } from './eval.js';
import type { EvalRunResult } from './eval.js';

const r = (
  taskId: string,
  mode: 'orchestrated' | 'single',
  resolved: boolean,
  rounds = 1,
  wallMs = 100,
  tokens = 50,
): EvalRunResult => ({ taskId, mode, resolved, rounds, wallMs, tokens });

describe('aggregateResults', () => {
  it('computes per-mode resolved rate and averages', () => {
    const results = [
      r('t1', 'orchestrated', true, 2, 200, 60),
      r('t2', 'orchestrated', false, 4, 400, 140),
      r('t1', 'single', true),
      r('t2', 'single', true),
    ];
    const metrics = aggregateResults(results, ['orchestrated', 'single']);
    const orch = metrics.perMode.find((p) => p.mode === 'orchestrated');
    expect(orch?.total).toBe(2);
    expect(orch?.resolved).toBe(1);
    expect(orch?.resolvedRate).toBe(0.5);
    expect(orch?.avgRounds).toBe(3);
    expect(orch?.avgWallMs).toBe(300);
    expect(orch?.totalTokens).toBe(200);
    const single = metrics.perMode.find((p) => p.mode === 'single');
    expect(single?.resolvedRate).toBe(1);
  });

  it('picks the winner by resolved rate', () => {
    const metrics = aggregateResults(
      [r('t1', 'orchestrated', true), r('t1', 'single', false)],
      ['orchestrated', 'single'],
    );
    expect(metrics.winner).toBe('orchestrated');
  });

  it('breaks resolved-rate ties by fewer avg rounds', () => {
    const metrics = aggregateResults(
      [r('t1', 'orchestrated', true, 3), r('t1', 'single', true, 1)],
      ['orchestrated', 'single'],
    );
    expect(metrics.winner).toBe('single');
  });

  it('breaks further ties by fewer total tokens', () => {
    const metrics = aggregateResults(
      [r('t1', 'orchestrated', true, 1, 100, 80), r('t1', 'single', true, 1, 100, 30)],
      ['orchestrated', 'single'],
    );
    expect(metrics.winner).toBe('single');
  });

  it('returns null winner when there are no results', () => {
    expect(aggregateResults([], ['orchestrated', 'single']).winner).toBeNull();
  });

  it('still lists a mode that has zero results (rate 0)', () => {
    const metrics = aggregateResults([r('t1', 'single', true)], ['orchestrated', 'single']);
    const orch = metrics.perMode.find((p) => p.mode === 'orchestrated');
    expect(orch?.total).toBe(0);
    expect(orch?.resolvedRate).toBe(0);
  });
});

describe('formatMetricsTable', () => {
  it('renders a header and one row per mode, mentioning resolved', () => {
    const metrics = aggregateResults([r('t1', 'orchestrated', true)], ['orchestrated']);
    const table = formatMetricsTable(metrics);
    expect(table.toLowerCase()).toContain('mode');
    expect(table).toContain('orchestrated');
    expect(table.toLowerCase()).toContain('resolved');
    expect(table.split('\n').length).toBeGreaterThanOrEqual(2);
  });
});
