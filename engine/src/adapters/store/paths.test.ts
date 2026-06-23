import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { fileKey, joinPath } from './paths.js';
import { MemoryFileSystem } from '../../infra/memory-file-system.js';
import { FsResultStore } from './fs-result-store.js';
import type { Artifact } from '../../domain/artifact.js';
import { systemClock } from '../../infra/clock.js';

describe('joinPath', () => {
  it('joins with a single slash and tolerates trailing slashes', () => {
    expect(joinPath('a/b', 'c.json')).toBe('a/b/c.json');
    expect(joinPath('a/b/', 'c.json')).toBe('a/b/c.json');
    expect(joinPath('', 'c.json')).toBe('c.json');
  });
});

describe('fileKey', () => {
  it('is deterministic for the same key', () => {
    expect(fileKey('round/1')).toBe(fileKey('round/1'));
  });

  it('keeps a readable, sanitized prefix', () => {
    expect(fileKey('round/1')).toMatch(/^round_1-[0-9a-f]{32}\.json$/u);
  });

  it('does not collide for keys that sanitize alike', () => {
    expect(fileKey('a/b')).not.toBe(fileKey('a_b'));
    expect(fileKey('a:b')).not.toBe(fileKey('a/b'));
  });

  it('distinct keys map to distinct filenames (property)', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        if (a === b) return true;
        return fileKey(a) !== fileKey(b);
      }),
    );
  });
});

describe('FsResultStore key collisions', () => {
  it('round-trips keys that sanitize to the same prefix', async () => {
    const store = new FsResultStore(new MemoryFileSystem(systemClock), '/results');
    const art = (id: string): Artifact => ({ id, kind: 'log', uri: `mem://${id}`, sha256: id });

    await store.put('a/b', [art('slash')]);
    await store.put('a_b', [art('underscore')]);

    expect(await store.get('a/b')).toEqual([art('slash')]);
    expect(await store.get('a_b')).toEqual([art('underscore')]);
    expect((await store.keys()).slice().sort()).toEqual(['a/b', 'a_b']);
  });
});
