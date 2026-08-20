import { error } from 'console';
import { ProviderFactory } from '../core/providerFactory';
import { UniversalSong, TransferProgressState } from '../core/types';

// State to keep track of the current transfer
let currentTransferState: TransferProgressState = {
  status: 'idle',
  processed: 0,
  total: 0,
  successes: 0,
  failures: 0,
  percentage: 0
};

let transferStartTime: number = 0;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_TRANSFER') {
    const { source, destination } = message.payload;
    
    // Start the transfer asynchronously so we can return a quick response to the popup
    startTransferRoutine(source, destination).catch(err => {
      console.error("Transfer failed:", err);
    });

    sendResponse({ ok: true, report: { status: 'running' } });
    return true; // Keeps the message channel open
  }

  if (message.type === 'CANCEL_TRANSFER') {
    console.log("🛑 Cancel command received!");
    // Directly mutate the active state object
    if (currentTransferState) {
      currentTransferState.status = 'cancelling'; 
    }
    sendResponse({ ok: true });
    return true;
  }

  // NEW: The popup will ask for this the moment it opens to reconnect to the transfer
  if (message.type === 'GET_STATUS') {
    sendResponse({ state: currentTransferState });
    return true;
  }
});

/**
 * Ruthlessly scrubs titles to ensure API compatibility.
 */
function sanitizeTitleOnly(title: string): string {
  let clean = title.toLowerCase();

  // 1. Nuke everything after specific characters
  clean = clean.split('|')[0];
  clean = clean.split('-')[0];
  clean = clean.split('feat.')[0];
  clean = clean.split(' ft.')[0];

  // 2. Remove all text inside parentheses and brackets entirely
  clean = clean.replace(/\[.*?\]|\(.*?\)/g, '');

  // 3. Aggressively remove generic junk words
  const junkWords = [
    'official', 'video', 'song', 'tamil', 'full', 'hd', '4k', '1080p', 
    'lyrical', 'lyric', 'audio', 'original motion picture soundtrack', 
    'original soundtrack', 'theme', 'bgm'
  ];
  
  junkWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    clean = clean.replace(regex, '');
  });

  // 4. Strip out any remaining non-alphanumeric characters
  clean = clean.replace(/[^\w\s\u0C00-\u0C7F\u0B80-\u0BFF]/g, ' ');

  // 5. Remove extra spaces
  clean = clean.replace(/\s+/g, ' ').trim();
  
  return clean;
}

async function startTransferRoutine(sourceId: string, destId: string) {
  try {
    console.log(`🚀 Starting transfer from ${sourceId} to ${destId}`);
    
    // 1. Get the correct adapters from our factory
    const sourceProvider = ProviderFactory.getProvider(sourceId);
    const destProvider = ProviderFactory.getProvider(destId);

    // 2. Extract the playlist from the source
    console.log(`📦 Extracting songs from ${sourceProvider.name}...`);
    const songsToTransfer = await sourceProvider.extractPlaylist();
    
    if (!songsToTransfer || songsToTransfer.length === 0) {
      throw new Error("No songs found to transfer.");
    }

    // 3. Initialize progress state & start stopwatch
    currentTransferState = {
      status: 'running',
      processed: 0,
      total: songsToTransfer.length,
      successes: 0,
      failures: 0,
      percentage: 0,
      etaSeconds: 0
    };
    const transferStartTime = Date.now();
    saveAndBroadcastState();

    // 4. The Transfer Loop
    for (const song of songsToTransfer) {
      
      // 🛑 THE EMERGENCY BRAKE: Check the state object directly
      if (currentTransferState.status === 'cancelling') {
        console.warn("🛑 Transfer loop aborted by user.");
        currentTransferState.status = 'cancelled';
        currentTransferState.etaSeconds = 0;
        saveAndBroadcastState();
        break; // Instantly kills the loop
      }

      try {
        const cleanTitle = sanitizeTitleOnly(song.title);
        const primaryArtist = song.artist ? song.artist.split(',')[0].split('&')[0].trim() : '';
        
        console.log(`🔍 Original: "${song.title}"`);
        
        // Pass 1: Try searching with Title + Artist
        let searchTarget = { 
          ...song, 
          title: `${cleanTitle} ${primaryArtist}`.trim(), 
          artist: '' 
        };
        
        console.log(`✨ Pass 1 (Title + Artist): "${searchTarget.title}"`);
        let destTrackId = await destProvider.searchForSong(searchTarget);
        
        // Pass 2: If Pass 1 fails, drop the artist and try just the Title
        if (!destTrackId) {
          console.log(`⚠️ Pass 1 failed. Pass 2 (Title Only): "${cleanTitle}"`);
          searchTarget.title = cleanTitle;
          destTrackId = await destProvider.searchForSong(searchTarget);
        }
        
        if (destTrackId) {
          // Send an empty string for the playlist ID so the Spotify Adapter creates a new one
          const addSuccess = await destProvider.addToPlaylist('', [destTrackId]);
          
          if (addSuccess) {
            currentTransferState.successes++;
            console.log(`✅ MATCHED & SAVED: "${cleanTitle}"`);
          } else {
            console.warn(`❌ MATCHED BUT FAILED TO SAVE: "${cleanTitle}"`);
            currentTransferState.failures++;
          }
        } else {
          console.warn(`❌ FAILED. Could not find match for "${cleanTitle}"`);
          currentTransferState.failures++;
        }
      } catch (error) {
        console.error(`Error processing "${song.title}":`, error);
        currentTransferState.failures++;
      }

      // Update progress & calculate ETA
      currentTransferState.processed++;
      currentTransferState.percentage = Math.round((currentTransferState.processed / currentTransferState.total) * 100);

      const elapsedMs = Date.now() - transferStartTime;
      const msPerSong = elapsedMs / currentTransferState.processed;
      const remainingSongs = currentTransferState.total - currentTransferState.processed;
      currentTransferState.etaSeconds = Math.max(0, Math.round((remainingSongs * msPerSong) / 1000));

      saveAndBroadcastState();
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 5. Finish up (only if not cancelled)
    if (currentTransferState.status !== 'cancelled') {
      currentTransferState.status = 'completed';
      currentTransferState.etaSeconds = 0;
      saveAndBroadcastState();
      console.log("✅ Transfer Complete!");
    }

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.error("🚨 Critical Transfer Error:", err);
    currentTransferState.status = 'failed';
    currentTransferState.etaSeconds = 0;
    saveAndBroadcastState();

    if (errorMessage.includes('HTTP 403') || errorMessage.includes('403')) {
      chrome.runtime.sendMessage({ 
        type: 'SPOTIFY_403_ALERT', 
        payload: "Spotify restricts third-party apps from reading other users' playlists.\n\nTo transfer this, clone it using the Spotify Desktop App:\n1. Open this playlist in the desktop app.\n2. Click a song and press Ctrl+A (Windows) or Cmd+A (Mac) to select all.\n3. Right-click > Add to playlist > Create playlist.\n4. Refresh your browser, open your new clone, and run the transfer again!" 
      });
    }
  }
}

/**
 * Saves the current progress to local storage and broadcasts it to the open popup.
 */
function saveAndBroadcastState() {
  // FIXED: Standardized the storage key to 'transferState'
  chrome.storage.local.set({ transferState: currentTransferState });
  chrome.runtime.sendMessage({ 
    type: 'TRANSFER_PROGRESS', 
    payload: currentTransferState 
  }).catch(() => {
    // Ignore errors here. It just means the user closed the popup while it was running.
  });
}