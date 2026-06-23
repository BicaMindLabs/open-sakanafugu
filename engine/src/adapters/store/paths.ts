import { createHash } from 'node:crypto';

/** Join a dir and a name with a single '/', tolerating trailing slashes and a root dir. */
export const joinPath = (dir: string, name: string): string => {
  if (dir === '') return name;
  const root = dir.replace(/\/+$/u, '');
  return root === '' ? `/${name}` : `${root}/${name}`;
};

/** First 128 bits of sha256(key), hex — collision-resistant and deterministic. */
const digest = (key: string): string => createHash('sha256').update(key).digest('hex').slice(0, 32);

/**
 * A collision-resistant, human-readable filename for an arbitrary key.
 *
 * A readable sanitized prefix keeps files greppable, and a sha256 suffix over
 * the *original* key disambiguates keys that sanitize alike (e.g. `a/b` vs
 * `a_b`) or that share the first 64 sanitized chars. Collision probability is
 * cryptographically negligible (128-bit), so distinct keys get distinct files.
 */
export const fileKey = (key: string, ext = 'json'): string => {
  const safe = key.replace(/[^A-Za-z0-9_-]/gu, '_').slice(0, 64);
  return `${safe}-${digest(key)}.${ext}`;
};
