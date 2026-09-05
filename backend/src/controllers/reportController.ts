/**
 * LedgerLens — Report Controller
 */

import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reports/reportService';

export async function getSummaryMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchantId = (req.query.merchantId as string) || 'demo_merchant';
    const data = await ReportService.getSummaryMetrics(merchantId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchantId = (req.query.merchantId as string) || 'demo_merchant';
    const csvContent = await ReportService.exportResultsCsv(merchantId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=reconciliation_export_${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}
