// ============================================
// ADVANCED OPTIONS
// ============================================

(function() {
  window.initializeAdvancedOptions = function() {
    const includeDigitalCheckbox = document.getElementById('includeDigital');
    const concurrentSelect = document.getElementById('concurrent');

    if (!includeDigitalCheckbox || !concurrentSelect) return;

    // Load saved options
    chrome.storage.sync.get(['includeDigital', 'concurrentDownloads'], function(data) {
      if (data.includeDigital !== undefined) {
        includeDigitalCheckbox.checked = data.includeDigital;
      }
      if (data.concurrentDownloads !== undefined) {
        concurrentSelect.value = data.concurrentDownloads;
      }
    });

    // Save options when changed
    includeDigitalCheckbox.addEventListener('change', function() {
      chrome.storage.sync.set({ includeDigital: this.checked });
    });

    concurrentSelect.addEventListener('change', function() {
      chrome.storage.sync.set({ concurrentDownloads: parseInt(this.value) });
    });
  };

  window.getAdvancedOptions = function() {
    const includeDigital = document.getElementById('includeDigital');
    const concurrent = document.getElementById('concurrent');

    return {
      includeDigital: includeDigital ? includeDigital.checked : false,
      concurrentDownloads: concurrent ? parseInt(concurrent.value) : 3
    };
  };
})();