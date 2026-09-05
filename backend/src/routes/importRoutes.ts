/**
 * LedgerLens — Import Routes
 *
 * POST /api/import/payments            — upload payments.csv
 * POST /api/import/settlements         — upload settlements.csv
 * POST /api/import/bank-transactions   — upload bank_transactions.csv
 * POST /api/import/all                 — upload all three at once
 */

import { Router } from 'express';
import multer from 'multer';
import {
  handleImportPayments,
  handleImportSettlements,
  handleImportBankTransactions,
  handleImportAll,
  handleLoadDemoData,
  handleResetData,
} from '../controllers/importController';

const router = Router();

const MAX_SIZE_MB = parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '50', 10);

// Single-file upload (in-memory — no disk writes)
const singleUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/csv', 'text/plain', 'application/octet-stream'];
    const isAllowed = allowed.includes(file.mimetype) || file.originalname.endsWith('.csv');
    if (!isAllowed) {
      return cb(new Error(`Only CSV files are accepted. Got: ${file.mimetype}`));
    }
    cb(null, true);
  },
}).single('file');

// Multi-file upload for /all endpoint
const multiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
}).fields([
  { name: 'payments', maxCount: 1 },
  { name: 'settlements', maxCount: 1 },
  { name: 'bank_transactions', maxCount: 1 },
]);

router.post('/payments',           singleUpload, handleImportPayments);
router.post('/settlements',        singleUpload, handleImportSettlements);
router.post('/bank-transactions',  singleUpload, handleImportBankTransactions);
router.post('/all',                multiUpload,  handleImportAll);
router.post('/demo',               handleLoadDemoData);
router.post('/reset',              handleResetData);

export default router;


