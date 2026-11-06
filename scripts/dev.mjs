import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

const services = [
  {
    name: 'api',
    cwd: path.join(root, 'backend'),
    url: 'http://127.0.0.1:4000/api/v1/agents',
  },
  {
    name: 'web',
    cwd: path.join(root, 'frontend'),
    url: 'http://127.0.0.1:5174',
  },
];

console.log('Starting Delivery Agent Management System…');
for (const service of services) console.log(`  ${service.name.padEnd(4)} -> ${service.url}`);

const children = services.map((service) =>
  spawn(npm, ['run', 'dev'], {
    cwd: service.cwd,
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
  }),
);

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

children.forEach((child) => {
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error('A dev server stopped; shutting the other one down.');
      shutdown(code ?? 1);
    }
  });
  child.on('error', (error) => {
    console.error(`Failed to start a dev server: ${error.message}`);
    shutdown(1);
  });
});
