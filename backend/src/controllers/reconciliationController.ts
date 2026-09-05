/**
 * LedgerLens — Reconciliation Controller
 */

import { Request, Response, NextFunction } from 'express';
import { ReconciliationOrchestrator } from '../services/reconciliation/orchestrator';
import { supabase } from '../lib/supabase';

const orchestrator = new ReconciliationOrchestrator();

export async function runReconciliation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchantId = (req.body?.merchantId as string) || 'demo_merchant';
    const result = await orchestrator.run({ merchantId });
    res.status(200).json({
      success: true,
      message: 'Reconciliation completed successfully',
      data: result,
    });
  } catch (err: any) {
    next(err);
  }
}

export async function listRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Number(req.query.limit) || 20;
    const { data, error } = await supabase
      .from('reconciliation_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRunDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { data: run, error: runError } = await supabase
      .from('reconciliation_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (runError || !run) {
      res.status(404).json({ success: false, error: 'Run not found' });
      return;
    }

    const { data: results, error: resultsError } = await supabase
      .from('reconciliation_results')
      .select(`
        *,
        payments (*),
        settlements (*),
        bank_transactions (*)
      `)
      .eq('run_id', id)
      .limit(100);

    if (resultsError) throw resultsError;

    res.status(200).json({
      success: true,
      data: {
        run,
        results,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, exceptionType, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('reconciliation_results')
      .select(`
        *,
        payments (*),
        settlements (*),
        bank_transactions (*)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status as string);
    if (exceptionType) query = query.eq('exception_type', exceptionType as string);

    query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      total: count,
    });
  } catch (err) {
    next(err);
  }
}
