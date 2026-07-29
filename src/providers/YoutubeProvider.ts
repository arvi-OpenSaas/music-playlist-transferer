import { Playlist, ProviderName, Song } from '@/shared/types';
import { Logger } from '@/utils/Logger';
import { IStorage } from '@/storage/IStorage';
import { BaseMusicProvider } from '@/providers/MusicProvider';

interface YouTubeContentResponse {
  ok?: boolean;
  data?: Playlist | Playlist[] | Song | Song[] | { added?: boolean };
  error?: string;
}

export class YouTubeMusicProvider extends BaseMusicProvider {
  readonly name = ProviderName.YOUTUBE_MUSIC;
  readonly isAvailable = true;

  constructor(
    protected readonly logger: Logger = new Logger({ module: 'YouTubeMusicProvider' }),
    protected readonly storage: IStorage,
  ) {
    super();
  }

  async getPlaylists(): Promise<Playlist[]> {
    this.logger.info('Fetching YouTube Music playlists');
    const response = await this.sendToContentScript('YOUTUBE_GET_PLAYLISTS');
    if (Array.isArray(response?.data)) {
      return response.data as Playlist[];
    }
    return [];
  }

  async getPlaylistSongs(playlistId: string): Promise<Song[]> {
    this.logger.info(`Fetching YouTube Music playlist songs for ${playlistId}`);
    const response = await this.sendToContentScript('YOUTUBE_GET_PLAYLIST_SONGS', { playlistId });
    if (Array.isArray(response?.data)) {
      return response.data as Song[];
    }
    return [];
  }

  async searchSong(query: string = ''): Promise<Song[]> {
    this.logger.info(`Searching YouTube Music songs for ${query}`);
    const response = await this.sendToContentScript('YOUTUBE_SEARCH_SONG', { query });
    if (Array.isArray(response?.data)) {
      return response.data as Song[];
    }
    return [];
  }

  async createPlaylist(name: string): Promise<Playlist> {
    this.logger.info(`Creating YouTube Music playlist: ${name}`);
    const response = await this.sendToContentScript('YOUTUBE_CREATE_PLAYLIST', { name });
    if (response?.data && typeof response.data === 'object' && 'name' in response.data) {
      return response.data as Playlist;
    }
    return {
      id: `youtube-${Date.now()}`,
      name,
      provider: ProviderName.YOUTUBE_MUSIC,
    };
  }

  async addSongToPlaylist(playlistId: string = '', song?: Song): Promise<void> {
    const songTitle = song?.title ?? 'unknown song';
    this.logger.info(`Adding song ${songTitle} to YouTube Music playlist ${playlistId}`);
    await this.sendToContentScript('YOUTUBE_ADD_SONG_TO_PLAYLIST', { playlistId, song });
  }

  async removeSongFromPlaylist(): Promise<void> {
    this.logger.info('Removing songs from YouTube Music playlist');
    return;
  }

  private async sendToContentScript(type: string, payload?: Record<string, unknown>): Promise<YouTubeContentResponse> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return {};
    }

    const response = await chrome.tabs.sendMessage(activeTab.id, { type, ...payload });
    return response?.data ?? response ?? {};
  }
}
