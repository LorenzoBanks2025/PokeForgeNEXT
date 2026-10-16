/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Health check endpoint for Render / cloud deployment monitors
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', app: 'PokeForge', timestamp: Date.now() });
});

// Check if a genuine ROM file is present in the server root
app.get('/api/rom-status', (_req, res) => {
  const romPath = path.resolve(__dirname, 'ROM.gba');
  if (fs.existsSync(romPath)) {
    const stats = fs.statSync(romPath);
    res.json({ available: true, size: stats.size, filename: 'ROM.gba' });
  } else {
    res.json({ available: false });
  }
});

// Download server ROM file directly to client
app.get('/api/load-rom', (_req, res) => {
  const romPath = path.resolve(__dirname, 'ROM.gba');
  if (fs.existsSync(romPath)) {
    res.sendFile(romPath);
  } else {
    res.status(404).json({ error: 'ROM.gba not found on server' });
  }
});

async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(distPath);

  if (isProduction && fs.existsSync(distPath)) {
    console.log(`[PokeForge Server] Serving production build from: ${distPath}`);
    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[PokeForge Server] Development mode: Mounting Vite middlewares');
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PokeForge Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[PokeForge Server] Failed to start:', err);
  process.exit(1);
});
