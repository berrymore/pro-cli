import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ConfigInterface, RuntimeInterface } from './types';
import { lookupConfig } from './utils';

export const CONFIG_FILE_NAME = '.pro.json';

export function createConfig(name: string): ConfigInterface {
  return {
    name,
    docker: {
      network: name,
    },
  };
}

export function createRuntime(): RuntimeInterface {
  const cwd = process.cwd();
  const { uid, gid } = os.userInfo();
  const configPath = lookupConfig(cwd, CONFIG_FILE_NAME);

  let config: ConfigInterface | undefined;

  if (configPath) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  return {
    cwd,
    uid,
    gid,
    config,
    nsRoot: configPath ? path.dirname(configPath) : undefined,
    assertNamespace() {
      if (!this.config) {
        throw new Error('You are not in a namespace');
      }
    },
  };
}
