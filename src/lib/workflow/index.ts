import chalk from 'chalk';

import { WrappedDocker } from '../docker/types';
import { RuntimeInterface } from '../pro/types';

import {
  Workflow,
  WorkflowEngine,
  Executor,
} from './types';

import { toEnvName, filterScheduledJobs } from './utils';
import { createStdExecutor, createDockerExecutor } from './executor';

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

type CreateWorkflowEngineOptions = {
  docker: WrappedDocker;
  runtime: RuntimeInterface;
};

export function createWorkflowEngine(options: CreateWorkflowEngineOptions): WorkflowEngine {
  const { docker, runtime } = options;

  return {
    async run(workflow: Workflow, jobs?: string[]) {
      console.log(chalk.blue(`Running "${workflow.name}" workflow`));

      const scheduledJobs = filterScheduledJobs(workflow.jobs, jobs);
      const globalEnv = await computeEnvVariables(docker, runtime);

      for (const [jobId, job] of Object.entries(scheduledJobs)) {
        console.log(chalk.yellow(`Job "${jobId}"`));

        const jobEnv = job.env ?? [];
        const shell = job.shell ?? 'sh';

        const executor: Executor = job.image
          ? createDockerExecutor(docker, job.image, runtime.config?.docker.network)
          : createStdExecutor();

        for (const command of job.commands) {
          // eslint-disable-next-line no-await-in-loop
          const statusCode = await executor.exec(
            [shell, '-c', command],
            {
              stdout: process.stdout,
              stderr: process.stderr,
            },
            {
              cwd: process.cwd(),
              env: [...globalEnv, ...jobEnv],
              gid: runtime.gid,
              uid: runtime.uid,
            },
          );

          if (statusCode !== 0) {
            console.error(chalk.red(`Command of "${jobId}" job finished with exit code ${statusCode}`));
            process.exit(statusCode);
          }
        }
      }
    },
  };
}
