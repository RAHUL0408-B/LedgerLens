/**
 * LedgerLens — Exceptions Controller
 */

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { AuditService } from '../services/audit/auditService';

export async function listExceptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, severity, exceptionType, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('exceptions')
      .select(`
        *,
        reconciliation_results (
          id,
          status,
          difference_amount,
          confidence_score,
          matching_rule,
          payments (*),
          settlements (*),
          bank_transactions (*)
        )
      `, { count: 'exact' })
      .order('priority', { ascending: true })
      .order('amount_at_risk', { ascending: false });

    if (status) query = query.eq('status', status as string);
    if (severity) query = query.eq('severity', severity as string);
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

export async function getExceptionById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const { data: exception, error } = await supabase
      .from('exceptions')
      .select(`
        *,
        reconciliation_results (
          *,
          payments (*),
          settlements (*),
          bank_transactions (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !exception) {
      res.status(404).json({ success: false, error: 'Exception record not found' });
      return;
    }

    res.status(200).json({ success: true, data: exception });
  } catch (err) {
    next(err);
  }
}

export async function resolveException(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { action, reason, assignedTo } = req.body;

    // Fetch existing state
    const { data: current, error: getErr } = await supabase
      .from('exceptions')
      .select('*')
      .eq('id', id)
      .single();

    if (getErr || !current) {
      res.status(404).json({ success: false, error: 'Exception not found' });
      return;
    }

    const newStatus = action === 'REJECT' ? 'unresolved' : 'resolved';
    const resolutionReason = reason || `Manual resolution applied: ${action || 'ACCEPTED'}`;

    const { data: updated, error: updateErr } = await supabase
      .from('exceptions')
      .update({
        status: newStatus,
        assigned_to: assignedTo || null,
        resolution_reason: resolutionReason,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    // Audit log
    await AuditService.log({
      action: 'MANUAL_RESOLUTION',
      entityType: 'exception',
      entityId: id,
      beforeState: current,
      afterState: updated,
      reason: resolutionReason,
    });

    res.status(200).json({
      success: true,
      message: 'Exception status updated',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}
