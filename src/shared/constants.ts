import { ProviderName } from '@/shared/types';

export const CONFIDENCE_THRESHOLDS = {
  autoMatch: 95,
  askUser: 80,
} as const;

export const RETRY_DEFAULTS = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
} as const;

export const STORAGE_KEYS = {
  settings: 'settings',
  jobs: 'jobs',
  logs: 'logs',
  reports: 'reports',
} as const;

export const MESSAGE_NAMES = {
  startTransfer: 'START_TRANSFER',
  getStatus: 'GET_STATUS',
  pauseTransfer: 'PAUSE_TRANSFER',
  resumeTransfer: 'RESUME_TRANSFER',
  cancelTransfer: 'CANCEL_TRANSFER',
} as const;

export const PROVIDER_URLS: Record<ProviderName, string> = {
  [ProviderName.APPLE_MUSIC]: 'https://music.apple.com',
  [ProviderName.YOUTUBE_MUSIC]: 'https://music.youtube.com',
  [ProviderName.SPOTIFY]: 'https://open.spotify.com',
  [ProviderName.AMAZON_MUSIC]: 'https://music.amazon.com',
  [ProviderName.JIOSAAVN]: 'https://www.jiosaavn.com',
  [ProviderName.GAANA]: 'https://gaana.com',
  [ProviderName.TIDAL]: 'https://listen.tidal.com',
  [ProviderName.DEEZER]: 'https://www.deezer.com',
  [ProviderName.NAPSTER]: 'https://app.napster.com',
  [ProviderName.PANDORA]: 'https://www.pandora.com',
  [ProviderName.SOUNDCLOUD]: 'https://soundcloud.com',
};
