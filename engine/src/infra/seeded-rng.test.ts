import { describe, expect, it } from 'vitest';

import { seededRng } from './seeded-rng.js';
import { rankAgents } from '../domain/allocation-score.js';
import { DEFAULT_ALLOCATION_PARAMS, type BenchTable } from '../domain/allocation.js';

describe('seededRng', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const seqA = Array.from({ length: 6 }, () => a.next());
    const seqB = Array.from({ length: 6 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const r = seededRng(7);
    for (let i = 0; i < 200; i += 1) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    expect(seededRng(1).next()).not.toBe(seededRng(2).next());
  });
});

describe('Thompson sampling under seededRng', () => {
  const profileType = 'code';
  const bench: BenchTable = new Map([[profileType, ['a', 'b']]]);
  const sampledTop = (seed: number): string | undefined => {
    const rng = seededRng(seed);
    return rankAgents(profileType, bench, [], DEFAULT_ALLOCATION_PARAMS, {
      sample: true,
      random: () => rng.next(),
    })[0]?.agent;
  };

  it('is reproducible for the same seed', () => {
    const left = seededRng(123);
    const right = seededRng(123);
    const rankWith = (rng: ReturnType<typeof seededRng>) =>
      rankAgents(profileType, bench, [], DEFAULT_ALLOCATION_PARAMS, {
        sample: true,
        random: () => rng.next(),
      });
    expect(rankWith(left)).toEqual(rankWith(right));
  });

  it('explores: across many seeds the sampled top-1 is not always the greedy winner', () => {
    const greedyWinner = rankAgents(profileType, bench, [], DEFAULT_ALLOCATION_PARAMS, {
      sample: false,
      random: () => 0,
    })[0]?.agent;
    if (greedyWinner === undefined) throw new Error('expected a greedy winner');

    const winners = new Set<string>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const top = sampledTop(seed);
      if (top !== undefined) winners.add(top);
    }

    expect(winners.has(greedyWinner)).toBe(true);
    expect(winners.size).toBeGreaterThan(1);
  });
});
