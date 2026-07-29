export enum ProviderName {
  APPLE_MUSIC = 'APPLE_MUSIC',
  YOUTUBE_MUSIC = 'YOUTUBE_MUSIC',
  SPOTIFY = 'SPOTIFY',
  AMAZON_MUSIC = 'AMAZON_MUSIC',
  JIOSAAVN = 'JIOSAAVN',
  GAANA = 'GAANA',
  TIDAL = 'TIDAL',
  DEEZER = 'DEEZER',
  NAPSTER = 'NAPSTER',
  PANDORA = 'PANDORA',
  SOUNDCLOUD = 'SOUNDCLOUD',
}

export type TransferAction = 'auto' | 'ask' | 'manual-review';

export type TransferStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'canceled'
  | 'completed'
  | 'failed';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface Song {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  durationSeconds?: number;
  isExplicit?: boolean;
  isLive?: boolean;
  isRemix?: boolean;
  isAcoustic?: boolean;
  language?: string;
  popularity?: number;
  provider: ProviderName;
  externalUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  songCount?: number;
  provider: ProviderName;
  externalUrl?: string;
}

export interface ScoredCandidate {
  song: Song;
  score: number;
  reason: string;
}

export interface MatchResult {
  sourceSong: Song;
  candidates: ScoredCandidate[];
  selectedMatch?: Song;
  confidence: number;
  action: TransferAction;
}

export interface MatchedSong {
  sourceSong: Song;
  matchedSong: Song;
  confidence: number;
}

export interface FailedSong {
  sourceSong: Song;
  reason: string;
  attempts: number;
}

export interface MissingSong {
  sourceSong: Song;
  reason: string;
}

export interface DuplicateSong {
  sourceSong: Song;
  duplicateOf: Song;
  reason: string;
}

export interface TransferJob {
  id: string;
  sourceProvider: ProviderName;
  destinationProvider: ProviderName;
  sourcePlaylistId: string;
  destinationPlaylistName: string;
  status: TransferStatus;
  totalSongs: number;
  processedSongs: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface TransferResult {
  songId: string;
  status: 'completed' | 'failed' | 'skipped';
  message?: string;
}

export interface TransferReport {
  jobId: string;
  sourceProvider: ProviderName;
  destinationProvider: ProviderName;
  createdAt: number;
  completedAt?: number;
  totalSongs: number;
  matched: MatchedSong[];
  failed: FailedSong[];
  missing: MissingSong[];
  duplicates: DuplicateSong[];
  status: TransferStatus;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  jobId?: string;
}

export interface AppSettings {
  sourceProvider: ProviderName;
  destinationProvider: ProviderName;
  autoMatchThreshold: number;
  askUserThreshold: number;
  persistQueue: boolean;
  enableLogging: boolean;
}

export interface ProviderConfig {
  name: ProviderName;
  enabled: boolean;
  apiBaseUrl?: string;
}
