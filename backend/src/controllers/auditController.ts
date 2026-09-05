/**
 * LedgerLens — Audit Controller
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit/auditService';

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { action, entityType, limit = 50, offset = 0 } = req.query;
    const result = await AuditService.getLogs({
      action: action as string,
      entityType: entityType as string,
      limit: Number(limit),
      offset: Number(offset),
    });

    res.status(200).json({
      success: true,
      data: result.data,
      total: result.count,
    });
  } catch (err) {
    next(err);
  }
}
