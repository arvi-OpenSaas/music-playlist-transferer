// src/core/providerFactory.ts
import { MusicProvider } from './types';
import { YouTubeMusicAdapter } from '../content/youtubeMusicAdapter';
import { AppleMusicAdapter } from '../content/appleMusicAdapter';
import { SpotifyAdapter } from '../content/spotifyAdapter';

export interface PlatformMetadata {
  id: string;
  name: string;
  domain: string;
}

export class ProviderFactory {
  // The universal list of platforms your extension supports
  static getSupportedPlatforms(): PlatformMetadata[] {
    return [
      { id: 'APPLE_MUSIC', name: 'Apple Music', domain: 'music.apple.com' },
      { id: 'YOUTUBE_MUSIC', name: 'YouTube Music', domain: 'music.youtube.com' },
      { id: 'SPOTIFY', name: 'Spotify', domain: 'open.spotify.com' } 
    ];
  }

  static getProvider(providerId: string): MusicProvider {
    switch (providerId.toUpperCase()) {
      case 'APPLE_MUSIC':
        return new AppleMusicAdapter();
      case 'YOUTUBE_MUSIC':
        return new YouTubeMusicAdapter();
      case 'SPOTIFY':
        return new SpotifyAdapter();
        
      default:
        throw new Error(`Critical Error: Unknown music provider ID - ${providerId}`);
    }
  }
}