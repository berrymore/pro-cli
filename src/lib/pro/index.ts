import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ConfigInterface, lookupConfig } from './config';

export interface RuntimeInterface {
  cwd: string;
  configPath?: string;
  config?: ConfigInterface;
  nsRoot?: string;
  uid: number;
  gid: number;

  assertNamespace(): void;

  getConfig(): ConfigInterface;
}

export function createRuntime(): RuntimeInterface {
  const cwd: string = process.cwd();
  const configPath: string | undefined = lookupConfig(cwd);
  let config: ConfigInterface | undefined;

  if (configPath) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  return {
    cwd,
    configPath,
    config,
    nsRoot: configPath ? path.dirname(configPath) : undefined,
    uid: os.userInfo().uid,
    gid: os.userInfo().gid,
    assertNamespace() {
      if (!this.config) {
        throw new Error('You are not in a namespace');
      }
    },
    getConfig(): ConfigInterface {
      if (!this.config) {
        throw new Error('Cannot read a config file');
      }

      return this.config;
    },
  };
}
