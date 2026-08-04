import { Playlist, ProviderName, Song } from '@/shared/types';
import { Logger } from '@/utils/Logger';
import { IStorage } from '@/storage/IStorage';
import { BaseMusicProvider } from '@/providers/MusicProvider';

interface AppleContentResponse {
  ok?: boolean;
  data?: {
    playlistName?: string;
    songs?: Song[];
  } | Playlist[];
  error?: string;
}

export class AppleMusicProvider extends BaseMusicProvider {
  readonly name = ProviderName.APPLE_MUSIC;
  readonly isAvailable = true;

  constructor(
    protected readonly logger: Logger = new Logger({ module: 'AppleMusicProvider' }),
    protected readonly storage: IStorage,
  ) {
    super();
  }

  async getPlaylists(): Promise<Playlist[]> {
    this.logger.info('Fetching Apple Music playlists');
    const response = await this.sendToContentScript('APPLE_GET_PLAYLISTS');
    if (Array.isArray(response?.data)) {
      return response.data as Playlist[];
    }
    return [];
  }

  async getPlaylistSongs(playlistId: string): Promise<Song[]> {
    this.logger.info(`Fetching Apple Music playlist songs for ${playlistId}`);
    const response = await this.sendToContentScript('APPLE_GET_PLAYLIST_SONGS', { playlistId });
    if (response?.data && typeof response.data === 'object' && 'songs' in response.data) {
      return (response.data as { songs?: Song[] }).songs ?? [];
    }
    return [];
  }

  async searchSong(): Promise<Song[]> {
    this.logger.info('Searching Apple Music songs');
    return [];
  }

  async createPlaylist(name: string): Promise<Playlist> {
    this.logger.info(`Creating Apple Music playlist: ${name}`);
    return {
      id: `apple-${Date.now()}`,
      name,
      provider: ProviderName.APPLE_MUSIC,
    };
  }

  async addSongToPlaylist(): Promise<void> {
    this.logger.info('Adding songs to Apple Music playlist');
    return;
  }

  async removeSongFromPlaylist(): Promise<void> {
    this.logger.info('Removing songs from Apple Music playlist');
    return;
  }

  private async sendToContentScript(_type: string, _payload?: Record<string, unknown>): Promise<AppleContentResponse> {
    
    const tabs = await chrome.tabs.query({ url: '*://music.apple.com/*' });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return { ok: false, error: 'No active tab found.' };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: async () => {
          const getSongRows = () => {
            const rows = Array.from(document.querySelectorAll('.songs-list-row, [data-testid="tracklist-row"], [role="row"]'));
            return rows.filter(row => row.querySelector('[data-testid="track-title"], [class*="song-name"], [class*="title"]'));
          };

          let songRows = getSongRows();
          let attempts = 0;

          while (songRows.length === 0 && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 300));
            songRows = getSongRows();
            attempts++;
          }

          const tracks: any[] = [];
          songRows.forEach((row) => {
            const titleEl = row.querySelector('[data-testid="track-title"], [class*="song-name"], [class*="title"], a');
            const artistEl = row.querySelector('[data-testid="track-artist"], [class*="artist"], [class*="subtitle"]');
            const albumEl = row.querySelector('[data-testid="track-album"], [class*="album"]');

            if (!titleEl?.textContent?.trim()) return;

            let rawTitle = titleEl.textContent.trim();

            // 1. Clean up Apple Music title clutter (removes movie tags like (From "Movie") and trailing dashes)
            if (rawTitle.includes(' - ')) {
              rawTitle = rawTitle.split(' - ')[0];
            }
            const title = rawTitle.replace(/\s*[([].*?[)\]]\s*/g, '').trim();

            let artistText = artistEl?.textContent?.trim() || '';
            
            // Fallback: If artist element is missing, try to parse artists if they were glued into the title string
            let artists: string[] = [];
            if (artistText && artistText.toLowerCase() !== 'unknown artist') {
              artists = artistText.split(',').map(a => a.trim());
            } else {
              artists = ['Unknown Artist'];
            }

            const album = albumEl?.textContent?.trim();

            if (title.toLowerCase() !== 'title' && title.toLowerCase() !== 'song') {
              tracks.push({ title, artists, album });
            }
          });

          const heading = document.querySelector('h1, [data-testid="playlist-name"], .playlist-name');
          const playlistName = heading?.textContent?.trim() || 'Apple Music Playlist';

          return {
            playlistName,
            songs: tracks.map((track, index) => ({
              id: `apple-${index + 1}`,
              title: track.title,
              artists: track.artists,
              album: track.album,
              provider: 'APPLE_MUSIC',
              externalUrl: window.location.href,
            })),
          };
        },
      });

      const scrapedData = results?.[0]?.result as { playlistName?: string; songs?: Song[] } | undefined;
      
      return {
        ok: true,
        data: scrapedData ?? { playlistName: 'Apple Music Playlist', songs: [] },
      };
    } catch (error) {
      this.logger.error(`Failed to execute script on tab: ${error}`);
      return { ok: false, error: 'Script execution failed.' };
    }
  }
}