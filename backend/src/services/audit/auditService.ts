/**
 * LedgerLens — Audit Trail Service
 *
 * Provides immutable audit logging for all critical operations.
 * Compliant with financial record-keeping standards.
 */

import { supabase } from '../../lib/supabase';

export type AuditAction =
  | 'IMPORT_STARTED'
  | 'IMPORT_COMPLETED'
  | 'IMPORT_FAILED'
  | 'RECONCILIATION_STARTED'
  | 'RECONCILIATION_COMPLETED'
  | 'RECONCILIATION_FAILED'
  | 'AI_INVESTIGATION'
  | 'AUTO_RESOLUTION'
  | 'REVIEW_REQUIRED'
  | 'MANUAL_RESOLUTION'
  | 'EXCEPTION_CREATED'
  | 'EXCEPTION_UPDATED'
  | 'SETTINGS_CHANGED';

export interface AuditLogEntry {
  userId?: string | null;
  action: AuditAction;
  entityType: 'exception' | 'run' | 'import' | 'settings';
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
}

export class AuditService {
  /**
   * Log an audit event.
   */
  public static async log(entry: AuditLogEntry): Promise<void> {
    try {
      await supabase.from('audit_logs').insert({
        user_id: entry.userId || null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        before_state: entry.beforeState || {},
        after_state: entry.afterState || {},
        reason: entry.reason || null,
      });
    } catch (err) {
      console.error('[AuditService] Failed to write audit log:', err);
    }
  }

  /**
   * Batch insert audit logs.
   */
  public static async logBatch(entries: AuditLogEntry[]): Promise<void> {
    if (!entries || entries.length === 0) return;
    try {
      const rows = entries.map((entry) => ({
        user_id: entry.userId || null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        before_state: entry.beforeState || {},
        after_state: entry.afterState || {},
        reason: entry.reason || null,
      }));
      await supabase.from('audit_logs').insert(rows);
    } catch (err) {
      console.error('[AuditService] Failed to write batch audit logs:', err);
    }
  }

  /**
   * Fetch recent audit logs with pagination and filters.
   */
  public static async getLogs(options?: {
    action?: string;
    entityType?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (options?.action) {
      query = query.eq('action', options.action);
    }
    if (options?.entityType) {
      query = query.eq('entity_type', options.entityType);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data, count };
  }
}
