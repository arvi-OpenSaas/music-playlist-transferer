import './popup.css'; 

import { ProviderFactory } from '../core/providerFactory';
import { TransferProgressState } from '../core/types';

// ============================================================================
// ELEMENT SELECTORS
// ============================================================================
const runButton = document.getElementById('runButton') as HTMLButtonElement | null;
const cancelButton = document.getElementById('cancelButton') as HTMLButtonElement | null;
const progressTextEl = document.getElementById('progressText');
const progressSubtitleEl = document.getElementById('progressSubtitle');
const successCountEl = document.getElementById('successCount');
const failCountEl = document.getElementById('failCount');
const progressBarEl = document.getElementById('progressBar');

// New Selectors for the Route Card
const autoDetectCard = document.getElementById('auto-detect-card') as HTMLDivElement | null;
const sourceBadge = document.getElementById('source-badge') as HTMLSpanElement | null;
const destBadge = document.getElementById('dest-badge') as HTMLSpanElement | null;
const tabErrorMsg = document.getElementById('tab-error-msg') as HTMLDivElement | null;

// State Variables
let finalSourceProvider: string | null = null;
let finalDestProvider: string | null = null;

// Helper to convert IDs to display names
function getDisplayName(id: string): string {
  return id === 'APPLE_MUSIC' ? 'Apple Music' : 'YouTube Music';
}

// ============================================================================
// UI UPDATE HELPERS
// ============================================================================
function updateUiState(isRunning: boolean) {
  if (runButton) {
    runButton.style.display = isRunning ? 'none' : 'block';
    runButton.disabled = isRunning || !finalSourceProvider || !finalDestProvider;
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

// ============================================================================
// BUTTON CLICK EVENTS
// ============================================================================
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

// ============================================================================
// REAL-TIME PROGRESS LISTENER
// ============================================================================
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TRANSFER_PROGRESS') {
    const payload = message.payload as TransferProgressState;
    const isRunning = payload.status === 'running' || payload.status === 'cancelling';

    updateUiState(isRunning);
    updateUiText(payload);
  }
});

// ============================================================================
// WAKEUP ROUTINE & SMART TAB DETECTION
// ============================================================================
async function detectTabs() {
  // 1. Get the tab you are CURRENTLY looking at
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = activeTabs[0];

  // 2. Get all other open tabs
  const allTabs = await chrome.tabs.query({});
  const platforms = ProviderFactory.getSupportedPlatforms();

  let activePlatformId: string | null = null;
  const otherOpenPlatforms: string[] = [];

  // Check if your current active tab is a supported music player
  if (activeTab && activeTab.url) {
    const matched = platforms.find(p => activeTab.url!.includes(p.domain));
    if (matched) activePlatformId = matched.id;
  }

  // Check the background tabs to find your destination
  for (const tab of allTabs) {
    if (tab.id === activeTab?.id) continue; 
    if (tab.url) {
      const matched = platforms.find(p => tab.url!.includes(p.domain));
      if (matched && !otherOpenPlatforms.includes(matched.id)) {
        otherOpenPlatforms.push(matched.id);
      }
    }
  }

  // Assign the Source to the active tab, and target the background tab
  if (activePlatformId) {
    finalSourceProvider = activePlatformId;
    finalDestProvider = otherOpenPlatforms.length > 0 
      ? otherOpenPlatforms[0] 
      : (activePlatformId === 'APPLE_MUSIC' ? 'YOUTUBE_MUSIC' : 'APPLE_MUSIC'); // Default fallback
      
    // Un-hide the UI card and set the text!
    if (autoDetectCard) autoDetectCard.style.display = 'block';
    if (tabErrorMsg) tabErrorMsg.style.display = 'none';
    if (sourceBadge) sourceBadge.textContent = getDisplayName(finalSourceProvider);
    if (destBadge) destBadge.textContent = getDisplayName(finalDestProvider);
    
  } else {
    // If you open the extension on Google.com, show the error
    finalSourceProvider = null;
    finalDestProvider = null;
    
    if (autoDetectCard) autoDetectCard.style.display = 'none';
    if (tabErrorMsg) tabErrorMsg.style.display = 'block';
  }

  updateUiState(false);
}

// Check for active transfers, otherwise detect tabs
chrome.storage.local.get(['transferState'], (result) => {
  if (result.transferState) {
    const state = result.transferState as TransferProgressState;
    if (state.status === 'running' || state.status === 'cancelling') {
      updateUiState(true);
      updateUiText(state);
      return; 
    } else {
      updateUiText(state);
    }
  }
  detectTabs();
});