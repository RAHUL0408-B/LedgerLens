/**
 * LedgerLens — Synthetic Financial Dataset Generator
 * Phase 3
 *
 * Generates realistic Indian financial data (INR) with deliberate exception scenarios.
 * - Never calls an LLM or external API
 * - Supports deterministic seeding for reproducible datasets
 * - Uses integer arithmetic (paise) internally, outputs as decimal rupees
 * - Produces ground_truth.json for evaluation (Phase 18)
 *
 * Usage:
 *   npx ts-node src/scripts/generateData.ts
 *   npx ts-node src/scripts/generateData.ts --count 500 --seed 42
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';

// ─── CLI Args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag: string, def: string) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const TOTAL_PAYMENTS = parseInt(getArg('--count', '1000'), 10);
const SEED = parseInt(getArg('--seed', '2024'), 10);

// ─── Seeded Pseudo-Random Number Generator (Mulberry32) ───────────────────────
function makePrng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makePrng(SEED);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)];
const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Format paise (integer) to decimal rupees string e.g. 976400 → "9764.00" */
function paiseToRupees(paise: number): string {
  const abs = Math.abs(paise);
  const sign = paise < 0 ? '-' : '';
  return `${sign}${Math.floor(abs / 100)}.${pad(abs % 100)}`;
}

/** Generate a date within a range (returns ISO string) */
function randomDate(start: Date, end: Date): string {
  const t = start.getTime() + rand() * (end.getTime() - start.getTime());
  return new Date(t).toISOString();
}

/** Deterministic UTR: UTR + YYYYMMDD + 8-digit sequence */
function makeUTR(seq: number): string {
  const d = new Date('2024-01-15');
  d.setDate(d.getDate() + Math.floor(seq / 100));
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `UTR${dateStr}${String(seq).padStart(8, '0')}`;
}

/** Generate a realistic Indian payment amount (in paise) */
function randomAmountPaise(): number {
  // Distribution: mostly small-to-mid range
  const ranges = [
    { min: 50000, max: 500000, weight: 40 },   // ₹500 – ₹5,000
    { min: 500000, max: 2500000, weight: 35 },  // ₹5,000 – ₹25,000
    { min: 2500000, max: 10000000, weight: 15 }, // ₹25,000 – ₹1,00,000
    { min: 10000000, max: 50000000, weight: 8 }, // ₹1,00,000 – ₹5,00,000
    { min: 50000000, max: 200000000, weight: 2 }, // ₹5,00,000 – ₹20,00,000
  ];
  const totalWeight = ranges.reduce((s, r) => s + r.weight, 0);
  let r = rand() * totalWeight;
  for (const range of ranges) {
    if (r < range.weight) {
      // Round to nearest 100 paise (₹1)
      const raw = randInt(range.min, range.max);
      return Math.round(raw / 100) * 100;
    }
    r -= range.weight;
  }
  return 1000000; // fallback ₹10,000
}

/** Calculate fee in paise (2% of amount, rounded to nearest paise) */
function calculateFee(amountPaise: number): number {
  return Math.round(amountPaise * 0.02);
}

/** Calculate GST in paise (18% of fee) */
function calculateGST(feePaise: number): number {
  return Math.round(feePaise * 0.18);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Scenario =
  | 'EXACT_MATCH'
  | 'FEE_DIFFERENCE'
  | 'TAX_DIFFERENCE'
  | 'DATE_DIFFERENCE'
  | 'MISSING_BANK_TRANSACTION'
  | 'MISSING_SETTLEMENT'
  | 'AMOUNT_MISMATCH'
  | 'DUPLICATE_TRANSACTION'
  | 'UNKNOWN_EXCEPTION';

interface PaymentRow {
  payment_id: string;
  merchant_id: string;
  customer_id: string;
  amount: string;
  currency: string;
  status: string;
  payment_method: string;
  payment_date: string;
  source: string;
}

interface SettlementRow {
  settlement_id: string;
  merchant_id: string;
  payment_id: string;  // cross-reference field for generator tracking
  amount: string;
  fees: string;
  tax: string;
  net_amount: string;
  utr: string;
  settlement_date: string;
  status: string;
  source: string;
}

interface BankTransactionRow {
  bank_reference: string;
  merchant_id: string;
  utr: string;
  amount: string;
  transaction_type: string;
  transaction_date: string;
  description: string;
  source: string;
}

interface GroundTruthEntry {
  scenario: Scenario;
  payment_id: string;
  settlement_id: string | null;
  bank_reference: string | null;
  payment_amount: string;
  settlement_net: string | null;
  bank_amount: string | null;
  expected_exception_type: string | null;
  expected_difference: string | null;
  notes: string;
}

// ─── Scenario Distribution for 1,000 records ──────────────────────────────────
const DISTRIBUTION: Record<Scenario, number> = {
  EXACT_MATCH:             700,
  FEE_DIFFERENCE:          100,
  TAX_DIFFERENCE:           30,
  DATE_DIFFERENCE:          50,
  MISSING_BANK_TRANSACTION: 50,
  MISSING_SETTLEMENT:       20,
  AMOUNT_MISMATCH:          25,
  DUPLICATE_TRANSACTION:    15,
  UNKNOWN_EXCEPTION:        10,
};

// Scale to target count
function buildScenarioList(): Scenario[] {
  const total = Object.values(DISTRIBUTION).reduce((a, b) => a + b, 0);
  const list: Scenario[] = [];
  for (const [scenario, count] of Object.entries(DISTRIBUTION)) {
    const scaled = Math.round((count / total) * TOTAL_PAYMENTS);
    for (let i = 0; i < scaled; i++) list.push(scenario as Scenario);
  }
  // Pad or trim to exact TOTAL_PAYMENTS
  while (list.length < TOTAL_PAYMENTS) list.push('EXACT_MATCH');
  return list.slice(0, TOTAL_PAYMENTS);
}

// ─── Generator ────────────────────────────────────────────────────────────────
function generate() {
  const scenarios = buildScenarioList();
  // Shuffle deterministically
  for (let i = scenarios.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [scenarios[i], scenarios[j]] = [scenarios[j], scenarios[i]];
  }

  const payments: PaymentRow[] = [];
  const settlements: SettlementRow[] = [];
  const bankTxns: BankTransactionRow[] = [];
  const groundTruth: GroundTruthEntry[] = [];

  const paymentMethods = ['upi', 'card', 'netbanking', 'wallet', 'upi', 'upi', 'card'];
  const baseDate = new Date('2024-01-01T00:00:00Z');
  const endDate  = new Date('2024-06-30T23:59:59Z');

  // Track used bank references for duplicate scenario
  const usedBankRefs = new Map<string, BankTransactionRow>();

  scenarios.forEach((scenario, idx) => {
    const seq = idx + 1;
    const payId = `pay_${String(seq).padStart(8, '0')}`;
    const settlId = `setl_${String(seq).padStart(8, '0')}`;
    const bankRef = `BANK${String(seq).padStart(10, '0')}`;
    const utr = makeUTR(seq);

    const amountPaise = randomAmountPaise();
    const feePaise = calculateFee(amountPaise);
    const gstPaise = calculateGST(feePaise);
    const netPaise = amountPaise - feePaise - gstPaise;

    const payDate = randomDate(baseDate, endDate);
    // Settlement is typically 1-3 days after payment
    const settlDate = new Date(new Date(payDate).getTime() + randInt(1, 3) * 86400000).toISOString();
    const bankDate  = new Date(new Date(settlDate).getTime() + randInt(0, 1) * 86400000).toISOString();

    // ── Payment (always created) ──────────────────────────────────────────────
    const payment: PaymentRow = {
      payment_id:     payId,
      merchant_id:    'demo_merchant',
      customer_id:    `cust_${String(randInt(1, 50000)).padStart(6, '0')}`,
      amount:         paiseToRupees(amountPaise),
      currency:       'INR',
      status:         'captured',
      payment_method: pick(paymentMethods),
      payment_date:   payDate,
      source:         'generated',
    };
    payments.push(payment);

    let settlementId: string | null = null;
    let bankReference: string | null = null;
    let settlNetStr: string | null = null;
    let bankAmtStr: string | null = null;
    let exceptionType: string | null = null;
    let expectedDiff: string | null = null;
    let notes = '';

    // ── Build settlement + bank based on scenario ─────────────────────────────
    switch (scenario) {
      // ────────────────────────────────────────────────────────────────────────
      case 'EXACT_MATCH': {
        // Payment → Settlement (correct net) → Bank (same as net)
        settlements.push({
          settlement_id:   settlId,
          merchant_id:     'demo_merchant',
          payment_id:      payId,
          amount:          paiseToRupees(amountPaise),
          fees:            paiseToRupees(feePaise),
          tax:             paiseToRupees(gstPaise),
          net_amount:      paiseToRupees(netPaise),
          utr,
          settlement_date: settlDate,
          status:          'processed',
          source:          'generated',
        });
        bankTxns.push({
          bank_reference:   bankRef,
          merchant_id:      'demo_merchant',
          utr,
          amount:           paiseToRupees(netPaise),
          transaction_type: 'credit',
          transaction_date: bankDate,
          description:      `NEFT CR ${utr} RAZORPAY`,
          source:           'generated',
        });
        settlementId = settlId;
        bankReference = bankRef;
        settlNetStr = paiseToRupees(netPaise);
        bankAmtStr  = paiseToRupees(netPaise);
        notes = 'Perfect 3-way match';
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case 'FEE_DIFFERENCE': {
        // Settlement has the correct fee deduction, but bank shows a DIFFERENT
        // amount (simulating a secondary fee or adjustment not in the settlement)
        const actualBankPaise = netPaise - randInt(100, 50000); // small extra deduction
        settlements.push({
          settlement_id:   settlId,
          merchant_id:     'demo_merchant',
          payment_id:      payId,
          amount:          paiseToRupees(amountPaise),
          fees:            paiseToRupees(feePaise),
          tax:             paiseToRupees(gstPaise),
          net_amount:      paiseToRupees(netPaise),
          utr,
          settlement_date: settlDate,
          status:          'processed',
          source:          'generated',
        });
        bankTxns.push({
          bank_reference:   bankRef,
          merchant_id:      'demo_merchant',
          utr,
          amount:           paiseToRupees(actualBankPaise),
          transaction_type: 'credit',
          transaction_date: bankDate,
          description:      `NEFT CR ${utr} RAZORPAY`,
          source:           'generated',
        });
        settlementId  = settlId;
        bankReference = bankRef;
        settlNetStr   = paiseToRupees(netPaise);
        bankAmtStr    = paiseToRupees(actualBankPaise);
        exceptionType = 'FEE_DIFFERENCE';
        expectedDiff  = paiseToRupees(Math.abs(netPaise - actualBankPaise));
        notes = 'Secondary fee deduction caused bank amount to differ from settlement net';
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case 'TAX_DIFFERENCE': {
        // Settlement records slightly different tax (rounding dispute)
        const altGstPaise = gstPaise + randInt(-500, 500); // ±₹5 rounding
        const altNetPaise = amountPaise - feePaise - altGstPaise;
        settlements.push({
          settlement_id:   settlId,
          merchant_id:     'demo_merchant',
          payment_id:      payId,
          amount:          paiseToRupees(amountPaise),
          fees:            paiseToRupees(feePaise),
          tax:             paiseToRupees(altGstPaise),
          net_amount:      paiseToRupees(altNetPaise),
          utr,
          settlement_date: settlDate,
          status:          'processed',
          source:          'generated',
        });
        bankTxns.push({
          bank_reference:   bankRef,
          merchant_id:      'demo_merchant',
          utr,
          amount:           paiseToRupees(netPaise), // bank uses original expected net
          transaction_type: 'credit',
          transaction_date: bankDate,
          description:      `NEFT CR ${utr} RAZORPAY`,
          source:           'generated',
        });
        settlementId  = settlId;
        bankReference = bankRef;
        settlNetStr   = paiseToRupees(altNetPaise);
        bankAmtStr    = paiseToRupees(netPaise);
        exceptionType = 'TAX_DIFFERENCE';
        expectedDiff  = paiseToRupees(Math.abs(altNetPaise - netPaise));
        notes = 'GST rounding difference between settlement and bank';
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case 'DATE_DIFFERENCE': {
        // Settlement and bank match on amount but bank is 4-7 days after payment
        // (outside the normal 1-3 day window)
        const lateBankDate = new Date(
          new Date(payDate).getTime() + randInt(4, 7) * 86400000
        ).toISOString();
        settlements.push({
          settlement_id:   settlId,
          merchant_id:     'demo_merchant',
          payment_id:      payId,
          amount:          paiseToRupees(amountPaise),
          fees:            paiseToRupees(feePaise),
          tax:             paiseToRupees(gstPaise),
          net_amount:      paiseToRupees(netPaise),
          utr,
          settlement_date: settlDate,
          status:          'processed',
          source:          'generated',
        });
        bankTxns.push({
          bank_reference:   bankRef,
          merchant_id:      'demo_merchant',
          utr,
          amount:           paiseToRupees(netPaise),
          transaction_type: 'credit',
          transaction_date: lateBankDate,
          description:      `NEFT CR ${utr} RAZORPAY`,
          source:           'generated',
        });
        settlementId  = settlId;
        bankReference = bankRef;
        settlNetStr   = paiseToRupees(netPaise);
        bankAmtStr    = paiseToRupees(netPaise);
        exceptionType = 'DATE_DIFFERENCE';
        expectedDiff  = '0.00';
        notes = 'Amounts match but bank credit is 4-7 days late';
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case 'MISSING_BANK_TRANSACTION': {
        // Settlement exists but no corresponding bank credit
        settlements.push({
          settlement_id:   settlId,
          merchant_id:     'demo_merchant',
          payment_id:      payId,
          amount:          paiseToRupees(amountPaise),
          fees:            paiseToRupees(feePaise),
          tax:             paiseToRupees(gstPaise),
          net_amount:      paiseToRupees(netPaise),
          utr,
          settlement_date: settlDate,
          status:          'processed',
          source:          'generated',
        });
        // No bank transaction added
        settlementId  = settlId;
        bankReference = null;
        settlNetStr   = paiseToRupees(netPaise);
        bankAmtStr    = null;
        exceptionType = 'MISSING_BANK';
        expectedDiff  = paiseToRupees(netPaise); // full net is at risk
        notes = 'Settlement processed but bank credit never appeared';
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case 'MISSING_SETTLEMENT': {
        // Payment captured but gateway never settled it
        // Bank also has no credit (no settlement → no bank credit)
        // No settlement or bank transaction added
        settlementId  = null;
        bankReference = null;
        settlNetStr   = null;
        bankAmtStr    = null;
        exceptionType = 'MISSING_SETTLEMENT';
        expectedDiff  = paiseToRupees(amountPaise);
        notes = 'Payment captured but gateway never created a settlement';
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case 'AMOUNT_MISMATCH': {
        // Settlement and bank both exist but bank amount doesn't match net
        const mismatchPaise = netPaise + (rand() > 0.5 ? 1 : -1) * randInt(100, 200000);
        settlements.push({
          settlement_id:   settlId,
          merchant_id:     'demo_merchant',
          payment_id:      payId,
          amount:          paiseToRupees(amountPaise),
          fees:            paiseToRupees(feePaise),
          tax:             paiseToRupees(gstPaise),
          net_amount:      paiseToRupees(netPaise),
          utr,
          settlement_date: settlDate,
          status:          'processed',
          source:          'generated',
        });
        bankTxns.push({
          bank_reference:   bankRef,
          merchant_id:      'demo_merchant',
          utr,
          amount:           paiseToRupees(Math.abs(mismatchPaise)),
          transaction_type: 'credit',
          transaction_date: bankDate,
          description:      `NEFT CR ${utr} RAZORPAY`,
          source:           'generated',
        });
        settlementId  = settlId;
        bankReference = bankRef;
        settlNetStr   = paiseToRupees(netPaise);
        bankAmtStr    = paiseToRupees(Math.abs(mismatchPaise));
        exceptionType = 'AMOUNT_MISMATCH';
        expectedDiff  = paiseToRupees(Math.abs(netPaise - mismatchPaise));
        notes = 'Bank amount differs from settlement net by an unexplained amount';
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case 'DUPLICATE_TRANSACTION': {
        // The bank credited the same UTR twice
        const dupBankRef = `BANKDUP${String(seq).padStart(9, '0')}`;
        settlements.push({
          settlement_id:   settlId,
          merchant_id:     'demo_merchant',
          payment_id:      payId,
          amount:          paiseToRupees(amountPaise),
          fees:            paiseToRupees(feePaise),
          tax:             paiseToRupees(gstPaise),
          net_amount:      paiseToRupees(netPaise),
          utr,
          settlement_date: settlDate,
          status:          'processed',
          source:          'generated',
        });
        // First (legitimate) bank credit
        bankTxns.push({
          bank_reference:   bankRef,
          merchant_id:      'demo_merchant',
          utr,
          amount:           paiseToRupees(netPaise),
          transaction_type: 'credit',
          transaction_date: bankDate,
          description:      `NEFT CR ${utr} RAZORPAY`,
          source:           'generated',
        });
        // Duplicate bank credit (same UTR, different bank_reference, slightly later date)
        const dupDate = new Date(new Date(bankDate).getTime() + 3600000).toISOString();
        bankTxns.push({
          bank_reference:   dupBankRef,
          merchant_id:      'demo_merchant',
          utr,
          amount:           paiseToRupees(netPaise),
          transaction_type: 'credit',
          transaction_date: dupDate,
          description:      `NEFT CR ${utr} RAZORPAY DUP`,
          source:           'generated',
        });
        settlementId  = settlId;
        bankReference = bankRef; // primary reference
        settlNetStr   = paiseToRupees(netPaise);
        bankAmtStr    = paiseToRupees(netPaise);
        exceptionType = 'DUPLICATE';
        expectedDiff  = paiseToRupees(netPaise); // duplicate amount at risk
        notes = `Duplicate bank credit: ${bankRef} and ${dupBankRef} both reference UTR ${utr}`;
        break;
      }

      // ────────────────────────────────────────────────────────────────────────
      case 'UNKNOWN_EXCEPTION': {
        // All three records exist but the differences are inconsistent and
        // don't fit any standard pattern — tests AI "knows when to say UNRESOLVED"
        const weirdBankPaise = randInt(
          Math.floor(netPaise * 0.5),
          Math.floor(netPaise * 1.5)
        );
        const altFeePaise = randInt(
          Math.floor(feePaise * 0.7),
          Math.floor(feePaise * 1.3)
        );
        const altGstPaise = randInt(
          Math.floor(gstPaise * 0.7),
          Math.floor(gstPaise * 1.3)
        );
        const altNetPaise = amountPaise - altFeePaise - altGstPaise;
        settlements.push({
          settlement_id:   settlId,
          merchant_id:     'demo_merchant',
          payment_id:      payId,
          amount:          paiseToRupees(amountPaise),
          fees:            paiseToRupees(altFeePaise),
          tax:             paiseToRupees(altGstPaise),
          net_amount:      paiseToRupees(altNetPaise),
          utr,
          settlement_date: settlDate,
          status:          'processed',
          source:          'generated',
        });
        bankTxns.push({
          bank_reference:   bankRef,
          merchant_id:      'demo_merchant',
          utr,
          amount:           paiseToRupees(weirdBankPaise),
          transaction_type: 'credit',
          transaction_date: bankDate,
          description:      `NEFT CR ${utr} RAZORPAY ADJ`,
          source:           'generated',
        });
        settlementId  = settlId;
        bankReference = bankRef;
        settlNetStr   = paiseToRupees(altNetPaise);
        bankAmtStr    = paiseToRupees(weirdBankPaise);
        exceptionType = 'UNKNOWN';
        expectedDiff  = paiseToRupees(Math.abs(altNetPaise - weirdBankPaise));
        notes = 'Inconsistent amounts across all three records — no standard pattern applies';
        break;
      }
    }

    // ── Ground truth entry ────────────────────────────────────────────────────
    groundTruth.push({
      scenario,
      payment_id:             payId,
      settlement_id:          settlementId,
      bank_reference:         bankReference,
      payment_amount:         paiseToRupees(amountPaise),
      settlement_net:         settlNetStr,
      bank_amount:            bankAmtStr,
      expected_exception_type: exceptionType,
      expected_difference:    expectedDiff,
      notes,
    });
  });

  // ─── Write CSVs ─────────────────────────────────────────────────────────────
  const outDir = path.resolve(__dirname, '../../../data/generated');
  fs.mkdirSync(outDir, { recursive: true });

  const toCsv = (rows: Record<string, string>[]): string => {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const v = row[h] ?? '';
            // Quote values containing commas or quotes
            return v.includes(',') || v.includes('"')
              ? `"${v.replace(/"/g, '""')}"`
              : v;
          })
          .join(',')
      ),
    ];
    return lines.join('\n');
  };

  fs.writeFileSync(path.join(outDir, 'payments.csv'), toCsv(payments as unknown as Record<string, string>[]));
  fs.writeFileSync(path.join(outDir, 'settlements.csv'), toCsv(settlements as unknown as Record<string, string>[]));
  fs.writeFileSync(path.join(outDir, 'bank_transactions.csv'), toCsv(bankTxns as unknown as Record<string, string>[]));
  fs.writeFileSync(path.join(outDir, 'ground_truth.json'), JSON.stringify({ seed: SEED, total: TOTAL_PAYMENTS, generated_at: new Date().toISOString(), distribution: DISTRIBUTION, records: groundTruth }, null, 2));

  // ─── Summary ────────────────────────────────────────────────────────────────
  const counts: Record<string, number> = {};
  for (const gt of groundTruth) counts[gt.scenario] = (counts[gt.scenario] ?? 0) + 1;

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   LedgerLens Dataset Generator — Complete          ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\n  Seed:          ${SEED}`);
  console.log(`  Payments:      ${payments.length}`);
  console.log(`  Settlements:   ${settlements.length}`);
  console.log(`  Bank Txns:     ${bankTxns.length}`);
  console.log(`\n  Scenario Distribution:`);
  for (const [s, c] of Object.entries(counts)) {
    const bar = '█'.repeat(Math.round(c / TOTAL_PAYMENTS * 40));
    console.log(`    ${s.padEnd(28)} ${String(c).padStart(4)}  ${bar}`);
  }
  console.log(`\n  Output: ${outDir}`);
  console.log('    payments.csv');
  console.log('    settlements.csv');
  console.log('    bank_transactions.csv');
  console.log('    ground_truth.json');
  console.log('');
}

generate();
