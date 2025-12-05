// history.js - Download History Management
console.log('📊 History page loading...');

// Global state
let allSessions = [];
let filteredSessions = [];

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📊 History page initialized');
  
  // Load history
  await loadHistory();
  
  // Setup event listeners
  setupEventListeners();
});

// Load history from storage
async function loadHistory() {
  try {
    const result = await chrome.storage.local.get(['downloadHistory']);
    allSessions = result.downloadHistory?.sessions || [];

    console.log(`📊 Loaded ${allSessions.length} sessions from storage`);
    
    // Update stats
    updateStats();
    
    // Show sessions
    filteredSessions = [...allSessions];
    renderSessions();
    
  } catch (error) {
    console.error('❌ Error loading history:', error);
    showError('Failed to load history');
  }
}

// Calculate and update stats
function updateStats() {
  const totalSessions = allSessions.length;
  const totalInvoices = allSessions.reduce((sum, s) => sum + (s.invoicesDownloaded || 0), 0);
  const totalDuration = allSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const lastSession = allSessions.length > 0 ? allSessions[0] : null;
  
  // Update stat cards
  document.getElementById('totalSessions').textContent = totalSessions;
  document.getElementById('totalInvoices').textContent = totalInvoices;
  document.getElementById('totalTime').textContent = formatDuration(totalDuration);
  
  if (lastSession) {
    document.getElementById('lastDownload').textContent = formatRelativeTime(lastSession.timestamp);
  } else {
    document.getElementById('lastDownload').textContent = 'Never';
  }
}

// Render sessions in table
function renderSessions() {
  const tbody = document.getElementById('historyTableBody');
  const emptyState = document.getElementById('emptyState');
  
  if (filteredSessions.length === 0) {
    tbody.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  tbody.style.display = 'table-row-group';
  emptyState.style.display = 'none';
  
  tbody.innerHTML = filteredSessions.map((session, index) => {
    const date = new Date(session.timestamp);
    const success = session.invoicesDownloaded || 0;
    const failed = session.failed || 0;
    const total = success + failed;
    
    let status = 'success';
    let statusText = 'Success';
    if (failed === total) {
      status = 'failed';
      statusText = 'Failed';
    } else if (failed > 0) {
      status = 'partial';
      statusText = 'Partial';
    }
    
    return `
      <tr data-index="${index}">
        <td>
          <div style="font-weight: 600;">${formatDate(date)}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">${formatTime(date)}</div>
        </td>
        <td>
          <span class="marketplace-badge">${session.marketplace || 'Unknown'}</span>
        </td>
        <td>
          <div style="font-weight: 600;">${success} / ${total}</div>
          ${failed > 0 ? `<div style="font-size: 12px; color: #dc3545; margin-top: 4px;">${failed} failed</div>` : ''}
        </td>
        <td>
          <span class="duration-text">${formatDuration(session.duration || 0)}</span>
        </td>
        <td>
          <span class="status-badge ${status}">${statusText}</span>
        </td>
        <td>
          <button class="btn btn-secondary view-details-btn" style="padding: 6px 12px; font-size: 13px;" data-session-index="${index}">
            View Details
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Setup event listeners
function setupEventListeners() {
  // Filter listeners
  document.getElementById('marketplaceFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('searchInput').addEventListener('input', applyFilters);

  // Action buttons
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
  document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);

  // Event delegation for dynamically created view details buttons
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('view-details-btn')) {
      const sessionIndex = parseInt(e.target.dataset.sessionIndex);
      viewSessionDetails(sessionIndex);
    }
  });
}

// Apply filters
function applyFilters() {
  const marketplaceFilter = document.getElementById('marketplaceFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;
  const searchText = document.getElementById('searchInput').value.toLowerCase();
  
  filteredSessions = allSessions.filter(session => {
    // Marketplace filter
    if (marketplaceFilter && session.marketplace !== marketplaceFilter) {
      return false;
    }
    
    // Status filter
    if (statusFilter) {
      const success = session.successCount || 0;
      const failed = session.failedCount || 0;
      const total = success + failed;
      
      let sessionStatus = 'success';
      if (failed === total) sessionStatus = 'failed';
      else if (failed > 0) sessionStatus = 'partial';
      
      if (sessionStatus !== statusFilter) return false;
    }
    
    // Search filter
    if (searchText) {
      const dateStr = new Date(session.timestamp).toISOString().toLowerCase();
      const marketplaceStr = (session.marketplace || '').toLowerCase();
      if (!dateStr.includes(searchText) && !marketplaceStr.includes(searchText)) {
        return false;
      }
    }
    
    return true;
  });
  
  renderSessions();
}

// View session details
function viewSessionDetails(index) {
  const session = filteredSessions[index];
  
  const details = `
    Session Details:
    
    Date: ${formatDate(new Date(session.timestamp))} ${formatTime(new Date(session.timestamp))}
    Marketplace: ${session.marketplace || 'Unknown'}
    Total Invoices: ${(session.successCount || 0) + (session.failedCount || 0)}
    Successful: ${session.successCount || 0}
    Failed: ${session.failedCount || 0}
    Duration: ${formatDuration(session.duration || 0)}
    
    ${session.files && session.files.length > 0 ? 'Files:\n' + session.files.join('\n') : ''}
  `;
  
  alert(details);
}

// Clear history
async function clearHistory() {
  if (!confirm('Are you sure you want to clear all download history? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.local.set({ downloadHistory: [] });
    allSessions = [];
    filteredSessions = [];
    updateStats();
    renderSessions();
    console.log('✅ History cleared');
  } catch (error) {
    console.error('❌ Error clearing history:', error);
    alert('Failed to clear history. Please try again.');
  }
}

// Export history as CSV
function exportHistory() {
  if (allSessions.length === 0) {
    alert('No history to export');
    return;
  }
  
  // Create CSV content
  const headers = ['Date', 'Time', 'Marketplace', 'Total', 'Success', 'Failed', 'Duration (seconds)', 'Status'];
  const rows = allSessions.map(session => {
    const date = new Date(session.timestamp);
    const success = session.invoicesDownloaded || 0;
    const failed = session.failed || 0;
    const total = success + failed;
    
    let status = 'Success';
    if (failed === total) status = 'Failed';
    else if (failed > 0) status = 'Partial';
    
    return [
      formatDate(date),
      formatTime(date),
      session.marketplace || 'Unknown',
      total,
      success,
      failed,
      Math.round((session.duration || 0) / 1000),
      status
    ];
  });
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `amazon-invoice-history-${formatDate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('✅ History exported as CSV');
}

// Formatting helpers
function formatDate(date) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function formatTime(date) {
  const options = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  return date.toLocaleTimeString('en-US', options);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function showError(message) {
  const emptyState = document.getElementById('emptyState');
  emptyState.innerHTML = `
    <div class="empty-state-icon">⚠️</div>
    <div class="empty-state-title">Error Loading History</div>
    <div class="empty-state-text">${message}</div>
  `;
  emptyState.style.display = 'block';
  document.getElementById('historyTableBody').style.display = 'none';
}

console.log('📊 History.js loaded');