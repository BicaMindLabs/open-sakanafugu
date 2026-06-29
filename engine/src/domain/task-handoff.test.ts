import { describe, expect, it } from 'vitest';

import { renderTaskHandoffPacket, taskHandoffPacket } from './task-handoff.js';

describe('taskHandoffPacket', () => {
  it('extracts a provenance-bearing handoff packet from a completed task', () => {
    const packet = taskHandoffPacket(
      [
        '# TASK-2026-06-29-023: Add task handoff packets',
        'Status: DONE',
        'Priority: P1',
        'Created: 2026-06-29 09:58',
        'Completed: 2026-06-29 10:20',
        '',
        '## Requirements',
        '- Preserve provenance.',
        '  - Emit JSON and Markdown.',
        '',
        '## Subtasks',
        '- [x] Implement parser',
        '- [x] Final Review (Reviewer: coder)',
        '',
        '## Output files',
        '- engine/src/domain/task-handoff.ts',
        '- README.md',
        '',
        '## Log',
        '- [2026-06-29 10:01] Gates green.',
        '- [2026-06-29 10:02] Reviewer approved.',
      ].join('\n'),
      { sourceRef: '/tmp/TASK.md', maxEvidence: 1 },
    );

    expect(packet).toEqual({
      taskId: 'TASK-2026-06-29-023',
      title: 'Add task handoff packets',
      status: 'DONE',
      priority: 'P1',
      created: '2026-06-29 09:58',
      completed: '2026-06-29 10:20',
      sourceRef: '/tmp/TASK.md',
      readiness: 'ready',
      acceptanceConditions: ['Preserve provenance.', 'Emit JSON and Markdown.'],
      checklist: [
        { text: 'Implement parser', checked: true },
        { text: 'Final Review (Reviewer: coder)', checked: true },
      ],
      handoffObjects: ['engine/src/domain/task-handoff.ts', 'README.md'],
      evidence: [{ at: '2026-06-29 10:02', text: 'Reviewer approved.' }],
      issues: [],
    });
  });

  it('flags invalid handoffs before downstream consumers rely on them', () => {
    const packet = taskHandoffPacket(
      [
        '# TASK-x: Thin task',
        'Status: IN_PROGRESS',
        'Priority: P2',
        '',
        '## Requirements',
        '',
        '## Subtasks',
        '- [ ] Final Review',
        '',
        '## Output files',
        '- ...',
        '',
        '## Log',
        '',
      ].join('\n'),
      { sourceRef: '/tmp/Thin.md' },
    );

    expect(packet.readiness).toBe('blocked');
    expect(packet.issues).toEqual([
      {
        kind: 'not-done',
        severity: 'warning',
        detail: 'task status is IN_PROGRESS; downstream consumers may need an explicit waiver',
      },
      {
        kind: 'missing-requirements',
        severity: 'error',
        detail: 'handoff has no acceptance conditions from Requirements',
      },
      {
        kind: 'missing-output-files',
        severity: 'error',
        detail: 'handoff has no output objects from Output files',
      },
      {
        kind: 'unchecked-subtasks',
        severity: 'warning',
        detail: 'handoff has 1 unchecked Subtasks item',
      },
      {
        kind: 'missing-evidence',
        severity: 'warning',
        detail: 'handoff has no recent Log evidence',
      },
    ]);
  });
});

describe('renderTaskHandoffPacket', () => {
  it('renders parse-stable markdown with metadata and evidence', () => {
    const packet = taskHandoffPacket(
      [
        '# TASK-1: Handoff',
        'Status: DONE',
        '',
        '## Requirements',
        '- Ship packet.',
        '',
        '## Subtasks',
        '- [x] Validate packet.',
        '- [ ] Publish packet.',
        '- Plain follow-up.',
        '',
        '## Output files',
        '- out.md',
        '',
        '## Log',
        '- [2026-06-29 10:03] Check passed.',
      ].join('\n'),
      { sourceRef: '/tmp/TASK-1.md' },
    );

    expect(renderTaskHandoffPacket(packet)).toBe(
      [
        '[task:handoff] TASK-1: Handoff',
        '[task:handoff:meta] {"taskId":"TASK-1","status":"DONE","readiness":"needs-review","sourceRef":"/tmp/TASK-1.md"}',
        '## Acceptance Conditions',
        '- requirement: Ship packet.',
        '## Checklist',
        '- subtask: [x] Validate packet.',
        '- subtask: [ ] Publish packet.',
        '- subtask: [?] Plain follow-up.',
        '## Handoff Objects',
        '- output: out.md',
        '## Evidence',
        '- evidence: 2026-06-29 10:03 Check passed.',
        '## Issues',
        '- warning: unchecked-subtasks: handoff has 1 unchecked Subtasks item',
        '',
      ].join('\n'),
    );
  });
});
