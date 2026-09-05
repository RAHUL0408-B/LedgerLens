/**
 * LedgerLens — Import Service Unit Tests
 *
 * Tests the CSV parse → validate → normalize pipeline without hitting the database.
 * Database upsert calls are mocked.
 */

import { parseCsvBuffer } from '../services/import/csvParser';
import { paymentCsvSchema, settlementCsvSchema, bankTransactionCsvSchema } from '../services/import/importSchemas';

// ─── CSV Parser Tests ─────────────────────────────────────────────────────────
describe('parseCsvBuffer', () => {
  it('parses a valid CSV', () => {
    const csv = `payment_id,amount,payment_date\npay_001,1000.00,2024-01-15`;
    const { records, errors } = parseCsvBuffer(Buffer.from(csv));
    expect(errors).toHaveLength(0);
    expect(records).toHaveLength(1);
    expect(records[0].payment_id).toBe('pay_001');
    expect(records[0].amount).toBe('1000.00');
  });

  it('returns error for empty file', () => {
    const { records, errors } = parseCsvBuffer(Buffer.from(''));
    expect(records).toHaveLength(0);
    expect(errors[0].message).toMatch(/empty/i);
  });

  it('returns error for header-only CSV', () => {
    const { records, errors } = parseCsvBuffer(Buffer.from('payment_id,amount\n'));
    expect(records).toHaveLength(0);
    expect(errors[0].message).toMatch(/no data rows/i);
  });

  it('handles BOM marker from Excel exports', () => {
    const csv = '\uFEFFpayment_id,amount\npay_001,1000.00';
    const { records, errors } = parseCsvBuffer(Buffer.from(csv, 'utf8'));
    expect(errors).toHaveLength(0);
    expect(records[0].payment_id).toBe('pay_001');
  });

  it('returns parse error for malformed CSV', () => {
    const csv = 'payment_id,amount\npay_001,"unclosed quote';
    const { records, errors } = parseCsvBuffer(Buffer.from(csv));
    expect(records).toHaveLength(0);
    expect(errors[0].message).toMatch(/parse error/i);
  });
});

// ─── Payment Schema Tests ─────────────────────────────────────────────────────
describe('paymentCsvSchema', () => {
  const validPayment = {
    payment_id:     'pay_001',
    amount:         '10000.00',
    currency:       'INR',
    status:         'captured',
    payment_date:   '2024-01-15T10:00:00Z',
  };

  it('accepts a valid payment row', () => {
    const result = paymentCsvSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it('rejects missing payment_id', () => {
    const result = paymentCsvSchema.safeParse({ ...validPayment, payment_id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid amount', () => {
    const result = paymentCsvSchema.safeParse({ ...validPayment, amount: '-100' });
    expect(result.success).toBe(false);
  });

  it('rejects amount with letters', () => {
    const result = paymentCsvSchema.safeParse({ ...validPayment, amount: '10k' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date', () => {
    const result = paymentCsvSchema.safeParse({ ...validPayment, payment_date: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = paymentCsvSchema.safeParse({ ...validPayment, status: 'paid' });
    expect(result.success).toBe(false);
  });

  it('applies defaults for optional fields', () => {
    const result = paymentCsvSchema.safeParse({
      payment_id: 'pay_001',
      amount: '100.00',
      payment_date: '2024-01-15',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('INR');
      expect(result.data.status).toBe('captured');
      expect(result.data.merchant_id).toBe('demo_merchant');
    }
  });
});

// ─── Settlement Schema Tests ──────────────────────────────────────────────────
describe('settlementCsvSchema', () => {
  const validSettlement = {
    settlement_id:   'setl_001',
    amount:          '10000.00',
    fees:            '200.00',
    tax:             '36.00',
    net_amount:      '9764.00',
    utr:             'UTR20240115001',
    settlement_date: '2024-01-16T09:00:00Z',
  };

  it('accepts a valid settlement row', () => {
    const result = settlementCsvSchema.safeParse(validSettlement);
    expect(result.success).toBe(true);
  });

  it('rejects missing settlement_id', () => {
    const result = settlementCsvSchema.safeParse({ ...validSettlement, settlement_id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid net_amount', () => {
    const result = settlementCsvSchema.safeParse({ ...validSettlement, net_amount: 'abc' });
    expect(result.success).toBe(false);
  });

  it('defaults fees and tax to 0.00 when omitted', () => {
    const result = settlementCsvSchema.safeParse({
      settlement_id: 'setl_001',
      amount: '10000.00',
      net_amount: '10000.00',
      settlement_date: '2024-01-16',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fees).toBe('0.00');
      expect(result.data.tax).toBe('0.00');
    }
  });
});

// ─── Bank Transaction Schema Tests ────────────────────────────────────────────
describe('bankTransactionCsvSchema', () => {
  const validBank = {
    bank_reference:   'BANK0000001',
    utr:              'UTR20240115001',
    amount:           '9764.00',
    transaction_type: 'credit',
    transaction_date: '2024-01-16T10:00:00Z',
  };

  it('accepts a valid bank transaction row', () => {
    const result = bankTransactionCsvSchema.safeParse(validBank);
    expect(result.success).toBe(true);
  });

  it('rejects missing bank_reference', () => {
    const result = bankTransactionCsvSchema.safeParse({ ...validBank, bank_reference: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid transaction_type', () => {
    const result = bankTransactionCsvSchema.safeParse({ ...validBank, transaction_type: 'transfer' });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = bankTransactionCsvSchema.safeParse({ ...validBank, amount: '-500' });
    expect(result.success).toBe(false);
  });

  it('defaults transaction_type to credit', () => {
    const result = bankTransactionCsvSchema.safeParse({
      bank_reference: 'BANK0000001',
      amount: '9764.00',
      transaction_date: '2024-01-16',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transaction_type).toBe('credit');
    }
  });
});
