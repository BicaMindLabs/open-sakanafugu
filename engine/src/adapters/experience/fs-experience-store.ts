import {
  isExperienceSourceKind,
  isExperienceTrustKind,
  experienceFailureCause,
  experienceQueryTerms,
  experienceScore,
} from '../../domain/experience.js';
import type {
  AddMethod,
  ExperienceError,
  Method,
  PromoteMethod,
  RecallOptions,
} from '../../domain/experience.js';
import { containsSecret, slugify } from '../../domain/experience-redact.js';
import type { ExperienceStore } from '../../domain/ports/experience-store.js';
import { err, ok } from '../../domain/result.js';
import type { Result } from '../../domain/result.js';
import type { Clock } from '../../infra/clock.js';
import type { FileSystem } from '../../infra/file-system.js';
import { joinPath } from '../store/paths.js';

const singleLine = (value: string): string => value.replace(/[\r\n]+/gu, ' ').trim();

const cleanSupersedes = (values: readonly string[] | undefined): readonly string[] => [
  ...new Set(
    (values ?? [])
      .flatMap((value) => singleLine(value).split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  ),
];

const cleanConfirmationRefs = (values: readonly string[] | undefined): readonly string[] =>
  (values ?? []).map((value) => singleLine(value)).filter((value) => value.length > 0);

const hasDuplicate = (values: readonly string[]): boolean => new Set(values).size !== values.length;

const parseConfirmedBy = (value: string): readonly string[] => {
  const cleaned = singleLine(value);
  if (cleaned.length === 0) return [];
  if (cleaned.startsWith('[')) {
    try {
      const parsed = JSON.parse(cleaned) as unknown;
      if (Array.isArray(parsed)) {
        return cleanConfirmationRefs(
          parsed.map((entry) => (typeof entry === 'string' ? entry : '')),
        );
      }
    } catch {
      return [];
    }
  }
  return cleaned
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const renderMethod = (m: Method): string =>
  [
    '---',
    `workspace: ${m.workspace}`,
    `title: ${m.title}`,
    `created: ${m.created}`,
    `sourceKind: ${m.sourceKind}`,
    ...(m.sourceRef === undefined || m.sourceRef.length === 0 ? [] : [`sourceRef: ${m.sourceRef}`]),
    `trustKind: ${m.trustKind}`,
    ...(m.confirmedBy === undefined || m.confirmedBy.length === 0
      ? []
      : [`confirmedBy: ${JSON.stringify(m.confirmedBy)}`]),
    ...(m.supersedes === undefined || m.supersedes.length === 0
      ? []
      : [`supersedes: ${m.supersedes.join(', ')}`]),
    '---',
    m.body,
    '',
  ].join('\n');

const parseMethod = (content: string, workspace: string, slug: string): Method => {
  const lines = content.split(/\r?\n/u);
  let start = -1;
  let end = -1;
  for (const [index, line] of lines.entries()) {
    if (line === '---') {
      if (start === -1) start = index;
      else {
        end = index;
        break;
      }
    }
  }
  const fm = start !== -1 && end !== -1 ? lines.slice(start + 1, end) : [];
  const fmField = (key: string): string => {
    const prefix = `${key}: `;
    const line = fm.find((entry) => entry.startsWith(prefix));
    return line !== undefined ? line.slice(prefix.length) : '';
  };
  const created = Number.parseInt(fmField('created'), 10);
  const sourceKind = fmField('sourceKind');
  const sourceRef = singleLine(fmField('sourceRef'));
  const trustKind = fmField('trustKind');
  const confirmedBy = parseConfirmedBy(fmField('confirmedBy'));
  const supersedes = cleanSupersedes([fmField('supersedes')]);
  const body =
    end !== -1
      ? lines
          .slice(end + 1)
          .join('\n')
          .replace(/\n+$/u, '')
      : content;
  return {
    workspace,
    title: fmField('title'),
    slug,
    created: Number.isFinite(created) ? created : 0,
    sourceKind: isExperienceSourceKind(sourceKind) ? sourceKind : 'manual',
    ...(sourceRef.length === 0 ? {} : { sourceRef }),
    trustKind: isExperienceTrustKind(trustKind) ? trustKind : 'trusted',
    ...(confirmedBy.length === 0 ? {} : { confirmedBy }),
    ...(supersedes.length === 0 ? {} : { supersedes }),
    body,
  };
};

const byWorkspaceSlug = (a: Method, b: Method): number => {
  if (a.workspace !== b.workspace) return a.workspace < b.workspace ? -1 : 1;
  if (a.slug === b.slug) return 0;
  return a.slug < b.slug ? -1 : 1;
};

/** Filesystem-backed experience store: `<root>/<workspace>/<slug>.md` (frontmatter + body). */
export class FsExperienceStore implements ExperienceStore {
  constructor(
    private readonly fs: FileSystem,
    private readonly clock: Clock,
    private readonly rootDir: string,
  ) {}

  async add(input: AddMethod): Promise<Result<Method, ExperienceError>> {
    if (input.body.length === 0) {
      return err({ kind: 'empty-body', detail: 'experience body is empty' });
    }
    if (containsSecret(input.body)) {
      return err({
        kind: 'contains-secret',
        detail: 'body contains a suspected key; redact first',
      });
    }
    const sourceRef = input.sourceRef === undefined ? undefined : singleLine(input.sourceRef);
    if (sourceRef !== undefined && containsSecret(sourceRef)) {
      return err({
        kind: 'contains-secret',
        detail: 'sourceRef contains a suspected key; redact first',
      });
    }
    const supersedes = cleanSupersedes(input.supersedes);
    if (supersedes.some((slug) => containsSecret(slug))) {
      return err({
        kind: 'contains-secret',
        detail: 'supersedes contains a suspected key; redact first',
      });
    }
    const method: Method = {
      workspace: input.workspace,
      title: input.title,
      slug: slugify(input.title),
      created: Math.floor(this.clock.now() / 1000),
      sourceKind: input.sourceKind ?? 'manual',
      ...(sourceRef === undefined || sourceRef.length === 0 ? {} : { sourceRef }),
      trustKind: input.trustKind ?? 'trusted',
      ...(supersedes.length === 0 ? {} : { supersedes }),
      body: input.body,
    };
    await this.fs.write(this.path(method.workspace, method.slug), renderMethod(method));
    return ok(method);
  }

  async promote(input: PromoteMethod): Promise<Result<Method, ExperienceError>> {
    const method = await this.get(input.workspace, input.slug);
    if (method === null) {
      return err({
        kind: 'not-found',
        detail: `no experience ${input.workspace}/${input.slug}`,
      });
    }
    if (method.trustKind === 'trusted') {
      return err({
        kind: 'already-trusted',
        detail: `experience ${input.workspace}/${input.slug} is already trusted`,
      });
    }
    if (method.sourceRef === undefined || method.sourceRef.length === 0) {
      return err({
        kind: 'missing-source-ref',
        detail: `experience ${input.workspace}/${input.slug} has no write-time sourceRef`,
      });
    }
    const sourceRef = singleLine(input.sourceRef);
    if (sourceRef.length === 0 || method.sourceRef !== sourceRef) {
      return err({
        kind: 'source-ref-mismatch',
        detail: `--source-ref must match stored sourceRef for ${input.workspace}/${input.slug}`,
      });
    }
    if (containsSecret(sourceRef)) {
      return err({
        kind: 'contains-secret',
        detail: 'sourceRef contains a suspected key; redact first',
      });
    }
    const confirmedBy = cleanConfirmationRefs(input.confirmSourceRefs);
    if (confirmedBy.length === 0) {
      return err({
        kind: 'missing-confirmation',
        detail: 'promotion requires at least one --confirm-source-ref',
      });
    }
    if (confirmedBy.some((ref) => containsSecret(ref))) {
      return err({
        kind: 'contains-secret',
        detail: 'confirmSourceRefs contains a suspected key; redact first',
      });
    }
    if (confirmedBy.some((ref) => ref === sourceRef)) {
      return err({
        kind: 'confirmation-source-conflict',
        detail: '--confirm-source-ref must be distinct from the original --source-ref',
      });
    }
    if (hasDuplicate(confirmedBy)) {
      return err({
        kind: 'confirmation-source-conflict',
        detail: '--confirm-source-ref values must be distinct',
      });
    }
    const promoted: Method = {
      ...method,
      trustKind: 'trusted',
      confirmedBy,
    };
    await this.fs.write(this.path(promoted.workspace, promoted.slug), renderMethod(promoted));
    return ok(promoted);
  }

  async get(workspace: string, slug: string): Promise<Method | null> {
    const content = await this.fs.read(this.path(workspace, slug));
    return content === null ? null : parseMethod(content, workspace, slug);
  }

  async list(workspace?: string): Promise<readonly Method[]> {
    if (workspace !== undefined) return (await this.methodsIn(workspace)).sort(byWorkspaceSlug);
    const workspaces = await this.fs.list(this.rootDir);
    const all: Method[] = [];
    for (const ws of workspaces) all.push(...(await this.methodsIn(ws)));
    return all.sort(byWorkspaceSlug);
  }

  async recall(workspace: string, options: RecallOptions = {}): Promise<readonly Method[]> {
    const limit = options.limit ?? 3;
    let methods = await this.methodsIn(workspace);
    if (options.maxAgeSeconds !== undefined) {
      const minCreated = Math.floor(this.clock.now() / 1000) - options.maxAgeSeconds;
      methods = methods.filter((method) => method.created >= minCreated);
    }
    if (options.sourceKind !== undefined) {
      methods = methods.filter((method) => method.sourceKind === options.sourceKind);
    }
    if (options.sourceRef !== undefined) {
      methods = methods.filter((method) => method.sourceRef === options.sourceRef);
    }
    if (options.trust !== undefined && options.trust !== 'all') {
      methods = methods.filter((method) => method.trustKind === options.trust);
    }
    if (options.failureCause !== undefined) {
      methods = methods.filter((method) => experienceFailureCause(method) === options.failureCause);
    }
    if (options.includeSuperseded !== true) {
      const supersedingMethods =
        options.trust === undefined
          ? methods.filter((method) => method.trustKind === 'trusted')
          : methods;
      const superseded = new Set(
        supersedingMethods.flatMap((method) =>
          (method.supersedes ?? []).filter((slug) => slug !== method.slug),
        ),
      );
      methods = methods.filter((method) => !superseded.has(method.slug));
    }
    const terms = experienceQueryTerms(options.query);
    if (terms.length > 0) {
      const minScore = Math.max(1, options.minScore ?? 1);
      methods = methods
        .map((method) => ({ method, score: experienceScore(method, terms) }))
        .filter((entry) => entry.score >= minScore)
        .sort((a, b) => b.score - a.score || b.method.created - a.method.created)
        .map((entry) => entry.method);
    } else {
      methods.sort((a, b) => b.created - a.created); // most recent first
    }
    return methods.slice(0, Math.max(0, limit));
  }

  private async methodsIn(workspace: string): Promise<Method[]> {
    const names = await this.fs.list(joinPath(this.rootDir, workspace));
    const methods: Method[] = [];
    for (const name of names) {
      if (!name.endsWith('.md')) continue;
      const method = await this.get(workspace, name.slice(0, -'.md'.length));
      if (method !== null) methods.push(method);
    }
    return methods;
  }

  private path(workspace: string, slug: string): string {
    return joinPath(joinPath(this.rootDir, workspace), `${slug}.md`);
  }
}
