import type { Barrier } from '../domain/ports/barrier.js';
import type { Deadline, RoundManifest } from '../domain/round.js';
import { isComplete } from '../domain/round.js';

export async function waitForRound(
  barrier: Barrier,
  round: number,
  opts: {
    readonly deadline: Deadline;
    readonly now: () => number;
    readonly sleep: (ms: number) => Promise<void>;
    readonly pollMs: number;
  },
): Promise<RoundManifest> {
  for (;;) {
    const manifest = await barrier.inspect(round);
    if (manifest !== null && isComplete(manifest)) return manifest;
    // One clock (opts.now) owns the deadline decision; settle then guarantees
    // every still-pending key becomes terminal (timeout), so the result is final.
    if (opts.now() > opts.deadline) return await barrier.settle(round);
    await opts.sleep(opts.pollMs);
  }
}
