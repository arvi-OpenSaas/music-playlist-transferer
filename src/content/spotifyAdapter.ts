import { MusicProvider, UniversalSong } from '../core/types';

let searchQueue: Promise<any> = Promise.resolve();
let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let cachedPlaylistId: string | null = null;

export class SpotifyAdapter implements MusicProvider {
  name = 'Spotify';
  id = 'SPOTIFY';
  
  private clientId = 'client id'; 
  private redirectUri = chrome.identity.getRedirectURL();


  // PKCE CRYPTO HELPERS
  private generateRandomString(length: number): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }


  // EXTRACT PLAYLIST (SPOTIFY AS SOURCE)
  async extractPlaylist(): Promise<UniversalSong[]> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error("Cannot extract playlist: Spotify authentication missing.");
      }

      // 1. Find the open Spotify tab to get the playlist ID from its URL
      const tabs = await chrome.tabs.query({ url: "*://open.spotify.com/playlist/*" });
      const spotifyTab = tabs[0];

      if (!spotifyTab || !spotifyTab.url) {
        throw new Error("No active Spotify playlist tab found. Please make sure a Spotify playlist is open.");
      }

      // Extract the playlist ID from URL (e.g., /playlist/76h835uAMqxAgrgQZxyl0l)
      const match = spotifyTab.url.match(/playlist\/([a-zA-Z0-9]+)/);
      if (!match || !match[1]) {
        throw new Error("Could not parse Spotify Playlist ID from the active tab URL.");
      }

      const playlistId = match[1];
      console.log(`[Spotify API] 🔍 Fetching tracks for playlist ID: ${playlistId}`);

      const songs: UniversalSong[] = [];
      let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100`;
      // 2. Fetch all pages of tracks via Spotify API
      // 2. Fetch all pages of tracks via Spotify API
      while (nextUrl !== null) {
        const apiResponse: Response = await fetch(nextUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!apiResponse.ok) {
          throw new Error(`Failed to fetch playlist tracks. HTTP ${apiResponse.status}: ${await apiResponse.text()}`);
        }

        const data: any = await apiResponse.json();
        const items: any[] = data.items || [];

        for (const item of items) {
          const track = item.track || item.item;
          if (track && track.name) {
            songs.push({
              title: track.name,
              artist: track.artists ? track.artists.map((a: any) => a.name).join(', ') : '',
              album: track.album?.name || '',
              durationMs: track.duration_ms || 0
            });
          }
        }

        nextUrl = data.next; // Spotify returns the next page URL if >100 songs
      }

      console.log(`[Spotify API] ✅ Extracted ${songs.length} song(s) successfully.`);
      return songs;

    } catch (error) {
      console.error("[Spotify API] 💥 Error extracting playlist:", error);
      throw error;
    }
  }


  // 2. NATIVE BACKGROUND SEARCH (WITH DIAGNOSTICS)
  async searchForSong(song: UniversalSong): Promise<string | null> {
    return new Promise((resolve) => {
      searchQueue = searchQueue.then(async () => {
        try {
          const token = await this.getToken();
          if (!token) {
            console.error(`[Spotify API] ❌ No token available for: ${song.title}`);
            return resolve(null);
          }
          
          if (!song.title) return resolve(null);
          const cleanArtist = song.artist ? song.artist.split(',')[0].trim() : '';
          const query = cleanArtist ? `${song.title} ${cleanArtist}` : song.title;
          
          // Pure, native fetch directly from the background.
          const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.status === 429) {
            console.warn("[Spotify API] ⚠️ Rate Limit hit. Pausing...");
            await new Promise(r => setTimeout(r, 3000));
            return resolve(null);
          }
          
          // THE FIX: Stop failing silently. Shout the exact error!
          if (!res.ok) {
            const errText = await res.text();
            console.error(`[Spotify API] ❌ Search failed for "${query}". HTTP ${res.status}: ${errText}`);
            return resolve(null);
          }
          
          const data = await res.json();
          const tracks = data.tracks?.items || [];
          
          // THE FIX: Tell us if Spotify simply doesn't have the song
          if (tracks.length === 0) {
             console.warn(`[Spotify API] 🫙 Zero results returned from Spotify for: "${query}"`);
             return resolve(null);
          }

          const targetLower = song.title.toLowerCase();
          let bestMatchUri = null;
          
          for (const track of tracks) {
            if (!track) continue;
            const spotifyTitle = track.name.toLowerCase();
            if (spotifyTitle.includes(targetLower) || targetLower.includes(spotifyTitle)) {
              bestMatchUri = track.uri;
              break;
            }
          }
          
          if (!bestMatchUri && tracks.length > 0) {
             bestMatchUri = tracks[0].uri;
          }

          console.log(`[Spotify API] ✅ Matched "${query}" to URI: ${bestMatchUri}`);
          await new Promise(r => setTimeout(r, 200)); 
          resolve(bestMatchUri);
        } catch (e) {
          console.error(`[Spotify API] 💥 Exception during search for "${song.title}":`, e);
          resolve(null);
        }
      });
    });
  }

  
  // 1. OFFICIAL PKCE TOKEN AUTH (UPDATED SCOPES)
  private async getToken(): Promise<string | null> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

    try {
      const codeVerifier = this.generateRandomString(64);
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);

      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.append('client_id', this.clientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', this.redirectUri);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('code_challenge', codeChallenge);
      
      // 🔴 ADDED user-read-private so we can legally fetch your User ID for playlist creation
      authUrl.searchParams.append(
        'scope', 
        'playlist-modify-public playlist-modify-private playlist-read-private playlist-read-collaborative user-read-private user-read-email'
      );      
      // Force the dialog so Spotify is forced to grant the new scopes
      authUrl.searchParams.append('show_dialog', 'true'); 

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true
      });

      if (!responseUrl) throw new Error("Authorization failed: Window closed.");

      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      if (!code) throw new Error("Authorization failed: No code returned.");

      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier,
        })
      });

      if (!tokenResponse.ok) throw new Error(`Token Exchange Failed: ${tokenResponse.status}`);

      const data = await tokenResponse.json();
      cachedToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; 

      return cachedToken;
    } catch (error) {
      console.error("[Spotify PKCE] Auth Error:", error);
      return null;
    }
  }


  // Module-level cache for active transfer session
  private cachedPlaylistId: string | null = null;

 
  // 3. FULLY AUTOMATED PLAYLIST CREATION (AUTO-INCREMENT)
  async addToPlaylist(playlistId: string, trackIds: string[]): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    try {
      const headers = { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      };

      // 1. Check if we already created a playlist for THIS specific transfer run
      let targetPlaylistId = this.cachedPlaylistId;

      if (!targetPlaylistId) {
        const baseName = 'Harmony Sync - Apple Music';

        // 2. Fetch up to 50 existing playlists in user's library
        const getPlRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { headers });
        const plData = await getPlRes.json();
        const existingPlaylists = plData?.items || [];

        let maxNum = 0;
        let hasBase = false;

        // 3. Scan playlist names to find the highest sequence number
        existingPlaylists.forEach((p: any) => {
          const name = p?.name?.trim();
          if (!name) return;

          if (name.toLowerCase() === baseName.toLowerCase()) {
            hasBase = true;
          } else if (name.toLowerCase().startsWith(baseName.toLowerCase())) {
            // Matches "Harmony Sync - Apple Music - 2", "Harmony Sync - Apple Music 2", etc.
            const match = name.match(/Harmony Sync - Apple Music\s*[-–]?\s*(\d+)/i);
            if (match && match[1]) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          }
        });

        // 4. Calculate the next available sequence name
        let newName = baseName;
        if (hasBase || maxNum > 0) {
          newName = `${baseName} - ${maxNum === 0 ? 2 : maxNum + 1}`;
        }

        // 5. Create the new sequenced playlist on Spotify
        const createRes = await fetch('https://api.spotify.com/v1/me/playlists', {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            name: newName, 
            description: 'Fully automated transfer via Harmony Sync',
            public: false 
          })
        });

        if (!createRes.ok) {
          console.error(`[Spotify API] ❌ Failed to auto-create playlist. HTTP ${createRes.status}: ${await createRes.text()}`);
          return false;
        }

        const createdData = await createRes.json();
        targetPlaylistId = createdData.id;
        this.cachedPlaylistId = targetPlaylistId;
        console.log(`[Spotify API] 📁 Created sequence playlist: "${newName}" (ID: ${targetPlaylistId})`);
      }

      // 6. Inject tracks into the target playlist
      const addRes = await fetch(`https://api.spotify.com/v1/playlists/${targetPlaylistId}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ uris: trackIds })
      });

      if (!addRes.ok) {
        console.error(`[Spotify API] ❌ Failed to add items. HTTP ${addRes.status}: ${await addRes.text()}`);
        return false;
      }

      console.log(`[Spotify API] 💾 Successfully saved ${trackIds.length} track(s)!`);
      return true;
    } catch (e) {
      console.error("[Spotify API] 💥 Exception during playlist save:", e);
      return false;
    }
  }

  // ==========================================
  // SPOTIFY AUTHENTICATION VERIFICATION
  // ==========================================
  async isLoggedIn(): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) {
        return false;
      }

      // Verify whether the token is genuinely active and valid
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401 || res.status === 403) {
        console.warn('[Spotify API] ⚠️ Stored token is expired or unauthorized. Clearing cache.');
        await chrome.storage.local.remove(['spotify_access_token', 'spotify_token_expires_at']);
        return false;
      }

      return res.ok;
    } catch (e) {
      console.error('[Spotify API] 💥 Error checking login status:', e);
      return false;
    }
  }
}