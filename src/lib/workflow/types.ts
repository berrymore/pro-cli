export enum EntityType {
  workflow = 'workflow',
}

interface Entity {
  kind: EntityType;
}

// Workflow Entity

interface WorkflowJob {
  image?: string;
  env?: string[];
  commands: string[];
}

export type JobsDictionary = { [id: string]: WorkflowJob };

export interface Workflow extends Entity {
  kind: EntityType.workflow;
  name: string;
  jobs: JobsDictionary;
}

// ExecFunction

export type ExecFunction = (
  cmd: string[],
  outputStream: NodeJS.WritableStream,
  errorStream: NodeJS.WritableStream,
  cwd: string,
  env: string[]
) => Promise<number>;

// Engine

export interface WorkflowEngine {
  run(workflow: Workflow, jobs?: string[]): void;
}
