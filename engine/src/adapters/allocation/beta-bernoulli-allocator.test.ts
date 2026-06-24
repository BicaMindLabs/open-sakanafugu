import { describe, expect, it } from 'vitest';

import type { BenchTable, StatEntry, StrategyState } from '../../domain/allocation.js';
import { MemoryFileSystem } from '../../infra/memory-file-system.js';
import { systemClock } from '../../infra/clock.js';
import { BetaBernoulliAllocator } from './beta-bernoulli-allocator.js';

const profile = { taskType: 'code' };

const bench: BenchTable = new Map([['code', ['a', 'b']]]);

const makeAllocator = (
  root = '/allocation',
  fs = new MemoryFileSystem(systemClock),
  table = bench,
): { readonly allocator: BetaBernoulliAllocator; readonly fs: MemoryFileSystem } => ({
  allocator: new BetaBernoulliAllocator(fs, root, table),
  fs,
});

const requireEntry = (state: StrategyState, agent: string): StatEntry => {
  const entry = state.find((candidate) => candidate.agent === agent);
  if (entry === undefined) throw new Error(`missing ${agent}`);
  return entry;
};

const requireScore = async (allocator: BetaBernoulliAllocator, agent: string): Promise<number> => {
  const ranked = await allocator.rank(profile);
  const entry = ranked.find((candidate) => candidate.agent === agent);
  if (entry === undefined) throw new Error(`missing ${agent}`);
  return entry.score;
};

describe('BetaBernoulliAllocator', () => {
  it('persists and round-trips stats.json', async () => {
    const { allocator, fs } = makeAllocator();

    await allocator.update({ taskType: 'code', agent: 'a', result: 'ok' });
    await allocator.update({ taskType: 'code', agent: 'b', result: 'fail' });

    const restored = new BetaBernoulliAllocator(fs, '/allocation', bench);

    expect(await restored.snapshot()).toEqual([
      { taskType: 'code', agent: 'a', s: 1, f: 0 },
      { taskType: 'code', agent: 'b', s: 0, f: 1 },
    ]);
  });

  it('update shifts the posterior toward winners', async () => {
    const { allocator } = makeAllocator();
    const before = await requireScore(allocator, 'b');

    for (let i = 0; i < 4; i += 1) {
      await allocator.update({ taskType: 'code', agent: 'b', result: 'ok' });
    }

    const after = await requireScore(allocator, 'b');
    const ranked = await allocator.rank(profile);

    expect(after).toBeGreaterThan(before);
    expect(ranked[0]?.agent).toBe('b');
  });

  it('decay reduces persisted evidence', async () => {
    const { allocator } = makeAllocator();

    await allocator.update({ taskType: 'code', agent: 'a', result: 'ok' });
    await allocator.update({ taskType: 'code', agent: 'a', result: 'ok' });
    await allocator.update({ taskType: 'code', agent: 'a', result: 'fail' });
    await allocator.decay(0.5);

    expect(requireEntry(await allocator.snapshot(), 'a')).toEqual({
      taskType: 'code',
      agent: 'a',
      s: 1,
      f: 0.5,
    });
  });

  it('concurrent update loses no evidence', async () => {
    const { allocator } = makeAllocator();
    const updates = [
      ...Array.from({ length: 50 }, () =>
        allocator.update({ taskType: 'code', agent: 'a', result: 'ok' }),
      ),
      ...Array.from({ length: 50 }, () =>
        allocator.update({ taskType: 'code', agent: 'a', result: 'fail' }),
      ),
    ];

    await Promise.all(updates);

    expect(requireEntry(await allocator.snapshot(), 'a')).toEqual({
      taskType: 'code',
      agent: 'a',
      s: 50,
      f: 50,
    });
  });

  it('rejects an invalid decay gamma (no negative/NaN counts persisted)', async () => {
    const { allocator } = makeAllocator();
    await allocator.update({ taskType: 'code', agent: 'a', result: 'ok' });

    await expect(allocator.decay(-0.5)).rejects.toThrow(/gamma/u);
    await expect(allocator.decay(Number.NaN)).rejects.toThrow(/gamma/u);
    await expect(allocator.decay(2)).rejects.toThrow(/gamma/u);

    // evidence untouched after the rejected calls
    expect(requireEntry(await allocator.snapshot(), 'a')).toEqual({
      taskType: 'code',
      agent: 'a',
      s: 1,
      f: 0,
    });
  });

  it('rank covers bench-listed agents plus seen agents', async () => {
    const { allocator } = makeAllocator();

    await allocator.update({ taskType: 'code', agent: 'z', result: 'ok' });

    expect(new Set((await allocator.rank(profile)).map((candidate) => candidate.agent))).toEqual(
      new Set(['a', 'b', 'z']),
    );
  });
});
