import type { Rng } from './rng.js';

export const seededRng = (seed: number): Rng => {
  let state = seed >>> 0;

  return {
    next: (): number => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
};
