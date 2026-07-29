import { AppSettings, LogEntry, TransferJob, TransferReport } from '@/shared/types';

export interface IStorage {
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;

  getTransferJob(jobId: string): Promise<TransferJob | null>;
  saveTransferJob(job: TransferJob): Promise<void>;
  listTransferJobs(): Promise<TransferJob[]>;

  getLogs(jobId?: string): Promise<LogEntry[]>;
  appendLog(entry: LogEntry): Promise<void>;

  saveTransferReport(report: TransferReport): Promise<void>;
  getTransferReport(jobId: string): Promise<TransferReport | null>;
}
