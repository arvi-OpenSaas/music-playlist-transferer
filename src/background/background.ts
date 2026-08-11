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

let cancelRequested = false;
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
});

/**
 * Scrubs messy YouTube titles. Strips out hyphens, pipes, and junk words.
 */
function sanitizeTitleOnly(title: string): string {
  // 1. Strip everything after a pipe or hyphen (usually cast lists or labels)
  let clean = title.split('|')[0];
  clean = clean.split('-')[0]; 
  
  // 2. Aggressive junk word removal
  const junkWords = [
    /official/gi, /video/gi, /song/gi, /tamil/gi, /full/gi, 
    /hd/gi, /4k/gi, /1080p/gi, /lyrical/gi, /lyric/gi, /audio/gi
  ];
  
  junkWords.forEach(regex => {
    clean = clean.replace(regex, '');
  });

  // 3. Remove parentheses/brackets
  clean = clean.replace(/\[.*?\]|\(.*?\)/g, '');
  
  return clean.trim();
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

    // 3. Initialize progress state
    currentTransferState = {
      status: 'running',
      processed: 0,
      total: songsToTransfer.length,
      successes: 0,
      failures: 0,
      percentage: 0
    };
    saveAndBroadcastState();

   // 4. The Transfer Loop
    // 4. The Transfer Loop
    for (const song of songsToTransfer) {
      
      // 🛑 THE EMERGENCY BRAKE: Check the state object directly
      if (currentTransferState.status === 'cancelling') {
        console.warn("🛑 Transfer loop aborted by user.");
        currentTransferState.status = 'cancelled';
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
        
        // Pass 2: If Pass 1 fails, drop the artist (in case it's a record label) and try just the Title
        if (!destTrackId) {
          console.log(`⚠️ Pass 1 failed. Pass 2 (Title Only): "${cleanTitle}"`);
          searchTarget.title = cleanTitle;
          destTrackId = await destProvider.searchForSong(searchTarget);
        }
        
        if (destTrackId) {
          // ✅ NEW: Actually check if the save was successful!
          const addSuccess = await destProvider.addToPlaylist('CURRENT_ACTIVE_PLAYLIST', [destTrackId]);
          
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

      // Update progress
      currentTransferState.processed++;
      currentTransferState.percentage = Math.round((currentTransferState.processed / currentTransferState.total) * 100);
      saveAndBroadcastState();
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 5. Finish up
    currentTransferState.status = 'completed';
    saveAndBroadcastState();
    console.log("✅ Transfer Complete!");

  } catch (error) {
    console.error("🚨 Critical Transfer Error:", error);
    currentTransferState.status = 'failed';
    saveAndBroadcastState();
  }
}

/**
 * Saves the current progress to local storage (so if the user closes and reopens the popup, 
 * it remembers where it was) and broadcasts it to the open popup.
 */
function saveAndBroadcastState() {
  chrome.storage.local.set({ harmonyTransferState: currentTransferState });
  chrome.runtime.sendMessage({ 
    type: 'TRANSFER_PROGRESS', 
    payload: currentTransferState 
  }).catch(() => {
    // Ignore errors here. It just means the user closed the popup while it was running.
  });
}