/**
 * LedgerLens — Import Controller
 *
 * Handles multipart file uploads and delegates to importService.
 * Returns consistent JSON responses for all import operations.
 */

import { Request, Response, NextFunction } from 'express';
import {
  importPayments,
  importSettlements,
  importBankTransactions,
} from '../services/import/importService';
import { createError } from '../middleware/errorHandler';
import { ImportResult } from '../services/import/importTypes';

function getFileBuffer(req: Request): Buffer {
  if (!req.file) {
    throw createError('No file uploaded. Send a CSV file as multipart/form-data with field name "file".', 400, 'NO_FILE');
  }
  if (!req.file.originalname.toLowerCase().endsWith('.csv') &&
      req.file.mimetype !== 'text/csv' &&
      req.file.mimetype !== 'application/csv') {
    throw createError('Only CSV files are accepted.', 400, 'INVALID_FILE_TYPE');
  }
  return req.file.buffer;
}

function sendImportResponse(res: Response, type: string, result: ImportResult) {
  const statusCode = result.errors.length > 0 && result.imported === 0 ? 422 : 200;
  res.status(statusCode).json({
    type,
    received: result.received,
    imported: result.imported,
    rejected: result.rejected,
    duplicates: result.duplicates,
    errors: result.errors.slice(0, 50), // cap error list in response
    success: result.imported > 0,
  });
}

// POST /api/import/payments
export async function handleImportPayments(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const buffer = getFileBuffer(req);
    const result = await importPayments(buffer);
    sendImportResponse(res, 'payments', result);
  } catch (err) {
    next(err);
  }
}

// POST /api/import/settlements
export async function handleImportSettlements(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const buffer = getFileBuffer(req);
    const result = await importSettlements(buffer);
    sendImportResponse(res, 'settlements', result);
  } catch (err) {
    next(err);
  }
}

// POST /api/import/bank-transactions
export async function handleImportBankTransactions(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const buffer = getFileBuffer(req);
    const result = await importBankTransactions(buffer);
    sendImportResponse(res, 'bank_transactions', result);
  } catch (err) {
    next(err);
  }
}

// POST /api/import/all — uploads all three in one request & optionally runs reconciliation
export async function handleImportAll(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;

    if (!files) {
      throw createError(
        'No files uploaded. Send payments, settlements, and bank_transactions as multipart fields.',
        400, 'NO_FILES'
      );
    }

    const results: Record<string, ImportResult | { error: string }> = {};

    const importPromises: Promise<void>[] = [];

    if (files.payments?.[0]) {
      importPromises.push(
        importPayments(files.payments[0].buffer).then((res) => {
          results.payments = res;
        })
      );
    }
    if (files.settlements?.[0]) {
      importPromises.push(
        importSettlements(files.settlements[0].buffer).then((res) => {
          results.settlements = res;
        })
      );
    }
    if (files.bank_transactions?.[0]) {
      importPromises.push(
        importBankTransactions(files.bank_transactions[0].buffer).then((res) => {
          results.bank_transactions = res;
        })
      );
    }

    if (importPromises.length === 0) {
      throw createError(
        'No recognised file fields found. Use field names: payments, settlements, bank_transactions.',
        400, 'NO_RECOGNISED_FILES'
      );
    }

    await Promise.all(importPromises);

    const totalImported = Object.values(results).reduce(
      (sum, r) => sum + ('imported' in r ? r.imported : 0), 0
    );

    let reconciliationResult = null;
    const shouldReconcile = req.query.reconcile === 'true' || req.body?.reconcile === 'true';

    if (shouldReconcile) {
      const { ReconciliationOrchestrator } = await import('../services/reconciliation/orchestrator');
      const orchestrator = new ReconciliationOrchestrator();
      reconciliationResult = await orchestrator.run({ merchantId: 'demo_merchant' });
    }

    res.json({
      success: totalImported > 0,
      totalImported,
      results,
      reconciliation: reconciliationResult,
    });
  } catch (err) {
    next(err);
  }
}


// POST /api/import/demo — loads generated demo datasets directly from disk
export async function handleLoadDemoData(
  _req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const fs = await import('fs');
    const path = await import('path');

    const dataDir = path.resolve(__dirname, '../../../data/generated');
    const paymentsPath = path.join(dataDir, 'payments.csv');
    const settlementsPath = path.join(dataDir, 'settlements.csv');
    const bankPath = path.join(dataDir, 'bank_transactions.csv');

    if (!fs.existsSync(paymentsPath) || !fs.existsSync(settlementsPath) || !fs.existsSync(bankPath)) {
      throw createError(
        'Generated demo CSV files not found in data/generated. Run npm run generate-data first.',
        404,
        'DEMO_DATA_NOT_FOUND'
      );
    }

    const paymentsBuf = fs.readFileSync(paymentsPath);
    const settlementsBuf = fs.readFileSync(settlementsPath);
    const bankBuf = fs.readFileSync(bankPath);

    const [pResult, sResult, bResult] = await Promise.all([
      importPayments(paymentsBuf),
      importSettlements(settlementsBuf),
      importBankTransactions(bankBuf),
    ]);

    res.json({
      success: true,
      message: 'Demo dataset imported successfully',
      results: {
        payments: pResult,
        settlements: sResult,
        bank_transactions: bResult,
      },
      totalImported: pResult.imported + sResult.imported + bResult.imported,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/import/reset — clears all transactions, reconciliation runs, and exceptions
export async function handleResetData(
  _req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { supabase } = await import('../lib/supabase');
    await supabase.from('exceptions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reconciliation_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('reconciliation_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('settlements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('bank_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    res.json({
      success: true,
      message: 'All ledger data, reconciliation runs, and exceptions have been reset successfully.',
    });
  } catch (err) {
    next(err);
  }
}


