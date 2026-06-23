import { describe, it, expect } from 'vitest';
import { Mutex } from './mutex.js';

describe('Mutex', () => {
  it('serializes critical sections — no interleaving across await points', async () => {
    const m = new Mutex();
    const log: string[] = [];
    const section = (id: string): Promise<void> =>
      m.run(async () => {
        log.push(`${id}-start`);
        await Promise.resolve();
        await Promise.resolve();
        log.push(`${id}-end`);
      });

    await Promise.all([section('a'), section('b'), section('c')]);

    expect(log).toEqual(['a-start', 'a-end', 'b-start', 'b-end', 'c-start', 'c-end']);
  });

  it('a rejecting section does not wedge the lock', async () => {
    const m = new Mutex();
    await expect(m.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(m.run(() => Promise.resolve(42))).resolves.toBe(42);
  });

  it('returns the section result', async () => {
    const m = new Mutex();
    await expect(m.run(() => Promise.resolve('x'))).resolves.toBe('x');
  });
});
