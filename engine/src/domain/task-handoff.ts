export type TaskHandoffReadiness = 'ready' | 'needs-review' | 'blocked';

export type TaskHandoffIssueKind =
  | 'not-done'
  | 'missing-requirements'
  | 'missing-output-files'
  | 'unchecked-subtasks'
  | 'missing-evidence';

export interface TaskHandoffIssue {
  readonly kind: TaskHandoffIssueKind;
  readonly severity: 'warning' | 'error';
  readonly detail: string;
}

export interface TaskHandoffEvidence {
  readonly at?: string;
  readonly text: string;
}

export interface TaskHandoffChecklistItem {
  readonly text: string;
  readonly checked: boolean | null;
}

export interface TaskHandoffPacket {
  readonly taskId: string;
  readonly title: string;
  readonly status: string;
  readonly priority?: string;
  readonly created?: string;
  readonly completed?: string;
  readonly sourceRef: string;
  readonly readiness: TaskHandoffReadiness;
  readonly acceptanceConditions: readonly string[];
  readonly checklist: readonly TaskHandoffChecklistItem[];
  readonly handoffObjects: readonly string[];
  readonly evidence: readonly TaskHandoffEvidence[];
  readonly issues: readonly TaskHandoffIssue[];
}

export interface TaskHandoffOptions {
  readonly sourceRef: string;
  readonly maxEvidence?: number;
}

const field = (content: string, name: string): string | undefined => {
  const match = new RegExp(`^${name}:[ \\t]*(.*)$`, 'mu').exec(content);
  const value = match?.[1]?.trim();
  return value === undefined || value.length === 0 || value === '-' ? undefined : value;
};

const taskHeading = (content: string): { readonly taskId: string; readonly title: string } => {
  const heading = /^#\s+([^:\n]+)(?::\s*(.*))?$/mu.exec(content);
  const taskId = heading?.[1]?.trim() ?? 'TASK-unknown';
  const title = heading?.[2]?.trim() ?? taskId;
  return { taskId, title: title.length === 0 ? taskId : title };
};

const sectionLines = (content: string, heading: string): readonly string[] => {
  const lines = content.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/u.test(line)) break;
    out.push(line);
  }
  return out;
};

const cleanListLine = (line: string): string =>
  line
    .trim()
    .replace(/^[-*]\s+/u, '')
    .replace(/^\d+[.)]\s+/u, '')
    .replace(/^\[[ xX]\]\s+/u, '')
    .trim();

const nonPlaceholder = (line: string): boolean =>
  line.length > 0 && line !== '...' && !/^<.*>$/u.test(line);

const sectionItems = (content: string, heading: string): readonly string[] =>
  sectionLines(content, heading)
    .map((line) => cleanListLine(line))
    .filter(nonPlaceholder);

const checklistItem = (line: string): TaskHandoffChecklistItem | null => {
  const trimmed = line.trim();
  const checked = /^(?:[-*]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/u.exec(trimmed);
  if (checked !== null) {
    const marker = checked[1] ?? ' ';
    const text = checked[2]?.trim() ?? '';
    return nonPlaceholder(text) ? { text, checked: marker.toLowerCase() === 'x' } : null;
  }

  const text = cleanListLine(line);
  return nonPlaceholder(text) ? { text, checked: null } : null;
};

const checklistItems = (content: string): readonly TaskHandoffChecklistItem[] =>
  sectionLines(content, 'Subtasks').flatMap((line) => {
    const item = checklistItem(line);
    return item === null ? [] : [item];
  });

const parseLogEvidence = (content: string, maxEvidence: number): readonly TaskHandoffEvidence[] => {
  const entries = sectionLines(content, 'Log')
    .map((line) => {
      const match = /^-\s+\[([^\]]+)\]\s+(.*)$/u.exec(line.trim());
      if (match === null) return { text: cleanListLine(line) };
      const at = match[1] ?? '';
      const text = match[2]?.trim() ?? '';
      return at.length === 0 ? { text } : { at, text };
    })
    .filter((entry) => entry.text.length > 0);
  return entries.slice(Math.max(0, entries.length - maxEvidence));
};

const handoffIssues = (
  status: string,
  acceptanceConditions: readonly string[],
  checklist: readonly TaskHandoffChecklistItem[],
  handoffObjects: readonly string[],
  evidence: readonly TaskHandoffEvidence[],
): readonly TaskHandoffIssue[] => {
  const issues: TaskHandoffIssue[] = [];
  const uncheckedCount = checklist.filter((item) => item.checked === false).length;
  if (status !== 'DONE') {
    issues.push({
      kind: 'not-done',
      severity: 'warning',
      detail: `task status is ${status}; downstream consumers may need an explicit waiver`,
    });
  }
  if (acceptanceConditions.length === 0) {
    issues.push({
      kind: 'missing-requirements',
      severity: 'error',
      detail: 'handoff has no acceptance conditions from Requirements',
    });
  }
  if (handoffObjects.length === 0) {
    issues.push({
      kind: 'missing-output-files',
      severity: 'error',
      detail: 'handoff has no output objects from Output files',
    });
  }
  if (uncheckedCount > 0) {
    issues.push({
      kind: 'unchecked-subtasks',
      severity: 'warning',
      detail: `handoff has ${uncheckedCount} unchecked Subtasks item${uncheckedCount === 1 ? '' : 's'}`,
    });
  }
  if (evidence.length === 0) {
    issues.push({
      kind: 'missing-evidence',
      severity: 'warning',
      detail: 'handoff has no recent Log evidence',
    });
  }
  return issues;
};

const readiness = (issues: readonly TaskHandoffIssue[]): TaskHandoffReadiness => {
  if (issues.some((issue) => issue.severity === 'error')) return 'blocked';
  if (issues.length > 0) return 'needs-review';
  return 'ready';
};

export const taskHandoffPacket = (
  content: string,
  options: TaskHandoffOptions,
): TaskHandoffPacket => {
  const heading = taskHeading(content);
  const status = field(content, 'Status') ?? 'UNKNOWN';
  const acceptanceConditions = sectionItems(content, 'Requirements');
  const checklist = checklistItems(content);
  const handoffObjects = sectionItems(content, 'Output files');
  const evidence = parseLogEvidence(content, options.maxEvidence ?? 12);
  const issues = handoffIssues(status, acceptanceConditions, checklist, handoffObjects, evidence);
  const priority = field(content, 'Priority');
  const created = field(content, 'Created');
  const completed = field(content, 'Completed');
  return {
    taskId: heading.taskId,
    title: heading.title,
    status,
    ...(priority === undefined ? {} : { priority }),
    ...(created === undefined ? {} : { created }),
    ...(completed === undefined ? {} : { completed }),
    sourceRef: options.sourceRef,
    readiness: readiness(issues),
    acceptanceConditions,
    checklist,
    handoffObjects,
    evidence,
    issues,
  };
};

const bullets = (label: string, values: readonly string[], empty: string): readonly string[] =>
  values.length === 0 ? [`- ${label}: ${empty}`] : values.map((value) => `- ${label}: ${value}`);

const checklistBullets = (checklist: readonly TaskHandoffChecklistItem[]): readonly string[] =>
  checklist.length === 0
    ? ['- subtask: (none recorded)']
    : checklist.map((item) => {
        const marker = item.checked === null ? '[?]' : item.checked ? '[x]' : '[ ]';
        return `- subtask: ${marker} ${item.text}`;
      });

const evidenceBullets = (evidence: readonly TaskHandoffEvidence[]): readonly string[] =>
  evidence.length === 0
    ? ['- evidence: (none recorded)']
    : evidence.map((entry) =>
        entry.at === undefined
          ? `- evidence: ${entry.text}`
          : `- evidence: ${entry.at} ${entry.text}`,
      );

export const renderTaskHandoffPacket = (packet: TaskHandoffPacket): string => {
  const metadata = {
    taskId: packet.taskId,
    status: packet.status,
    readiness: packet.readiness,
    sourceRef: packet.sourceRef,
    ...(packet.priority === undefined ? {} : { priority: packet.priority }),
    ...(packet.created === undefined ? {} : { created: packet.created }),
    ...(packet.completed === undefined ? {} : { completed: packet.completed }),
  };
  return [
    `[task:handoff] ${packet.taskId}: ${packet.title}`,
    `[task:handoff:meta] ${JSON.stringify(metadata)}`,
    '## Acceptance Conditions',
    ...bullets('requirement', packet.acceptanceConditions, '(none recorded)'),
    '## Checklist',
    ...checklistBullets(packet.checklist),
    '## Handoff Objects',
    ...bullets('output', packet.handoffObjects, '(none recorded)'),
    '## Evidence',
    ...evidenceBullets(packet.evidence),
    '## Issues',
    ...(packet.issues.length === 0
      ? ['- issue: (none)']
      : packet.issues.map((issue) => `- ${issue.severity}: ${issue.kind}: ${issue.detail}`)),
    '',
  ].join('\n');
};
