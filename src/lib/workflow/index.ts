import chalk from 'chalk';

import { WrappedDocker } from '../docker/types';
import { RuntimeInterface } from '../pro/types';

import {
  Workflow,
  WorkflowEngine,
  JobsDictionary,
  ExecFunction,
} from './types';

import { toEnvName } from './utils';
import { createExecFunction } from './exec';

async function computeEnvVariables(docker: WrappedDocker, runtime: RuntimeInterface): Promise<string[]> {
  const result: string[] = [];
  const services = await docker.listComposeServices();

  const pushVar = (
    key: string,
    value: any,
    prefix: string = 'PRO_',
  ) => result.push(`${prefix}${toEnvName(key)}=${value}`);

  for (const service of services) {
    if (service.network) {
      pushVar(`${service.project}_${service.service}_IP_ADDR`, service.network?.IPAddress);
    }
  }

  if (runtime.nsRoot) {
    pushVar('NS_ROOT', runtime.nsRoot);
  }

  if (runtime.config) {
    pushVar('NS_NAME', runtime.config.name);
  }

  Object.entries(process.env).forEach(([key, value]) => {
    pushVar(key, value, '');
  });

  return result;
}

interface CreateWorkflowEngineOptions {
  docker: WrappedDocker;
  runtime: RuntimeInterface;
}

export function createWorkflowDriver(docker: WrappedDocker, runtime: RuntimeInterface, image?: string): ExecFunction {
  if (image) {
    const { uid, gid } = runtime;

    return async function exec(cmd: string[], outputStream: NodeJS.WritableStream, _, cwd, env: string[]) {
      const result = await docker.driver.run(
        image,
        cmd,
        outputStream,
        {
          HostConfig: {
            AutoRemove: true,
            Mounts: [
              {
                Target: '/project',
                Source: cwd,
                Type: 'bind',
              },
            ],
            NetworkMode: runtime.config?.docker.network,
          },
          WorkingDir: '/project',
          User: `${uid}:${gid}`,
          Env: env,
        },
      );

      return result[0]?.StatusCode;
    };
  }

  return createExecFunction();
}

export function createWorkflowEngine(deps: CreateWorkflowEngineOptions): WorkflowEngine {
  const { docker, runtime } = deps;

  return {
    async run(workflow: Workflow, jobs?: string[]) {
      console.log(chalk.blue(`Running "${workflow.name}" workflow`));

      let queuedJobs: JobsDictionary = workflow.jobs;

      if (jobs) {
        queuedJobs = {};

        for (const job of jobs) {
          if (!(job in workflow.jobs)) {
            throw new Error(`Job "${job}" is undefined in workflow "${workflow.name}"`);
          }

          queuedJobs[job] = workflow.jobs[job];
        }
      }

      const envVariables = await computeEnvVariables(docker, runtime);

      for (const [jobId, job] of Object.entries(queuedJobs)) {
        console.log(chalk.yellow(`Job "${jobId}"`));

        const jobEnvVariables = job.env ?? [];

        for (const command of job.commands) {
          const exec = createWorkflowDriver(docker, runtime, job.image);

          // eslint-disable-next-line no-await-in-loop
          await exec(
            ['sh', '-c', command],
            process.stdout,
            process.stderr,
            process.cwd(),
            [...envVariables, ...jobEnvVariables],
          );
        }
      }
    },
  };
}
