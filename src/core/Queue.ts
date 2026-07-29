import { IStorage } from '@/storage/IStorage';
import { Song, TransferJob } from '@/shared/types';
import { Logger } from '@/utils/Logger';

export interface QueueState {
  jobId: string;
  pending: string[];
  completed: string[];
  paused: boolean;
  canceled: boolean;
  currentIndex: number;
}

export class Queue {
  private readonly storageKeyPrefix = 'queue';

  constructor(
    private readonly storage: IStorage,
    private readonly logger: Logger = new Logger({ module: 'Queue' }),
  ) {}

  async initialize(job: TransferJob, songs: Song[]): Promise<void> {
    const state: QueueState = {
      jobId: job.id,
      pending: songs.map((song) => song.id),
      completed: [],
      paused: false,
      canceled: false,
      currentIndex: 0,
    };

    await this.persistState(state);
    this.logger.info(`Initialized queue for ${job.id}`);
  }

  async getState(jobId: string): Promise<QueueState | null> {
    const result = await chrome.storage.local.get(this.storageKey(jobId));
    const stored = result[this.storageKey(jobId)];
    return typeof stored === 'object' && stored !== null ? (stored as QueueState) : null;
  }

  async next(jobId: string): Promise<string | null> {
    const state = await this.getState(jobId);
    if (!state) {
      return null;
    }

    if (state.paused || state.canceled) {
      return null;
    }

    const nextSongId = state.pending[state.currentIndex] ?? null;
    if (!nextSongId) {
      return null;
    }

    state.currentIndex += 1;
    await this.persistState(state);
    return nextSongId;
  }

  async markCompleted(jobId: string, songId: string): Promise<void> {
    const state = await this.getState(jobId);
    if (!state) {
      return;
    }

    state.completed.push(songId);
    await this.persistState(state);
  }

  async pause(jobId: string): Promise<void> {
    const state = await this.getState(jobId);
    if (!state) {
      return;
    }

    state.paused = true;
    await this.persistState(state);
  }

  async resume(jobId: string): Promise<void> {
    const state = await this.getState(jobId);
    if (!state) {
      return;
    }

    state.paused = false;
    await this.persistState(state);
  }

  async cancel(jobId: string): Promise<void> {
    const state = await this.getState(jobId);
    if (!state) {
      return;
    }

    state.canceled = true;
    await this.persistState(state);
  }

  private async persistState(state: QueueState): Promise<void> {
    await chrome.storage.local.set({ [this.storageKey(state.jobId)]: state });
  }

  private storageKey(jobId: string): string {
    return `${this.storageKeyPrefix}.${jobId}`;
  }
}
