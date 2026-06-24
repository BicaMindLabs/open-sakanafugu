import { describe, expect, it } from 'vitest';

import { MemoryFileSystem } from '../../infra/memory-file-system.js';
import { systemClock } from '../../infra/clock.js';
import { FsWorkspaceStore } from './fs-workspace-store.js';

const CODE_WS = [
  '# code station',
  'prompt: You are at the code station. Write tests.',
  'models: @bench:code',
  'tools: read,edit,write,bash',
  'skills:',
  'memory: event,experience',
  '',
].join('\n');

const seed = async (): Promise<FsWorkspaceStore> => {
  const fs = new MemoryFileSystem(systemClock);
  await fs.write('/ws/code.workspace', CODE_WS);
  await fs.write('/ws/review.workspace', 'prompt: review\ntools: read\n');
  await fs.write('/ws/_system.md', 'GLOBAL RULES\n');
  await fs.write('/ws/notes.txt', 'ignore me');
  return new FsWorkspaceStore(fs, '/ws');
};

describe('FsWorkspaceStore', () => {
  it('parses a .workspace file into a Workspace', async () => {
    const store = await seed();
    const ws = await store.get('code');
    expect(ws).toEqual({
      name: 'code',
      prompt: 'You are at the code station. Write tests.',
      models: '@bench:code',
      tools: ['read', 'edit', 'write', 'bash'],
      skills: [],
      memory: ['event', 'experience'],
    });
  });

  it('returns null for a missing workspace', async () => {
    expect(await (await seed()).get('nope')).toBeNull();
  });

  it('lists workspace names (stripped, sorted) and ignores other files', async () => {
    expect(await (await seed()).list()).toEqual(['code', 'review']);
  });

  it('reads the global system prompt, or "" when absent', async () => {
    expect(await (await seed()).systemPrompt()).toBe('GLOBAL RULES\n');
    const empty = new FsWorkspaceStore(new MemoryFileSystem(systemClock), '/empty');
    expect(await empty.systemPrompt()).toBe('');
  });
});
