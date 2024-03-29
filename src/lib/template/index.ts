import fs from 'node:fs';

import { Template, TemplateRenderer } from './types';
import { WrappedDocker } from '../docker/types';
import { createEngine } from './engine';

export function createTemplateRenderer(docker: WrappedDocker): TemplateRenderer {
  const engine = createEngine(docker);

  return {
    render(path: string, context?: object): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        engine.render(path, context, (err, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(err || new Error('Template engine has returned nothing'));
          }
        });
      });
    },
    renderString(content: string, context?: object): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        engine.renderString(content, context ?? {}, (err, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(err || new Error('Template engine has returned nothing'));
          }
        });
      });
    },
    renderTemplates(templates: Template[], context?: object): Promise<Template[]> {
      const queue: Promise<Template>[] = [];

      const createPromise = async (destination: string, content: Promise<string>): Promise<Template> => ({
        destination,
        content: await content,
      });

      for (const template of templates) {
        if (template.source) {
          if (!fs.existsSync(template.source)) {
            throw new Error(`File ${template.source} does not exist`);
          }

          queue.push(createPromise(template.destination, this.render(template.source, context)));
        } else {
          queue.push(createPromise(template.destination, this.renderString(template.content ?? '', context)));
        }
      }

      return Promise.all(queue);
    },
  };
}
