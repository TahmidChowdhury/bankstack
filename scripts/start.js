const { spawn } = require('node:child_process');
const path = require('node:path');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootDir = __dirname ? path.resolve(__dirname, '..') : process.cwd();

function runService(name, cwd, script) {
  const child = spawn(npmCommand, ['run', script], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] stopped with signal ${signal}`);
      return;
    }

    if (typeof code === 'number' && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });

  child.on('error', (error) => {
    console.error(`[${name}] failed to start`, error);
    shutdown(1);
  });

  return child;
}

const children = [
  runService('backend', path.join(rootDir, 'backend'), 'dev'),
  runService('frontend', path.join(rootDir, 'frontend'), 'dev'),
];

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }

  setTimeout(() => process.exit(exitCode), 100);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
