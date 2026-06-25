import { join as joinPath } from 'node:path';

import { Command, Option } from 'clipanion';

import { FsExperienceStore } from '../../adapters/experience/fs-experience-store.js';
import { isOk } from '../../domain/result.js';
import { systemClock } from '../../infra/clock.js';
import { NodeFileSystem } from '../../infra/node-file-system.js';

const fs = (): NodeFileSystem => new NodeFileSystem();

const readStream = async (stream: NodeJS.ReadableStream): Promise<string> => {
  let out = '';
  for await (const chunk of stream) {
    out += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
  }
  return out.replace(/\n$/u, '');
};

const renderRecall = (title: string, body: string): string => `[experience] ${title}\n${body}\n\n`;

const parseLimit = (raw: string): number => {
  const limit = Number.parseInt(raw, 10);
  return Number.isFinite(limit) ? limit : 3;
};

abstract class ExperienceCommand extends Command {
  store = Option.String('--store', { required: true });

  protected experienceStore(): FsExperienceStore {
    return new FsExperienceStore(fs(), systemClock, this.store);
  }
}

export class ExperienceAddCommand extends ExperienceCommand {
  static override paths = [['experience', 'add']];

  workspace = Option.String();
  title = Option.String();
  from = Option.String('--from');

  override async execute(): Promise<number> {
    const body =
      this.from === undefined ? await readStream(this.context.stdin) : await fs().read(this.from);
    if (body === null) {
      this.context.stderr.write(`no --from file ${this.from ?? ''}\n`);
      return 1;
    }
    const result = await this.experienceStore().add({
      workspace: this.workspace,
      title: this.title,
      body,
    });
    if (!isOk(result)) {
      this.context.stderr.write(`${result.error.detail}\n`);
      return 1;
    }
    this.context.stdout.write(
      `✓ experience stored: ${joinPath(this.store, result.value.workspace, `${result.value.slug}.md`)}\n`,
    );
    return 0;
  }
}

export class ExperienceListCommand extends ExperienceCommand {
  static override paths = [['experience', 'list']];

  workspace = Option.String({ required: false });

  override async execute(): Promise<void> {
    const methods = await this.experienceStore().list(this.workspace);
    if (methods.length === 0) {
      this.context.stdout.write('(no experiences yet)\n');
      return;
    }
    for (const method of methods) {
      this.context.stdout.write(`  ${method.workspace.padEnd(12)} ${method.title}\n`);
    }
  }
}

export class ExperienceRecallCommand extends ExperienceCommand {
  static override paths = [['experience', 'recall']];

  workspace = Option.String();
  query = Option.String('--query');
  limit = Option.String('--limit', '3');

  override async execute(): Promise<void> {
    const options =
      this.query === undefined
        ? { limit: parseLimit(this.limit) }
        : { limit: parseLimit(this.limit), query: this.query };
    const methods = await this.experienceStore().recall(this.workspace, options);
    for (const method of methods) {
      this.context.stdout.write(renderRecall(method.title, method.body));
    }
  }
}

export class ExperienceShowCommand extends ExperienceCommand {
  static override paths = [['experience', 'show']];

  workspace = Option.String();
  slug = Option.String();

  override async execute(): Promise<number> {
    const path = joinPath(this.store, this.workspace, `${this.slug}.md`);
    const content = await fs().read(path);
    if (content === null) {
      this.context.stderr.write(`no experience ${this.workspace}/${this.slug}\n`);
      return 1;
    }
    this.context.stdout.write(content);
    return 0;
  }
}
