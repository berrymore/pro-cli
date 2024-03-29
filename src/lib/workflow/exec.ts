import { spawn } from 'node:child_process';

import { ExecFunction } from './types';

export function createExecFunction(): ExecFunction {
  return function exec(
    cmd: string[],
    outputStream: NodeJS.WritableStream,
    errorStream: NodeJS.WritableStream,
    cwd: string,
    env: string[],
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const envObj: Record<string, string> = {};

      if (cmd.length === 0) {
        reject(new Error('You should specify a command'));
      }

      env.forEach((el) => {
        const [key, value] = el.split('=');

        envObj[key] = value;
      });

      const child = spawn(cmd[0], cmd.slice(1), { env: envObj, cwd });

      child.stdout.pipe(outputStream);
      child.stderr.pipe(errorStream);

      child.on('close', (code) => {
        resolve(code ?? 1);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  };
}
