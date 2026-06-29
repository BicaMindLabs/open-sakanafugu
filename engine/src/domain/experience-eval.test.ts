import { describe, expect, it } from 'vitest';

import {
  calculateEvalMetrics,
  evalCaseResult,
  evalSummary,
  type ExperienceEvalCase,
} from './experience-eval.js';
import type { Method } from './experience.js';

const method = (slug: string): Method => ({
  workspace: 'w',
  title: slug,
  slug,
  created: 0,
  sourceKind: 'manual',
  trustKind: 'untrusted',
  body: '',
});

describe('calculateEvalMetrics', () => {
  it('scores a perfect single-hit retrieval', () => {
    const m = calculateEvalMetrics(['a'], ['a']);
    expect(m).toMatchObject({ precision: 1, recall: 1, f1: 1, hit: true, mrr: 1 });
    expect(m.relevantRetrieved).toEqual(['a']);
  });

  it('computes precision/recall when retrieval is partial', () => {
    // expected {a,b}, retrieved [a,x] => precision 1/2, recall 1/2, f1 1/2
    const m = calculateEvalMetrics(['a', 'b'], ['a', 'x']);
    expect(m.precision).toBeCloseTo(0.5);
    expect(m.recall).toBeCloseTo(0.5);
    expect(m.f1).toBeCloseTo(0.5);
    expect(m.hit).toBe(true);
  });

  it('uses the rank of the first relevant hit for MRR', () => {
    // first relevant ('b') at index 2 => mrr = 1/3
    const m = calculateEvalMetrics(['b'], ['x', 'y', 'b', 'z']);
    expect(m.mrr).toBeCloseTo(1 / 3);
  });

  it('returns zeros when nothing relevant is retrieved', () => {
    const m = calculateEvalMetrics(['a'], ['x', 'y']);
    expect(m).toMatchObject({ precision: 0, recall: 0, f1: 0, hit: false, mrr: 0 });
  });

  it('guards against divide-by-zero on empty retrieval and empty expectations', () => {
    expect(calculateEvalMetrics(['a'], [])).toMatchObject({ precision: 0, recall: 0, mrr: 0 });
    expect(calculateEvalMetrics([], ['x'])).toMatchObject({ precision: 0, recall: 0, f1: 0 });
  });

  it('accepts a Set as the expected slugs', () => {
    expect(calculateEvalMetrics(new Set(['a']), ['a']).recall).toBe(1);
  });
});

describe('evalCaseResult', () => {
  const evalCase: ExperienceEvalCase = { id: 'c1', query: 'q', expectedSlugs: ['a', 'b'] };

  it('derives retrieved slugs from methods and rounds metrics to 6 decimals', () => {
    const result = evalCaseResult(evalCase, [method('a'), method('c'), method('b')]);
    expect(result.retrievedSlugs).toEqual(['a', 'c', 'b']);
    expect(result.relevantRetrieved).toEqual(['a', 'b']);
    expect(result.precision).toBe(Number((2 / 3).toFixed(6)));
    expect(result.recall).toBe(1);
    expect(result.passed).toBe(false); // precision < 1
    expect(result.hit).toBe(true);
  });

  it('marks a case passed only on precision === 1 && recall === 1', () => {
    const result = evalCaseResult(evalCase, [method('a'), method('b')]);
    expect(result.passed).toBe(true);
  });
});

describe('evalSummary', () => {
  it('aggregates pass/fail counts and mean metrics', () => {
    const c1 = evalCaseResult({ id: 'c1', query: 'q', expectedSlugs: ['a'] }, [method('a')]);
    const c2 = evalCaseResult({ id: 'c2', query: 'q', expectedSlugs: ['b'] }, [method('x')]);
    const summary = evalSummary('w', [c1, c2]);
    expect(summary).toMatchObject({ caseCount: 2, passed: 1, failed: 1, workspace: 'w' });
    expect(summary.meanPrecision).toBe(0.5);
    expect(summary.hitRate).toBe(0.5);
  });

  it('returns zeroed means for an empty case set', () => {
    const summary = evalSummary('w', []);
    expect(summary).toMatchObject({ caseCount: 0, passed: 0, failed: 0, meanF1: 0, meanMrr: 0 });
  });
});
