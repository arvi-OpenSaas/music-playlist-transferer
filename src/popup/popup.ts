import '@/popup/popup.css';

const statusEl = document.getElementById('status');
const stepEl = document.getElementById('step');
const loaderEl = document.getElementById('loader');
const runButton = document.getElementById('run-transfer');

if (statusEl && stepEl && loaderEl && runButton) {
  statusEl.textContent = 'Ready';
  stepEl.textContent = 'Idle';

  const updateUi = (message: string, step: string, isLoading: boolean) => {
    statusEl.textContent = message;
    stepEl.textContent = step;
    loaderEl.classList.toggle('active', isLoading);
  };

  runButton.addEventListener('click', () => {
    updateUi('Starting transfer...', 'Preparing sources', true);

    chrome.runtime.sendMessage({ type: 'START_TRANSFER' }, (response) => {
      if (response?.ok) {
        const finalStatus = response.report?.status ?? 'unknown';
        const message = finalStatus === 'failed' ? 'Transfer could not run because no songs were available yet.' : `Transfer status: ${finalStatus}`;
        updateUi(message, finalStatus === 'failed' ? 'Finished with no data' : 'Finished', false);
        return;
      }

      updateUi('Transfer failed', 'Failed', false);
    });
  });
}
