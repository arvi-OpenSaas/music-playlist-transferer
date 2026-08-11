// src/core/types.ts

/**
 * The standard format every song must be converted to, 
 * regardless of where it came from.
 */
export interface UniversalSong {
  originalId?: string; // The ID from the source platform
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  isrc?: string; // International Standard Recording Code (Crucial for exact matching)
}

/**
 * The strict contract that every music platform adapter MUST follow.
 */
export interface MusicProvider {
  /** The display name (e.g., "Apple Music") */
  name: string;
  
  /** The internal ID (e.g., "APPLE_MUSIC") */
  id: string; 

  // ==========================================
  // SOURCE METHODS (When reading data)
  // ==========================================
  
  /** Scrapes or fetches the songs from the active playlist */
  extractPlaylist(): Promise<UniversalSong[]>;

  // ==========================================
  // DESTINATION METHODS (When writing data)
  // ==========================================
  
  /** 
   * Searches the platform for a matching song and returns its platform-specific ID 
   * Returns null if no match is found.
   */
  searchForSong(song: UniversalSong): Promise<string | null>;
  
  /** Takes a list of platform-specific track IDs and adds them to a playlist */
  addToPlaylist(playlistId: string, trackIds: string[]): Promise<boolean>;
}

/**
 * The standard progress report for the popup UI.
 */
export interface TransferProgressState {
  status: 'idle' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
  processed: number;
  total: number;
  percentage: number;
  successes: number;
  failures: number;
}