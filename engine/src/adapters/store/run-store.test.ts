import { describe, expect, it } from 'vitest';

import type { RunStore } from '../../domain/ports/run-store.js';
import type { RunEvent } from '../../domain/run.js';
import { MemoryFileSystem } from '../../infra/memory-file-system.js';
import { FsRunStore } from './fs-run-store.js';
import { InMemoryRunStore } from './in-memory-run-store.js';

const clock = { now: (): number => 1_000 };

const storeFactories: readonly [string, () => RunStore][] = [
  ['InMemoryRunStore', () => new InMemoryRunStore()],
  ['FsRunStore', () => new FsRunStore(new MemoryFileSystem(clock), '/runs')],
];

describe.each(storeFactories)('%s', (_name, makeStore) => {
  it('create then get returns the run snapshot', async () => {
    const store = makeStore();
    const created = await store.create('run-a', 'plan');

    expect(created).toEqual({ id: 'run-a', phase: 'plan', round: 0, events: [] });
    expect(await store.get('run-a')).toEqual(created);
  });

  it('patch updates only provided fields and preserves best absence', async () => {
    const store = makeStore();

    await store.create('run-a', 'plan');
    const patched = await store.patch('run-a', { phase: 'dispatch' });

    expect(patched).toEqual({ id: 'run-a', phase: 'dispatch', round: 0, events: [] });
    expect('best' in patched).toBe(false);
  });

  it('patch can set best and later sparse patches preserve it', async () => {
    const store = makeStore();

    await store.create('run-a', 'plan');
    await store.patch('run-a', { best: 'artifact-a' });
    const patched = await store.patch('run-a', { round: 2 });

    expect(patched).toEqual({
      id: 'run-a',
      phase: 'plan',
      round: 2,
      best: 'artifact-a',
      events: [],
    });
  });

  it('appendEvent appends in order', async () => {
    const store = makeStore();
    const first: RunEvent = { at: 1, phase: 'plan', kind: 'created' };
    const second: RunEvent = { at: 2, phase: 'dispatch', kind: 'started', detail: 'round 1' };

    await store.create('run-a', 'plan');
    await store.appendEvent('run-a', first);
    const run = await store.appendEvent('run-a', second);

    expect(run.events).toEqual([first, second]);
  });

  it('concurrent appendEvent does not lose events', async () => {
    const store = makeStore();
    await store.create('run-a', 'plan');
    const events: readonly RunEvent[] = Array.from({ length: 8 }, (_unused, i) => ({
      at: i,
      phase: 'dispatch',
      kind: `e${i}`,
    }));

    await Promise.all(events.map((event) => store.appendEvent('run-a', event)));

    const run = await store.get('run-a');
    expect(run?.events.length).toBe(8);
    expect(new Set(run?.events.map((event) => event.kind))).toEqual(
      new Set(events.map((event) => event.kind)),
    );
  });
});
