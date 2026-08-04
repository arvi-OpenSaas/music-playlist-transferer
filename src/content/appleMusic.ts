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

function parseDuration(value: string): number | undefined {
  const tokens = value.trim().split(':');
  if (tokens.length === 0) return undefined;
  const numbers = tokens.map((token) => Number.parseInt(token, 10)).filter((token) => !Number.isNaN(token));
  if (numbers.length === 0) return undefined;
  const seconds = numbers.reduceRight((acc, val, idx) => acc + val * 60 ** (tokens.length - 1 - idx), 0);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function readTracksFromDom() {
  const rows = Array.from(document.querySelectorAll('.songs-list-row, [role="row"], tr'));
  const tracks: any[] = [];

  rows.forEach((row) => {
    const titleEl = row.querySelector('[data-testid="track-title"], [class*="song-name"], [class*="title"], a');
    const artistEl = row.querySelector('[data-testid="track-artist"], [class*="artist"], [class*="subtitle"]');
    const albumEl = row.querySelector('[data-testid="track-album"], [class*="album"]');
    const durationEl = row.querySelector('[data-testid="track-duration"], time, [class*="length"]');

    if (!titleEl?.textContent?.trim()) return;

    const title = titleEl.textContent.trim();
    const artist = artistEl?.textContent?.trim() ?? 'Unknown Artist';
    const album = albumEl?.textContent?.trim();
    const duration = durationEl?.textContent ? parseDuration(durationEl.textContent) : undefined;

    if (title.toLowerCase() !== 'title' && title.toLowerCase() !== 'song') {
      tracks.push({ title, artist, album, duration });
    }
  });

  const heading = document.querySelector('h1, [data-testid="playlist-name"], .playlist-name') as HTMLElement | null;
  return {
    playlistName: heading?.textContent?.trim() || 'Apple Music Playlist',
    songs: tracks.map((track, index) => ({
      id: `apple-${index + 1}`,
      title: track.title,
      artists: [track.artist],
      album: track.album,
      durationSeconds: track.duration,
      provider: 'APPLE_MUSIC',
      externalUrl: window.location.href,
    })),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'APPLE_GET_PLAYLIST_SONGS' || message?.type === 'APPLE_GET_PLAYLISTS') {
    const data = readTracksFromDom();
    sendResponse({ ok: true, data: message.type === 'APPLE_GET_PLAYLISTS' ? [{ id: message.playlistId ?? 'apple-playlist', name: data.playlistName, provider: 'APPLE_MUSIC', externalUrl: window.location.href }] : data });
  }
  return true;
});