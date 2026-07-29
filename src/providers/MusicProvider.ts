import { Playlist, ProviderName, Song } from '@/shared/types';
import { HarmonySyncError } from '@/shared/errors';

export interface MusicProvider {
  readonly name: ProviderName;
  readonly isAvailable: boolean;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getPlaylists(): Promise<Playlist[]>;
  getPlaylistSongs(playlistId: string): Promise<Song[]>;
  searchSong(query: string): Promise<Song[]>;
  createPlaylist(name: string): Promise<Playlist>;
  addSongToPlaylist(playlistId: string, song: Song): Promise<void>;
  removeSongFromPlaylist(playlistId: string, songId: string): Promise<void>;
}

export abstract class BaseMusicProvider implements MusicProvider {
  abstract readonly name: ProviderName;
  abstract readonly isAvailable: boolean;

  async connect(): Promise<void> {
    return;
  }

  async disconnect(): Promise<void> {
    return;
  }

  async getPlaylists(): Promise<Playlist[]> {
    return [];
  }

  async getPlaylistSongs(playlistId: string): Promise<Song[]> {
    void playlistId;
    return [];
  }

  async searchSong(): Promise<Song[]> {
    return [];
  }

  async createPlaylist(name: string): Promise<Playlist> {
    return {
      id: `${this.name.toLowerCase()}-${Date.now()}`,
      name,
      provider: this.name,
    };
  }

  async addSongToPlaylist(): Promise<void> {
    return;
  }

  async removeSongFromPlaylist(): Promise<void> {
    return;
  }
}

export function assertProviderAvailable(provider: MusicProvider): void {
  if (!provider.isAvailable) {
    throw new HarmonySyncError('Provider is unavailable', {
      recoveryAction: 'ManualReview',
      retryable: false,
    });
  }
}
