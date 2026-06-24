/**
 * Orchestrator-side ownership (Lynn): we don't trust a worker's self-discipline —
 * before integrating, we check what files it actually changed against its grant.
 */
export interface OwnershipRule {
  /** Globs the agent may touch. Empty or `['*']` = unrestricted. */
  readonly owned: readonly string[];
  /** Globs the agent must NOT touch (takes precedence over owned). */
  readonly forbidden: readonly string[];
}

/** agent → its ownership rule. An agent absent from the map is unrestricted. */
export type Ownership = ReadonlyMap<string, OwnershipRule>;
