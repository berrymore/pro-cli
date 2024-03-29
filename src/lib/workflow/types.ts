import { WriteStream } from 'node:tty';

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
  shell?: string;
  commands: string[];
}

export type JobsDictionary = { [id: string]: WorkflowJob };

export interface Workflow extends Entity {
  kind: EntityType.workflow;
  name: string;
  jobs: JobsDictionary;
}

// Executor

export type Stream = { stdout: WriteStream, stderr: WriteStream };
export type ExecOptions = { cwd: string, env: string[], uid: number, gid: number };

export interface Executor {
  exec(cmd: string[], stream: Stream, options: ExecOptions): Promise<number>;
}

// Engine

export interface WorkflowEngine {
  run(workflow: Workflow, jobs?: string[]): Promise<void>;
}
