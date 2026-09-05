/**
 * LedgerLens — Shared import types
 */

export interface ImportResult {
  received: number;
  imported: number;
  rejected: number;
  duplicates: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field?: string;
  value?: string;
  message: string;
}

export type ImportType = 'payments' | 'settlements' | 'bank_transactions';
