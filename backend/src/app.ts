import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import healthRoutes from './routes/healthRoutes';
import importRoutes from './routes/importRoutes';
import reconciliationRoutes from './routes/reconciliationRoutes';
import exceptionRoutes from './routes/exceptionRoutes';
import auditRoutes from './routes/auditRoutes';
import reportRoutes from './routes/reportRoutes';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, true); // Permissive for local dev & demo
    },
    credentials: true,
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', healthRoutes);
app.use('/api/import', importRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/exceptions', exceptionRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/reports', reportRoutes);


// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
