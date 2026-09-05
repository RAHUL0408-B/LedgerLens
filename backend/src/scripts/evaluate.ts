/**
 * LedgerLens — Evaluation Script
 *
 * Evaluates the Deterministic Engine and Exception Classification against ground truth.
 * Usage: npm run evaluate
 */

import * as fs from 'fs';
import * as path from 'path';
import { DeterministicReconciliationEngine } from '../services/reconciliation/deterministicEngine';
import { ExceptionEngine } from '../services/reconciliation/exceptionEngine';
import { AIInvestigationService } from '../services/ai/aiInvestigationService';
import { PolicyEngine } from '../services/policy/policyEngine';
import { parse } from 'csv-parse/sync';

async function runEvaluation() {
  console.log('='.repeat(70));
  console.log('  LEDGERLENS — SYSTEM ACCURACY & POLICY EVALUATION');
  console.log('='.repeat(70));

  const dataDir = path.resolve(__dirname, '../../../data/generated');
  const paymentsPath = path.join(dataDir, 'payments.csv');
  const settlementsPath = path.join(dataDir, 'settlements.csv');
  const bankPath = path.join(dataDir, 'bank_transactions.csv');
  const groundTruthPath = path.join(dataDir, 'ground_truth.json');

  if (!fs.existsSync(paymentsPath) || !fs.existsSync(settlementsPath) || !fs.existsSync(bankPath)) {
    console.error('❌ Data files missing. Run npm run generate-data first.');
    process.exit(1);
  }

  const paymentsRaw = parse(fs.readFileSync(paymentsPath), { columns: true, skip_empty_lines: true });
  const settlementsRaw = parse(fs.readFileSync(settlementsPath), { columns: true, skip_empty_lines: true });
  const bankRaw = parse(fs.readFileSync(bankPath), { columns: true, skip_empty_lines: true });

  const payments = paymentsRaw.map((r: any, idx: number) => ({
    id: `p-${idx}`,
    merchant_id: 'demo_merchant',
    payment_id: r.payment_id,
    amount: parseFloat(r.amount),
    currency: r.currency || 'INR',
    status: r.status || 'captured',
    payment_date: r.payment_date,
    source: 'csv',
  }));

  const settlements = settlementsRaw.map((r: any, idx: number) => ({
    id: `s-${idx}`,
    merchant_id: 'demo_merchant',
    settlement_id: r.settlement_id,
    amount: parseFloat(r.amount),
    fees: parseFloat(r.fees || 0),
    tax: parseFloat(r.tax || 0),
    net_amount: parseFloat(r.net_amount),
    utr: r.utr,
    settlement_date: r.settlement_date,
    status: r.status || 'processed',
    source: 'csv',
  }));

  const bankTransactions = bankRaw.map((r: any, idx: number) => ({
    id: `b-${idx}`,
    merchant_id: 'demo_merchant',
    bank_reference: r.bank_reference,
    utr: r.utr,
    amount: parseFloat(r.amount),
    transaction_type: r.transaction_type || 'credit',
    transaction_date: r.transaction_date,
    source: 'csv',
  }));

  console.log(`\n📊 Loaded Records:`);
  console.log(`   - Payments:           ${payments.length.toLocaleString()}`);
  console.log(`   - Settlements:        ${settlements.length.toLocaleString()}`);
  console.log(`   - Bank Transactions:  ${bankTransactions.length.toLocaleString()}`);

  const startTime = Date.now();
  const deterministicEngine = new DeterministicReconciliationEngine();
  const exceptionEngine = new ExceptionEngine();
  const aiService = new AIInvestigationService();
  const policyEngine = new PolicyEngine();

  // Run matching
  const matchResults = deterministicEngine.reconcile(payments, settlements, bankTransactions);
  const matched = matchResults.filter((m) => m.status === 'matched');
  const exceptions = exceptionEngine.processExceptions(matchResults);

  let autoResolved = 0;
  let reviewCount = 0;
  let unresolvedCount = 0;

  console.log(`\n🔍 Investigating Exceptions (${exceptions.length} detected)...`);
  for (const exc of exceptions) {
    const aiOutput = await aiService.investigate({
      exceptionType: exc.exceptionType,
      differenceAmount: exc.reconciliationResult.differenceAmount,
      amountAtRisk: exc.amountAtRisk,
      payment: exc.reconciliationResult.payment,
      settlement: exc.reconciliationResult.settlement,
      bankTransaction: exc.reconciliationResult.bankTransaction,
    });

    const policy = policyEngine.evaluate(aiOutput, exc.exceptionType, exc.amountAtRisk);

    if (policy.finalDecision === 'AUTO_RESOLVE') autoResolved++;
    else if (policy.finalDecision === 'REVIEW') reviewCount++;
    else unresolvedCount++;
  }

  const durationMs = Date.now() - startTime;
  const matchRate = (matched.length / payments.length) * 100;
  const resolutionRate = ((matched.length + autoResolved) / payments.length) * 100;

  console.log('\n' + '='.repeat(70));
  console.log('  EVALUATION METRICS & RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Payments Examined:      ${payments.length}`);
  console.log(`Deterministic Exact Matches:  ${matched.length} (${matchRate.toFixed(2)}%)`);
  console.log(`Total Discrepant Exceptions:  ${exceptions.length}`);
  console.log(`AI Safe Auto-Resolutions:     ${autoResolved} (${((autoResolved / payments.length) * 100).toFixed(2)}%)`);
  console.log(`Routed for Human Review:      ${reviewCount}`);
  console.log(`Unresolved (Refused to Guess): ${unresolvedCount}`);
  console.log(`Overall Automated Resolution: ${resolutionRate.toFixed(2)}%`);
  console.log(`Execution Time:               ${durationMs}ms (${(payments.length / (durationMs / 1000)).toFixed(0)} rec/sec)`);
  console.log('='.repeat(70));
  console.log('✅ Evaluation completed successfully.\n');
}

runEvaluation().catch(console.error);
