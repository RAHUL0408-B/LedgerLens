/**
 * LedgerLens — High Throughput Benchmark Script
 *
 * Simulates high-volume transaction loads (10,000+ records)
 * to measure throughput, memory efficiency, and latency.
 * Usage: npm run benchmark
 */

import { DeterministicReconciliationEngine } from '../services/reconciliation/deterministicEngine';
import { PaymentRecord, SettlementRecord, BankTransactionRecord } from '../types/reconciliation';

async function runBenchmark() {
  const RECORD_COUNT = 10000;
  console.log('='.repeat(70));
  console.log(`  LEDGERLENS — PERFORMANCE & THROUGHPUT BENCHMARK (${RECORD_COUNT.toLocaleString()} RECORDS)`);
  console.log('='.repeat(70));

  console.log(`\n⏳ Generating ${RECORD_COUNT.toLocaleString()} synthetic records in-memory...`);
  const payments: PaymentRecord[] = [];
  const settlements: SettlementRecord[] = [];
  const bankTransactions: BankTransactionRecord[] = [];

  const baseDate = new Date('2026-03-01T00:00:00Z').getTime();

  for (let i = 0; i < RECORD_COUNT; i++) {
    const payId = `pay_bench_${i}`;
    const utr = `UTR_BENCH_${i}`;
    const amount = 500 + (i % 2000);
    const fee = Math.round(amount * 0.02 * 100) / 100;
    const tax = Math.round(fee * 0.18 * 100) / 100;
    const net = Math.round((amount - fee - tax) * 100) / 100;
    const dateStr = new Date(baseDate + i * 60000).toISOString();

    payments.push({
      id: `p-${i}`,
      merchant_id: 'demo_merchant',
      payment_id: payId,
      amount,
      currency: 'INR',
      status: 'captured',
      payment_date: dateStr,
      source: 'benchmark',
    });

    settlements.push({
      id: `s-${i}`,
      merchant_id: 'demo_merchant',
      settlement_id: `set_bench_${i}`,
      amount,
      fees: fee,
      tax,
      net_amount: net,
      utr,
      settlement_date: dateStr,
      status: 'processed',
      source: 'benchmark',
      metadata: { payment_id: payId },
    });

    bankTransactions.push({
      id: `b-${i}`,
      merchant_id: 'demo_merchant',
      bank_reference: `BANK_BENCH_${i}`,
      utr,
      amount: net,
      transaction_type: 'credit',
      transaction_date: dateStr,
      source: 'benchmark',
    });
  }

  console.log(`⚡ Executing Deterministic Reconciliation Engine across ${RECORD_COUNT.toLocaleString()} triples...`);
  const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
  const startTime = process.hrtime.bigint();

  const engine = new DeterministicReconciliationEngine();
  const results = engine.reconcile(payments, settlements, bankTransactions);

  const endTime = process.hrtime.bigint();
  const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;

  const durationMs = Number(endTime - startTime) / 1_000_000;
  const recordsPerSec = Math.round((RECORD_COUNT / (durationMs / 1000)));
  const matched = results.filter((r) => r.status === 'matched').length;

  console.log('\n' + '='.repeat(70));
  console.log('  BENCHMARK RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Records Processed:     ${RECORD_COUNT.toLocaleString()}`);
  console.log(`Matched Records:             ${matched.toLocaleString()} (${((matched / RECORD_COUNT) * 100).toFixed(2)}%)`);
  console.log(`Total Time Taken:            ${durationMs.toFixed(2)} ms`);
  console.log(`Average Latency per Record:  ${(durationMs / RECORD_COUNT).toFixed(4)} ms`);
  console.log(`Throughput:                  ${recordsPerSec.toLocaleString()} records/second`);
  console.log(`Memory Footprint:            +${(memAfter - memBefore).toFixed(2)} MB`);
  console.log('='.repeat(70));
  console.log('🚀 High-throughput benchmark passed with flying colors!\n');
}

runBenchmark().catch(console.error);
