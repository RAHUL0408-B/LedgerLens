/**
 * LedgerLens — CSV Parser
 *
 * Parses a CSV buffer into an array of raw string records.
 * Does NOT validate — validation is handled by Zod schemas in importSchemas.ts
 */

import { parse } from 'csv-parse/sync';
import { ImportError } from './importTypes';

export interface ParseResult {
  records: Record<string, string>[];
  errors: ImportError[];
}

export function parseCsvBuffer(buffer: Buffer): ParseResult {
  const errors: ImportError[] = [];

  if (buffer.length === 0) {
    return {
      records: [],
      errors: [{ row: 0, message: 'File is empty' }],
    };
  }

  let records: Record<string, string>[];

  try {
    records = parse(buffer, {
      columns: true,           // Use first row as headers
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
      bom: true,               // Handle UTF-8 BOM from Excel exports
    }) as Record<string, string>[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown parse error';
    return {
      records: [],
      errors: [{ row: 0, message: `CSV parse error: ${msg}` }],
    };
  }

  if (records.length === 0) {
    return {
      records: [],
      errors: [{ row: 0, message: 'CSV contains headers but no data rows' }],
    };
  }

  return { records, errors };
}
