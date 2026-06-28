import type {
  AddMethod,
  ExperienceError,
  Method,
  PromoteMethod,
  RecallOptions,
} from '../experience.js';
import type { Result } from '../result.js';

/**
 * Stores + recalls reusable methods, bucketed by workspace. `add` redacts
 * (rejects bodies with a plaintext key); `recall` returns the most recent,
 * query-filtered methods for context injection.
 */
export interface ExperienceStore {
  add(method: AddMethod): Promise<Result<Method, ExperienceError>>;
  promote(method: PromoteMethod): Promise<Result<Method, ExperienceError>>;
  /** Most-recent-first, optionally filtered by a fixed-substring query, capped at limit (default 3). */
  recall(workspace: string, options?: RecallOptions): Promise<readonly Method[]>;
  /** All methods (optionally scoped to one workspace). */
  list(workspace?: string): Promise<readonly Method[]>;
  get(workspace: string, slug: string): Promise<Method | null>;
}
