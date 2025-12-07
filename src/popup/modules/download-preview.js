// ============================================
// DOWNLOAD PREVIEW
// ============================================

(function() {
  window.addDownloadItem = function(id, filename, status = 'pending') {
    const downloadList = document.getElementById('downloadList');
    const previewContainer = document.getElementById('downloadPreview');

    if (!downloadList) return;

    const item = document.createElement('div');
    item.className = `download-item ${status}`;
    item.id = `download-${id}`;
    item.innerHTML = `
      <span class="file-icon">${window.getFileIcon(filename)}</span>
      <span class="file-name">${filename}</span>
      <span class="file-status ${status}">${window.getStatusText(status)}</span>
    `;

    downloadList.appendChild(item);
    window.downloadItems.set(id, { element: item, filename, status });

    if (previewContainer && previewContainer.style.display === 'none') {
      previewContainer.style.display = 'block';
    }
  };

  window.updateDownloadItem = function(id, status) {
    const item = window.downloadItems.get(id);
    if (item) {
      item.element.className = `download-item ${status}`;
      const statusElement = item.element.querySelector('.file-status');
      if (statusElement) {
        statusElement.className = `file-status ${status}`;
        statusElement.textContent = window.getStatusText(status);
      }
      item.status = status;
    }
  };

  window.clearDownloadPreview = function() {
    const downloadList = document.getElementById('downloadList');
    const previewContainer = document.getElementById('downloadPreview');

    if (downloadList) {
      downloadList.innerHTML = '';
    }
    window.downloadItems.clear();

    if (previewContainer) {
      previewContainer.style.display = 'none';
    }
  };

  window.getFileIcon = function(filename) {
    if (filename.toLowerCase().includes('pdf')) {
      return '📄';
    } else if (filename.toLowerCase().includes('jpg') || filename.toLowerCase().includes('jpeg')) {
      return '🖼️';
    } else if (filename.toLowerCase().includes('zip')) {
      return '📦';
    }
    return '📄';
  };

  window.getStatusText = function(status) {
    switch (status) {
      case 'pending': return 'Waiting';
      case 'downloading': return 'Downloading';
      case 'completed': return 'Done';
      case 'failed': return 'Failed';
      default: return status;
    }
  };
})();