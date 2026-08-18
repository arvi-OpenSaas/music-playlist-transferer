import { MusicProvider, UniversalSong } from '../core/types';


// INJECTED SCRIPTS (Runs inside Apple Music)
async function searchUsingMusicKit(title: string, artist: string): Promise<any> {
  try {
    // @ts-ignore
    const musicKit = window.MusicKit?.getInstance();
    if (!musicKit) return { success: false, debug: "MusicKit is undefined." };

    const query = `${title} ${artist}`.trim();
    let songId = null;

    try {
      // Approach 1: Try modern MusicKit v3 structure
      if (typeof musicKit.api?.music?.search === 'function') {
        const results = await musicKit.api.music.search({ term: query, types: ['songs'], limit: 1 });
        if (results?.songs?.data?.length > 0) songId = results.songs.data[0].id;
      } 
      // Approach 2: Try older MusicKit v2 structure
      else if (typeof musicKit.api?.search === 'function') {
        const results = await musicKit.api.search(query, { types: 'songs', limit: 1 });
        if (results?.songs?.data?.length > 0) songId = results.songs.data[0].id;
      } 
      // Approach 3: The Bulletproof Manual Fetch (Directly calling Apple's REST API using their tokens)
      else if (musicKit.developerToken) {
        const storefront = musicKit.storefrontId || 'us'; 
        const url = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(query)}&types=songs&limit=1`;
        
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${musicKit.developerToken}`,
            'Music-User-Token': musicKit.musicUserToken || ''
          }
        });
        const data = await res.json();
        
        // Apple's raw REST API structures search results slightly differently
        if (data?.results?.songs?.data?.length > 0) {
          songId = data.results.songs.data[0].id;
        }
      } else {
        return { success: false, debug: "No known search API or tokens available on MusicKit." };
      }

      if (songId) return { success: true, id: songId };
      return { success: false, debug: `Zero matches found.` };

    } catch (apiError: any) {
      return { success: false, debug: `API Crash: ${apiError.message || JSON.stringify(apiError)}` };
    }
  } catch (error: any) {
    return { success: false, debug: `Hard Crash: ${error.message}` };
  }
}

async function addUsingMusicKit(trackIds: string[], sessionKey: string): Promise<any> {
  try {
    // @ts-ignore
    const musicKit = window.MusicKit?.getInstance();
    if (!musicKit || !musicKit.developerToken) return { success: false, debug: "No tokens available." };

    const headers = {
      'Authorization': `Bearer ${musicKit.developerToken}`,
      'Music-User-Token': musicKit.musicUserToken || '',
      'Content-Type': 'application/json'
    };

    // 1. Check if we already created a playlist for THIS specific transfer run
    // @ts-ignore
    let targetPlaylistId = window[sessionKey];

    if (!targetPlaylistId) {
      // 2. Fetch all existing playlists in the user's library
      const getPlRes = await fetch('https://api.music.apple.com/v1/me/library/playlists', { headers });
      const plData = await getPlRes.json();
      const existingPlaylists = plData?.data || [];

      let maxNum = 0;
      let hasBase = false;

      // 3. Scan the names to find the highest "Harmony Sync" number
      existingPlaylists.forEach((p: any) => {
        const name = p.attributes?.name;
        if (name === 'Harmony Sync') {
          hasBase = true;
        } else if (name && name.startsWith('Harmony Sync - ')) {
          const match = name.match(/Harmony Sync - (\d+)/);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });

      // 4. Calculate the next available sequence name
      let newName = 'Harmony Sync';
      if (hasBase) {
        newName = `Harmony Sync - ${maxNum === 0 ? 2 : maxNum + 1}`;
      }

      // 5. Create the new sequenced playlist
      const createRes = await fetch('https://api.music.apple.com/v1/me/library/playlists', {
        method: 'POST',
        headers,
        body: JSON.stringify({ attributes: { name: newName, description: 'Transferred automatically by HarmonySync.' } })
      });
      
      const newPlData = await createRes.json();
      if (newPlData?.data?.length > 0) {
        targetPlaylistId = newPlData.data[0].id;
        
        // Cache the ID in the window object so the next song in the loop uses it!
        // @ts-ignore
        window[sessionKey] = targetPlaylistId;
      }
    }

    if (!targetPlaylistId) return { success: false, debug: "Failed to create or find target playlist." };

    // 6. Add the track to our shiny new playlist
    const addRes = await fetch(`https://api.music.apple.com/v1/me/library/playlists/${targetPlaylistId}/tracks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: trackIds.map(id => ({ id, type: 'songs' }))
      })
    });
    
    if (addRes.ok || addRes.status === 202) {
      return { success: true };
    }
    
    return { success: false, debug: `Manual add failed with status ${addRes.status}` };
  } catch (error: any) {
    return { success: false, debug: `Failed to add track: ${error.message}` };
  }
}


function scrapeAppleDomForSongs(): UniversalSong[] {
  const songs: UniversalSong[] = [];
  const trackRows = document.querySelectorAll('div[role="row"]');

  trackRows.forEach((row, index) => {
    try {
      const titleNode = row.querySelector('.songs-list-row__song-name');
      const artistNode = row.querySelector('.songs-list-row__by-line span');
      const albumNode = row.querySelector('.songs-list-row__album a');

      const title = titleNode ? (titleNode as HTMLElement).innerText.trim() : '';
      const artist = artistNode ? (artistNode as HTMLElement).innerText.trim() : 'Unknown Artist';
      const album = albumNode ? (albumNode as HTMLElement).innerText.trim() : undefined;

      if (title) {
        songs.push({ originalId: `apple-row-${index}`, title, artist, album });
      }
    } catch (error) {}
  });

  return songs;
}

export class AppleMusicAdapter implements MusicProvider {
  name = 'Apple Music';
  id = 'APPLE_MUSIC';
  
  // Create a unique ID for this specific transfer session
  private sessionKey = `harmony_session_${Date.now()}`;

  private async getAppleMusicTab(): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({ url: '*://music.apple.com/*' });
    const targetTab = tabs.find(tab => tab.active) || tabs[0]; 
    if (!targetTab?.id) throw new Error('No open Apple Music tab found.');
    return targetTab;
  }

  async extractPlaylist(): Promise<UniversalSong[]> {
    console.log(`[${this.name}] Starting extraction...`);
    const targetTab = await this.getAppleMusicTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      func: scrapeAppleDomForSongs,
    });

    return (injectionResults[0]?.result as UniversalSong[]) || [];
  }

  async searchForSong(song: UniversalSong): Promise<string | null> {
    const targetTab = await this.getAppleMusicTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      world: 'MAIN', 
      func: searchUsingMusicKit,
      args: [song.title, song.artist || '']
    });

    const res = injectionResults[0]?.result as any;
    if (!res || !res.success) return null;
    return res.id;
  }

  async addToPlaylist(playlistId: string, trackIds: string[]): Promise<boolean> {
    const targetTab = await this.getAppleMusicTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      world: 'MAIN',
      func: addUsingMusicKit,
      // Pass the session key into the injected script!
      args: [trackIds, this.sessionKey] 
    });

    const res = injectionResults[0]?.result as any;
    return res?.success === true;
  }

  async isLoggedIn(): Promise<boolean> {
    const targetTab = await this.getAppleMusicTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      world: 'MAIN',
      func: () => {
        // @ts-ignore
        const musicKit = window.MusicKit?.getInstance();
        return musicKit ? musicKit.isAuthorized === true : false;
      }
    });

    return injectionResults[0]?.result === true;
  }
}