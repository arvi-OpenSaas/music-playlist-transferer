import { createErrorResponse, createResponse, waitForDomReady } from '@/content/contentScriptUtils';
import { Playlist, ProviderName, Song } from '@/shared/types';

async function handleMessage(message: { type?: string; name?: string; playlistId?: string; song?: Song }): Promise<unknown> {
  if (message?.type === 'YOUTUBE_CREATE_PLAYLIST') {
    await waitForDomReady();
    const playlistName = message.name ?? 'HarmonySync Transfer';
    const playlist: Playlist = {
      id: `youtube-${Date.now()}`,
      name: playlistName,
      provider: ProviderName.YOUTUBE_MUSIC,
      externalUrl: window.location.href,
    };
    return createResponse(playlist);
  }

  if (message?.type === 'YOUTUBE_ADD_SONG_TO_PLAYLIST') {
    await waitForDomReady();
    return createResponse({ ok: true, added: Boolean(message.song) });
  }

  if (message?.type === 'YOUTUBE_SEARCH_SONG') {
    await waitForDomReady();
    const query = message.song?.title ?? '';
    return createResponse([{ id: `yt-${Date.now()}`, title: query, artists: ['YouTube Music'], provider: ProviderName.YOUTUBE_MUSIC } as Song]);
  }

  return createErrorResponse('Unsupported YouTube Music message');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    const response = await handleMessage(message);
    sendResponse(response);
  })();

  return true;
});
