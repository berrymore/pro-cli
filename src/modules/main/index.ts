import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

import { createRuntime, createConfig, CONFIG_FILE_NAME } from '../../lib/pro';
import { lookupConfig } from '../../lib/pro/utils';
import { createGit } from '../../lib/git';
import { createTemplateRenderer } from '../../lib/template';
import { createWorkflowEngine } from '../../lib/workflow';
import { createDocker } from '../../lib/docker';

const initCommand: Command = new Command('init')
  .summary('init namespace')
  .argument('[name]', 'name of a namespace', 'dev')
  .action((name): void => {
    const runtime = createRuntime();

    if (fs.existsSync(name)) {
      console.error(`Namespace "${name}" already exists`);
      return;
    }

    if (runtime.config) {
      console.error(`You are currently in "${runtime.config.name}" namespace`);
      return;
    }

    const dirs = [
      path.join(name, 'github.com'),
      path.join(name, 'www'),
      path.join(name, '.docker/images'),
      path.join(name, '.docker/etc'),
      path.join(name, '.docker/var'),
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(name, CONFIG_FILE_NAME),
      JSON.stringify(createConfig(name), null, 2),
    );

    console.log('Namespace has been created');
  });

const cloneCommand: Command = new Command('clone')
  .summary('clone repository')
  .description('Clone repository from GitHub')
  .argument('<name>', 'repository to clone (owner/repository)')
  .argument('[dir]', 'directory to clone into')
  .action((name: string, dir?: string) => {
    const git = createGit();
    const repo = name.split('/');

    if (repo.length !== 2) {
      throw new Error(`Repository name format should be "owner/repository". Given: "${name}"`);
    }

    const [owner, repository] = repo;
    const link = `${owner}/${repository}`;

    git.clone(
      `git@github.com:${link}.git`,
      dir ?? `github.com/${link}`,
      undefined,
      (err) => {
        if (err) {
          console.error(err);
        } else {
          console.log('Repository has been cloned');
        }
      },
    );
  });

type TemplateOptions = {
  output?: string
}

const templateCommand: Command = new Command('template')
  .summary('handle template file')
  .argument('<input>', 'input file (.tpl or .yaml)')
  .option('-o, --output <path>', 'output filepath (for .tpl only)')
  .action(async (input: string, options: TemplateOptions) => {
    const extName = path.extname(input);

    const docker = createDocker();
    const templateRenderer = createTemplateRenderer(docker);
    const runtime = createRuntime();

    if (!['.tpl', '.yaml'].includes(extName)) {
      throw new Error('Input file must have one of the following extensions: .tpl, .yaml');
    }

    if (!fs.existsSync(input)) {
      throw new Error(`File ${input} does not exist`);
    }

    const context = {
      runtime,
      env: process.env,
    };

    if (extName === '.yaml') {
      const yamlData = yaml.parse(fs.readFileSync(input, 'utf8'));

      const isValidData = typeof yamlData === 'object' && Array.isArray(yamlData?.templates);

      if (!isValidData) {
        throw new Error('YAML file is invalid');
      }

      const templates = await templateRenderer.renderTemplates(yamlData.templates, context);

      for (const template of templates) {
        fs.mkdirSync(path.dirname(template.destination), { recursive: true });
        fs.writeFileSync(template.destination, template.content ?? '');
      }
    } else {
      let outputPath = path.join(runtime.cwd, path.basename(input, '.tpl'));

      if (options.output) {
        outputPath = path.isAbsolute(options.output)
          ? options.output
          : path.join(runtime.cwd, options.output)
      }

      fs.writeFileSync(
        outputPath,
        await templateRenderer.render(input, context)
      );
    }
  });

interface WorkflowOptions {
  jobs?: string[];
}

const workflowCommand: Command = new Command('workflow')
  .summary('run workflow')
  .argument('<file>', 'path to the workflow')
  .option('-j, --jobs [jobs]', 'jobs to be executed', (str) => str.split(','))
  .action((file: string, options: WorkflowOptions) => {
    const runtime = createRuntime();
    const docker = createDocker();

    const wkEngine = createWorkflowEngine(
      {
        runtime,
        docker,
      },
    );

    wkEngine.run(yaml.parse(fs.readFileSync(file, 'utf8')), options.jobs);
  });

const whichCommand: Command = new Command('which')
  .summary('show current config path')
  .action(() => {
    console.log(lookupConfig(process.cwd(), CONFIG_FILE_NAME) || 'Config file not found');
  });

export default {
  install(program: Command): void {
    program.addCommand(initCommand);
    program.addCommand(cloneCommand);
    program.addCommand(templateCommand);
    program.addCommand(workflowCommand);
    program.addCommand(whichCommand);
  },
};
