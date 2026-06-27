import { Command, Option } from 'clipanion';

import type { AgentProfile, AgentRegistry } from '../../domain/agent-registry.js';
import {
  findAgentProfile,
  parseAgentRegistryJson,
  renderAgentRegistryTemplate,
  resolveAgentTarget,
} from '../../domain/agent-registry.js';
import { isOk } from '../../domain/result.js';
import { NodeFileSystem } from '../../infra/node-file-system.js';

const rolesText = (profile: AgentProfile): string => profile.roles?.join(',') ?? '*';

export const formatAgentRegistryList = (registry: AgentRegistry): string =>
  `${registry.agents
    .map((profile) =>
      [profile.id, profile.harness, resolveAgentTarget(profile), rolesText(profile)].join('\t'),
    )
    .join('\n')}\n`;

export const formatAgentRegistryResolve = (profile: AgentProfile): string => {
  const fields: ReadonlyArray<readonly [string, string]> = [
    ['id', profile.id],
    ['harness', profile.harness],
    ['target', resolveAgentTarget(profile)],
    ['modelFamily', profile.modelFamily ?? ''],
    ['workspace', profile.workspace ?? ''],
    ['roles', rolesText(profile)],
  ];
  return `${fields.map(([key, value]) => `${key}\t${value}`).join('\n')}\n`;
};

const defaultRegistry = (): AgentRegistry | string => {
  const parsed = parseAgentRegistryJson(renderAgentRegistryTemplate());
  return isOk(parsed) ? parsed.value : parsed.error;
};

const readRegistry = async (file: string | undefined): Promise<AgentRegistry | string> => {
  if (file === undefined) return defaultRegistry();
  const text = await new NodeFileSystem().read(file);
  if (text === null) return `no agent registry at ${file}`;
  const parsed = parseAgentRegistryJson(text);
  return isOk(parsed) ? parsed.value : parsed.error;
};

/** `fugue agent-registry template` — print a starter runtime profile registry. */
export class AgentRegistryTemplateCommand extends Command {
  static override paths = [['agent-registry', 'template']];

  override execute(): Promise<number> {
    this.context.stdout.write(renderAgentRegistryTemplate());
    return Promise.resolve(0);
  }
}

/** `fugue agent-registry validate [file]` — validate a runtime profile registry. */
export class AgentRegistryValidateCommand extends Command {
  static override paths = [['agent-registry', 'validate']];

  file = Option.String({ required: false });

  override async execute(): Promise<number> {
    const registry = await readRegistry(this.file);
    if (typeof registry === 'string') {
      this.context.stderr.write(`${registry}\n`);
      return 1;
    }
    this.context.stdout.write(
      `OK agent registry valid: ${String(registry.agents.length)} agents\n`,
    );
    return 0;
  }
}

/** `fugue agent-registry list [file]` — print id/harness/target/roles rows. */
export class AgentRegistryListCommand extends Command {
  static override paths = [['agent-registry', 'list']];

  file = Option.String({ required: false });

  override async execute(): Promise<number> {
    const registry = await readRegistry(this.file);
    if (typeof registry === 'string') {
      this.context.stderr.write(`${registry}\n`);
      return 1;
    }
    this.context.stdout.write(formatAgentRegistryList(registry));
    return 0;
  }
}

/** `fugue agent-registry resolve [file] <id>` — resolve one logical id. */
export class AgentRegistryResolveCommand extends Command {
  static override paths = [['agent-registry', 'resolve']];

  fileOrId = Option.String({ required: false });
  id = Option.String({ required: false });

  override async execute(): Promise<number> {
    const selection = this.selection();
    if (typeof selection === 'string') {
      this.context.stderr.write(`${selection}\n`);
      return 2;
    }
    const registry = await readRegistry(selection.file);
    if (typeof registry === 'string') {
      this.context.stderr.write(`${registry}\n`);
      return 1;
    }
    const profile = findAgentProfile(registry, selection.id);
    if (profile === undefined) {
      this.context.stderr.write(`agent "${selection.id}" not found\n`);
      return 1;
    }
    this.context.stdout.write(formatAgentRegistryResolve(profile));
    return 0;
  }

  private selection(): { readonly file?: string; readonly id: string } | string {
    if (this.fileOrId === undefined) return 'need <id> or <file> <id>';
    if (this.id === undefined) return { id: this.fileOrId };
    return { file: this.fileOrId, id: this.id };
  }
}
