import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

import { createRuntime } from '../../lib/pro';
import { defaultFileName, createConfig, lookupConfig } from '../../lib/pro/config';
import { createGit } from '../../lib/git';
import { createTpl } from '../../lib/tpl';
import { createWorkflowEngine } from '../../lib/workflow';
import { createDocker } from '../../lib/docker';

const wwwDirectory = 'www';

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
      path.join(name, wwwDirectory),
      path.join(name, '.docker/images'),
      path.join(name, '.docker/etc'),
      path.join(name, '.docker/var'),
    ];

    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(name, defaultFileName),
      JSON.stringify(createConfig(name), null, 2),
    );

    console.log('Namespace has been created');
  });

const cloneCommand: Command = new Command('clone')
  .summary('clone repository')
  .description('Clone repository from GitHub')
  .argument('<repository>', 'repository to clone')
  .argument('<owner>', 'owner of the repository')
  .action((repository, owner) => {
    const runtime = createRuntime();
    const git = createGit();

    runtime.assertNamespace();

    const link = `${owner}/${repository}`;
    const { projects } = runtime.getConfig();

    git.clone(
      `git@github.com:${link}.git`,
      link in projects ? `${wwwDirectory}/${projects[link]}` : `github.com/${link}`,
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

const templateCommand: Command = new Command('template')
  .summary('handle template file')
  .argument('<input>', 'input file (.tpl or .yaml)')
  .action(async (input: string) => {
    const extName = path.extname(input);
    const tpl = createTpl();
    const runtime = createRuntime();

    if (!['.tpl', '.yaml'].includes(extName)) {
      throw new Error('Input file must have one of the following extensions: .tpl, .yaml');
    }

    if (!fs.existsSync(input)) {
      throw new Error(`File ${input} does not exist`);
    }

    const context = {
      runtime,
    };

    if (extName === '.yaml') {
      const yamlData = yaml.parse(fs.readFileSync(input, 'utf8'));

      const isValidData = typeof yamlData === 'object' && Array.isArray(yamlData?.templates);

      if (!isValidData) {
        throw new Error('YAML file is invalid');
      }

      const intents = await tpl.renderIntents(yamlData.templates, context);

      for (const intent of intents) {
        fs.mkdirSync(path.dirname(intent.destination), { recursive: true });
        fs.writeFileSync(intent.destination, intent.content ?? '');
      }
    } else {
      fs.writeFileSync(input.replace('.tpl', ''), await tpl.render(input, context));
    }
  });

interface WorkflowOptions {
  jobs?: Array<string>;
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
    const configPath = lookupConfig(process.cwd());

    console.log(configPath || 'Config file not found');
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
