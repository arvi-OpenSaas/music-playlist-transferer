import { MusicProvider, UniversalSong } from '../core/types';

async function searchInnerTube(title: string, artist: string): Promise<any> {
  try {
    // @ts-ignore - Access YouTube's hidden configuration object
    const ytcfg = window.ytcfg;
    if (!ytcfg) return { success: false, debug: 'ytcfg not found. Chrome is blocking access.' };

    const apiKey = ytcfg.get('INNERTUBE_API_KEY');
    const clientName = ytcfg.get('INNERTUBE_CONTEXT_CLIENT_NAME');
    const clientVersion = ytcfg.get('INNERTUBE_CONTEXT_CLIENT_VERSION');

    const query = `${title} ${artist}`.trim();

    const res = await fetch(`https://music.youtube.com/youtubei/v1/search?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName, clientVersion } },
        query: query
      })
    });

    const data = await res.json();
    const dataStr = JSON.stringify(data);

    // YouTube's JSON response is incredibly nested and changes often. 
    // This regex acts as a bulletproof X-Ray to grab the very first 11-character videoId it finds.
    const match = dataStr.match(/"videoId":"([^"]{11})"/);
    if (match && match[1]) {
      return { success: true, id: match[1] };
    }

    return { success: false, debug: 'No videoId found in search results.' };
  } catch (error: any) {
    return { success: false, debug: `Search Crash: ${error.message}` };
  }
}

async function addInnerTubePlaylist(trackIds: string[], sessionKey: string): Promise<any> {
  try {
    // @ts-ignore
    const ytcfg = window.ytcfg;
    if (!ytcfg) return { success: false, debug: 'ytcfg not found.' };

    const apiKey = ytcfg.get('INNERTUBE_API_KEY');
    const client = {
      clientName: ytcfg.get('INNERTUBE_CONTEXT_CLIENT_NAME'),
      clientVersion: ytcfg.get('INNERTUBE_CONTEXT_CLIENT_VERSION')
    };

    const headers: any = { 
      'Content-Type': 'application/json',
      'X-Origin': 'https://music.youtube.com',
    };

    // GENERATING THE SAPISIDHASH (Security Header)
    const sapisidMatch = document.cookie.match(/SAPISID=([^;]+)/);
    if (sapisidMatch) {
      const sapisid = sapisidMatch[1];
      const time = Math.floor(Date.now() / 1000);
      const origin = 'https://music.youtube.com';
      const msg = `${time} ${sapisid} ${origin}`;
      
      const msgBuffer = new TextEncoder().encode(msg);
      const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      headers['Authorization'] = `SAPISIDHASH ${time}_${hashHex}`;
    } else {
      return { success: false, debug: 'SAPISID cookie not found. Please ensure you are logged in.' };
    }

    // @ts-ignore
    let targetPlaylistId = window[sessionKey];

    if (!targetPlaylistId) {
      // SMART SEQUENCING: Check for existing Harmony Sync playlists
      let newPlaylistName = 'Harmony Sync';

      try {
        // Fetch the user's library playlists
        const libRes = await fetch(`https://music.youtube.com/youtubei/v1/browse?key=${apiKey}`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            context: { client },
            browseId: 'FEmusic_liked_playlists' 
          })
        });
        
        const libData = await libRes.text(); 
        
        let maxNum = 0;
        let hasBase = false;

        const regex = /Harmony Sync(?: - (\d+))?/g;
        let match;
        
        while ((match = regex.exec(libData)) !== null) {
          hasBase = true;
          if (match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }

        if (hasBase) {
          newPlaylistName = `Harmony Sync - ${maxNum === 0 ? 2 : maxNum + 1}`;
        }
      } catch (e) {
        console.warn("Could not fetch existing playlists. Defaulting to base name.");
      }

      // 1. Create a brand new sequenced playlist
      const res = await fetch(`https://music.youtube.com/youtubei/v1/playlist/create?key=${apiKey}`, {
        method: 'POST',
        headers,
        credentials: 'include', 
        body: JSON.stringify({
          context: { client },
          title: newPlaylistName,
          description: 'Transferred automatically by HarmonySync.',
          videoIds: trackIds 
        })
      });
      
      if (!res.ok) {
        return { success: false, debug: `Create failed with status ${res.status}: ${await res.text()}` };
      }

      const data = await res.json();
      if (data.playlistId) {
        // Cache the ID so the next song in the loop adds to this same playlist
        // @ts-ignore
        window[sessionKey] = data.playlistId;
        return { success: true };
      }
      return { success: false, debug: `No playlistId returned. Response: ${JSON.stringify(data)}` };
      
    } else {
      // 2. Edit the existing playlist to add the rest of the songs
      const res = await fetch(`https://music.youtube.com/youtubei/v1/browse/edit_playlist?key=${apiKey}`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          context: { client },
          playlistId: targetPlaylistId,
          actions: trackIds.map(id => ({ action: 'ACTION_ADD_VIDEO', addedVideoId: id }))
        })
      });
      
      if (res.ok) return { success: true };
      return { success: false, debug: `Edit failed with status ${res.status}: ${await res.text()}` };
    }
  } catch (error: any) {
    return { success: false, debug: `Add Crash: ${error.message}` };
  }
}

function scrapeDomForSongs(): UniversalSong[] {
  const songs: UniversalSong[] = [];
  
  // Restrict to the main container so it doesn't grab sidebar recommendations
  const mainContainer = document.querySelector('ytmusic-playlist-shelf-renderer, ytmusic-shelf-renderer');
  if (!mainContainer) return [];

  const trackRows = mainContainer.querySelectorAll('ytmusic-responsive-list-item-renderer');

  trackRows.forEach((row, index) => {
    try {
      const titleNode = row.querySelector('.title-column yt-formatted-string a') || 
                        row.querySelector('.title-column yt-formatted-string');
      const title = titleNode ? (titleNode as HTMLElement).innerText.trim() : '';

      const metadataNodes = row.querySelectorAll('.secondary-flex-columns yt-formatted-string');
      let artist = 'Unknown Artist';
      let album = undefined;

      if (metadataNodes.length > 0) artist = (metadataNodes[0] as HTMLElement).innerText.trim();
      if (metadataNodes.length > 1) album = (metadataNodes[1] as HTMLElement).innerText.trim();

      if (title) {
        songs.push({ originalId: `ytm-row-${index}`, title, artist, album });
      }
    } catch (error) {}
  });

  return songs;
}


// THE ADAPTER CLASS
export class YouTubeMusicAdapter implements MusicProvider {
  name = 'YouTube Music';
  id = 'YOUTUBE_MUSIC';
  
  // Create a unique ID for this specific transfer session
  private sessionKey = `ytm_session_${Date.now()}`;

  private async getYouTubeTab(): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({ url: '*://music.youtube.com/*' });
    const targetTab = tabs.find(tab => tab.active) || tabs[0]; 
    if (!targetTab?.id) throw new Error('No open YouTube Music tab found.');
    return targetTab;
  }

  async extractPlaylist(): Promise<UniversalSong[]> {
    console.log(`[${this.name}] Starting extraction...`);
    const targetTab = await this.getYouTubeTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      func: scrapeDomForSongs,
    });

    const extractedSongs = (injectionResults[0]?.result as UniversalSong[]) || [];
    console.log(`[${this.name}] Extracted ${extractedSongs.length} songs.`);
    return extractedSongs;
  }

  async searchForSong(song: UniversalSong): Promise<string | null> {
    const targetTab = await this.getYouTubeTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      world: 'MAIN', // CRUCIAL: Breaks out of Chrome's isolation bubble to access ytcfg
      func: searchInnerTube,
      args: [song.title, song.artist || '']
    });

    const res = injectionResults[0]?.result as any;
    
    if (!res || !res.success) {
      console.warn(`▶️ YouTube API Debug [${song.title}]:`, res?.debug || 'Unknown error.');
      return null;
    }

    return res.id;
  }

  async addToPlaylist(playlistId: string, trackIds: string[]): Promise<boolean> {
    const targetTab = await this.getYouTubeTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      world: 'MAIN',
      func: addInnerTubePlaylist,
      args: [trackIds, this.sessionKey] 
    });

    const res = injectionResults[0]?.result as any;
    
    // NEW: Print the exact reason YouTube rejected the save!
    if (!res || !res.success) {
      console.warn(`▶️ YouTube API Save Debug:`, res?.debug || 'Unknown save error.');
      return false;
    }
    
    return true;
  }

  async isLoggedIn(): Promise<boolean> {
    const targetTab = await this.getYouTubeTab();

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id! },
      func: () => {
        // If the SAPISID cookie is present, the user is logged in and authorized
        return document.cookie.includes('SAPISID=');
      }
    });

    return injectionResults[0]?.result === true;
  }
}