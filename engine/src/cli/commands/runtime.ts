import { homedir } from 'node:os';
import { join as joinPath } from 'node:path';

import { Command, Option } from 'clipanion';

import {
  parseProviderInstallPath,
  parseProviderVersion,
  RuntimeSync,
} from '../../adapters/runtime/runtime-sync.js';
import type { CommandRunner } from '../../infra/command-runner.js';
import type { FileSystem } from '../../infra/file-system.js';
import { NodeCommandRunner } from '../../infra/node-command-runner.js';
import { NodeFileSystem } from '../../infra/node-file-system.js';
import { defaultStateDir, fuguectlFile, fuguectlScript } from '../default-paths.js';

const fs = (): NodeFileSystem => new NodeFileSystem();

const nonEmptyEnv = (value: string | undefined): string | undefined =>
  value !== undefined && value.length > 0 ? value : undefined;

const stampPath = (state: string): string => joinPath(state, 'runtime-version');

const defaultRepoSkillPath = (): string =>
  nonEmptyEnv(process.env.FUGUNANO_REPO_SKILL) ??
  nonEmptyEnv(process.env.FUGUE_REPO_SKILL) ??
  fuguectlFile(import.meta.url, 'SKILL.md');

const defaultInstalledSkillPath = (): string =>
  nonEmptyEnv(process.env.FUGUNANO_SKILL) ??
  nonEmptyEnv(process.env.FUGUE_WORKFLOW_SKILL) ??
  nonEmptyEnv(process.env.FUGUE_SKILL) ??
  joinPath(homedir(), '.claude', 'skills', 'fugue', 'SKILL.md');

const providerOutput = async (runner: CommandRunner, bin: string): Promise<string> => {
  try {
    const result = await runner.run(bin, ['version']);
    return result.code === 0 ? result.stdout : '';
  } catch {
    return '';
  }
};

const defaultInstallPath = (): string =>
  joinPath(process.env.HOME ?? '', '.local/share/codex-dual');

const resolveInstallPath = (output: string, override: string | undefined): string =>
  override ?? parseProviderInstallPath(output) ?? defaultInstallPath();

const graftingPresent = async (fileSystem: FileSystem, installPath: string): Promise<boolean> =>
  (await fileSystem.read(joinPath(installPath, 'lib/provider_profiles/api_shortcuts.py'))) !== null;

const existingFile = async (fileSystem: FileSystem, path: string): Promise<boolean> =>
  (await fileSystem.read(path)) !== null;

const nonEmpty = (value: string | undefined): value is string =>
  value !== undefined && value.length > 0;

const indent = (text: string): string =>
  text
    .replace(/\s+$/u, '')
    .split(/\r?\n/u)
    .filter((line) => line.length > 0)
    .map((line) => `    ${line}`)
    .join('\n');

interface WorkflowSkillStatus {
  readonly repoSkill: string;
  readonly installedSkill: string;
  readonly repoExists: boolean;
  readonly installedExists: boolean;
  readonly upToDate: boolean;
}

const workflowSkillStatus = async (
  fileSystem: FileSystem,
  repoSkill: string,
  installedSkill: string,
): Promise<WorkflowSkillStatus> => {
  const repo = await fileSystem.read(repoSkill);
  const installed = await fileSystem.read(installedSkill);
  return {
    repoSkill,
    installedSkill,
    repoExists: repo !== null,
    installedExists: installed !== null,
    upToDate: repo !== null && installed !== null && repo === installed,
  };
};

const workflowSkillCheckLines = async (
  fileSystem: FileSystem,
  repoSkill: string,
  installedSkill: string,
  driverName: string,
): Promise<readonly string[]> => {
  const status = await workflowSkillStatus(fileSystem, repoSkill, installedSkill);
  if (!status.repoExists) return [`  ⚠ workflow skill source missing (${repoSkill})`];
  if (status.upToDate) return [`  ✓ workflow skill up-to-date (${installedSkill})`];
  if (!status.installedExists) {
    return [
      `  → workflow skill not installed (${installedSkill}): run '${driverName} runtime adapt --apply' to sync`,
    ];
  }
  return [
    `  → workflow skill drift (${installedSkill}): run '${driverName} runtime adapt --apply' to sync`,
  ];
};

const workflowSkillAdaptLines = async (
  fileSystem: FileSystem,
  repoSkill: string,
  installedSkill: string,
  apply: boolean,
): Promise<readonly string[]> => {
  const repo = await fileSystem.read(repoSkill);
  if (repo === null) return [`  ✗ workflow skill source missing (${repoSkill})`];

  const installed = await fileSystem.read(installedSkill);
  if (installed === repo) return [`  ✓ workflow skill up-to-date (${installedSkill})`];

  if (!apply) {
    const verb = installed === null ? 'install' : 'refresh';
    return [`  [dry] would ${verb} workflow skill (${repoSkill} → ${installedSkill})`];
  }

  await fileSystem.write(installedSkill, repo);
  return [`  ✓ synced workflow skill (${repoSkill} → ${installedSkill})`];
};

abstract class RuntimeCommand extends Command {
  bin = Option.String('--bin', process.env.FUGUE_CC_BIN ?? 'fugue-cc');
  state = Option.String('--state', defaultStateDir());
  install = Option.String('--install');
  driverName = Option.String('--driver-name', process.env.FUGUE_DRIVER_NAME ?? 'fuguectl');
  repoSkill = Option.String('--repo-skill', defaultRepoSkillPath());
  skill = Option.String('--skill', defaultInstalledSkillPath());

  protected installOverride(): string | undefined {
    return this.install ?? nonEmptyEnv(process.env.FUGUE_CC_INSTALL);
  }

  protected sync(fileSystem: FileSystem, runner: CommandRunner): RuntimeSync {
    return new RuntimeSync(fileSystem, runner, {
      bin: this.bin,
      stampPath: stampPath(this.state),
    });
  }
}

export class RuntimeCheckCommand extends RuntimeCommand {
  static override paths = [['runtime', 'check']];

  override async execute(): Promise<number> {
    const fileSystem = fs();
    const runner = new NodeCommandRunner();
    const output = await providerOutput(runner, this.bin);
    const current = parseProviderVersion(output);
    const last = (await fileSystem.read(stampPath(this.state)))?.trim() ?? '(none)';
    const lines = [
      `fugue-cc provider current: ${current.length > 0 ? current : 'unknown'}   last recorded: ${last}`,
    ];
    if (current.length === 0) {
      lines.push('  ⚠ cannot get fugue-cc provider version (fugue-cc not installed?)');
      lines.push(
        ...(await workflowSkillCheckLines(fileSystem, this.repoSkill, this.skill, this.driverName)),
      );
      this.context.stdout.write(`${lines.join('\n')}\n`);
      return 0;
    }
    if (current !== last) {
      lines.push(
        `  → version drift (${last} → ${current}): run '${this.driverName} runtime adapt --apply' to adapt`,
      );
    } else {
      lines.push('  ✓ no drift');
    }

    const installPath = resolveInstallPath(output, this.installOverride());
    if (await graftingPresent(fileSystem, installPath)) {
      lines.push(`  ✓ grafting api_shortcuts.py present (${installPath})`);
    } else {
      lines.push(
        '  ✗ grafting api_shortcuts.py is gone — claude+url grafting may break, check the new fugue-cc version manually',
      );
    }
    lines.push(
      ...(await workflowSkillCheckLines(fileSystem, this.repoSkill, this.skill, this.driverName)),
    );
    this.context.stdout.write(`${lines.join('\n')}\n`);
    return 0;
  }
}

export class RuntimeAdaptCommand extends RuntimeCommand {
  static override paths = [['runtime', 'adapt']];

  apply = Option.Boolean('--apply', false);
  work = Option.String('--work');
  claude = Option.String('--claude');
  preflightScript = Option.String(
    '--preflight-script',
    fuguectlScript(import.meta.url, 'preflight'),
  );

  override async execute(): Promise<number> {
    const fileSystem = fs();
    const runner = new NodeCommandRunner();
    const output = await providerOutput(runner, this.bin);
    const current = parseProviderVersion(output);
    const last = (await fileSystem.read(stampPath(this.state)))?.trim() ?? '';
    const lines = [
      `── fugue-cc runtime adapt (${last.length > 0 ? last : 'none'} → ${current.length > 0 ? current : 'unknown'})${this.apply ? '' : ' [dry-run]'} ──`,
    ];
    if (current.length === 0) {
      lines.push(
        '  ⚠ cannot get fugue-cc provider version — skipped provider restart and version stamp',
      );
      lines.push(
        ...(await workflowSkillAdaptLines(fileSystem, this.repoSkill, this.skill, this.apply)),
      );
      this.context.stdout.write(`${lines.join('\n')}\n`);
      return 2;
    }

    const installPath = resolveInstallPath(output, this.installOverride());
    if (await graftingPresent(fileSystem, installPath)) {
      lines.push('  ✓ grafting api_shortcuts.py present');
    } else {
      lines.push(
        '  ✗ grafting dependency lost — new fugue-cc may have changed provider_profiles, grafting scheme needs manual adaptation',
      );
    }

    lines.push(
      ...(await workflowSkillAdaptLines(fileSystem, this.repoSkill, this.skill, this.apply)),
    );

    const work = this.work ?? nonEmptyEnv(process.env.FUGUE_CC_WORK);
    const claude = this.claude ?? nonEmptyEnv(process.env.FUGUE_CC_CLAUDE);
    const projects = [work, claude].filter(nonEmpty);
    for (const project of projects) {
      if (this.apply) {
        try {
          const killed = await runner.run(this.bin, ['kill'], { cwd: project });
          if (killed.code === 0) {
            lines.push(
              `  ✓ stopped provider daemon @ ${project} — next 'cd ${project} && fugue-cc' starts it and loads new code (claude-only uses env CLAUDE_START_CMD=claude)`,
            );
          }
        } catch {
          // Match the shell behavior: a missing project or kill failure is non-fatal here.
        }
      } else {
        lines.push(
          `  [dry] need to restart provider daemon @ ${project} (provider update does not auto-restart, old code keeps running)`,
        );
      }
    }
    if (projects.length === 0) {
      lines.push(
        '  ⚠ FUGUE_CC_WORK/FUGUE_CC_CLAUDE unset — skip provider restart (set them and re-run)',
      );
    }

    lines.push(...(await this.runPreflightIfNeeded(fileSystem, runner, work)));

    if (this.apply) {
      await this.sync(fileSystem, runner).record(current);
      lines.push(`  ✓ recorded ${current} → ${stampPath(this.state)}`);
    } else {
      lines.push('  [dry] stamp not written; add --apply to commit');
    }
    this.context.stdout.write(`${lines.join('\n')}\n`);
    return 0;
  }

  private async runPreflightIfNeeded(
    fileSystem: FileSystem,
    runner: CommandRunner,
    work: string | undefined,
  ): Promise<readonly string[]> {
    if (!this.apply || work === undefined) return [];
    const config = joinPath(work, '.fugue-cc/provider.config');
    if (!(await existingFile(fileSystem, config))) return [];
    const lines = ['  config validation (legacy CLI + sound):'];
    try {
      const result = await runner.run(this.preflightScript, ['--config-only', config]);
      const output = indent(`${result.stdout}${result.stderr}`);
      if (output.length > 0) lines.push(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lines.push(`    ${message}`);
    }
    return lines;
  }
}
