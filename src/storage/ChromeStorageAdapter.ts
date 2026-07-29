import { Logger } from '@/utils/Logger';
import { AppSettings, LogEntry, TransferJob, TransferReport, ProviderName } from '@/shared/types';
import { IStorage } from '@/storage/IStorage';
import { STORAGE_KEYS } from '@/shared/constants';

export class ChromeStorageAdapter implements IStorage {
  constructor(private readonly logger: Logger = new Logger({ module: 'ChromeStorageAdapter' })) {}

  async getSettings(): Promise<AppSettings> {
    const key = this.getKey(STORAGE_KEYS.settings);
    const result = await chrome.storage.local.get(key);
    const value = result[key];

    if (this.isAppSettings(value)) {
      return value;
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
    await chrome.storage.local.set({ [this.getKey(STORAGE_KEYS.settings)]: settings });
  }

  async getTransferJob(jobId: string): Promise<TransferJob | null> {
    const result = await chrome.storage.local.get(this.getKey(`${STORAGE_KEYS.jobs}.${jobId}`));
    const value = result[this.getKey(`${STORAGE_KEYS.jobs}.${jobId}`)];
    return this.isTransferJob(value) ? value : null;
  }

  async saveTransferJob(job: TransferJob): Promise<void> {
    await chrome.storage.local.set({ [this.getKey(`${STORAGE_KEYS.jobs}.${job.id}`)]: job });
  }

  async listTransferJobs(): Promise<TransferJob[]> {
    const result = await chrome.storage.local.get(null);
    return Object.values(result)
      .filter((value): value is TransferJob => this.isTransferJob(value))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async getLogs(jobId?: string): Promise<LogEntry[]> {
    const result = await chrome.storage.local.get(this.getKey(STORAGE_KEYS.logs));
    const logs = result[this.getKey(STORAGE_KEYS.logs)] ?? [];
    return Array.isArray(logs) && logs.every((entry) => this.isLogEntry(entry))
      ? jobId
        ? logs.filter((entry) => entry.jobId === jobId)
        : logs
      : [];
  }

  async appendLog(entry: LogEntry): Promise<void> {
    const logs = await this.getLogs();
    logs.push(entry);
    await chrome.storage.local.set({ [this.getKey(STORAGE_KEYS.logs)]: logs });
  }

  async saveTransferReport(report: TransferReport): Promise<void> {
    await chrome.storage.local.set({ [this.getKey(`${STORAGE_KEYS.reports}.${report.jobId}`)]: report });
  }

  async getTransferReport(jobId: string): Promise<TransferReport | null> {
    const result = await chrome.storage.local.get(this.getKey(`${STORAGE_KEYS.reports}.${jobId}`));
    const value = result[this.getKey(`${STORAGE_KEYS.reports}.${jobId}`)];
    return this.isTransferReport(value) ? value : null;
  }

  private getKey(key: string): string {
    return `harmonysync.${key}`;
  }

  private isAppSettings(value: unknown): value is AppSettings {
    return typeof value === 'object' && value !== null && 'sourceProvider' in value && 'destinationProvider' in value;
  }

  private isTransferJob(value: unknown): value is TransferJob {
    return typeof value === 'object' && value !== null && 'id' in value && 'status' in value && 'updatedAt' in value;
  }

  private isTransferReport(value: unknown): value is TransferReport {
    return typeof value === 'object' && value !== null && 'jobId' in value && 'status' in value;
  }

  private isLogEntry(value: unknown): value is LogEntry {
    return typeof value === 'object' && value !== null && 'id' in value && 'message' in value && 'timestamp' in value;
  }
}
