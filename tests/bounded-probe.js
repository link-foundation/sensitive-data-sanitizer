import { fork } from 'node:child_process';

export function boundedProbe(path) {
  return new Promise((resolve, reject) => {
    const child = fork(path, [], {
      execPath: 'node',
      execArgv: ['--max-old-space-size=128', '--stack_size=1024'],
      silent: true,
    });
    let problem,
      output = '',
      timer = setTimeout(
        () => fail(new Error('Probe startup exceeded 15 seconds')),
        15000
      );
    function fail(error) {
      problem ??= error;
      clearTimeout(timer);
      child.kill();
    }
    child.on('error', fail);
    child.once('message', () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => fail(new Error('Matching exceeded two seconds')),
        2000
      );
    });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.length > 4096) {
        fail(new Error('Probe output limit'));
      }
    });
    child.stderr.resume();
    child.on('close', (code) => {
      clearTimeout(timer);
      problem
        ? reject(problem)
        : code === 0
          ? resolve(JSON.parse(output))
          : reject(new Error(`Probe exited ${code}`));
    });
  });
}
