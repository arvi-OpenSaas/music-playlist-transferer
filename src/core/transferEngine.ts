import { IStorage } from '@/storage/IStorage';
import { Matcher } from '@/matcher/Matcher';
import { Queue } from '@/core/Queue';
import { RetryEngine } from '@/core/RetryEngine';
import { TransferReportBuilder } from '@/core/TransferReportBuilder';
import { MusicProvider } from '@/providers/MusicProvider';
import {
  FailedSong,
  MatchedSong,
  MissingSong,
  Playlist,
  Song,
  TransferJob,
  TransferReport,
  TransferResult,
} from '@/shared/types';

export interface TransferEngine {
  runTransfer(job: TransferJob, sourceSongs: Song[], sourcePlaylist: Playlist): Promise<TransferReport>;
}

export class DefaultTransferEngine implements TransferEngine {
  private readonly queue: Queue;
  private readonly retryEngine: RetryEngine;
  private readonly reportBuilder: TransferReportBuilder;

  constructor(
    private readonly storage: IStorage,
    private readonly matcher: Matcher,
    private readonly destinationProvider?: MusicProvider,
  ) {
    this.queue = new Queue(storage);
    this.retryEngine = new RetryEngine();
    this.reportBuilder = new TransferReportBuilder();
  }

  async runTransfer(job: TransferJob, sourceSongs: Song[]): Promise<TransferReport> {
    const report: TransferReport = {
      jobId: job.id,
      sourceProvider: job.sourceProvider,
      destinationProvider: job.destinationProvider,
      createdAt: Date.now(),
      totalSongs: sourceSongs.length,
      matched: [],
      failed: [],
      missing: [],
      duplicates: [],
      status: 'running',
    };

    await this.storage.saveTransferReport(report);
    await this.queue.initialize(job, sourceSongs);

    const matchedSongs: MatchedSong[] = [];
    let destinationPlaylistId = '';

    if (this.destinationProvider) {
      const playlist = await this.destinationProvider.createPlaylist(job.destinationPlaylistName);
      destinationPlaylistId = playlist.id;
    }
    const failedSongs: FailedSong[] = [];
    const missingSongs: MissingSong[] = [];
    const duplicates: MatchedSong[] = [];
    const results: TransferResult[] = [];

    for (const sourceSong of sourceSongs) {
      const nextSongId = await this.queue.next(job.id);
      if (nextSongId && nextSongId !== sourceSong.id) {
        continue;
      }

      const matchResult = await this.retryEngine.runWithRetry(() => this.matcher.match(sourceSong, sourceSongs));

      if (!matchResult.selectedMatch) {
        missingSongs.push({ sourceSong, reason: 'No candidate matched' });
        results.push({ songId: sourceSong.id, status: 'skipped', message: 'No candidate matched' });
        await this.queue.markCompleted(job.id, sourceSong.id);
        continue;
      }

      if (matchResult.confidence < 80) {
        failedSongs.push({ sourceSong, reason: 'Confidence below threshold', attempts: 1 });
        results.push({ songId: sourceSong.id, status: 'failed', message: 'Confidence below threshold' });
        await this.queue.markCompleted(job.id, sourceSong.id);
        continue;
      }

      if (sourceSong.id === matchResult.selectedMatch.id) {
        duplicates.push({ sourceSong, matchedSong: matchResult.selectedMatch, confidence: matchResult.confidence });
        results.push({ songId: sourceSong.id, status: 'skipped', message: 'Duplicate match' });
        await this.queue.markCompleted(job.id, sourceSong.id);
        continue;
      }

      matchedSongs.push({
        sourceSong,
        matchedSong: matchResult.selectedMatch,
        confidence: matchResult.confidence,
      });

      if (this.destinationProvider && destinationPlaylistId) {
        await this.destinationProvider.addSongToPlaylist(destinationPlaylistId, matchResult.selectedMatch);
      }

      results.push({ songId: sourceSong.id, status: 'completed', message: 'Matched' });
      await this.queue.markCompleted(job.id, sourceSong.id);
    }

    const summary = this.reportBuilder.build(job, results);
    report.matched = matchedSongs;
    report.failed = failedSongs;
    report.missing = missingSongs;
    report.duplicates = duplicates as never[];
    report.status = summary.failed > 0 && summary.succeeded === 0 ? 'failed' : 'completed';
    report.completedAt = Date.now();

    await this.storage.saveTransferReport(report);
    return report;
  }
}
