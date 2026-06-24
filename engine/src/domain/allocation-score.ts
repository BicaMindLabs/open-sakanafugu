import {
  UNLISTED_RANK,
  type AllocationOutcome,
  type AllocationParams,
  type BenchTable,
  type Ranking,
  type StrategyState,
} from './allocation.js';

interface Evidence {
  readonly s: number;
  readonly f: number;
}

interface RankedMutable {
  readonly agent: string;
  readonly score: number;
  readonly benchRank: number;
}

export const betaPrior = (index: number, listSize: number): number =>
  (listSize - index) / (listSize + 1);

/** Quantize to 6 decimals — the precision bash sorts on (printf "%.6f"). */
const q6 = (x: number): number => Math.round(x * 1e6);

export const applyOutcome = (state: StrategyState, outcome: AllocationOutcome): StrategyState => {
  let updated = false;
  const next = state.map((entry) => {
    if (entry.taskType !== outcome.taskType || entry.agent !== outcome.agent) return entry;
    updated = true;
    return {
      taskType: entry.taskType,
      agent: entry.agent,
      s: entry.s + (outcome.result === 'ok' ? 1 : 0),
      f: entry.f + (outcome.result === 'fail' ? 1 : 0),
    };
  });

  if (updated) return next;

  return [
    ...next,
    {
      taskType: outcome.taskType,
      agent: outcome.agent,
      s: outcome.result === 'ok' ? 1 : 0,
      f: outcome.result === 'fail' ? 1 : 0,
    },
  ];
};

export const decayState = (state: StrategyState, gamma: number, taskType?: string): StrategyState =>
  state.map((entry) => {
    if (taskType !== undefined && entry.taskType !== taskType) return entry;
    return { taskType: entry.taskType, agent: entry.agent, s: entry.s * gamma, f: entry.f * gamma };
  });

export const thompsonScore = (A: number, B: number, random: () => number): number => {
  const mean = A / (A + B);
  const variance = (A * B) / ((A + B) * (A + B) * (A + B + 1));
  const sd = Math.sqrt(variance);
  const z = Math.sqrt(-2 * Math.log(random() + 1e-12)) * Math.cos(2 * Math.PI * random());
  const value = mean + z * sd;
  return Math.min(1, Math.max(0, value));
};

export const rankAgents = (
  taskType: string,
  bench: BenchTable,
  state: StrategyState,
  params: AllocationParams,
  opts: { sample: boolean; random: () => number },
): Ranking => {
  const listed = bench.get(taskType) ?? [];
  const priorByAgent = new Map<string, number>();
  const rankByAgent = new Map<string, number>();
  const evidenceByAgent = new Map<string, Evidence>();
  const candidates = new Set<string>();

  for (const [index, agent] of listed.entries()) {
    priorByAgent.set(agent, betaPrior(index, listed.length));
    rankByAgent.set(agent, index + 1);
    candidates.add(agent);
  }

  for (const entry of state) {
    if (entry.taskType !== taskType) continue;
    evidenceByAgent.set(entry.agent, { s: entry.s, f: entry.f });
    candidates.add(entry.agent);
  }

  const ranked: RankedMutable[] = [];
  for (const agent of candidates) {
    const p0 = priorByAgent.get(agent) ?? params.unlistedPrior;
    const evidence = evidenceByAgent.get(agent) ?? { s: 0, f: 0 };
    const a0 = params.kappa * p0 + 1;
    const b0 = params.kappa * (1 - p0) + 1;
    const A = a0 + evidence.s;
    const B = b0 + evidence.f;
    ranked.push({
      agent,
      score: opts.sample ? thompsonScore(A, B, opts.random) : A / (A + B),
      benchRank: rankByAgent.get(agent) ?? UNLISTED_RANK,
    });
  }

  // bash ranks on the printf "%.6f" score, so scores equal to 6 decimals tie and
  // fall through to bench rank; quantize here to reproduce that exactly (raw
  // doubles would split a bash tie by float epsilon). Agent names compare by
  // codepoint to match bash `sort -k3` (byte order), not locale collation.
  return ranked.sort((left, right) => {
    const scoreOrder = q6(right.score) - q6(left.score);
    if (scoreOrder !== 0) return scoreOrder;
    const rankOrder = left.benchRank - right.benchRank;
    if (rankOrder !== 0) return rankOrder;
    if (left.agent < right.agent) return -1;
    if (left.agent > right.agent) return 1;
    return 0;
  });
};
