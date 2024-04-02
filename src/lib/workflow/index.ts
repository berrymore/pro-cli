import chalk from 'chalk';

import { WrappedDocker } from '../docker/types';
import { RuntimeInterface } from '../pro/types';

import {
  Workflow,
  WorkflowEngine,
  Executor,
  Task,
} from './types';

import { toEnvName, filterScheduledJobs } from './utils';
import { createStdExecutor, createDockerExecutor } from './executor';
import { schedule } from './scheduler';

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

  return result;
}

function getHostEnv(env: string[]): string[] {
  const result: string[] = [];

  for (const key of env) {
    if (key in process.env) {
      result.push(`${key}=${process.env[key]}`);
    }
  }

  return result;
}

type CreateWorkflowEngineOptions = {
  docker: WrappedDocker;
  runtime: RuntimeInterface;
};

export function createWorkflowEngine(options: CreateWorkflowEngineOptions): WorkflowEngine {
  const { docker, runtime } = options;

  return {
    async run(workflow: Workflow, jobs?: string[]) {
      const scheduledJobs = filterScheduledJobs(workflow.jobs, jobs);
      const computedEnv = await computeEnvVariables(docker, runtime);

      for (const [jobId, job] of Object.entries(scheduledJobs)) {
        console.log(chalk.yellow(`Running "${jobId} job"`));

        const jobEnv = job.env ?? [];
        const shell = job.shell ?? 'sh';
        const maxParallel = job.maxParallel ?? 1;
        const hostEnv = job.hostEnv ?? [];

        const execEnv = [...computedEnv, ...getHostEnv(hostEnv), ...jobEnv];

        const executor: Executor = job.image
          ? createDockerExecutor(docker, job.image, runtime.config?.docker.network)
          : createStdExecutor();

        const queue: Task<number>[] = [];

        // eslint-disable-next-line guard-for-in
        for (const cmdId in job.commands) {
          queue.push(() => executor.exec(
            `${jobId}[${cmdId}]`,
            [shell, '-c', job.commands[cmdId]],
            {
              stdout: process.stdout,
              stderr: process.stderr,
            },
            {
              cwd: process.cwd(),
              env: execEnv,
              gid: runtime.gid,
              uid: runtime.uid,
            },
          ));
        }

        // eslint-disable-next-line no-await-in-loop
        const results = await schedule<number>(queue, maxParallel);

        for (const result of results) {
          if (result.error) {
            throw result.error;
          }

          if (result.result !== 0) {
            console.error(chalk.red(`Command of "${jobId}" job finished with exit code ${result.result}`));
            process.exit(result.result);
          }
        }
      }
    },
  };
}
