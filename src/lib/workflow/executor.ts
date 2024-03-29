import { spawn } from 'node:child_process';

import { Executor, Stream, ExecOptions } from './types';
import { WrappedDocker } from '../docker/types';

export function createStdExecutor(): Executor {
  return {
    exec(cmd: string[], stream: Stream, options: ExecOptions): Promise<number> {
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

        child.stdout.pipe(stream.stdout);
        child.stderr.pipe(stream.stderr);

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
    async exec(cmd: string[], stream: Stream, options: ExecOptions): Promise<number> {
      const result = await docker.driver.run(
        image,
        cmd,
        stream.stdout,
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
