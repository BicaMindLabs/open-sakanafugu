import { describe, expect, it } from 'vitest';

import type { Barrier } from '../domain/ports/barrier.js';
import type { RoundManifest } from '../domain/round.js';
import { stateOf } from '../domain/round.js';
import type { TaskState } from '../domain/task.js';
import { waitForRound } from './wait-for-round.js';

class FakeBarrier implements Barrier {
  private manifest: RoundManifest | null = null;

  open(round: number, expected: readonly string[]): Promise<void> {
    this.manifest = { round, expected: [...expected], states: {} };
    return Promise.resolve();
  }

  mark(round: number, key: string, state: TaskState): Promise<void> {
    const manifest = this.require(round);
    this.manifest = { ...manifest, states: { ...manifest.states, [key]: state } };
    return Promise.resolve();
  }

  inspect(round: number): Promise<RoundManifest | null> {
    return Promise.resolve(this.manifest?.round === round ? this.manifest : null);
  }

  settle(round: number): Promise<RoundManifest> {
    const manifest = this.require(round);
    const states: Record<string, TaskState> = { ...manifest.states };

    for (const key of manifest.expected) {
      if (stateOf(manifest, key) === 'pending') states[key] = 'timeout';
    }

    this.manifest = { ...manifest, states };
    return Promise.resolve(this.manifest);
  }

  private require(round: number): RoundManifest {
    if (this.manifest === null || this.manifest.round !== round)
      throw new Error(`Round ${round} was never opened`);
    return this.manifest;
  }
}

describe('waitForRound', () => {
  it('completes when marks make the round complete', async () => {
    const now = 0;
    const barrier = new FakeBarrier();

    await barrier.open(1, ['a', 'b']);
    await barrier.mark(1, 'a', 'done');

    const manifest = await waitForRound(barrier, 1, {
      deadline: 100,
      now: () => now,
      pollMs: 5,
      sleep: () => barrier.mark(1, 'b', 'done'),
    });

    expect(stateOf(manifest, 'a')).toBe('done');
    expect(stateOf(manifest, 'b')).toBe('done');
  });

  it('settles and returns timeouts when now advances past the deadline', async () => {
    let now = 0;
    const barrier = new FakeBarrier();

    await barrier.open(1, ['a', 'b']);
    await barrier.mark(1, 'a', 'done');

    const manifest = await waitForRound(barrier, 1, {
      deadline: 100,
      now: () => now,
      pollMs: 5,
      sleep: () => {
        now = 101;
        return Promise.resolve();
      },
    });

    expect(stateOf(manifest, 'a')).toBe('done');
    expect(stateOf(manifest, 'b')).toBe('timeout');
  });
});
