import type { Artifact } from '../../domain/artifact.js';
import type { ResultStore } from '../../domain/ports/result-store.js';

export class InMemoryResultStore implements ResultStore {
  readonly #artifactsByKey = new Map<string, readonly Artifact[]>();

  put(key: string, artifacts: readonly Artifact[]): Promise<void> {
    this.#artifactsByKey.set(key, [...artifacts]);
    return Promise.resolve();
  }

  get(key: string): Promise<readonly Artifact[] | null> {
    const artifacts = this.#artifactsByKey.get(key);
    return Promise.resolve(artifacts === undefined ? null : [...artifacts]);
  }

  keys(): Promise<readonly string[]> {
    return Promise.resolve([...this.#artifactsByKey.keys()]);
  }
}
