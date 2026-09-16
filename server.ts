import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { runSeed } from './server/seed.js';
import { getDatabase } from './server/db/connection.js';

// Import Route Handlers
import { authRouter } from './server/routes/authRoutes.js';
import { superAdminRouter } from './server/routes/superAdminRoutes.js';
import { companyRouter } from './server/routes/companyRoutes.js';
import { buildingRouter, roomRouter } from './server/routes/buildingRoutes.js';
import { rentalRouter, contractRouter } from './server/routes/rentalRoutes.js';
import { meterRouter, invoiceRouter, paymentRouter } from './server/routes/billingRoutes.js';
import { serviceRouter, serviceRequestRouter } from './server/routes/serviceRoutes.js';
import { notificationRouter } from './server/routes/notificationRoutes.js';
import { docsRouter } from './server/routes/docsRoutes.js';
import { operationsRouter } from './server/routes/operationsRoutes.js';

async function startServer() {
  const app = express();
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

  // Common Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Property Rental Management Platform',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // API v1 Routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/admin', superAdminRouter);
  app.use('/api/v1/companies', companyRouter);
  app.use('/api/v1/buildings', buildingRouter);
  app.use('/api/v1/rooms', roomRouter);
  app.use('/api/v1/rentals', rentalRouter);
  app.use('/api/v1/contracts', contractRouter);
  app.use('/api/v1/meters', meterRouter);
  app.use('/api/v1/invoices', invoiceRouter);
  app.use('/api/v1/payments', paymentRouter);
  app.use('/api/v1/services', serviceRouter);
  app.use('/api/v1/service-requests', serviceRequestRouter);
  app.use('/api/v1/notifications', notificationRouter);
  app.use('/api/v1/operations', operationsRouter);
  app.use('/api/v1/docs', docsRouter);
  app.use('/api/docs', (req, res) => res.redirect('/api/v1/docs'));

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
