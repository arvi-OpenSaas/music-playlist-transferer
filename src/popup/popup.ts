import './popup.css'; 

import { ProviderFactory } from '../core/providerFactory';
import { TransferProgressState } from '../core/types';


// ELEMENT SELECTORS
const runButton = document.getElementById('runButton') as HTMLButtonElement | null;
const cancelButton = document.getElementById('cancelButton') as HTMLButtonElement | null;
const progressTextEl = document.getElementById('progressText');
const progressSubtitleEl = document.getElementById('progressSubtitle');
const successCountEl = document.getElementById('successCount');
const failCountEl = document.getElementById('failCount');
const progressBarEl = document.getElementById('progressBar');
const spotifyPremiumNotice = document.getElementById('spotify-premium-notice') as HTMLDivElement | null;

// Route Card Selectors
const autoDetectCard = document.getElementById('auto-detect-card') as HTMLDivElement | null;
const sourceBadge = document.getElementById('source-badge') as HTMLSpanElement | null;
const destBadge = document.getElementById('dest-badge') as HTMLSpanElement | null;
const tabErrorMsg = document.getElementById('tab-error-msg') as HTMLDivElement | null;
const loginErrorMsg = document.getElementById('login-error-msg') as HTMLDivElement | null;

// Multi-Tab Selectors
const multiTabSelector = document.getElementById('multi-tab-selector') as HTMLDivElement | null;
const destSelect = document.getElementById('dest-select') as HTMLSelectElement | null;


// State Variables
let finalSourceProvider: string | null = null;
let finalDestProvider: string | null = null;

// Helper to convert IDs to display names
function getDisplayName(id: string): string {
  if (id === 'APPLE_MUSIC') return 'Apple Music';
  if (id === 'YOUTUBE_MUSIC') return 'YouTube Music';
  if (id === 'SPOTIFY') return 'Spotify';
  return id;
}


// UI UPDATE HELPERS
function updateUiState(isRunning: boolean, forceDisableButton: boolean = false) {
  if (runButton) {
    runButton.style.display = isRunning ? 'none' : 'block';
    // Disable if running, missing providers, or explicitly forced (e.g., logged out)
    runButton.disabled = isRunning || !finalSourceProvider || !finalDestProvider || forceDisableButton;
  }

  if (cancelButton) {
    cancelButton.style.display = isRunning ? 'block' : 'none';
    cancelButton.disabled = !isRunning;
    cancelButton.textContent = "Stop Transfer";
  }
}

function updateUiText(payload: TransferProgressState) {
  const isRunning = payload.status === 'running' || payload.status === 'cancelling';
  
  if (progressTextEl) {
    progressTextEl.textContent = isRunning 
      ? `Transferring: ${payload.processed} / ${payload.total} (${payload.percentage}%)`
      : payload.status === 'cancelled' ? `Transfer Stopped (${payload.percentage}%)` : `Transfer Complete! (${payload.percentage}%)`;
  }

  if (progressSubtitleEl) progressSubtitleEl.textContent = `Succeeded: ${payload.successes} | Failed: ${payload.failures}`;
  if (successCountEl) successCountEl.textContent = `Succeeded: ${payload.successes}`;
  if (failCountEl) failCountEl.textContent = `Failed: ${payload.failures}`;
  if (progressBarEl) progressBarEl.style.width = `${payload.percentage}%`;
}


// AUTHENTICATION CHECKER
async function verifyAuthAndRender() {
  if (!finalSourceProvider || !finalDestProvider) return;

  const sourceAdapter = ProviderFactory.getProvider(finalSourceProvider);
  const destAdapter = ProviderFactory.getProvider(finalDestProvider);

  // Update route badges
  if (sourceBadge) sourceBadge.textContent = getDisplayName(finalSourceProvider);
  if (destBadge) destBadge.textContent = getDisplayName(finalDestProvider);

  // Toggle Spotify Premium Notice
  if (spotifyPremiumNotice) {
    const involvesSpotify = finalSourceProvider === 'SPOTIFY' || finalDestProvider === 'SPOTIFY';
    spotifyPremiumNotice.style.display = involvesSpotify ? 'block' : 'none';
  }

  try {
    const [sourceLoggedIn, destLoggedIn] = await Promise.all([
      sourceAdapter.isLoggedIn(),
      destAdapter.isLoggedIn()
    ]);

    if (!sourceLoggedIn || !destLoggedIn) {
      const offlinePlatforms: string[] = [];
      if (!sourceLoggedIn) offlinePlatforms.push(getDisplayName(finalSourceProvider));
      if (!destLoggedIn && finalSourceProvider !== finalDestProvider) {
        offlinePlatforms.push(getDisplayName(finalDestProvider));
      }

      if (loginErrorMsg) {
        loginErrorMsg.textContent = `⚠️ Please log in to ${offlinePlatforms.join(' and ')} to continue.`;
        loginErrorMsg.style.display = 'block';
      }
      
      // Disable the transfer button
      updateUiState(false, true); 
    } else {
      if (loginErrorMsg) loginErrorMsg.style.display = 'none';
      // Enable the transfer button
      updateUiState(false, false); 
    }
  } catch (e) {
    console.error("Failed to check auth status:", e);
  }
}

// BUTTON CLICK EVENTS
if (runButton) {
  runButton.addEventListener('click', () => {
    if (!finalSourceProvider || !finalDestProvider) return;
    updateUiState(true);
    chrome.runtime.sendMessage({
      type: 'START_TRANSFER',
      payload: { source: finalSourceProvider, destination: finalDestProvider }
    });
  });
}

if (cancelButton) {
  cancelButton.addEventListener('click', () => {
    cancelButton.textContent = "Stopping...";
    cancelButton.disabled = true;
    chrome.runtime.sendMessage({ type: 'CANCEL_TRANSFER' });
  });
}


// BUY ME A COFFEE HYPERLINK LISTENER
const bmacLink = document.getElementById('bmac-link');

if (bmacLink) {
  bmacLink.addEventListener('click', (event) => {
    event.preventDefault();
    
    // Replace with your actual Buy Me a Coffee URL slug
    const bmacUrl = 'https://buymeacoffee.com/urbro';
    
    chrome.tabs.create({ url: bmacUrl, active: true });
  });
}


// REAL-TIME PROGRESS LISTENER
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TRANSFER_PROGRESS') {
    const payload = message.payload as TransferProgressState;
    const isRunning = payload.status === 'running' || payload.status === 'cancelling';
    updateUiState(isRunning);
    updateUiText(payload);
  }
});


// WAKEUP ROUTINE & SMART TAB DETECTION
async function detectTabs() {
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = activeTabs[0];

  const allTabs = await chrome.tabs.query({});
  const platforms = ProviderFactory.getSupportedPlatforms();

  let activePlatformId: string | null = null;
  const otherOpenPlatforms: string[] = [];

  if (activeTab && activeTab.url) {
    const matched = platforms.find(p => activeTab.url!.includes(p.domain));
    if (matched) activePlatformId = matched.id;
  }

  for (const tab of allTabs) {
    if (tab.id === activeTab?.id) continue; 
    if (tab.url) {
      const matched = platforms.find(p => tab.url!.includes(p.domain));
      if (matched && !otherOpenPlatforms.includes(matched.id)) {
        otherOpenPlatforms.push(matched.id);
      }
    }
  }

  if (activePlatformId) {
    finalSourceProvider = activePlatformId;
    if (autoDetectCard) autoDetectCard.style.display = 'block';
    if (tabErrorMsg) tabErrorMsg.style.display = 'none';

    // MULTI-TAB LOGIC
    if (otherOpenPlatforms.length > 1) {
      // 3 or more platforms open - Show Dropdown!
      if (multiTabSelector) multiTabSelector.style.display = 'block';
      
      if (destSelect) {
        destSelect.innerHTML = ''; 
        otherOpenPlatforms.forEach(platformId => {
          const opt = document.createElement('option');
          opt.value = platformId;
          opt.textContent = getDisplayName(platformId);
          destSelect.appendChild(opt);
        });
        
        finalDestProvider = destSelect.value; // Default to first

        // Listen for user changing the target
        destSelect.addEventListener('change', () => {
          finalDestProvider = destSelect.value;
          verifyAuthAndRender(); // Re-check login instantly!
        });
      }
    } else if (otherOpenPlatforms.length === 1) {
      // EXACTLY ONE TARGET TAB OPEN - THE MISSING LOGIC!
      if (multiTabSelector) multiTabSelector.style.display = 'none';
      finalDestProvider = otherOpenPlatforms[0]; // Assign the target provider!
    } else {
      // 0 targets open - Unsupported tab error
      finalSourceProvider = null;
      finalDestProvider = null;
      if (autoDetectCard) autoDetectCard.style.display = 'none';
      if (tabErrorMsg) tabErrorMsg.style.display = 'block';
      if (loginErrorMsg) loginErrorMsg.style.display = 'none';
      if (spotifyPremiumNotice) spotifyPremiumNotice.style.display = 'none';
      updateUiState(false);
    }

    // Run the initial auth check
    await verifyAuthAndRender();
    
  } else {
    // Unsupported tab error
    finalSourceProvider = null;
    finalDestProvider = null;
    if (autoDetectCard) autoDetectCard.style.display = 'none';
    if (tabErrorMsg) tabErrorMsg.style.display = 'block';
    if (loginErrorMsg) loginErrorMsg.style.display = 'none';
    updateUiState(false);
  }
}

chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  if (response && response.state && response.state.status !== 'idle') {
    const state = response.state as TransferProgressState;
    if (state.status === 'running' || state.status === 'cancelling') {
      updateUiState(true);
      updateUiText(state);
      return; // Stop here, don't run tab detection while transferring
    } else {
      updateUiText(state); // Show final complete/failed score
    }
  }
  
  // If we aren't transferring right now, go ahead and scan for tabs
  detectTabs();
});