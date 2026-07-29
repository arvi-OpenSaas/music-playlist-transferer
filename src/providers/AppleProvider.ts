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

  private async sendToContentScript(type: string, payload?: Record<string, unknown>): Promise<AppleContentResponse> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id) {
      return {};
    }

    const response = await chrome.tabs.sendMessage(activeTab.id, { type, ...payload });
    return response?.data ?? response ?? {};
  }
}
