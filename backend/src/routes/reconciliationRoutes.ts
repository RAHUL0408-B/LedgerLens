/**
 * LedgerLens — Reconciliation Routes
 *
 * POST /api/reconciliation/run      — Trigger full reconciliation
 * GET  /api/reconciliation/runs     — List past runs
 * GET  /api/reconciliation/runs/:id — Details of a specific run
 * GET  /api/reconciliation/results  — Filterable list of results
 */

import { Router } from 'express';
import {
  runReconciliation,
  listRuns,
  getRunDetails,
  getResults,
} from '../controllers/reconciliationController';

const router = Router();

router.post('/run', runReconciliation);
router.get('/runs', listRuns);
router.get('/runs/:id', getRunDetails);
router.get('/results', getResults);

export default router;
