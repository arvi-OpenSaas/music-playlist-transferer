import { Playlist, ProviderName, Song } from '@/shared/types';
import { Logger } from '@/utils/Logger';
import { IStorage } from '@/storage/IStorage';
import { BaseMusicProvider } from '@/providers/MusicProvider';

interface YouTubeContentResponse {
  ok?: boolean;
  data?: any;
  error?: string;
}

export class YouTubeMusicProvider extends BaseMusicProvider {
  readonly name = ProviderName.YOUTUBE_MUSIC;
  readonly isAvailable = true;

  constructor(
    protected readonly logger: Logger = new Logger({ module: 'YouTubeMusicProvider' }),
    protected readonly storage: IStorage,
  ) {
    super();
  }

  async getPlaylists(): Promise<Playlist[]> { return []; }
  async getPlaylistSongs(_playlistId: string): Promise<Song[]> { return []; }
  async removeSongFromPlaylist(): Promise<void> { return; }
  async searchSong(): Promise<Song[]> { return []; }

  async createPlaylist(name: string): Promise<Playlist> {
    this.logger.info(`[HarmonySync API] Creating playlist: ${name}`);
    const response = await this.sendToContentScript('YOUTUBE_API_CREATE_PLAYLIST', { name });
    
    if (response?.ok && response.data?.playlistId) {
      return {
        id: response.data.playlistId,
        name,
        provider: ProviderName.YOUTUBE_MUSIC,
      };
    }
    throw new Error(response?.error || 'Failed to create playlist via API');
  }

  async addSongToPlaylist(playlistId: string, song: Song): Promise<void> {
    this.logger.info(`[HarmonySync API] Searching and adding: ${song.title}`);
    
    // We pass only the clean title for the highest search accuracy
    const response = await this.sendToContentScript('YOUTUBE_API_ADD_SONG', { 
      playlistId, 
      query: song.title 
    });
    
    if (!response?.ok) {
      throw new Error(response?.error || `Failed to add song: ${song.title}`);
    }
    
  }

private async sendToContentScript(actionType: string, actionData?: any): Promise<YouTubeContentResponse> {
    const tabs = await chrome.tabs.query({ url: '*://music.youtube.com/*' });
    const targetTab = tabs[0];

    if (!targetTab?.id) {
      return { ok: false, error: 'YouTube Music tab not found. Please make sure music.youtube.com is open in a tab.' };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        world: 'MAIN', 
        args: [actionType, actionData],
        func: async (type: string, data: any) => {
          // =========================================================
          // INJECTED BROWSER CONTEXT: RUNS DIRECTLY INSIDE YOUTUBE TAB
          // =========================================================

          const getInnertubeConfig = () => {
            // @ts-ignore
            if (typeof window.ytcfg === 'undefined') return null;
            // @ts-ignore
            const key = window.ytcfg.get('INNERTUBE_API_KEY');
            // @ts-ignore
            const context = window.ytcfg.get('INNERTUBE_CONTEXT');
            return { key, context };
          };

          const config = getInnertubeConfig();
          if (!config || !config.key) {
            return { ok: false, error: 'Could not find YouTube internal API keys.' };
          }

          // 2. Auth Generator: Replicates YouTube's security headers
          const getAuthorizationHeader = async () => {
            const sapisid = document.cookie.match(/SAPISID=([^;]+)/)?.[1];
            if (!sapisid) return '';
            
            const time = Math.round(Date.now() / 1000);
            const msg = `${time} ${sapisid} https://music.youtube.com`;
            
            const buffer = new TextEncoder().encode(msg);
            const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            return `SAPISIDHASH ${time}_${hashHex}`;
          };

          // 3. Helper to fetch directly from YouTube's internal JSON API
          const fetchInnertube = async (endpoint: string, bodyData: any) => {
            const url = `https://music.youtube.com/youtubei/v1/${endpoint}?key=${config.key}&prettyPrint=false`;
            
            const authHeader = await getAuthorizationHeader();
            const headers: Record<string, string> = { 
              'Content-Type': 'application/json',
              'X-Origin': 'https://music.youtube.com'
            };
            
            if (authHeader) {
              headers['Authorization'] = authHeader;
            }

            const response = await fetch(url, {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify({
                context: config.context,
                ...bodyData
              })
            });
            return response.json();
          };

          try {
            // ==========================================
            // ACTION: CREATE PLAYLIST
            // ==========================================
            if (type === 'YOUTUBE_API_CREATE_PLAYLIST') {
              const resData = await fetchInnertube('playlist/create', {
                title: data?.name || 'Imported Playlist',
                description: 'Created automatically by HarmonySync',
                privacyStatus: 'PRIVATE'
              });
              
              console.log('[HarmonySync] Create Playlist Response:', resData);

              if (!resData.playlistId) {
                return { ok: false, error: `API did not return a playlist ID. Response: ${JSON.stringify(resData)}` };
              }
              return { ok: true, data: { playlistId: resData.playlistId } };
            }

            // ==========================================
            // ACTION: SEARCH AND ADD SONG
            // ==========================================
            // ==========================================
            // ACTION: SEARCH AND ADD SONG
            // ==========================================
            if (type === 'YOUTUBE_API_ADD_SONG') {
              const searchRes = await fetchInnertube('search', { query: data?.query });
              
              // NEW: Bulletproof recursive function to hunt down the videoId anywhere in the JSON
              const extractVideoId = (jsonObj: any): string | null => {
                if (!jsonObj || typeof jsonObj !== 'object') return null;
                // If we found a videoId string, return it immediately
                if (typeof jsonObj.videoId === 'string') return jsonObj.videoId;
                
                // Otherwise, dig deeper into the object
                for (const key in jsonObj) {
                  const result = extractVideoId(jsonObj[key]);
                  if (result) return result;
                }
                return null;
              };

              // Run the scanner on the search response
              const videoId = extractVideoId(searchRes);

              if (!videoId) {
                console.warn(`[HarmonySync] Search payload did not contain a videoId for: ${data?.query}`, searchRes);
                return { ok: false, error: 'Song not found in internal API search results.' };
              }

              // Add the found Video ID to the Playlist
              const addRes = await fetchInnertube('browse/edit_playlist', {
                playlistId: (data?.playlistId as string).replace(/^VL/, ''),
                actions: [
                  {
                    action: 'ACTION_ADD_VIDEO',
                    addedVideoId: videoId
                  }
                ]
              });
              
              console.log(`[HarmonySync] Successfully Added Song: ${data?.query}`, addRes);

              return { ok: true, data: { added: true, videoId } };
            }

            return { ok: false, error: 'Unknown API action type' };

          } catch (err: any) {
            return { ok: false, error: err.message };
          }
        }
      });

      return results[0].result as YouTubeContentResponse;
    } catch (error: any) {
      this.logger.error(`Failed to execute API script on tab: ${error}`);
      return { ok: false, error: 'Content script injection failed.' };
    }
  }
}