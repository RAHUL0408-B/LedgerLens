/**
 * LedgerLens — Import Service
 *
 * Orchestrates: parse → validate → normalize → upsert to Supabase
 *
 * Design:
 * - Processes rows in batches (BATCH_SIZE) for efficiency
 * - Skips duplicate records (by unique constraint) rather than failing the whole import
 * - Returns detailed per-row error information
 * - Never truncates existing data — only inserts new records
 */

import { supabase } from '../../lib/supabase';
import { parseCsvBuffer } from './csvParser';
import {
  paymentCsvSchema,
  settlementCsvSchema,
  bankTransactionCsvSchema,
} from './importSchemas';
import { ImportResult, ImportError } from './importTypes';
import { ZodSchema } from 'zod';

const BATCH_SIZE = 100;

// ─── Generic row validator + normalizer ───────────────────────────────────────
function validateRows<T>(
  records: Record<string, string>[],
  schema: ZodSchema<T>
): { valid: T[]; errors: ImportError[] } {
  const valid: T[] = [];
  const errors: ImportError[] = [];

  records.forEach((record, index) => {
    const row = index + 2; // +2: header row is row 1, data starts at row 2
    const result = schema.safeParse(record);

    if (result.success) {
      valid.push(result.data);
    } else {
      const fieldErrors = result.error.issues.map((issue) => ({
        row,
        field: issue.path.join('.'),
        value: String(record[issue.path[0] as string] ?? ''),
        message: issue.message,
      }));
      errors.push(...fieldErrors);
    }
  });

  return { valid, errors };
}

// ─── Batch upsert helper ──────────────────────────────────────────────────────
async function batchUpsert(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn: string
): Promise<{ inserted: number; duplicates: number; errors: ImportError[] }> {
  let inserted = 0;
  let duplicates = 0;
  const errors: ImportError[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from(table)
      .upsert(batch, {
        onConflict: conflictColumn,
        ignoreDuplicates: true, // skip silently instead of erroring
      })
      .select('id');

    if (error) {
      // Record batch-level error but continue
      errors.push({
        row: i + 2,
        message: `Database insert failed for batch starting at row ${i + 2}: ${error.message}`,
      });
    } else {
      // data contains only actually-inserted rows (duplicates are filtered)
      const batchInserted = data?.length ?? 0;
      duplicates += batch.length - batchInserted;
      inserted += batchInserted;
    }
  }

  return { inserted, duplicates, errors };
}

// ─── Import Payments ──────────────────────────────────────────────────────────
export async function importPayments(buffer: Buffer): Promise<ImportResult> {
  const { records, errors: parseErrors } = parseCsvBuffer(buffer);
  if (parseErrors.length > 0 && records.length === 0) {
    return { received: 0, imported: 0, rejected: 0, duplicates: 0, errors: parseErrors };
  }

  const { valid, errors: validationErrors } = validateRows(records, paymentCsvSchema);
  const allErrors: ImportError[] = [...parseErrors, ...validationErrors];

  if (valid.length === 0) {
    return {
      received: records.length,
      imported: 0,
      rejected: records.length,
      duplicates: 0,
      errors: allErrors,
    };
  }

  // Normalize: map CSV fields to DB columns
  const dbRows = valid.map((r) => ({
    merchant_id:     r.merchant_id,
    payment_id:      r.payment_id,
    customer_id:     r.customer_id || null,
    amount:          r.amount,
    currency:        r.currency,
    status:          r.status,
    payment_method:  r.payment_method || null,
    payment_date:    r.payment_date,
    source:          r.source,
    metadata:        {},
  }));

  const { inserted, duplicates, errors: dbErrors } = await batchUpsert(
    'payments',
    dbRows,
    'merchant_id,payment_id'
  );

  return {
    received: records.length,
    imported: inserted,
    rejected: validationErrors.length + dbErrors.length,
    duplicates,
    errors: [...allErrors, ...dbErrors],
  };
}

// ─── Import Settlements ───────────────────────────────────────────────────────
export async function importSettlements(buffer: Buffer): Promise<ImportResult> {
  const { records, errors: parseErrors } = parseCsvBuffer(buffer);
  if (parseErrors.length > 0 && records.length === 0) {
    return { received: 0, imported: 0, rejected: 0, duplicates: 0, errors: parseErrors };
  }

  const { valid, errors: validationErrors } = validateRows(records, settlementCsvSchema);
  const allErrors: ImportError[] = [...parseErrors, ...validationErrors];

  if (valid.length === 0) {
    return {
      received: records.length,
      imported: 0,
      rejected: records.length,
      duplicates: 0,
      errors: allErrors,
    };
  }

  const dbRows = valid.map((r) => ({
    merchant_id:     r.merchant_id,
    settlement_id:   r.settlement_id,
    amount:          r.amount,
    fees:            r.fees,
    tax:             r.tax,
    net_amount:      r.net_amount,
    utr:             r.utr || null,
    settlement_date: r.settlement_date,
    status:          r.status,
    source:          r.source,
    metadata:        {},
  }));

  const { inserted, duplicates, errors: dbErrors } = await batchUpsert(
    'settlements',
    dbRows,
    'merchant_id,settlement_id'
  );

  return {
    received: records.length,
    imported: inserted,
    rejected: validationErrors.length + dbErrors.length,
    duplicates,
    errors: [...allErrors, ...dbErrors],
  };
}

// ─── Import Bank Transactions ─────────────────────────────────────────────────
export async function importBankTransactions(buffer: Buffer): Promise<ImportResult> {
  const { records, errors: parseErrors } = parseCsvBuffer(buffer);
  if (parseErrors.length > 0 && records.length === 0) {
    return { received: 0, imported: 0, rejected: 0, duplicates: 0, errors: parseErrors };
  }

  const { valid, errors: validationErrors } = validateRows(records, bankTransactionCsvSchema);
  const allErrors: ImportError[] = [...parseErrors, ...validationErrors];

  if (valid.length === 0) {
    return {
      received: records.length,
      imported: 0,
      rejected: records.length,
      duplicates: 0,
      errors: allErrors,
    };
  }

  const dbRows = valid.map((r) => ({
    merchant_id:      r.merchant_id,
    bank_reference:   r.bank_reference,
    utr:              r.utr || null,
    amount:           r.amount,
    transaction_type: r.transaction_type,
    transaction_date: r.transaction_date,
    description:      r.description || null,
    source:           r.source,
    metadata:         {},
  }));

  const { inserted, duplicates, errors: dbErrors } = await batchUpsert(
    'bank_transactions',
    dbRows,
    'merchant_id,bank_reference'
  );

  return {
    received: records.length,
    imported: inserted,
    rejected: validationErrors.length + dbErrors.length,
    duplicates,
    errors: [...allErrors, ...dbErrors],
  };
}
