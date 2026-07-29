import { createErrorResponse, createResponse, waitForDomReady } from '@/content/contentScriptUtils';
import { Playlist, ProviderName, Song } from '@/shared/types';

interface AppleTrackRow {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

function readTracksFromDom(): AppleTrackRow[] {
  const tracks: AppleTrackRow[] = [];
  const rows = Array.from(document.querySelectorAll('tr, [data-testid="tracklist-row"]'));

  rows.forEach((row) => {
    const titleEl = row.querySelector('[data-testid="track-title"], .song-title, .title, [class*="title"]') as HTMLElement | null;
    const artistEl = row.querySelector('[data-testid="track-artist"], .song-artist, .artist, [class*="artist"]') as HTMLElement | null;
    const albumEl = row.querySelector('[data-testid="track-album"], .song-album, .album') as HTMLElement | null;
    const durationEl = row.querySelector('[data-testid="track-duration"], .duration') as HTMLElement | null;

    if (!titleEl?.textContent?.trim()) {
      return;
    }

    const title = titleEl.textContent.trim();
    const artist = artistEl?.textContent?.trim() ?? 'Unknown Artist';
    const album = albumEl?.textContent?.trim();
    const duration = durationEl?.textContent ? parseDuration(durationEl.textContent) : undefined;

    tracks.push({ title, artist, album, duration });
  });

  return tracks;
}

function readPlaylistName(): string {
  const heading = document.querySelector('h1, [data-testid="playlist-name"], .playlist-name') as HTMLElement | null;
  return heading?.textContent?.trim() || 'Apple Music Playlist';
}

function parseDuration(value: string): number | undefined {
  const tokens = value.trim().split(':');
  if (tokens.length === 0) {
    return undefined;
  }

  const numbers = tokens.map((token) => Number.parseInt(token, 10)).filter((token) => !Number.isNaN(token));
  if (numbers.length === 0) {
    return undefined;
  }

  const seconds = numbers.reduceRight((acc, value, index) => acc + value * 60 ** (tokens.length - 1 - index), 0);
  return Number.isFinite(seconds) ? seconds : undefined;
}

async function handleMessage(message: { type?: string; playlistId?: string }): Promise<unknown> {
  if (message?.type === 'APPLE_GET_PLAYLIST_SONGS') {
    await waitForDomReady();
    const tracks = readTracksFromDom();
    const playlistName = readPlaylistName();

    const songs: Song[] = tracks.map((track, index) => ({
      id: `apple-${index + 1}`,
      title: track.title ?? 'Untitled',
      artists: [track.artist ?? 'Unknown Artist'],
      album: track.album,
      durationSeconds: track.duration,
      provider: ProviderName.APPLE_MUSIC,
      externalUrl: window.location.href,
    }));

    return createResponse({ playlistName, songs });
  }

  if (message?.type === 'APPLE_GET_PLAYLISTS') {
    const playlist: Playlist = {
      id: message.playlistId ?? 'apple-playlist',
      name: readPlaylistName(),
      provider: ProviderName.APPLE_MUSIC,
      externalUrl: window.location.href,
    };

    return createResponse([playlist]);
  }

  return createErrorResponse('Unsupported Apple Music message');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    const response = await handleMessage(message);
    sendResponse(response);
  })();

  return true;
});
