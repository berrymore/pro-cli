import chalk from 'chalk';

import { WrappedDocker } from '../docker/types';
import { RuntimeInterface } from '../pro/types';

import {
  Workflow,
  WorkflowEngine,
  JobsDictionary,
  Executor,
} from './types';

import { toEnvName } from './utils';
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

        const executor: Executor = job.image
          ? createDockerExecutor(docker, job.image, runtime.config?.docker.network)
          : createStdExecutor();

        for (const command of job.commands) {
          // eslint-disable-next-line no-await-in-loop
          await executor.exec(
            ['sh', '-c', command],
            {
              stdout: process.stdout,
              stderr: process.stderr,
            },
            {
              cwd: process.cwd(),
              env: [...envVariables, ...jobEnvVariables],
              gid: runtime.gid,
              uid: runtime.uid,
            },
          );
        }
      }
    },
  };
}
