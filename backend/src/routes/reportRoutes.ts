/**
 * LedgerLens — Report Routes
 *
 * GET /api/reports/summary — Dashboard KPI summary
 * GET /api/reports/export  — CSV export of reconciliation results
 */

import { Router } from 'express';
import { getSummaryMetrics, exportCsv } from '../controllers/reportController';

const router = Router();

router.get('/summary', getSummaryMetrics);
router.get('/export', exportCsv);

export default router;
