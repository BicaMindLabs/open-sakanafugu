/**
 * A workspace = a named context "station" (Zleap-Agent idea): each task type gets
 * only the prompt, tools, skills, and memory scope it should see — a weak model
 * is never handed the whole world.
 */
export interface Workspace {
  readonly name: string;
  readonly prompt: string;
  readonly tools: readonly string[];
  readonly skills: readonly string[];
  /** Memory scopes this station may read (e.g. event, experience). */
  readonly memory: readonly string[];
  /** Raw model spec (e.g. "@bench:code" or "a,b,c"); resolution is the allocator's job. */
  readonly models: string;
}
