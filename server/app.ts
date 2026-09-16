import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// Import Route Handlers
import { authRouter } from './routes/authRoutes.js';
import { superAdminRouter } from './routes/superAdminRoutes.js';
import { companyRouter } from './routes/companyRoutes.js';
import { buildingRouter, roomRouter } from './routes/buildingRoutes.js';
import { rentalRouter, contractRouter } from './routes/rentalRoutes.js';
import { meterRouter, invoiceRouter, paymentRouter } from './routes/billingRoutes.js';
import { serviceRouter, serviceRequestRouter } from './routes/serviceRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { docsRouter } from './routes/docsRoutes.js';
import { operationsRouter } from './routes/operationsRoutes.js';
import { crmRouter } from './routes/crmRoutes.js';
import { financialRouter } from './routes/financialRoutes.js';
import { reviewRouter } from './routes/reviewRoutes.js';
import { pushRouter } from './routes/pushRoutes.js';

export function createApp() {
  const app = express();

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
  app.use('/api/v1/crm', crmRouter);
  app.use('/api/v1/finance', financialRouter);
  app.use('/api/v1/reviews', reviewRouter);
  app.use('/api/v1/push', pushRouter);
  app.use('/api/v1/docs', docsRouter);
  app.use('/api/docs', (req, res) => res.redirect('/api/v1/docs'));

  return app;
}
