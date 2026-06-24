import { spawn } from 'node:child_process';
import { constants } from 'node:os';

import type { CommandOptions, CommandResult, CommandRunner } from './command-runner.js';

/** Real subprocess runner (child_process.spawn) — the only place node:child_process is used. */
export class NodeCommandRunner implements CommandRunner {
  run(
    command: string,
    args: readonly string[],
    options: CommandOptions = {},
  ): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject) => {
      const env = options.env !== undefined ? { ...process.env, ...options.env } : process.env;
      const child = spawn(command, [...args], {
        env,
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
      });

      const out: Buffer[] = [];
      const errChunks: Buffer[] = [];
      child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));

      child.on('error', (error: Error) => {
        reject(error);
      });
      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        // A signal-killed child reports code=null; map it to nonzero (bash: 128+signum),
        // never to 0 — otherwise a killed dispatch would look successful.
        let exit: number;
        if (code !== null) exit = code;
        else if (signal !== null) exit = 128 + (constants.signals[signal] ?? 0);
        else exit = 0;
        resolve({
          code: exit,
          stdout: Buffer.concat(out).toString('utf8'),
          stderr: Buffer.concat(errChunks).toString('utf8'),
        });
      });

      if (options.stdin !== undefined) child.stdin.write(options.stdin);
      child.stdin.end();
    });
  }
}
