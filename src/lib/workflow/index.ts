import chalk from 'chalk';

import DockerWrapper from '../docker/DockerWrapper';
import { RuntimeInterface } from '../pro';

type JobsDict = { [id: string]: WorkflowJob };

interface Workflow {
  kind: 'workflow';
  name: string;
  jobs: JobsDict;
}

interface WorkflowJob {
  image: string;
  env?: Array<string>;
  commands: Array<string>;
}

interface WorkflowEngine {
  run(workflow: Workflow, targetJobs?: Array<string>): void;
}

function anyCaseToEnvName(str: string): string {
  // convert camelCase to kebab-case
  // convert kebab-case to ENV_NAME
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    .split('-').map((word) => word.toUpperCase())
    .join('_');
}

async function computeEnvVariables(docker: DockerWrapper, runtime: RuntimeInterface): Promise<Array<string>> {
  const result: Array<string> = [];
  const services = await docker.listServices();

  const pushVar = (key: string, value: any) => result.push(`PRO_${anyCaseToEnvName(key)}=${value}`);

  for (const service of services) {
    if (service.defaultNetwork) {
      pushVar(`${service.project}_${service.service}_IP_ADDR`, service.defaultNetwork?.IPAddress);
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

export interface WorkflowEngineDeps {
  docker: DockerWrapper;
  runtime: RuntimeInterface;
}

export function createWorkflowEngine(deps: WorkflowEngineDeps): WorkflowEngine {
  const { docker, runtime } = deps;
  const { uid, gid } = runtime;
  const network = runtime.config?.docker.network;

  return {
    async run(workflow: Workflow, targetJobs?: Array<string>) {
      console.log(chalk.blue(`Running "${workflow.name}" workflow`));

      const env = await computeEnvVariables(docker, runtime);
      let queuedJobs: JobsDict = {};

      if (targetJobs) {
        for (const targetJob of targetJobs) {
          if (!(targetJob in workflow.jobs)) {
            throw new Error(`Job "${targetJob}" is undefined in workflow "${workflow.name}"`);
          }

          queuedJobs[targetJob] = workflow.jobs[targetJob];
        }
      } else {
        queuedJobs = workflow.jobs;
      }

      for (const [jobId, job] of Object.entries(queuedJobs)) {
        console.log(chalk.yellow(`Job "${jobId}"`));

        const jobEnv: Array<string> = job.env ?? [];

        for (const command of job.commands) {
          // eslint-disable-next-line no-await-in-loop
          await docker.driver.run(
            job.image,
            ['sh', '-c', command],
            process.stdout,
            {
              HostConfig: {
                AutoRemove: true,
                Mounts: [
                  {
                    Target: '/project',
                    Source: process.cwd(),
                    Type: 'bind',
                  },
                ],
                NetworkMode: network,
              },
              WorkingDir: '/project',
              User: `${uid}:${gid}`,
              Env: [...env, ...jobEnv],
            },
          );
        }
      }
    },
  };
}
