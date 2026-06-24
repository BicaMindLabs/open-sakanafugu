/**
 * Injected randomness — lets Thompson Sampling be tested deterministically
 * (seeded) and keeps `Math.random` out of domain/application code.
 */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
}

/** Production RNG backed by Math.random. Tests inject a seeded one instead. */
export const systemRng: Rng = { next: () => Math.random() };
