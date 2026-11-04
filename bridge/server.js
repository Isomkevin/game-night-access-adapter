/**
 * Local bridge: WebSocket hub + static phone controller.
 * Bind 0.0.0.0 so a phone on LAN can open the controller page.
 * Prefer this wireless path over ADB/USB (macOS-friendly, no-extra-hardware).
 *
 * Omar owns production hardening / optional OS key simulation.
 * Kevin stub: fan-in inputs → fan-out to extension clients.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.GNAA_PORT || 18765);
const HUB_DIR = path.resolve(__dirname, 'hub');
const PHONE_DIR = path.resolve(__dirname, '../phone-controller');
const CAMERA_DIR = path.resolve(__dirname, '../camera');
const VOICE_DIR = path.resolve(__dirname, '../voice');
const UI_DIR = path.resolve(__dirname, '../packages/ui');

/** @type {Map<import('ws').WebSocket, { role: string }>} */
const clients = new Map();

function mime(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime(filePath) }).end(data);
  });
}

function countRoles() {
  const counts = {};
  for (const meta of clients.values()) {
    counts[meta.role] = (counts[meta.role] || 0) + 1;
  }
  return counts;
}

function broadcast(obj, except) {
  const raw = JSON.stringify(obj);
  for (const [ws, meta] of clients) {
    if (ws === except) continue;
    if (ws.readyState !== 1) continue;
    // Inputs + setRemap go to extensions; status goes to everyone
    if (
      (obj.type === 'input' || obj.type === 'setRemap') &&
      meta.role !== 'extension'
    ) {
      continue;
    }
    ws.send(raw);
  }
}

function broadcastStatus() {
  const msg = {
    type: 'status',
    clients: countRoles(),
    v: 1,
    ts: Date.now(),
  };
  const raw = JSON.stringify(msg);
  for (const [ws] of clients) {
    if (ws.readyState === 1) ws.send(raw);
  }
}

function lanAddresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, clients: countRoles() }));
    return;
  }

  let filePath;
  if (url.pathname === '/' || url.pathname === '/hub' || url.pathname === '/hub/') {
    filePath = path.join(HUB_DIR, 'index.html');
  } else if (url.pathname.startsWith('/hub/')) {
    filePath = path.join(HUB_DIR, url.pathname.slice('/hub/'.length));
  } else if (url.pathname === '/phone' || url.pathname === '/phone/') {
    filePath = path.join(PHONE_DIR, 'index.html');
  } else if (url.pathname.startsWith('/phone/')) {
    filePath = path.join(PHONE_DIR, url.pathname.slice('/phone/'.length));
  } else if (url.pathname === '/camera' || url.pathname === '/camera/') {
    filePath = path.join(CAMERA_DIR, 'index.html');
  } else if (url.pathname.startsWith('/camera/')) {
    filePath = path.join(CAMERA_DIR, url.pathname.slice('/camera/'.length));
  } else if (url.pathname === '/voice' || url.pathname === '/voice/') {
    filePath = path.join(VOICE_DIR, 'index.html');
  } else if (url.pathname.startsWith('/voice/')) {
    filePath = path.join(VOICE_DIR, url.pathname.slice('/voice/'.length));
  } else if (url.pathname.startsWith('/ui/')) {
    filePath = path.join(UI_DIR, url.pathname.slice('/ui/'.length));
  } else if (url.pathname.startsWith('/shared/')) {
    filePath = path.join(__dirname, '../packages/shared', url.pathname.slice('/shared/'.length));
  } else {
    // Convenience: legacy root assets from phone
    filePath = path.join(PHONE_DIR, url.pathname.slice(1));
  }
  serveFile(res, path.normalize(filePath));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  clients.set(ws, { role: 'unknown' });

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }

    if (msg.type === 'hello' && typeof msg.role === 'string') {
      clients.set(ws, { role: msg.role });
      broadcastStatus();
      return;
    }

    if (msg.type === 'input') {
      // Normalize: ensure ts/v
      const event = {
        ...msg,
        ts: msg.ts || Date.now(),
        v: msg.v || 1,
      };
      broadcast(event, ws);
      return;
    }

    if (msg.type === 'setRemap' && msg.entries && typeof msg.entries === 'object') {
      broadcast(
        {
          type: 'setRemap',
          entries: msg.entries,
          merge: msg.merge !== false,
          ts: msg.ts || Date.now(),
          v: msg.v || 1,
        },
        ws
      );
      return;
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastStatus();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lans = lanAddresses();
  console.log(`Game Night bridge on http://127.0.0.1:${PORT}`);
  console.log(`  Hub        http://127.0.0.1:${PORT}/`);
  console.log(`  WebSocket  ws://127.0.0.1:${PORT}`);
  console.log(`  Phone UI   http://127.0.0.1:${PORT}/phone/`);
  console.log(`  Camera UI  http://127.0.0.1:${PORT}/camera/`);
  console.log(`  Voice UI   http://127.0.0.1:${PORT}/voice/`);
  for (const ip of lans) {
    console.log(`  Phone LAN  http://${ip}:${PORT}/phone/`);
    console.log(`  Hub LAN    http://${ip}:${PORT}/`);
  }
});
