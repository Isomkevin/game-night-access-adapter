/**
 * Smoke-test: start bridge/server.js with system Node, hit /health, stop.
 * Does not require Electron. Run from repo root: node launcher/scripts/smoke-bridge.mjs
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const entry = path.join(root, 'bridge', 'server.js');
const port = Number(process.env.GNAA_SMOKE_PORT || 18775);

function health() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, { timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, json: JSON.parse(body) });
        } catch {
          resolve({ ok: false, json: null });
        }
      });
    });
    req.on('error', () => resolve({ ok: false, json: null }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, json: null });
    });
  });
}

const logs = [];
const child = spawn(process.execPath, [entry], {
  cwd: path.join(root, 'bridge'),
  env: { ...process.env, PORT: String(port), GNAA_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let settled = false;
child.stdout?.on('data', (b) => logs.push(String(b)));
child.stderr?.on('data', (b) => logs.push(String(b)));
child.on('exit', (code, signal) => {
  logs.push(`[exit code=${code} signal=${signal}]\n`);
});

const deadline = Date.now() + 20000;
while (Date.now() < deadline) {
  if (child.exitCode != null) break;
  const h = await health();
  if (h.ok) {
    console.log('OK bridge health', h.json);
    settled = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 300));
}

try {
  child.kill('SIGTERM');
} catch {
  /* ignore */
}
await new Promise((r) => setTimeout(r, 200));

if (!settled) {
  console.error('FAIL: bridge did not become healthy on port', port);
  console.error(logs.join('') || '(no process output)');
  process.exit(1);
}
