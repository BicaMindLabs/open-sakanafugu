import type { Ownership, OwnershipRule } from './ownership.js';

/** Index of the `]` closing a bracket class opened at `open`, or -1 if unterminated. */
const classEnd = (glob: string, open: number): number => {
  let j = open + 1;
  if (glob[j] === '!') j += 1;
  if (glob[j] === ']') j += 1; // a ']' right after '[' (or '[!') is a literal member
  while (j < glob.length && glob[j] !== ']') j += 1;
  return j < glob.length ? j : -1;
};

/**
 * bash `case`-glob → regex, bracket-aware: outside a class `*`→any (incl `/`),
 * `?`→one char; inside `[...]` those are literal (bash semantics). `[!…]`→`[^…]`.
 */
const globToRegex = (glob: string): string => {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i] ?? '';
    if (ch === '[') {
      const end = classEnd(glob, i);
      if (end === -1) {
        out += '\\['; // unterminated '[' → literal
        continue;
      }
      const raw = glob.slice(i + 1, end);
      const body = raw.startsWith('!') ? `^${raw.slice(1)}` : raw;
      out += `[${body.replace(/\\/gu, '\\\\')}]`; // class members are literal regex-side
      i = end;
    } else if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += ch.replace(/[.+^${}()|\\]/u, '\\$&');
  }
  return out;
};

/**
 * Match a path against a single glob with bash `case`-glob semantics: `*` spans
 * `/`, `?` is one char, `[...]` classes/ranges supported. Anchored.
 */
export const matchGlob = (file: string, glob: string): boolean => {
  try {
    return new RegExp(`^${globToRegex(glob)}$`, 'u').test(file);
  } catch {
    return file === glob; // defensive: malformed glob → literal match
  }
};

const isUnrestricted = (rule: OwnershipRule): boolean =>
  rule.owned.length === 0 || rule.owned.includes('*');

/** Files this agent should not have changed: matched a forbidden glob, or fell outside its owned globs. */
export const violatingFiles = (
  rule: OwnershipRule | undefined,
  changed: readonly string[],
): readonly string[] => {
  if (rule === undefined) return []; // unlisted agent = unrestricted
  return changed.filter((file) => {
    if (rule.forbidden.some((glob) => matchGlob(file, glob))) return true;
    if (isUnrestricted(rule)) return false;
    return !rule.owned.some((glob) => matchGlob(file, glob));
  });
};

/** Convenience: look up an agent's rule in an Ownership map and check its changed files. */
export const checkOwnership = (
  ownership: Ownership,
  agent: string,
  changed: readonly string[],
): readonly string[] => violatingFiles(ownership.get(agent), changed);
