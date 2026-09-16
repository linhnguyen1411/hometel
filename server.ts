import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { runSeed } from './server/seed.js';
import { getDatabase } from './server/db/connection.js';

import { createApp } from './server/app.js';

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  // Initialize DB and ensure Seed Data exists
  try {
    const db = getDatabase();
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    if (userCount === 0) {
      console.log('Database empty. Running initial seed...');
      await runSeed(true);
    } else {
      // Refresh seed to ensure all required tables and relationships are present
      await runSeed(true);
    }
  } catch (err) {
    console.error('Database initialization warning:', err);
  }

  const app = createApp();

  // Vite Middleware in Development vs Static in Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Property Rental Platform Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
