import '@/popup/popup.css';

// 1. Tell TypeScript exactly what our progress data looks like
interface TransferProgressState {
  status: string;
  processed: number;
  total: number;
  successes: number;
  failures: number;
  percentage: number;
}

console.log("🚀 Popup script is loading!");

document.addEventListener('DOMContentLoaded', () => {
  console.log("📄 HTML fully loaded. Hunting for elements...");

  const statusEl = document.getElementById('status');
  const stepEl = document.getElementById('step');
  const loaderEl = document.getElementById('loader');
  const runButton = document.getElementById('run-transfer');

  const progressTextEl = document.getElementById('progress-text');
  const successCountEl = document.getElementById('success-count');
  const failCountEl = document.getElementById('fail-count');
  const progressBarEl = document.getElementById('progress-bar-fill');

  console.log("🔍 Elements found:", { 
    statusEl, 
    stepEl, 
    loaderEl, 
    runButton, 
    progressTextEl, 
    successCountEl, 
    failCountEl, 
    progressBarEl 
  });

  if (!runButton) {
    console.error("❌ CRITICAL: The 'Run Transfer' button was not found in the HTML!");
    return;
  }

  if (statusEl) statusEl.textContent = 'Ready';
  if (stepEl) stepEl.textContent = 'Idle';

  const updateUi = (message: string, step: string, isLoading: boolean) => {
    if (statusEl) statusEl.textContent = message;
    if (stepEl) stepEl.textContent = step;
    if (loaderEl) loaderEl.classList.toggle('active', isLoading);
    // Inside your updateUi function or when starting the transfer:
const tutorialEl = document.getElementById('tutorial-section');
if (tutorialEl) {
  tutorialEl.style.display = 'none'; // Hides the tutorial when the app is working
}
  };

  // ============================================================================
  // RESTORE STATE ON OPEN
  // ============================================================================
  chrome.storage.local.get('harmonyTransferState', (data) => {
    // 2. Cast the unknown storage data to our specific type
    const state = data.harmonyTransferState as TransferProgressState | undefined;
    
    if (state) {
      console.log("💾 Found previous state in storage:", state);
      
      if (state.status === 'running') {
        const progressMessage = `Transferring: ${state.processed}/${state.total} (${state.percentage}%)`;
        const stepDetail = `Succeeded: ${state.successes} | Failed: ${state.failures}`;
        
        updateUi(progressMessage, stepDetail, true);

        if (progressTextEl) progressTextEl.textContent = `${state.processed} / ${state.total} (${state.percentage}%)`;
        if (successCountEl) successCountEl.textContent = `Succeeded: ${state.successes}`;
        if (failCountEl) failCountEl.textContent = `Failed: ${state.failures}`;
        if (progressBarEl) progressBarEl.style.width = `${state.percentage}%`;
      } else if (state.status === 'completed' || state.status === 'failed') {
        updateUi(`Transfer status: ${state.status}`, 'Finished', false);
      }
    }
  });

  // ============================================================================
  // REAL-TIME PROGRESS LISTENER
  // ============================================================================
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'TRANSFER_PROGRESS') {
      // 3. Cast the unknown message payload to our specific type
      const payload = message.payload as TransferProgressState;

      const progressMessage = `Transferring: ${payload.processed}/${payload.total} (${payload.percentage}%)`;
      const stepDetail = `Succeeded: ${payload.successes} | Failed: ${payload.failures}`;

      updateUi(progressMessage, stepDetail, true);

      if (progressTextEl) progressTextEl.textContent = `${payload.processed} / ${payload.total} (${payload.percentage}%)`;
      if (successCountEl) successCountEl.textContent = `Succeeded: ${payload.successes}`;
      if (failCountEl) failCountEl.textContent = `Failed: ${payload.failures}`;
      if (progressBarEl) progressBarEl.style.width = `${payload.percentage}%`;
    }
  });

  // ============================================================================
  // TRANSFER TRIGGER
  // ============================================================================
  runButton.addEventListener('click', () => {
    console.log("🖱️ Button clicked! Sending message to background...");
    updateUi('Starting transfer...', 'Preparing sources', true);

    if (progressTextEl) progressTextEl.textContent = '0%';
    if (successCountEl) successCountEl.textContent = 'Succeeded: 0';
    if (failCountEl) failCountEl.textContent = 'Failed: 0';
    if (progressBarEl) progressBarEl.style.width = '0%';

    chrome.runtime.sendMessage({ type: 'START_TRANSFER' }, (response) => {
      console.log("📨 Response received from background:", response);
      
      if (response?.ok) {
        const finalStatus = response.report?.status ?? 'unknown';
        const message = finalStatus === 'failed' 
          ? 'Transfer could not run because no songs were available yet.' 
          : `Transfer status: ${finalStatus}`;
        
        updateUi(message, finalStatus === 'failed' ? 'Finished with no data' : 'Finished', false);
        return;
      }

      updateUi('Transfer failed', 'Failed', false);
    });
  });
});