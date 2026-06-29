import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import {
  DEFAULT_ALLOCATION_PARAMS,
  UNLISTED_RANK,
  type AllocationParams,
  type BenchTable,
  type StatEntry,
  type StrategyState,
} from './allocation.js';
import {
  applyOutcome,
  betaPrior,
  decayState,
  rankAgents,
  thompsonScore,
} from './allocation-score.js';

const profileType = 'code';
const noRandom = (): number => {
  throw new Error('random should not be used');
};

const rankGreedy = (
  bench: BenchTable,
  state: StrategyState,
  params: AllocationParams = DEFAULT_ALLOCATION_PARAMS,
) => rankAgents(profileType, bench, state, params, { sample: false, random: noRandom });

const agentNames = (ranked: ReturnType<typeof rankGreedy>): readonly string[] =>
  ranked.map((entry) => entry.agent);

const requireAgent = (ranked: ReturnType<typeof rankGreedy>, agent: string) => {
  const entry = ranked.find((candidate) => candidate.agent === agent);
  if (entry === undefined) throw new Error(`missing ${agent}`);
  return entry;
};

const agentArbitrary = fc.string({ minLength: 1, maxLength: 8 });
const benchAgentsArbitrary = fc.uniqueArray(agentArbitrary, { maxLength: 6 });
const stateArbitrary: fc.Arbitrary<StrategyState> = fc.array(
  fc.record<StatEntry>({
    taskType: fc.constantFrom(profileType, 'other'),
    agent: agentArbitrary,
    s: fc.integer({ min: 0, max: 20 }),
    f: fc.integer({ min: 0, max: 20 }),
  }),
  { maxLength: 12 },
);

describe('betaPrior', () => {
  it('matches the bash bench prior formula exactly', () => {
    expect(betaPrior(0, 3)).toBe(3 / 4);
    expect(betaPrior(1, 3)).toBe(2 / 4);
    expect(betaPrior(2, 3)).toBe(1 / 4);
  });
});

describe('rankAgents greedy scoring', () => {
  it('cold-start ranks exactly in bench order', () => {
    const bench: BenchTable = new Map([[profileType, ['a', 'b', 'c']]]);
    expect(agentNames(rankGreedy(bench, []))).toEqual(['a', 'b', 'c']);
  });

  it('matches a hand-computed posterior mean for a listed agent', () => {
    const bench: BenchTable = new Map([[profileType, ['a', 'b']]]);
    const state: StrategyState = [{ taskType: profileType, agent: 'a', s: 2, f: 1 }];

    const a = requireAgent(rankGreedy(bench, state), 'a');
    const A = 11 / 3 + 2;
    const B = 7 / 3 + 1;

    expect(a.score).toBe(A / (A + B));
    expect(a.score).toBeCloseTo(17 / 27, 15);
  });

  it('uses the unlisted prior for seen agents absent from the bench', () => {
    const bench: BenchTable = new Map([[profileType, ['a']]]);
    const state: StrategyState = [{ taskType: profileType, agent: 'z', s: 0, f: 0 }];

    const z = requireAgent(rankGreedy(bench, state), 'z');
    expect(z.benchRank).toBe(UNLISTED_RANK);
    expect(z.score).toBeCloseTo(4 / 15, 15);
  });

  it('breaks equal-score ties by bench rank, then agent name', () => {
    const bench: BenchTable = new Map([[profileType, ['b', 'a']]]);
    const state: StrategyState = [
      { taskType: profileType, agent: 'z', s: 0, f: 0 },
      { taskType: profileType, agent: 'c', s: 0, f: 0 },
    ];

    const ranked = rankGreedy(bench, state, { kappa: 0, unlistedPrior: 0.15 });
    expect(agentNames(ranked)).toEqual(['b', 'a', 'c', 'z']);
  });

  it('treats scores equal to 6 decimals as a tie (deterministic tolerance)', () => {
    const bench: BenchTable = new Map([[profileType, ['a', 'b']]]);
    // a (cold) = 11/18 and b (s=38,f=22) = 121/198 both round to 0.611111 → tie → bench rank
    const state: StrategyState = [{ taskType: profileType, agent: 'b', s: 38, f: 22 }];
    expect(agentNames(rankGreedy(bench, state))).toEqual(['a', 'b']);
  });

  it('breaks ties by codepoint, not locale collation', () => {
    const bench: BenchTable = new Map([[profileType, []]]); // all unlisted → equal score
    const state: StrategyState = [
      { taskType: profileType, agent: 'a', s: 0, f: 0 },
      { taskType: profileType, agent: 'B', s: 0, f: 0 },
    ];
    // codepoint: 'B'(0x42) < 'a'(0x61); locale collation would instead put 'a' first
    expect(agentNames(rankGreedy(bench, state))).toEqual(['B', 'a']);
  });
});

describe('state updates', () => {
  it('applyOutcome increments an existing row or appends a new one', () => {
    const state: StrategyState = [{ taskType: profileType, agent: 'a', s: 1, f: 2 }];

    const afterOk = applyOutcome(state, { taskType: profileType, agent: 'a', result: 'ok' });
    const afterFail = applyOutcome(afterOk, { taskType: profileType, agent: 'b', result: 'fail' });

    expect(afterOk).toEqual([{ taskType: profileType, agent: 'a', s: 2, f: 2 }]);
    expect(afterFail).toEqual([
      { taskType: profileType, agent: 'a', s: 2, f: 2 },
      { taskType: profileType, agent: 'b', s: 0, f: 1 },
    ]);
    expect(state).toEqual([{ taskType: profileType, agent: 'a', s: 1, f: 2 }]); // immutable
  });

  it('decayState discounts all rows or just one task type', () => {
    const state: StrategyState = [
      { taskType: profileType, agent: 'a', s: 2, f: 4 },
      { taskType: 'other', agent: 'a', s: 6, f: 8 },
    ];

    expect(decayState(state, 0.5, profileType)).toEqual([
      { taskType: profileType, agent: 'a', s: 1, f: 2 },
      { taskType: 'other', agent: 'a', s: 6, f: 8 },
    ]);
    expect(decayState(state, 0.5)).toEqual([
      { taskType: profileType, agent: 'a', s: 1, f: 2 },
      { taskType: 'other', agent: 'a', s: 3, f: 4 },
    ]);
  });
});

describe('thompsonScore', () => {
  it('clamps sampled values to [0, 1]', () => {
    expect(thompsonScore(1, 1, () => 0)).toBeGreaterThanOrEqual(0);
    expect(thompsonScore(1, 1, () => 0)).toBeLessThanOrEqual(1);
  });

  it('greedy ranking is deterministic and does not consume the rng', () => {
    const bench: BenchTable = new Map([[profileType, ['a', 'b']]]);
    expect(rankGreedy(bench, [])).toEqual(rankGreedy(bench, []));
  });
});

describe('rankAgents properties', () => {
  it('always returns scores in [0, 1]', () => {
    fc.assert(
      fc.property(benchAgentsArbitrary, stateArbitrary, (benchAgents, state) => {
        const bench: BenchTable = new Map([[profileType, benchAgents]]);
        for (const candidate of rankGreedy(bench, state)) {
          expect(candidate.score).toBeGreaterThanOrEqual(0);
          expect(candidate.score).toBeLessThanOrEqual(1);
        }
      }),
    );
  });

  it('cold-start order equals bench order', () => {
    fc.assert(
      fc.property(benchAgentsArbitrary, (benchAgents) => {
        const bench: BenchTable = new Map([[profileType, benchAgents]]);
        expect(agentNames(rankGreedy(bench, []))).toEqual(benchAgents);
      }),
    );
  });
});
