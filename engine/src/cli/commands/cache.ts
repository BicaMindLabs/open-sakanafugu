import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { join as joinPath } from 'node:path';

import { Command, Option } from 'clipanion';

import { NodeFileSystem } from '../../infra/node-file-system.js';

interface ManifestEntry {
  readonly id: string;
  readonly agent: string;
}

interface ParsedArgs {
  readonly ok: true;
  readonly cache: string | null;
  readonly rest: readonly string[];
}

interface ParseError {
  readonly ok: false;
  readonly message: string;
}

interface BarrierOptions {
  readonly wait: boolean;
  readonly timeout: number;
  readonly requireSuccess: boolean;
}

type ParseResult = ParsedArgs | ParseError;

const defaultCacheRoot = (): string =>
  process.env.FUGUE_CACHE ?? joinPath(process.cwd(), '.fuguectl-cache');

const nowSeconds = (): string => String(Math.floor(Date.now() / 1000));

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
};

const parseArgs = (args: readonly string[]): ParseResult => {
  let cache: string | null = null;
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === '--cache') {
      const next = args[index + 1];
      if (next === undefined)
        return { ok: false, message: 'usage: cache --cache <dir> <subcommand>' };
      cache = next;
      index += 1;
    } else if (arg.startsWith('--cache=')) {
      cache = arg.slice('--cache='.length);
    } else {
      rest.push(arg);
    }
  }
  return { ok: true, cache, rest };
};

const parseManifest = (content: string): readonly ManifestEntry[] => {
  const entries: ManifestEntry[] = [];
  for (const raw of content.split(/\r?\n/u)) {
    if (raw.length === 0) continue;
    const tab = raw.indexOf('\t');
    entries.push({
      id: tab === -1 ? raw : raw.slice(0, tab),
      agent: tab === -1 ? '' : raw.slice(tab + 1),
    });
  }
  return entries;
};

const parsePair = (pair: string): ManifestEntry | null => {
  const colon = pair.indexOf(':');
  if (colon <= 0) return null;
  return { id: pair.slice(0, colon), agent: pair.slice(colon + 1) };
};

const parseNonNegativeInteger = (raw: string): number | null => {
  if (!/^[0-9]+$/u.test(raw)) return null;
  return Number.parseInt(raw, 10);
};

const parseBarrierOptions = (args: readonly string[]): BarrierOptions | string => {
  let wait = false;
  let timeout = 300;
  let requireSuccess = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--wait') {
      wait = true;
      const next = args[index + 1];
      if (next !== undefined && !next.startsWith('--')) {
        const parsed = parseNonNegativeInteger(next);
        if (parsed === null) return `invalid --wait timeout '${next}'`;
        timeout = parsed;
        index += 1;
      }
    } else if (arg === '--require-success') {
      requireSuccess = true;
    } else {
      return `unknown arg ${arg ?? ''}`;
    }
  }
  return { wait, timeout, requireSuccess };
};

class LegacyRoundCache {
  private readonly fs = new NodeFileSystem();

  constructor(private readonly root: string) {}

  roundDir(round: string): string {
    return joinPath(this.root, `round-${round}`);
  }

  resultPath(round: string, id: string): string {
    return joinPath(this.roundDir(round), `${id}.result`);
  }

  private manifestPath(round: string): string {
    return joinPath(this.roundDir(round), 'manifest.tsv');
  }

  private statusPath(round: string, id: string): string {
    return joinPath(this.roundDir(round), `${id}.status`);
  }

  private async loadManifest(round: string): Promise<readonly ManifestEntry[] | null> {
    const manifest = await this.fs.read(this.manifestPath(round));
    return manifest === null ? null : parseManifest(manifest);
  }

  async init(round: string, pairs: readonly string[]): Promise<string | null> {
    if (round.length === 0 || pairs.length === 0)
      return 'usage: init <round> <task_id:agent> [...]';
    const entries: ManifestEntry[] = [];
    for (const pair of pairs) {
      const entry = parsePair(pair);
      if (entry === null) return `task format should be task_id:agent, got '${pair}'`;
      entries.push(entry);
    }
    const dir = this.roundDir(round);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await this.fs.write(
      this.manifestPath(round),
      entries.map((entry) => `${entry.id}\t${entry.agent}`).join('\n') + '\n',
    );
    await this.fs.write(joinPath(dir, '.started'), `${nowSeconds()}\n`);
    return `✓ round-${round} declared ${String(entries.length)} tasks: ${pairs.join(' ')}`;
  }

  async put(round: string, id: string, file: string): Promise<string | null> {
    if (round.length === 0 || id.length === 0 || file.length === 0)
      return 'usage: put <round> <task_id> <file>';
    const manifest = await this.loadManifest(round);
    if (manifest === null) return `round-${round} not init`;
    if (!manifest.some((entry) => entry.id === id))
      return `task '${id}' not in manifest (only tasks declared this round accepted)`;
    if (!(await isFile(file))) return `result file does not exist: ${file}`;

    const dir = this.roundDir(round);
    const temp = joinPath(dir, `.${id}.result.tmp`);
    const result = this.resultPath(round, id);
    await copyFile(file, temp);
    await rename(temp, result);
    await this.fs.write(this.statusPath(round, id), 'done\n');
    await this.fs.write(joinPath(dir, `${id}.at`), `${nowSeconds()}\n`);
    const bytes = (await stat(result)).size;
    return `✓ cached ${id} (${String(bytes)} bytes) [${String(
      await this.terminalCount(round, manifest),
    )}/${String(manifest.length)}]`;
  }

  async fail(round: string, id: string, reasons: readonly string[]): Promise<string | null> {
    if (round.length === 0 || id.length === 0) return 'usage: fail <round> <task_id> [reason]';
    const manifest = await this.loadManifest(round);
    if (manifest === null) return `round-${round} not init`;
    if (!manifest.some((entry) => entry.id === id)) return `task '${id}' not in manifest`;

    const dir = this.roundDir(round);
    await this.fs.write(this.statusPath(round, id), 'fail\n');
    await this.fs.write(joinPath(dir, `${id}.at`), `${nowSeconds()}\n`);
    const reason = reasons.join(' ');
    if (reasons.length > 0) await this.fs.write(joinPath(dir, `${id}.reason`), `${reason}\n`);
    return `✗ failed ${id}: ${reason.length === 0 ? '(no reason)' : reason} [${String(
      await this.terminalCount(round, manifest),
    )}/${String(manifest.length)}]`;
  }

  async status(round: string): Promise<string | null> {
    if (round.length === 0) return 'usage: status <round>';
    const manifest = await this.loadManifest(round);
    if (manifest === null) return `round-${round} not init`;
    const counts = await this.countDoneFail(round, manifest);
    return `round-${round}: total=${String(manifest.length)} done=${String(counts.done)} fail=${String(
      counts.fail,
    )} pending=${String(manifest.length - counts.done - counts.fail)}`;
  }

  async barrier(
    round: string,
    options: BarrierOptions,
  ): Promise<{ readonly code: number; readonly text: string; readonly stderr?: string }> {
    if (round.length === 0)
      return { code: 2, text: 'usage: barrier <round> [--wait [secs]] [--require-success]' };
    const manifest = await this.loadManifest(round);
    if (manifest === null) return { code: 2, text: `round-${round} not init` };
    if (manifest.length === 0) return { code: 2, text: `round-${round} manifest is empty` };

    let elapsed = 0;
    while (true) {
      const terminal = await this.terminalCount(round, manifest);
      if (terminal >= manifest.length) {
        if (options.requireSuccess) {
          const fail = await this.countFailedStatuses(round, manifest);
          if (fail > 0) {
            return {
              code: 1,
              text: `✗ barrier round-${round}: ${String(manifest.length)}/${String(
                manifest.length,
              )} returned, but ${String(fail)} failed (--require-success)`,
            };
          }
        }
        return {
          code: 0,
          text: `✓ barrier round-${round}: ${String(manifest.length)}/${String(
            manifest.length,
          )} all returned → may enter next round`,
        };
      }

      if (!options.wait) {
        return {
          code: 1,
          text: `✗ barrier round-${round}: only ${String(terminal)}/${String(
            manifest.length,
          )} returned, unmet → not allowed into next round`,
          stderr: (await this.status(round)) ?? '',
        };
      }
      if (elapsed >= options.timeout) {
        return {
          code: 1,
          text: `✗ barrier round-${round}: waited ${String(options.timeout)}s timeout, ${String(
            terminal,
          )}/${String(manifest.length)}`,
          stderr: '',
        };
      }
      await sleep(3000);
      elapsed += 3;
    }
  }

  async collect(round: string): Promise<string | null> {
    if (round.length === 0) return 'usage: collect <round>';
    const manifest = await this.loadManifest(round);
    if (manifest === null) return `round-${round} not init`;
    const paths: string[] = [];
    for (const entry of manifest) {
      const path = this.resultPath(round, entry.id);
      if (await isFile(path)) paths.push(path);
    }
    return paths.join('\n');
  }

  async list(round: string): Promise<string | null> {
    if (round.length === 0) return 'usage: list <round>';
    const manifest = await this.loadManifest(round);
    if (manifest === null) return `round-${round} not init`;
    const lines: string[] = [];
    for (const entry of manifest) {
      const status = (await this.fs.read(this.statusPath(round, entry.id)))?.trim() ?? 'pending';
      lines.push(`  ${entry.id.padEnd(22)} ${entry.agent.padEnd(14)} ${status}`);
    }
    return lines.join('\n');
  }

  async resume(round: string): Promise<string | null> {
    if (round.length === 0) return 'usage: resume <round>';
    const manifest = await this.loadManifest(round);
    if (manifest === null) return `round-${round} not init`;
    const lines: string[] = [];
    for (const entry of manifest) {
      if (!(await isFile(this.statusPath(round, entry.id))))
        lines.push(`${entry.id}\t${entry.agent}`);
    }
    return lines.join('\n');
  }

  private async terminalCount(round: string, manifest: readonly ManifestEntry[]): Promise<number> {
    let count = 0;
    for (const entry of manifest) {
      if (await isFile(this.statusPath(round, entry.id))) count += 1;
    }
    return count;
  }

  private async countDoneFail(
    round: string,
    manifest: readonly ManifestEntry[],
  ): Promise<{ readonly done: number; readonly fail: number }> {
    let done = 0;
    let fail = 0;
    for (const entry of manifest) {
      const status = (await this.fs.read(this.statusPath(round, entry.id)))?.trim();
      if (status === 'done') done += 1;
      if (status === 'fail') fail += 1;
    }
    return { done, fail };
  }

  private async countFailedStatuses(
    round: string,
    manifest: readonly ManifestEntry[],
  ): Promise<number> {
    let fail = 0;
    for (const entry of manifest) {
      const status = (await this.fs.read(this.statusPath(round, entry.id)))?.trim();
      if (status === 'fail') fail += 1;
    }
    return fail;
  }
}

export class CacheCommand extends Command {
  static override paths = [['cache']];

  args = Option.Proxy();

  override async execute(): Promise<number> {
    const parsed = parseArgs(this.args);
    if (!parsed.ok) return this.error(parsed.message);

    const [sub, ...subArgs] = parsed.rest;
    if (sub === undefined || sub === '-h' || sub === '--help') {
      this.context.stdout.write(
        [
          'fugue cache init <round> <task_id:agent> [...]',
          'fugue cache put <round> <task_id> <file>',
          'fugue cache fail <round> <task_id> [reason]',
          'fugue cache status|barrier|collect|list|resume <round>',
          '',
        ].join('\n'),
      );
      return 0;
    }

    const cache = new LegacyRoundCache(parsed.cache ?? defaultCacheRoot());
    switch (sub) {
      case 'init':
        return this.printUsageResult(await cache.init(subArgs[0] ?? '', subArgs.slice(1)));
      case 'put':
        return this.printUsageResult(
          await cache.put(subArgs[0] ?? '', subArgs[1] ?? '', subArgs[2] ?? ''),
        );
      case 'fail':
        return this.printUsageResult(
          await cache.fail(subArgs[0] ?? '', subArgs[1] ?? '', subArgs.slice(2)),
        );
      case 'status':
        return this.printUsageResult(await cache.status(subArgs[0] ?? ''));
      case 'barrier':
        return await this.runBarrier(cache, subArgs);
      case 'collect':
        return this.printUsageResult(await cache.collect(subArgs[0] ?? ''));
      case 'list':
        return this.printUsageResult(await cache.list(subArgs[0] ?? ''));
      case 'resume':
        return this.printUsageResult(await cache.resume(subArgs[0] ?? ''));
      default:
        return this.error(
          `unknown subcommand '${sub}' (init|put|fail|status|barrier|collect|list|resume)`,
        );
    }
  }

  private async runBarrier(cache: LegacyRoundCache, args: readonly string[]): Promise<number> {
    const [round, ...optionArgs] = args;
    const options = parseBarrierOptions(optionArgs);
    if (typeof options === 'string') return this.error(options);
    const result = await cache.barrier(round ?? '', options);
    if (result.code === 0) {
      this.context.stdout.write(`${result.text}\n`);
    } else if (result.code === 1) {
      this.context.stdout.write(`${result.text}\n`);
      if (result.stderr !== undefined && result.stderr.length > 0)
        this.context.stderr.write(`${result.stderr}\n`);
    } else {
      this.context.stderr.write(`${result.text}\n`);
    }
    return result.code;
  }

  private printUsageResult(message: string | null): number {
    if (message === null) return 0;
    if (
      message.startsWith('usage:') ||
      message.includes('not init') ||
      message.includes('not in manifest') ||
      message.includes('does not exist') ||
      message.includes('task format')
    ) {
      this.context.stderr.write(`${message}\n`);
      return 2;
    }
    this.context.stdout.write(message.length === 0 ? '' : `${message}\n`);
    return 0;
  }

  private error(message: string): number {
    this.context.stderr.write(`${message}\n`);
    return 2;
  }
}
