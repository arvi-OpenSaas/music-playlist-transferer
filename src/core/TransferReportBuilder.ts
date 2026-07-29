import { Logger } from '@/utils/Logger';
import { TransferJob, TransferResult, TransferStatus } from '@/shared/types';

export interface TransferReportSummary {
  jobId: string;
  status: TransferStatus;
  startedAt: number;
  completedAt?: number;
  totalSongs: number;
  succeeded: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export interface TransferReportExport {
  summary: TransferReportSummary;
  details: TransferResult[];
}

export class TransferReportBuilder {
  constructor(private readonly logger: Logger = new Logger({ module: 'TransferReportBuilder' })) {}

  build(job: TransferJob, results: TransferResult[]): TransferReportSummary {
    const startedAt = job.createdAt;
    const completedAt = job.completedAt ?? Date.now();
    const succeeded = results.filter((result) => result.status === 'completed').length;
    const failed = results.filter((result) => result.status === 'failed').length;
    const skipped = results.filter((result) => result.status === 'skipped').length;
    const durationMs = Math.max(0, completedAt - startedAt);

    const summary: TransferReportSummary = {
      jobId: job.id,
      status: job.status,
      startedAt,
      completedAt,
      totalSongs: results.length,
      succeeded,
      failed,
      skipped,
      durationMs,
    };

    this.logger.info(`Built transfer report for ${job.id}`);
    return summary;
  }

  toJson(job: TransferJob, results: TransferResult[]): TransferReportExport {
    return {
      summary: this.build(job, results),
      details: results,
    };
  }

  toCsv(job: TransferJob, results: TransferResult[]): string {
    const headers = ['songId', 'status', 'message'];
    const rows = results.map((result) => [result.songId, result.status, result.message ?? ''].join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}
