import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';

export function createGit(): SimpleGit {
  const options: Partial<SimpleGitOptions> = {
    baseDir: process.cwd(),
    binary: 'git',
    maxConcurrentProcesses: 6,
    trimmed: false,
  };

  return simpleGit(options).outputHandler((_, stdout, stderr) => {
    stdout.pipe(process.stdout);
    stderr.pipe(process.stderr);
  });
}
