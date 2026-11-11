/**
 * Spawn and supervise the existing Game Night bridge (bridge/server.js).
 */

const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { getBridgeDir, getBridgeEntry, getHealthUrl, DEFAULT_PORT } = require('./paths');

function resolveNodeRuntime() {
  // Prefer a real Node binary for ESM (bridge/package.json type=module).
  const candidates =
    process.platform === 'win32'
      ? ['node.exe', 'node']
      : ['node'];
  for (const cmd of candidates) {
    try {
      const check = spawnSync(cmd, ['-e', 'process.stdout.write("ok")'], {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true,
      });
      if (check.status === 0 && String(check.stdout).includes('ok')) {
        return { command: cmd, envExtra: {} };
      }
    } catch {
      /* try next */
    }
  }
  // Packaged / no system Node: run Electron binary as Node.
  return {
    command: process.execPath,
    envExtra: { ELECTRON_RUN_AS_NODE: '1' },
  };
}

class BridgeManager {
  constructor() {
    this.child = null;
    this.port = DEFAULT_PORT;
    this.restarting = false;
    this.onStatus = null;
  }

  setStatusHandler(fn) {
    this.onStatus = fn;
  }

  emit(status, detail) {
    if (typeof this.onStatus === 'function') {
      this.onStatus({ status, detail, port: this.port });
    }
  }

  async start(port = DEFAULT_PORT) {
    this.port = Number(port) || DEFAULT_PORT;
    if (this.child) {
      await this.stop();
    }

    const entry = getBridgeEntry();
    const cwd = getBridgeDir();
    if (!fs.existsSync(entry)) {
      const msg = `Bridge not found at ${entry}`;
      this.emit('error', msg);
      throw new Error(msg);
    }

    // Ensure ws is available (dev: install next to bridge; packaged: bundled node_modules)
    const wsPkg = path.join(cwd, 'node_modules', 'ws');
    if (!fs.existsSync(wsPkg)) {
      this.emit('error', 'Bridge dependencies missing. Run: cd bridge && npm install');
      throw new Error('Missing bridge/node_modules/ws');
    }

    this.emit('starting', `Starting bridge on port ${this.port}`);

    const runtime = resolveNodeRuntime();
    this.child = spawn(runtime.command, [entry], {
      cwd,
      env: {
        ...process.env,
        ...runtime.envExtra,
        PORT: String(this.port),
        GNAA_PORT: String(this.port),
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.child.stdout?.on('data', (buf) => {
      const line = String(buf).trim();
      if (line) this.emit('log', line);
    });
    this.child.stderr?.on('data', (buf) => {
      const line = String(buf).trim();
      if (line) this.emit('log', line);
    });

    this.child.on('exit', (code, signal) => {
      this.child = null;
      if (!this.restarting) {
        this.emit('stopped', `Bridge exited (code ${code}, signal ${signal || 'none'})`);
      }
    });

    const ok = await this.waitUntilHealthy(45000);
    if (!ok) {
      await this.stop();
      this.emit('error', 'Bridge did not become healthy in time. Is port already in use?');
      throw new Error('Bridge health check timed out');
    }
    this.emit('running', `Bridge ready on http://127.0.0.1:${this.port}`);
    return true;
  }

  async stop() {
    if (!this.child) return;
    this.restarting = true;
    const child = this.child;
    this.child = null;
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 400));
    try {
      if (!child.killed) child.kill('SIGKILL');
    } catch {
      /* ignore */
    }
    this.restarting = false;
    this.emit('stopped', 'Bridge stopped');
  }

  async restart(port = this.port) {
    await this.stop();
    return this.start(port);
  }

  async health() {
    return new Promise((resolve) => {
      const req = http.get(getHealthUrl(this.port), { timeout: 2500 }, (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            resolve({ ok: res.statusCode === 200 && json.ok === true, json });
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

  async waitUntilHealthy(ms) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const h = await this.health();
      if (h.ok) return true;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }

  extensionConnected() {
    return this.health().then((h) => {
      const n = h.json?.clients?.extension || 0;
      return n > 0;
    });
  }
}

module.exports = { BridgeManager };
