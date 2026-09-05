/**
 * LedgerLens — Audit Routes
 *
 * GET /api/audit-logs — Query audit logs
 */

import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditController';

const router = Router();

router.get('/', listAuditLogs);

export default router;
