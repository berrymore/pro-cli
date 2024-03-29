import { Environment, configure } from 'nunjucks';
import path from 'node:path';

import { WrappedDocker } from '../docker/types';

function setupFilters(engine: Environment, docker: WrappedDocker): void {
  engine.addFilter('service', async (name: string, project: string | undefined, callback) => {
    try {
      const services = (await docker.listComposeServices()).filter(
        (el) => el.service === name && (project ? el.project === project : false),
      );

      callback(null, services);
    } catch (e) {
      callback(e);
    }
  }, true);

  engine.addFilter('joinPath', (base: string, addition: string) => path.join(base, addition));
}

export function createEngine(docker: WrappedDocker): Environment {
  const engine = configure({});

  setupFilters(engine, docker);

  return engine;
}
