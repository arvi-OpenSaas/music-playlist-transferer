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

// ============================================================================
// 1. UTILITIES
// ============================================================================

function sanitizeTrackData(text: string): string {
  if (!text) return '';
  // Aggressively chop off anything after a parenthesis or bracket to drop movie and artist clutter
  let clean = text.split('(')[0].split('[')[0];
  // Also split by " - " to remove trailing labels
  clean = clean.split(' - ')[0];
  // Remove "Unknown Artist" if present
  clean = clean.replace(/Unknown Artist/gi, '');
  
  return clean.trim();
}

// ============================================================================
// 2. TRANSFER ENGINE
// ============================================================================

export interface TransferEngine {
  runTransfer(job: TransferJob, sourceSongs: Song[], sourcePlaylist?: Playlist): Promise<TransferReport>;
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

  async runTransfer(job: TransferJob, sourceSongs: Song[], sourcePlaylist?: Playlist): Promise<TransferReport> {
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

    // Step 1: Create the destination playlist on YouTube Music using the source playlist name
    if (this.destinationProvider) {
      const playlistName = sourcePlaylist?.name || job.destinationPlaylistName || 'Imported Playlist';
      const playlist = await this.destinationProvider.createPlaylist(playlistName);
      destinationPlaylistId = playlist.id;
    }
    
    const failedSongs: FailedSong[] = [];
    const missingSongs: MissingSong[] = [];
    const duplicates: MatchedSong[] = [];
    const results: TransferResult[] = [];

    // --- Initialize Progress Counters ---
    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;
    const totalSongs = sourceSongs.length;

    // NEW HELPER: Saves state to memory AND broadcasts to popup
    const broadcastProgress = async (currentStatus: string) => {
      const percentage = totalSongs === 0 ? 0 : Math.round((processedCount / totalSongs) * 100);
      const payload = {
        status: currentStatus,
        processed: processedCount,
        total: totalSongs,
        successes: successCount,
        failures: failCount,
        percentage: percentage
      };

      // 1. Save to storage so the popup can read it if reopened
      await chrome.storage.local.set({ harmonyTransferState: payload });

      // 2. Broadcast to the popup if it happens to be open right now
      chrome.runtime.sendMessage({
        type: 'TRANSFER_PROGRESS',
        payload: payload
      }).catch(() => { /* ignore errors if popup is closed */ });
    };

    // Broadcast initial state
    await broadcastProgress('running');

    // Step 2: Loop through and add songs via API
    for (const sourceSong of sourceSongs) {
      const nextSongId = await this.queue.next(job.id);
      if (nextSongId && nextSongId !== sourceSong.id) continue;

      const cleanTitle = sanitizeTrackData(sourceSong.title);
      const songToProcess: Song = { ...sourceSong, title: cleanTitle };

      try {
        if (this.destinationProvider && destinationPlaylistId) {
          await this.destinationProvider.addSongToPlaylist(destinationPlaylistId, songToProcess);
        }
        matchedSongs.push({ sourceSong, matchedSong: songToProcess, confidence: 1.0 });
        results.push({ songId: sourceSong.id, status: 'completed', message: 'Added via API' });
        successCount++;
      } catch (error: any) {
        failedSongs.push({ sourceSong, reason: error?.message || 'API failed', attempts: 1 });
        results.push({ songId: sourceSong.id, status: 'failed', message: error?.message || 'API failed' });
        failCount++;
      }

      await this.queue.markCompleted(job.id, sourceSong.id);
      
      processedCount++;
      
      // --- NEW: Trigger the broadcast/save ---
      await broadcastProgress('running');
      await new Promise(resolve => setTimeout(resolve, 800));
    } // <--- End of the for loop

    // 1. Build the summary FIRST so the variable exists
    const summary = this.reportBuilder.build(job, results);
    
    // 2. NOW calculate the final status using the summary
    const finalStatus = summary.failed > 0 && summary.succeeded === 0 ? 'failed' : 'completed';
    
    // 3. Broadcast the final completed state to the popup and storage
    await broadcastProgress(finalStatus);

    // 4. Finalize and save the transfer report
    report.matched = matchedSongs;
    report.failed = failedSongs;
    report.missing = missingSongs;
    report.duplicates = duplicates as never[];
    report.status = finalStatus; 
    report.completedAt = Date.now();

    await this.storage.saveTransferReport(report);
    return report;
  }
}

function broadcastProgress(finalStatus: string): Promise<void> {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'TRANSFER_PROGRESS',
          payload: {
            status: finalStatus,
            completedAt: Date.now(),
          },
        },
        () => resolve(),
      );
    } catch {
      resolve();
    }
  });
}

