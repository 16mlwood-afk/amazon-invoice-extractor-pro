// ============================================
// POPUP STATE SYNCHRONIZATION
// ============================================

(function() {
  window.showInProgressUI = function(state) {
    console.log('🔄 Showing IN PROGRESS UI');

    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.style.display = 'none';
    }

    const statusDiv = document.getElementById('status') || window.createStatusDiv();
    statusDiv.innerHTML = `
      <div style="padding: 16px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
        <h3 style="margin: 0 0 8px 0; color: #856404;">
          🔄 Collection In Progress
        </h3>
        <p style="margin: 4px 0; color: #856404;">
          Page ${state.currentPage || '?'} of ${state.totalPages || '?'}
        </p>
        <p style="margin: 4px 0; color: #856404;">
          Found ${state.collectedItems || 0} invoices
        </p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #856404;">
          💡 Please wait in the Amazon tab...
        </p>
        <button id="cancel-from-popup" style="
          margin-top: 12px; width: 100%;
          background: #dc3545; color: white;
          border: none; padding: 10px; border-radius: 6px;
          cursor: pointer; font-size: 14px;">
          Cancel Collection
        </button>
      </div>
    `;

    const cancelBtn = document.getElementById('cancel-from-popup');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs && tabs[0]) {
            await chrome.tabs.sendMessage(tabs[0].id, { action: 'cancelCollection' });
            window.close();
          }
        } catch (error) {
          console.error('Error canceling collection:', error);
          window.close();
        }
      });
    }

    window.disableFormInputs();
  };

  window.showCompletedUI = function(state) {
    console.log('✅ Showing COMPLETED UI');

    const statusDiv = document.getElementById('status') || window.createStatusDiv();
    statusDiv.innerHTML = `
      <div style="padding: 16px; background: #d4edda; border-radius: 8px; border: 1px solid #28a745;">
        <h3 style="margin: 0 0 8px 0; color: #155724;">
          ✅ Collection Complete
        </h3>
        <p style="margin: 4px 0; color: #155724;">
          Collected ${state.collectedItems || 0} invoices
        </p>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #155724;">
          💡 Downloads are processing in the background
        </p>
      </div>
    `;

    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.style.display = 'none';
    }
  };

  window.showReadyUI = function() {
    console.log('🆕 Showing READY UI');

    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
      downloadBtn.style.display = 'block';
    }

    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.innerHTML = '';
    }

    window.enableFormInputs();
  };

  window.createStatusDiv = function() {
    const div = document.createElement('div');
    div.id = 'status';

    const container = document.querySelector('.popup-container') || document.body;
    container.insertBefore(div, container.firstChild);

    return div;
  };

  window.disableFormInputs = function() {
    const inputs = document.querySelectorAll('input, select, button');
    inputs.forEach(input => {
      if (input.id !== 'cancel-from-popup') {
        input.disabled = true;
      }
    });
  };

  window.enableFormInputs = function() {
    const inputs = document.querySelectorAll('input, select, button');
    inputs.forEach(input => input.disabled = false);
  };

  window.initializePopup = async function() {
    console.log('🎬 Popup initializing...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        console.log('⚠️ No active tab found');
        return;
      }

      if (!tab.url?.includes('amazon.')) {
        console.log('ℹ️ Not on Amazon page');
        return;
      }

      console.log('🔍 Querying content script state...');

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'getContentState'
      });

      console.log('📊 Content script state:', response);

      if (response?.hasState) {
        if (response.isRunning) {
          window.showInProgressUI(response);
        } else if (response.isComplete) {
          window.showCompletedUI(response);
        } else {
          window.showReadyUI();
        }
      } else {
        window.showReadyUI();
      }

    } catch (error) {
      console.log('ℹ️ Could not get content state (expected if no content script):', error);
      window.showReadyUI();
    }
  };
})();