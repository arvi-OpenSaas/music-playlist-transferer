export {};

interface Song {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  durationSeconds?: number;
  provider: string;
  externalUrl?: string;
}

interface Playlist {
  id: string;
  name: string;
  provider: string;
  externalUrl?: string;
}

function createResponse<T>(data?: T) {
  return { ok: true, data };
}

function createErrorResponse(message: string) {
  return { ok: false, error: message };
}

function waitForDomReady(timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, timeoutMs);
    document.addEventListener('DOMContentLoaded', () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

async function handleYouTubeMessage(message: { type?: string; name?: string; playlistId?: string; song?: Song }): Promise<unknown> {
  if (message?.type === 'YOUTUBE_CREATE_PLAYLIST') {
    await waitForDomReady();
    const playlistName = message.name ?? 'HarmonySync Transfer';
    const playlist: Playlist = {
      id: `youtube-${Date.now()}`,
      name: playlistName,
      provider: 'YOUTUBE_MUSIC',
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
    return createResponse([{ id: `yt-${Date.now()}`, title: query, artists: ['YouTube Music'], provider: 'YOUTUBE_MUSIC' } as Song]);
  }

  return createErrorResponse('Unsupported YouTube Music message');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    const response = await handleYouTubeMessage(message);
    sendResponse(response);
  })();

  return true;
});