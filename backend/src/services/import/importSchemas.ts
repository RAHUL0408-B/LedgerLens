/**
 * LedgerLens — Zod validation schemas for CSV imports
 *
 * Rules:
 * - Monetary values parsed as strings then validated as numeric decimals
 * - Dates accepted as ISO strings or YYYY-MM-DD
 * - IDs must be non-empty strings
 * - Currency must be a known 3-letter code
 */

import { z } from 'zod';

// ─── Shared helpers ────────────────────────────────────────────────────────────

const nonEmptyString = z
  .string()
  .trim()
  .min(1, 'Cannot be empty');

/** Accept a decimal string like "9764.00" or "9764" and validate it's a positive number */
const monetaryString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Must be a positive decimal number (e.g. 9764.00)')
  .refine((v) => parseFloat(v) >= 0, 'Amount cannot be negative');

/** Accept ISO date strings or YYYY-MM-DD */
const dateString = z
  .string()
  .trim()
  .refine(
    (v) => !isNaN(Date.parse(v)),
    'Must be a valid date (ISO 8601 or YYYY-MM-DD)'
  );

const currency = z
  .string()
  .trim()
  .length(3, 'Currency must be a 3-letter ISO code')
  .transform((v) => v.toUpperCase());

// ─── Payment CSV Schema ────────────────────────────────────────────────────────
export const paymentCsvSchema = z.object({
  payment_id:     nonEmptyString,
  merchant_id:    nonEmptyString.optional().default('demo_merchant'),
  customer_id:    z.string().trim().optional().default(''),
  amount:         monetaryString,
  currency:       currency.optional().default('INR'),
  status:         z
    .enum(['created', 'authorized', 'captured', 'failed', 'refunded'])
    .optional()
    .default('captured'),
  payment_method: z.string().trim().optional().default(''),
  payment_date:   dateString,
  source:         z.string().trim().optional().default('csv'),
});

export type PaymentCsvRow = z.infer<typeof paymentCsvSchema>;

// ─── Settlement CSV Schema ─────────────────────────────────────────────────────
export const settlementCsvSchema = z.object({
  settlement_id:   nonEmptyString,
  merchant_id:     nonEmptyString.optional().default('demo_merchant'),
  payment_id:      z.string().trim().optional().default(''),
  amount:          monetaryString,
  fees:            monetaryString.optional().default('0.00'),
  tax:             monetaryString.optional().default('0.00'),
  net_amount:      monetaryString,
  utr:             z.string().trim().optional().default(''),
  settlement_date: dateString,
  status:          z
    .enum(['pending', 'processed', 'failed', 'reversed'])
    .optional()
    .default('processed'),
  source:          z.string().trim().optional().default('csv'),
});

export type SettlementCsvRow = z.infer<typeof settlementCsvSchema>;

// ─── Bank Transaction CSV Schema ───────────────────────────────────────────────
export const bankTransactionCsvSchema = z.object({
  bank_reference:   nonEmptyString,
  merchant_id:      nonEmptyString.optional().default('demo_merchant'),
  utr:              z.string().trim().optional().default(''),
  amount:           monetaryString,
  transaction_type: z
    .enum(['credit', 'debit'])
    .optional()
    .default('credit'),
  transaction_date: dateString,
  description:      z.string().trim().optional().default(''),
  source:           z.string().trim().optional().default('csv'),
});

export type BankTransactionCsvRow = z.infer<typeof bankTransactionCsvSchema>;
