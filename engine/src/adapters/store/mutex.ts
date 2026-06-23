/**
 * A minimal async mutex: serializes `run()` critical sections so an interleaved
 * load-mutate-save (at `await` points) can't lose an update.
 *
 * Scope: single-writer-per-process. Concurrent *processes* writing the same file
 * are out of scope (one run == one process; resume is a sequential restart, not
 * concurrent access).
 */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    // Chain after whatever is queued, regardless of how it settled.
    const result = this.tail.then(fn, fn);
    // Keep the chain alive but swallow errors so one failure doesn't wedge the lock.
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
