import type { Workspace } from './workspace.js';

/**
 * The structured, layered context fed to a station's agent (Zleap "layers"):
 * a typed bundle, not string concatenation. Rendered to text by `renderBundle`.
 */
export interface PromptBundle {
  readonly name: string;
  readonly system: string;
  readonly workspace: string;
  readonly tools: readonly string[];
  readonly skills: readonly string[];
  readonly memory: readonly string[];
  /** Reusable methods recalled for this station (experience memory). */
  readonly experience: readonly string[];
  readonly history: string;
  readonly task?: string;
  readonly models: string;
}

/** Inputs to assemble a bundle. IO (read workspace/system, recall experience) is the caller's job. */
export interface AssembleInput {
  readonly workspace: Workspace;
  readonly system: string;
  readonly task?: string;
  readonly experience?: readonly string[];
  readonly history?: string;
}
