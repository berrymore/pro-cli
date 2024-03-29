import fs from 'node:fs';
import path from 'node:path';
import { configure, Environment as Nunjucks } from 'nunjucks';

import { createDocker } from '../docker';
import DockerWrapper from '../docker/DockerWrapper';

interface TemplateIntent {
  destination: string;
  content?: string;
  template?: string;
}

interface TemplateEngine {
  render(name: string, context?: object): Promise<string>;

  renderString(name: string, context?: object): Promise<string>;

  renderIntents(intents: Array<TemplateIntent>, context?: object): Promise<Array<TemplateIntent>>;
}

function configureNunjucks(engine: Nunjucks, docker: DockerWrapper): void {
  engine.addFilter('service', async (name: string, project: string | undefined, callback) => {
    try {
      const services = (await docker.listServices()).filter(
        (el) => el.service === name && (project ? el.project === project : false),
      );

      callback(null, services);
    } catch (e) {
      callback(e);
    }
  }, true);

  engine.addFilter('joinPath', (base: string, addition: string) => path.join(base, addition));
}

export function createTpl(): TemplateEngine {
  const engine: Nunjucks = configure({});

  configureNunjucks(engine, createDocker());

  return {
    render(name: string, context?: object): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        engine.render(name, context, (err, result) => {
          if (err) {
            reject(err);
          } else if (result === null) {
            reject(new Error('Template engine has returned nothing'));
          } else {
            resolve(result);
          }
        });
      });
    },
    renderString(name: string, context?: object): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        engine.renderString(name, context ?? {}, (err, result) => {
          if (err) {
            reject(err);
          } else if (result === null) {
            reject(new Error('Template engine has returned nothing'));
          } else {
            resolve(result);
          }
        });
      });
    },
    async renderIntents(
      intents: Array<TemplateIntent>,
      context?: object,
    ): Promise<Array<TemplateIntent>> {
      const result: Array<TemplateIntent> = [];
      const templateQueue: Array<Promise<string>> = [];
      const destinationQueue: Array<Promise<string>> = [];

      for (const intent of intents) {
        if (intent.template) {
          if (!fs.existsSync(intent.template)) {
            throw new Error(`File ${intent.template} does not exist`);
          }

          templateQueue.push(this.render(intent.template, context));
        } else {
          templateQueue.push(this.renderString(intent.content ?? '', context));
        }

        destinationQueue.push(this.renderString(intent.destination, context));
      }

      const templates = await Promise.all(templateQueue);
      const destinations = await Promise.all(destinationQueue);

      // eslint-disable-next-line guard-for-in
      for (const idx in templates) {
        result.push({ destination: destinations[idx], content: templates[idx] });
      }

      return result;
    },
  };
}
