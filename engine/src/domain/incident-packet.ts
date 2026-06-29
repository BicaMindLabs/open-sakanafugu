import type { FailureCause } from './experience.js';

export const INCIDENT_PACKET_SCHEMA_VERSION = 'fugunano.incident-packet.v1' as const;

export const INCIDENT_KINDS = [
  'review-needs-fix',
  'verification-failure',
  'build-failure',
  'integration-conflict',
  'runtime-failure',
  'tooling-error',
  'missing-output',
  'context-provenance',
  'planning-error',
  'policy-violation',
] as const;

export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export type IncidentSeverity = 'critical' | 'major' | 'minor' | 'unknown';

export const INCIDENT_MAST_CATEGORIES = [
  'system-design',
  'inter-agent-misalignment',
  'task-verification',
  'unknown',
] as const;

export type IncidentMastCategory = (typeof INCIDENT_MAST_CATEGORIES)[number];

export const INCIDENT_HARNESS_LAYERS = [
  'environment',
  'tools',
  'context',
  'lifecycle',
  'observability',
  'verification',
  'governance',
  'unknown',
] as const;

export type IncidentHarnessLayer = (typeof INCIDENT_HARNESS_LAYERS)[number];

export interface IncidentEvidence {
  readonly line: number;
  readonly excerpt: string;
}

export interface IncidentRecord {
  readonly id: string;
  readonly kind: IncidentKind;
  readonly severity: IncidentSeverity;
  readonly failureCause: FailureCause;
  readonly mastCategory: IncidentMastCategory;
  readonly harnessLayer: IncidentHarnessLayer;
  readonly summary: string;
  readonly evidence: readonly IncidentEvidence[];
  readonly recommendedChecks: readonly string[];
}

export interface IncidentPacketIssue {
  readonly kind: 'no-incident-detected' | 'incident-without-evidence';
  readonly detail: string;
}

export interface IncidentPacket {
  readonly schemaVersion: typeof INCIDENT_PACKET_SCHEMA_VERSION;
  readonly sourceRef: string;
  readonly sourceSha256: string;
  readonly sourceChars: number;
  readonly incidentCount: number;
  readonly incidents: readonly IncidentRecord[];
  readonly issues: readonly IncidentPacketIssue[];
}

export interface IncidentPacketOptions {
  readonly sourceRef: string;
  readonly sourceSha256: string;
}

interface IncidentSpec {
  readonly kind: IncidentKind;
  readonly severity: IncidentSeverity;
  readonly failureCause: FailureCause;
  readonly mastCategory: IncidentMastCategory;
  readonly harnessLayer: IncidentHarnessLayer;
  readonly summary: string;
  readonly patterns: readonly RegExp[];
}

const MAX_EVIDENCE_PER_INCIDENT = 3;
const MAX_EXCERPT_CHARS = 180;

const REVIEW_NEEDS_FIX_RE = /\bVERDICT\s*:\s*(?:NEEDS[\s_-]*FIX|NEEDSFIX)\b/iu;
const VERIFICATION_FAILURE_RE =
  /\b(?:FAIL|FAILED|failed)\b.*\b(?:test|tests|spec|vitest|pytest|assertion)\b|\bAssertionError\b|\bexpected\b.{0,80}\b(?:received|to\s+(?:be|equal|contain|match))\b|\bTests?\s*:\s*[1-9]\d*\s+failed\b|\bcheck\b.{0,80}\bfailed\b/iu;
const BUILD_FAILURE_RE =
  /\bTS\d{4}\b|\b(?:TypeError|ReferenceError|SyntaxError)\b|\b(?:typecheck|tsc|eslint|prettier|build|compile|compilation)\b.{0,80}\b(?:failed|error|errors)\b|\b(?:failed|error|errors)\b.{0,80}\b(?:typecheck|tsc|eslint|prettier|build|compile|compilation)\b/iu;
const INTEGRATION_CONFLICT_RE =
  /\b(?:CONFLICT|merge conflict|integration conflict|ownership violation|cherry-pick\b.{0,80}\b(?:failed|abort)|worktree\b.{0,80}\bdirty)\b/iu;
const RUNTIME_FAILURE_RE =
  /\b(?:timed out|timeout|ETIMEDOUT|exit code 124|SIGTERM|SIGKILL|OOM|out of memory|process exited with code [1-9]\d*)\b/iu;
const TOOLING_ERROR_RE =
  /\b(?:spawn\b.{0,80}\bENOENT|command not found|ENOENT|EACCES|permission denied|No such file or directory|(?:cannot find module|module not found)|npm ERR!|ECONNRESET|EPIPE)\b/iu;
const MISSING_OUTPUT_RE =
  /\b(?:missing output|require-output|no output|artifact missing|did not write|output file\b.{0,80}\bmissing|expected artifact\b.{0,80}\bnot found)\b/iu;
const CONTEXT_PROVENANCE_RE =
  /\b(?:source-provenance|missing source|no source ref|without stable provenance|context overflow|omitted\b.{0,80}\bcontext|lost context|stale context|not enough context)\b/iu;
const PLANNING_ERROR_RE =
  /\b(?:requirement unclear|ambiguous requirement|wrong scope|out of scope|misunderstood|plan\b.{0,80}\bwrong|acceptance\b.{0,80}\bmissing)\b/iu;
const POLICY_VIOLATION_RE =
  /\b(?:runtime-guard:packet\b.{0,80}\bdisposition=BLOCK|disposition\s*[:=]\s*block|prompt-injection|secret-exfiltration|approval-missing|policy violation|blocked by guard|destructive action)\b/iu;

const SPECS: readonly IncidentSpec[] = [
  {
    kind: 'policy-violation',
    severity: 'critical',
    failureCause: 'policy',
    mastCategory: 'system-design',
    harnessLayer: 'governance',
    summary: 'runtime or governance policy blocked the trajectory',
    patterns: [POLICY_VIOLATION_RE],
  },
  {
    kind: 'review-needs-fix',
    severity: 'major',
    failureCause: 'verification',
    mastCategory: 'task-verification',
    harnessLayer: 'verification',
    summary: 'independent review reported NEEDS FIX',
    patterns: [REVIEW_NEEDS_FIX_RE],
  },
  {
    kind: 'verification-failure',
    severity: 'major',
    failureCause: 'verification',
    mastCategory: 'task-verification',
    harnessLayer: 'verification',
    summary: 'tests or verification checks failed',
    patterns: [VERIFICATION_FAILURE_RE],
  },
  {
    kind: 'build-failure',
    severity: 'major',
    failureCause: 'implementation',
    mastCategory: 'task-verification',
    harnessLayer: 'verification',
    summary: 'build, typecheck, lint, or syntax failure detected',
    patterns: [BUILD_FAILURE_RE],
  },
  {
    kind: 'integration-conflict',
    severity: 'major',
    failureCause: 'integration',
    mastCategory: 'inter-agent-misalignment',
    harnessLayer: 'lifecycle',
    summary: 'integration, ownership, or worktree conflict detected',
    patterns: [INTEGRATION_CONFLICT_RE],
  },
  {
    kind: 'runtime-failure',
    severity: 'major',
    failureCause: 'runtime',
    mastCategory: 'system-design',
    harnessLayer: 'environment',
    summary: 'runtime process failed, timed out, or was killed',
    patterns: [RUNTIME_FAILURE_RE],
  },
  {
    kind: 'tooling-error',
    severity: 'major',
    failureCause: 'tooling',
    mastCategory: 'system-design',
    harnessLayer: 'tools',
    summary: 'tooling, binary, path, permission, or dependency error detected',
    patterns: [TOOLING_ERROR_RE],
  },
  {
    kind: 'missing-output',
    severity: 'major',
    failureCause: 'integration',
    mastCategory: 'system-design',
    harnessLayer: 'observability',
    summary: 'expected artifact or model output was missing',
    patterns: [MISSING_OUTPUT_RE],
  },
  {
    kind: 'context-provenance',
    severity: 'major',
    failureCause: 'context',
    mastCategory: 'system-design',
    harnessLayer: 'context',
    summary: 'context, source provenance, or trace freshness problem detected',
    patterns: [CONTEXT_PROVENANCE_RE],
  },
  {
    kind: 'planning-error',
    severity: 'minor',
    failureCause: 'planning',
    mastCategory: 'system-design',
    harnessLayer: 'lifecycle',
    summary: 'planning or acceptance-contract problem detected',
    patterns: [PLANNING_ERROR_RE],
  },
];

const redactExcerpt = (line: string): string =>
  line
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(/[A-Za-z0-9_-]{24,}/gu, '<redacted-token>')
    .slice(0, MAX_EXCERPT_CHARS);

const evidenceFor = (
  lines: readonly string[],
  patterns: readonly RegExp[],
): readonly IncidentEvidence[] => {
  const evidence: IncidentEvidence[] = [];
  for (const [index, line] of lines.entries()) {
    if (!patterns.some((pattern) => pattern.test(line))) continue;
    evidence.push({ line: index + 1, excerpt: redactExcerpt(line) });
    if (evidence.length >= MAX_EVIDENCE_PER_INCIDENT) break;
  }
  return evidence;
};

const recommendedChecksFor = (
  kind: IncidentKind,
  failureCause: FailureCause,
): readonly string[] => {
  switch (failureCause) {
    case 'planning':
      return [
        'rewrite the task contract with explicit acceptance checks',
        'run fuguectl task handoff before redispatch',
      ];
    case 'context':
    case 'retrieval':
      return [
        'regenerate a bounded task digest before redispatch',
        'attach stable source refs for external evidence',
      ];
    case 'tooling':
      return [
        'run fuguectl preflight for the affected runtime',
        'capture tool versions, binary paths, and permissions before retrying',
      ];
    case 'implementation':
      return [
        'fix the smallest implicated code path',
        'run npm run check and add a focused regression test',
      ];
    case 'verification':
      return [
        'rerun the exact failing check locally',
        'turn the failure into a regression test or review packet before re-review',
      ];
    case 'integration':
      return [
        'inspect ownership boundaries and the integrated diff',
        'rerun integration after resolving conflicts or missing artifacts',
      ];
    case 'runtime':
      return [
        'rerun with a captured artifact and explicit timeout',
        'separate nondeterministic runtime failure from deterministic test failure',
      ];
    case 'policy':
      return [
        'run fuguectl guard prompt on the next dispatch prompt',
        kind === 'policy-violation'
          ? 'add approval or an action certificate before privileged runtime actions'
          : 'record the policy decision next to the TASK',
      ];
    case 'other':
      return ['capture more line evidence before relabeling this failure'];
  }
};

const packetIssues = (incidents: readonly IncidentRecord[]): readonly IncidentPacketIssue[] => {
  if (incidents.length === 0) {
    return [
      {
        kind: 'no-incident-detected',
        detail: 'input did not match any known incident pattern',
      },
    ];
  }
  return incidents
    .filter((incident) => incident.evidence.length === 0)
    .map((incident) => ({
      kind: 'incident-without-evidence' as const,
      detail: `${incident.id} has no line evidence`,
    }));
};

export const incidentPacket = (content: string, options: IncidentPacketOptions): IncidentPacket => {
  const lines = content.split(/\r?\n/u);
  const incidents = SPECS.flatMap((spec): readonly IncidentRecord[] => {
    const evidence = evidenceFor(lines, spec.patterns);
    if (evidence.length === 0) return [];
    return [
      {
        id: '',
        kind: spec.kind,
        severity: spec.severity,
        failureCause: spec.failureCause,
        mastCategory: spec.mastCategory,
        harnessLayer: spec.harnessLayer,
        summary: spec.summary,
        evidence,
        recommendedChecks: recommendedChecksFor(spec.kind, spec.failureCause),
      },
    ];
  }).map((incident, index) => ({
    ...incident,
    id: `I${String(index + 1)}`,
  }));

  return {
    schemaVersion: INCIDENT_PACKET_SCHEMA_VERSION,
    sourceRef: options.sourceRef,
    sourceSha256: options.sourceSha256,
    sourceChars: content.length,
    incidentCount: incidents.length,
    incidents,
    issues: packetIssues(incidents),
  };
};

const evidenceText = (evidence: readonly IncidentEvidence[]): string =>
  evidence.length === 0
    ? 'no-line'
    : evidence
        .map((item) => `line ${String(item.line)} ${JSON.stringify(item.excerpt)}`)
        .join('; ');

export const renderIncidentPacket = (packet: IncidentPacket): string => {
  const metadata = {
    schemaVersion: packet.schemaVersion,
    sourceRef: packet.sourceRef,
    sourceSha256: packet.sourceSha256,
    sourceChars: packet.sourceChars,
    incidentCount: packet.incidentCount,
  };
  const incidentLines =
    packet.incidents.length === 0
      ? ['- incident: (none)']
      : packet.incidents.flatMap((incident) => [
          `- ${incident.id} [${incident.severity}/${incident.failureCause}/${incident.kind}] MAST=${incident.mastCategory} layer=${incident.harnessLayer} ${evidenceText(
            incident.evidence,
          )} :: ${incident.summary}`,
          ...incident.recommendedChecks.map((check) => `  - check: ${check}`),
        ]);
  return [
    `[incident:packet] incidents=${String(packet.incidentCount)}`,
    `[incident:packet:meta] ${JSON.stringify(metadata)}`,
    '## Incidents',
    ...incidentLines,
    '## Issues',
    ...(packet.issues.length === 0
      ? ['- issue: (none)']
      : packet.issues.map((issue) => `- issue: ${issue.kind}: ${issue.detail}`)),
    '',
  ].join('\n');
};
