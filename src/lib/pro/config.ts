import path from 'node:path';
import fs from 'node:fs';

interface DockerConfigInterface {
  network: string;
}

export interface ConfigInterface {
  name: string;
  docker: DockerConfigInterface;
  projects: Record<string, string>;
}

export const defaultFileName = '.pro.json';

export function lookupConfig(basePath: string, fileName?: string): string | undefined {
  let cursor = basePath;
  const { root } = path.parse(basePath);

  while (cursor !== root) {
    const configPath = path.join(cursor, fileName ?? defaultFileName);

    if (fs.existsSync(configPath)) {
      return configPath;
    }

    cursor = path.dirname(cursor);
  }

  return undefined;
}

export function createConfig(name: string): ConfigInterface {
  return {
    name,
    docker: {
      network: name,
    },
    projects: {},
  };
}
