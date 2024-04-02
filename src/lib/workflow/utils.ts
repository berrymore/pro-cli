import { JobsDictionary } from './types';

export function toEnvName(str: string): string {
  // convert camelCase to kebab-case
  // convert kebab-case to ENV_NAME
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    .split('-').map((word) => word.toUpperCase())
    .join('_');
}

export function filterScheduledJobs(jobs: JobsDictionary, scheduled?: string[]): JobsDictionary {
  let result: JobsDictionary = jobs;

  if (scheduled) {
    result = {};

    for (const job of scheduled) {
      if (!(job in jobs)) {
        throw new Error(`Job "${job}" is undefined in the workflow"`);
      }

      result[job] = jobs[job];
    }
  }

  return result;
}

export function formatDate(date: Date): string {
  const pad = (num: number) => (num < 10 ? `0${num}` : num);

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
