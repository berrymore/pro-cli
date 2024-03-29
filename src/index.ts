import { Command } from 'commander';

import mainModule from './modules/main';

const program: Command = new Command('pro');

program
  .version('0.1.0')
  .description('Pro CLI');

mainModule.install(program);

program.parse(process.argv);
