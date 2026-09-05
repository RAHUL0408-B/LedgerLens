/**
 * LedgerLens — Exception Routes
 *
 * GET  /api/exceptions             — List and filter exceptions
 * GET  /api/exceptions/:id         — Exception detail view
 * POST /api/exceptions/:id/resolve — Human review / manual resolution
 */

import { Router } from 'express';
import {
  listExceptions,
  getExceptionById,
  resolveException,
} from '../controllers/exceptionController';

const router = Router();

router.get('/', listExceptions);
router.get('/:id', getExceptionById);
router.post('/:id/resolve', resolveException);

export default router;
