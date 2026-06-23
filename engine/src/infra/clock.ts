/** Injected time source — lets barrier timeouts and decay be tested deterministically. */
export interface Clock {
  /** Current time in epoch milliseconds. */
  now(): number;
}

/** Production clock. Adapters/tests inject a fake instead. */
export const systemClock: Clock = { now: () => Date.now() };
