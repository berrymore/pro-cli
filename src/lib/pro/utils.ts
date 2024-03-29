import path from 'node:path';
import fs from 'node:fs';

export function lookupConfig(basePath: string, fileName: string): string | undefined {
  let cursor = basePath;
  const { root } = path.parse(basePath);

  while (cursor !== root) {
    const configPath = path.join(cursor, fileName);

    if (fs.existsSync(configPath)) {
      return configPath;
    }

    cursor = path.dirname(cursor);
  }

  return undefined;
}
