import type {
  ExperienceSourceKind,
  ExperienceTrustFilter,
  FailureCause,
  Method,
} from './experience.js';

/**
 * Retrieval-quality evaluation for the experience recall surface. These are
 * pure functions over an eval case (a query + the slugs it *should* retrieve)
 * and the methods recall actually returned — no IO, no CLI concerns — so the
 * precision/recall/F1/MRR math is independently testable. The CLI `experience
 * eval` command only wires the store and serializes the result.
 */
export interface ExperienceEvalCase {
  readonly id: string;
  readonly query: string;
  readonly expectedSlugs: readonly string[];
  readonly limit?: number;
  readonly minScore?: number;
  readonly failureCause?: FailureCause;
  readonly sourceKind?: ExperienceSourceKind;
  readonly sourceRef?: string;
  readonly trust?: ExperienceTrustFilter;
  readonly maxAgeSeconds?: number;
  readonly includeSuperseded?: boolean;
}

export interface ExperienceEvalCaseResult {
  readonly id: string;
  readonly query: string;
  readonly expectedSlugs: readonly string[];
  readonly retrievedSlugs: readonly string[];
  readonly relevantRetrieved: readonly string[];
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly hit: boolean;
  readonly mrr: number;
  readonly passed: boolean;
}

export interface ExperienceEvalSummary {
  readonly workspace: string;
  readonly caseCount: number;
  readonly passed: number;
  readonly failed: number;
  readonly meanPrecision: number;
  readonly meanRecall: number;
  readonly meanF1: number;
  readonly hitRate: number;
  readonly meanMrr: number;
  readonly cases: readonly ExperienceEvalCaseResult[];
}

/** Ranked retrieval metrics for one query against its expected slug set. */
export interface EvalMetrics {
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly hit: boolean;
  readonly mrr: number;
  readonly relevantRetrieved: readonly string[];
}

/** Quantize a metric to 6 decimals so JSON output and assertions stay stable. */
export const roundMetric = (value: number): number => Number(value.toFixed(6));

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Precision / recall / F1 / MRR for a single ranked retrieval. `retrievedSlugs`
 * is in rank order (MRR uses the position of the first relevant hit). Metrics
 * are unrounded here; callers round at the edge via `roundMetric`.
 */
export const calculateEvalMetrics = (
  expectedSlugs: Iterable<string>,
  retrievedSlugs: readonly string[],
): EvalMetrics => {
  const expected = expectedSlugs instanceof Set ? expectedSlugs : new Set(expectedSlugs);
  const relevantRetrieved = retrievedSlugs.filter((slug) => expected.has(slug));
  const precision =
    retrievedSlugs.length === 0 ? 0 : relevantRetrieved.length / retrievedSlugs.length;
  const recall = expected.size === 0 ? 0 : relevantRetrieved.length / expected.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const firstRelevantIndex = retrievedSlugs.findIndex((slug) => expected.has(slug));
  const mrr = firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1);
  return { precision, recall, f1, hit: relevantRetrieved.length > 0, mrr, relevantRetrieved };
};

/** Score one eval case against the methods recall returned for it. */
export const evalCaseResult = (
  evalCase: ExperienceEvalCase,
  methods: readonly Method[],
): ExperienceEvalCaseResult => {
  const retrievedSlugs = methods.map((method) => method.slug);
  const metrics = calculateEvalMetrics(evalCase.expectedSlugs, retrievedSlugs);
  return {
    id: evalCase.id,
    query: evalCase.query,
    expectedSlugs: evalCase.expectedSlugs,
    retrievedSlugs,
    relevantRetrieved: metrics.relevantRetrieved,
    precision: roundMetric(metrics.precision),
    recall: roundMetric(metrics.recall),
    f1: roundMetric(metrics.f1),
    hit: metrics.hit,
    mrr: roundMetric(metrics.mrr),
    passed: metrics.precision === 1 && metrics.recall === 1,
  };
};

/** Aggregate per-case results into a workspace-level summary. */
export const evalSummary = (
  workspace: string,
  cases: readonly ExperienceEvalCaseResult[],
): ExperienceEvalSummary => {
  const passed = cases.filter((entry) => entry.passed).length;
  return {
    workspace,
    caseCount: cases.length,
    passed,
    failed: cases.length - passed,
    meanPrecision: roundMetric(mean(cases.map((entry) => entry.precision))),
    meanRecall: roundMetric(mean(cases.map((entry) => entry.recall))),
    meanF1: roundMetric(mean(cases.map((entry) => entry.f1))),
    hitRate: roundMetric(mean(cases.map((entry) => (entry.hit ? 1 : 0)))),
    meanMrr: roundMetric(mean(cases.map((entry) => entry.mrr))),
    cases,
  };
};
