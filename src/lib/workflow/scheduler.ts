import { Task, TaskResult } from './types';

export function schedule<T>(tasks: Task<T>[], concurrency: number): Promise<TaskResult<T>[]> {
  const results: TaskResult<T>[] = [];

  let workers = 0;

  return new Promise((resolve) => {
    const run = async (task: Task<T>) => {
      workers += 1;

      const result: TaskResult<T> = {};

      try {
        result.result = await task();
      } catch (e) {
        result.error = e instanceof Error ? e : new Error(String(e));
      } finally {
        results.push(result);
        workers -= 1;

        const next = tasks.shift();

        if (next) {
          run(next).then();
        }

        if (!workers && !tasks.length) {
          resolve(results);
        }
      }
    };

    const queue = tasks.splice(0, concurrency);

    for (const queued of queue) {
      run(queued).then();
    }
  });
}
