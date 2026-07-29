import { AppSettings, LogEntry, TransferJob, TransferReport, ProviderName } from '@/shared/types';
import { IStorage } from '@/storage/IStorage';

export class ChromeStorage implements IStorage {
  private readonly prefix = 'harmonysync';

  private getStorageKey(key: string): string {
    return `${this.prefix}.${key}`;
  }

  async getSettings(): Promise<AppSettings> {
    const key = this.getStorageKey('settings');
    const result = await chrome.storage.local.get(key);
    const stored = result[key];

    if (this.isAppSettings(stored)) {
      return stored;
    }

    return {
      sourceProvider: ProviderName.APPLE_MUSIC,
      destinationProvider: ProviderName.YOUTUBE_MUSIC,
      autoMatchThreshold: 95,
      askUserThreshold: 80,
      persistQueue: true,
      enableLogging: true,
    };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await chrome.storage.local.set({ [this.getStorageKey('settings')]: settings });
  }

  async getTransferJob(jobId: string): Promise<TransferJob | null> {
    const key = this.getStorageKey(`job.${jobId}`);
    const result = await chrome.storage.local.get(key);
    const stored = result[key];
    return this.isTransferJob(stored) ? stored : null;
  }

  async saveTransferJob(job: TransferJob): Promise<void> {
    await chrome.storage.local.set({ [this.getStorageKey(`job.${job.id}`)]: job });
  }

  async listTransferJobs(): Promise<TransferJob[]> {
    const result = await chrome.storage.local.get(null);
    return Object.values(result)
      .filter((value): value is TransferJob => this.isTransferJob(value))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async getLogs(jobId?: string): Promise<LogEntry[]> {
    const key = this.getStorageKey('logs');
    const result = await chrome.storage.local.get(key);
    const logs = (result[key] ?? []) as LogEntry[];
    return jobId ? logs.filter((entry) => entry.jobId === jobId) : logs;
  }

  async appendLog(entry: LogEntry): Promise<void> {
    const logs = await this.getLogs();
    logs.push(entry);
    await chrome.storage.local.set({ [this.getStorageKey('logs')]: logs });
  }

  async saveTransferReport(report: TransferReport): Promise<void> {
    await chrome.storage.local.set({ [this.getStorageKey(`report.${report.jobId}`)]: report });
  }

  async getTransferReport(jobId: string): Promise<TransferReport | null> {
    const key = this.getStorageKey(`report.${jobId}`);
    const result = await chrome.storage.local.get(key);
    const stored = result[key];
    return this.isTransferReport(stored) ? stored : null;
  }

  private isAppSettings(value: unknown): value is AppSettings {
    return (
      typeof value === 'object' &&
      value !== null &&
      'sourceProvider' in value &&
      'destinationProvider' in value &&
      'autoMatchThreshold' in value &&
      'askUserThreshold' in value &&
      'persistQueue' in value &&
      'enableLogging' in value
    );
  }

  private isTransferJob(value: unknown): value is TransferJob {
    return typeof value === 'object' && value !== null && 'id' in value && 'status' in value;
  }

  private isTransferReport(value: unknown): value is TransferReport {
    return typeof value === 'object' && value !== null && 'jobId' in value && 'status' in value;
  }
}
