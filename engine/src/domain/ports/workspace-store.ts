import type { Workspace } from '../workspace.js';

/** Loads workspace "station" definitions + the global system prompt (the workspaces/ dir). */
export interface WorkspaceStore {
  /** A workspace by name, or null if absent. */
  get(name: string): Promise<Workspace | null>;
  /** Names of all defined workspaces. */
  list(): Promise<readonly string[]>;
  /** The global system prompt shared by every station (_system.md), or '' if absent. */
  systemPrompt(): Promise<string>;
}
