import { MusicProvider, UniversalSong } from '../core/types';

export class SpotifyAdapter implements MusicProvider {
  name = 'Spotify';
  id = 'SPOTIFY';
  
  // You will get this from the Spotify Developer Dashboard (Instructions below)
  private readonly CLIENT_ID = '085aa8c4a8b448cca166b30eba666b70'; 
  private cachedAccessToken: string | null = null;

  // ==========================================
  // HELPER: Get the active Spotify tab
  // ==========================================
  private async getSpotifyTab(): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({ url: '*://open.spotify.com/*' });
    const targetTab = tabs.find(tab => tab.active) || tabs[0]; 
    if (!targetTab?.id) {
      throw new Error('No open Spotify tab found.');
    }
    return targetTab;
  }

  // ==========================================
  // SOURCE METHOD: Extracting the playlist (DOM)
  // ==========================================
  async extractPlaylist(): Promise<UniversalSong[]> {
    console.log(`[${this.name}] Starting extraction...`);
    const targetTab = await this.getSpotifyTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      func: this.scrapeSpotifyDomForSongs,
    });

    const extractedSongs = injectionResults[0].result as UniversalSong[];
    console.log(`[${this.name}] Extracted ${extractedSongs.length} songs.`);
    return extractedSongs;
  }

  // ==========================================
  // AUTHENTICATION: Get Spotify Web API Token
  // ==========================================
  private async getAccessToken(): Promise<string> {
    if (this.cachedAccessToken) return this.cachedAccessToken;

    return new Promise((resolve, reject) => {
      const redirectUri = chrome.identity.getRedirectURL(); // Auto-generates your extension's callback URL
      const scopes = encodeURIComponent('playlist-read-private playlist-modify-private playlist-modify-public');
      
      const authUrl = `https://accounts.spotify.com/authorize?client_id=${this.CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;

      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true // Pops up the Spotify login window if they aren't logged in
      }, (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'Authentication failed'));
          return;
        }

        // Extract the token from the redirect URL hash
        const urlHash = redirectUrl.split('#')[1];
        const params = new URLSearchParams(urlHash);
        const token = params.get('access_token');

        if (token) {
          this.cachedAccessToken = token;
          resolve(token);
        } else {
          reject(new Error('No access token found in response'));
        }
      });
    });
  }

  // ==========================================
  // DESTINATION METHOD: Search for a song (API)
  // ==========================================
  async searchForSong(song: UniversalSong): Promise<string | null> {
    const token = await this.getAccessToken();
    
    // Advanced search syntax: track:Name artist:Name
    const query = encodeURIComponent(`track:${song.title} artist:${song.artist}`);
    
    try {
      const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Search HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      if (data.tracks?.items?.length > 0) {
        // Spotify requires URIs (e.g., spotify:track:12345) to add to playlists
        return data.tracks.items[0].uri; 
      }
      
      return null;
    } catch (error) {
      console.error(`[${this.name}] Search failed for ${song.title}:`, error);
      return null;
    }
  }

  // ==========================================
  // DESTINATION METHOD: Add to playlist (API)
  // ==========================================
  async addToPlaylist(playlistId: string, trackIds: string[]): Promise<boolean> {
    const token = await this.getAccessToken();

    try {
      // 1. For this proof-of-concept, we'll fetch the user's first playlist
      // In a full app, you might create a new "HarmonySync" playlist instead
      const playlistsResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const playlistsData = await playlistsResponse.json();
      
      if (!playlistsData.items || playlistsData.items.length === 0) {
        throw new Error('No playlists found on this Spotify account.');
      }

      const targetPlaylistId = playlistsData.items[0].id;

      // 2. Add the tracks to that playlist
      const addResponse = await fetch(`https://api.spotify.com/v1/playlists/${targetPlaylistId}/tracks`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: trackIds }) // Send the URIs we found in search
      });

      return addResponse.ok;
    } catch (error) {
      console.error(`[${this.name}] Failed to add tracks to playlist:`, error);
      return false;
    }
  }

  // ==========================================
  // INJECTED SCRIPTS (Runs inside the webpage)
  // ==========================================
  private scrapeSpotifyDomForSongs(): UniversalSong[] {
    const songs: UniversalSong[] = [];
    const trackRows = document.querySelectorAll('[data-testid="tracklist-row"]');

    trackRows.forEach((row, index) => {
      try {
        const titleNode = row.querySelector('[data-encore-id="textLink"]');
        const title = titleNode ? (titleNode as HTMLElement).innerText.trim() : '';

        const artistNodes = row.querySelectorAll('a[href^="/artist/"]');
        let artist = 'Unknown Artist';
        if (artistNodes.length > 0) {
          artist = Array.from(artistNodes).map(node => (node as HTMLElement).innerText.trim()).join(', ');
        }

        const albumNode = row.querySelector('a[href^="/album/"]');
        const album = albumNode ? (albumNode as HTMLElement).innerText.trim() : undefined;

        if (title) {
          songs.push({ originalId: `spotify-row-${index}`, title, artist, album });
        }
      } catch (error) {}
    });

    return songs;
  }
}