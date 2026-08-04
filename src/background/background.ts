import { DefaultTransferEngine } from '@/core/transferEngine';
import { SimpleMatcher } from '@/matcher/Matcher';
import { AppleMusicProvider } from '@/providers/AppleProvider';
import { YouTubeMusicProvider } from '@/providers/YoutubeProvider';
import { ChromeStorage } from '@/storage/Storage';
import { ProviderName } from '@/shared/types';

const storage = new ChromeStorage();
const matcher = new SimpleMatcher();
const youtubeProvider = new YouTubeMusicProvider(undefined, storage);
const transferEngine = new DefaultTransferEngine(storage, matcher, youtubeProvider);
const appleProvider = new AppleMusicProvider(undefined, storage);

console.warn('HarmonySync Background Service Started');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Opens a new tab pointing to your tutorial page when installed
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    if (message?.type === 'START_TRANSFER') {
      const settings = await storage.getSettings();
      const sourceSongs = await appleProvider.getPlaylistSongs('apple-playlist');
      const job = {
        id: `job-${Date.now()}`,
        sourceProvider: settings.sourceProvider ?? ProviderName.APPLE_MUSIC,
        destinationProvider: settings.destinationProvider ?? ProviderName.YOUTUBE_MUSIC,
        sourcePlaylistId: 'apple-playlist',
        destinationPlaylistName: 'HarmonySync Transfer',
        status: 'queued' as const,
        totalSongs: sourceSongs.length,
        processedSongs: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveTransferJob(job);
      const report = await transferEngine.runTransfer(job, sourceSongs);
      const finalStatus = sourceSongs.length === 0 ? 'failed' : report.status;
      await storage.saveTransferJob({ ...job, status: finalStatus, processedSongs: report.matched.length, updatedAt: Date.now() });
      sendResponse({ ok: true, report: { ...report, status: finalStatus } });
      return;
    }

    if (message?.type === 'GET_STATUS') {
      const jobs = await storage.listTransferJobs();
      sendResponse({ ok: true, jobs });
      return;
    }

    sendResponse({ ok: false, error: 'Unsupported message' });
  })();

  return true;
});
