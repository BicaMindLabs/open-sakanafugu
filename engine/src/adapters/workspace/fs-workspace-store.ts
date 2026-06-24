import type { WorkspaceStore } from '../../domain/ports/workspace-store.js';
import type { Workspace } from '../../domain/workspace.js';
import type { FileSystem } from '../../infra/file-system.js';
import { joinPath } from '../store/paths.js';

const WORKSPACE_EXT = '.workspace';

/** First line `<key>: value` → trimmed value (bash `field()` parity); '' if absent. */
const field = (lines: readonly string[], key: string): string => {
  const prefix = `${key}:`;
  for (const line of lines) {
    if (line.startsWith(prefix)) return line.slice(prefix.length).trim();
  }
  return '';
};

const csv = (value: string): readonly string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

/** Loads `<dir>/<name>.workspace` station defs + `<dir>/_system.md` from a FileSystem. */
export class FsWorkspaceStore implements WorkspaceStore {
  constructor(
    private readonly fs: FileSystem,
    private readonly dir: string,
  ) {}

  async get(name: string): Promise<Workspace | null> {
    const content = await this.fs.read(joinPath(this.dir, `${name}${WORKSPACE_EXT}`));
    if (content === null) return null;
    const lines = content.split(/\r?\n/u);
    return {
      name,
      prompt: field(lines, 'prompt'),
      tools: csv(field(lines, 'tools')),
      skills: csv(field(lines, 'skills')),
      memory: csv(field(lines, 'memory')),
      models: field(lines, 'models'),
    };
  }

  async list(): Promise<readonly string[]> {
    const entries = await this.fs.list(this.dir);
    return entries
      .filter((entry) => entry.endsWith(WORKSPACE_EXT))
      .map((entry) => entry.slice(0, -WORKSPACE_EXT.length))
      .sort();
  }

  async systemPrompt(): Promise<string> {
    return (await this.fs.read(joinPath(this.dir, '_system.md'))) ?? '';
  }
}
