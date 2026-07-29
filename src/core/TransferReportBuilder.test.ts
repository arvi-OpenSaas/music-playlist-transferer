import { describe, expect, it } from 'vitest';
import { TransferReportBuilder } from './TransferReportBuilder';
import { ProviderName } from '@/shared/types';

describe('TransferReportBuilder', () => {
  it('summarizes transfer outcomes and exports csv', () => {
    const builder = new TransferReportBuilder();
    const job = {
      id: 'job-1',
      sourceProvider: ProviderName.APPLE_MUSIC,
      destinationProvider: ProviderName.YOUTUBE_MUSIC,
      sourcePlaylistId: 'apple-playlist',
      destinationPlaylistName: 'HarmonySync Transfer',
      status: 'completed' as const,
      totalSongs: 3,
      processedSongs: 3,
      createdAt: 1,
      updatedAt: 2,
      completedAt: 5000,
    };

    const results = [
      { songId: '1', status: 'completed', message: 'matched' },
      { songId: '2', status: 'failed', message: 'no match' },
      { songId: '3', status: 'skipped', message: 'duplicate' },
    ];

    const summary = builder.build(job as never, results as never);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.totalSongs).toBe(3);

    const csv = builder.toCsv(job as never, results as never);
    expect(csv).toContain('songId,status,message');
    expect(csv).toContain('1,completed,matched');
  });
});
