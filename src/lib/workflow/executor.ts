import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';

import { Executor, Stream, ExecOptions } from './types';
import { WrappedDocker } from '../docker/types';
import { formatDate } from './utils';

function createOutputStream(subject: string, stream: Writable, err: boolean): Writable {
  const subjectColor = err ? chalk.red : chalk.cyan;
  const lineColor = err ? chalk.yellow : chalk.reset;

  return new Writable({
    write(chunk: any, _: BufferEncoding, callback: (error?: (Error | null)) => void) {
      const lines = chunk.toString().split(/\r?\n/);

      const transformed = lines.map((line?: string) => {
        if (line) {
          return chalk.reset(`[${formatDate(new Date())}] ${subjectColor(subject)} | ${lineColor(line)}`);
        }

        return line;
      });

      stream.write(transformed.join('\n'), 'utf8', callback);
    },
  });
}

export function createStdExecutor(): Executor {
  return {
    exec(key: string, cmd: string[], stream: Stream, options: ExecOptions): Promise<number> {
      return new Promise<number>((resolve, reject) => {
        const envObj: Record<string, string> = {};

        if (cmd.length === 0) {
          reject(new Error('You should specify a command'));
        }

        const {
          env,
          cwd,
          uid,
          gid,
        } = options;

        env.forEach((e) => {
          const [key, value] = e.split('=');

          envObj[key] = value;
        });

        const child = spawn(
          cmd[0],
          cmd.slice(1),
          {
            env: envObj,
            cwd,
            uid,
            gid,
          },
        );

        child.stdout.pipe(createOutputStream(key, stream.stdout, false));
        child.stderr.pipe(createOutputStream(key, stream.stderr, true));

        child.on('close', (code) => {
          resolve(code ?? 1);
        });

        child.on('error', (error) => {
          reject(error);
        });
      });
    },
  };
}

export function createDockerExecutor(docker: WrappedDocker, image: string, network?: string): Executor {
  return {
    async exec(key: string, cmd: string[], stream: Stream, options: ExecOptions): Promise<number> {
      const result = await docker.driver.run(
        image,
        cmd,
        createOutputStream(key, stream.stdout, false),
        {
          HostConfig: {
            AutoRemove: true,
            Mounts: [
              {
                Target: '/project',
                Source: options.cwd,
                Type: 'bind',
              },
            ],
            NetworkMode: network,
          },
          WorkingDir: '/project',
          User: `${options.uid}:${options.gid}`,
          Env: options.env,
        },
      );

      return result[0]?.StatusCode;
    },
  };
}
