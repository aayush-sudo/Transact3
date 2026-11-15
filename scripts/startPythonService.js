const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const serviceDir = path.join(root, 'python-service');
const localPython = process.platform === 'win32'
  ? path.join(serviceDir, '.venv', 'Scripts', 'python.exe')
  : path.join(serviceDir, '.venv', 'bin', 'python');
const python = process.env.PYTHON
  || (fs.existsSync(localPython) ? localPython : (process.platform === 'win32' ? 'python' : 'python3'));
const args = [
  '-m',
  'uvicorn',
  'app.main:app',
  '--app-dir',
  serviceDir,
  '--host',
  process.env.FASTAPI_HOST || '127.0.0.1',
  '--port',
  process.env.FASTAPI_PORT || '8000',
  '--reload',
  '--reload-dir',
  serviceDir
];

const service = spawn(python, args, { cwd: root, env: process.env, stdio: 'inherit' });

service.on('error', (error) => {
  console.error(`Could not start the Python FastAPI service with "${python}": ${error.message}`);
  process.exitCode = 1;
});

service.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => service.kill(signal));
}
