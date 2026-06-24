import { describe, expect, it } from 'vitest';

import type { Workspace } from './workspace.js';
import { assembleContext, renderBundle, renderTemplate } from './prompt-render.js';

const ws: Workspace = {
  name: 'code',
  prompt: 'You are at the code station.',
  tools: ['read', 'edit', 'write'],
  skills: [],
  memory: ['event', 'experience'],
  models: '@bench:code',
};

describe('renderTemplate', () => {
  it('replaces set keys and leaves unset placeholders verbatim', () => {
    expect(renderTemplate('hi {{NAME}}, do {{TASK}}', { NAME: 'leo' })).toBe('hi leo, do {{TASK}}');
  });

  it('replaces every occurrence and treats values literally (no regex specials)', () => {
    expect(renderTemplate('{{A}}-{{A}}', { A: '$1.*' })).toBe('$1.*-$1.*');
  });
});

describe('assembleContext', () => {
  it('maps workspace fields and applies defaults', () => {
    const bundle = assembleContext({ workspace: ws, system: 'SYS' });
    expect(bundle.name).toBe('code');
    expect(bundle.system).toBe('SYS');
    expect(bundle.workspace).toBe('You are at the code station.');
    expect(bundle.tools).toEqual(['read', 'edit', 'write']);
    expect(bundle.experience).toEqual([]);
    expect(bundle.history).toMatch(/conversation rounds/u);
    expect('task' in bundle).toBe(false); // exactOptional: omitted, not undefined
  });

  it('sets task only when provided', () => {
    expect(assembleContext({ workspace: ws, system: 'SYS', task: 'do X' }).task).toBe('do X');
  });
});

describe('renderBundle', () => {
  it('renders the full layered context exactly', () => {
    const bundle = assembleContext({
      workspace: { ...ws, skills: ['testing'] },
      system: 'SYS',
      task: 'implement foo',
      experience: ['method: cache first'],
    });
    expect(renderBundle(bundle)).toBe(
      [
        '## Context — workspace: code',
        '',
        '### System Prompt',
        'SYS',
        '',
        '### Workspace Prompt',
        'You are at the code station.',
        '',
        '### Tools',
        'read edit write  (only this station enabled, the rest not exposed)',
        'skills: testing',
        '',
        '### Memory',
        'scope: event,experience  (only memory relevant to this scope, not the full archive)',
        '',
        'method: cache first',
        '',
        '### History',
        'last few conversation rounds + key execution trace (not the full transcript)',
        '',
        '### Task',
        'implement foo',
        '',
        '> suggested model(bench): @bench:code',
        '',
      ].join('\n'),
    );
  });

  it('keeps exactly one blank line when system has a trailing newline (file parity)', () => {
    const bundle = assembleContext({ workspace: { ...ws, models: '' }, system: 'RULES\n' });
    expect(renderBundle(bundle)).toContain('### System Prompt\nRULES\n\n### Workspace Prompt');
    expect(renderBundle(bundle)).not.toContain('RULES\n\n\n');
  });

  it('omits skills/experience/task and the model line when empty', () => {
    const bundle = assembleContext({ workspace: { ...ws, models: '' }, system: 'SYS' });
    const text = renderBundle(bundle);
    expect(text).not.toMatch(/skills:/u);
    expect(text).not.toMatch(/### Task/u);
    expect(text).not.toMatch(/suggested model/u);
    expect(text.endsWith('(not the full transcript)\n')).toBe(true);
  });
});
