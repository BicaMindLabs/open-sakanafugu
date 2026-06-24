import { describe, expect, it } from 'vitest';

import { checkOwnership, matchGlob, violatingFiles } from './ownership-check.js';
import type { Ownership, OwnershipRule } from './ownership.js';

describe('matchGlob', () => {
  it('* spans path separators (bash case-glob)', () => {
    expect(matchGlob('src/a.ts', 'src/*.ts')).toBe(true);
    expect(matchGlob('src/deep/a.ts', 'src/*.ts')).toBe(true); // * crosses '/'
    expect(matchGlob('lib/a.ts', 'src/*.ts')).toBe(false);
  });

  it('? matches one char; specials are literal', () => {
    expect(matchGlob('a.ts', 'a.t?')).toBe(true);
    expect(matchGlob('package.json', 'package.json')).toBe(true);
    expect(matchGlob('packageXjson', 'package.json')).toBe(false); // '.' is literal
  });

  it('supports bracket character classes and ranges (bash case-glob)', () => {
    expect(matchGlob('src/a.ts', 'src/[ab].ts')).toBe(true);
    expect(matchGlob('src/c.ts', 'src/[ab].ts')).toBe(false);
    expect(matchGlob('secret5.env', 'secret[0-9].env')).toBe(true);
    expect(matchGlob('x.ts', '[!y].ts')).toBe(true); // negated class
  });

  it('treats * and ? as literal inside a bracket class (bash semantics)', () => {
    expect(matchGlob('a?.ts', 'a[?].ts')).toBe(true); // [?] matches a literal '?'
    expect(matchGlob('ax.ts', 'a[?].ts')).toBe(false); // not any char
    expect(matchGlob('a*.ts', 'a[*].ts')).toBe(true); // [*] matches a literal '*'
    expect(matchGlob('aXY.ts', 'a[*].ts')).toBe(false);
  });

  it('falls back to literal match on a malformed glob (no crash)', () => {
    expect(matchGlob('a[b', 'a[b')).toBe(true);
    expect(matchGlob('ax', 'a[b')).toBe(false);
  });
});

describe('violatingFiles', () => {
  const rule = (owned: string[], forbidden: string[]): OwnershipRule => ({ owned, forbidden });

  it('flags files outside the owned globs', () => {
    expect(violatingFiles(rule(['src/*'], []), ['src/a.ts', 'docs/x.md'])).toEqual(['docs/x.md']);
  });

  it('flags forbidden files even within owned', () => {
    expect(violatingFiles(rule(['*'], ['*.env']), ['src/a.ts', 'secret.env'])).toEqual([
      'secret.env',
    ]);
  });

  it('treats empty or "*" owned as unrestricted', () => {
    expect(violatingFiles(rule([], []), ['anything/x'])).toEqual([]);
    expect(violatingFiles(rule(['*'], []), ['anything/x'])).toEqual([]);
  });

  it('an unlisted agent (undefined rule) is unrestricted', () => {
    expect(violatingFiles(undefined, ['whatever'])).toEqual([]);
  });
});

describe('checkOwnership', () => {
  it('looks up the agent rule in the map', () => {
    const ownership: Ownership = new Map([['coder', { owned: ['src/*'], forbidden: [] }]]);
    expect(checkOwnership(ownership, 'coder', ['src/a.ts', 'README.md'])).toEqual(['README.md']);
    expect(checkOwnership(ownership, 'other', ['README.md'])).toEqual([]); // not listed
  });
});
