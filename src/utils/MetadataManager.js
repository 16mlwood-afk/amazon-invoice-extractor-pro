// ===== METADATA SIDECAR FILES =====
// Store acquisition metadata alongside PDF files

class MetadataManager {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.extensionVersion = chrome.runtime.getManifest().version;
  }

  // Generate unique session ID for this download session
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }

  // Create metadata for a download
  createMetadata(downloadItem, downloadResult) {
    const now = new Date();

    const metadata = {
      // Download session info
      sessionId: this.sessionId,
      downloadTimestamp: now.toISOString(),
      extensionVersion: this.extensionVersion,

      // Source information (not invoice content)
      sourceURL: downloadItem.url,
      marketplace: downloadItem.marketplace || 'unknown',
      orderId: downloadItem.orderId,
      orderDate: downloadItem.orderDate,

      // File information
      filename: downloadItem.filename,
      filePath: this.getRelativePath(downloadItem.filename),
      downloadId: downloadResult.downloadId,

      // Acquisition details
      acquisitionMethod: 'chrome_downloads_api',
      downloadAttempts: downloadItem.attempts || 1,
      downloadDuration: downloadResult.duration || 0,

      // System information
      userAgent: navigator.userAgent,
      platform: navigator.platform,

      // Processing information
      processedBy: 'Amazon Invoice Extractor',
      processingTimestamp: now.toISOString(),

      // Verification status
      verified: false, // Will be set to true when download completes
      verificationTimestamp: null,

      // Error information (if any)
      error: downloadResult.error || null,
      errorType: downloadResult.error ? this.classifyError(downloadResult.error) : null
    };

    return metadata;
  }

  // Save metadata as JSON file alongside PDF
  async saveMetadata(metadata, pdfFilename) {
    const metadataFilename = `${pdfFilename}.meta.json`;
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: 'application/json'
    });

    try {
      // Use chrome.downloads API to save metadata file
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: URL.createObjectURL(metadataBlob),
          filename: metadataFilename,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        });
      });

      console.log(`📄 Saved metadata: ${metadataFilename} (ID: ${downloadId})`);
      return { success: true, filename: metadataFilename, downloadId: downloadId };

    } catch (error) {
      console.error('❌ Failed to save metadata:', error);
      return { success: false, error: error.message };
    }
  }

  // Update metadata when download completes successfully
  updateMetadataForCompletion(metadata, downloadDelta) {
    metadata.verified = true;
    metadata.verificationTimestamp = new Date().toISOString();

    if (downloadDelta.fileSize) {
      metadata.fileSize = downloadDelta.fileSize;
    }

    if (downloadDelta.mime) {
      metadata.mimeType = downloadDelta.mime;
    }

    return metadata;
  }

  // Get relative path from full filename
  getRelativePath(fullFilename) {
    // Extract just the folder structure, not the full system path
    const parts = fullFilename.split('/');
    if (parts.length > 1) {
      return parts.slice(0, -1).join('/'); // Remove filename, keep folders
    }
    return '';
  }

  // Classify error types for better debugging
  classifyError(error) {
    const errorMessage = error.message || error.toString();

    if (errorMessage.includes('NETWORK_ERROR')) return 'network_error';
    if (errorMessage.includes('SERVER_ERROR')) return 'server_error';
    if (errorMessage.includes('USER_CANCELED')) return 'user_cancelled';
    if (errorMessage.includes('FILE_ACCESS_DENIED')) return 'file_access_denied';
    if (errorMessage.includes('INSUFFICIENT_DISK_SPACE')) return 'insufficient_disk_space';
    if (errorMessage.includes('FILE_TOO_LARGE')) return 'file_too_large';

    return 'unknown_error';
  }

  // Generate summary metadata for a batch of downloads
  createBatchSummary(downloads, sessionStats) {
    const summary = {
      sessionId: this.sessionId,
      extensionVersion: this.extensionVersion,
      generatedAt: new Date().toISOString(),

      // Session statistics
      totalDownloads: downloads.length,
      successfulDownloads: downloads.filter(d => d.success).length,
      failedDownloads: downloads.filter(d => !d.success).length,

      // File information
      files: downloads.map(download => ({
        orderId: download.item.orderId,
        filename: download.item.filename,
        success: download.success,
        error: download.error?.message || null,
        duration: download.duration || 0
      })),

      // System information
      userAgent: navigator.userAgent,
      platform: navigator.platform,

      // Processing summary
      processingMethod: 'batch_download_queue',
      queueConfig: sessionStats.queueConfig || {},
      marketplaces: [...new Set(downloads.map(d => d.item.marketplace))].filter(Boolean)
    };

    return summary;
  }

  // Save batch summary
  async saveBatchSummary(summary, baseFilename = 'download_summary') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const summaryFilename = `${baseFilename}_${timestamp}.summary.json`;

    const summaryBlob = new Blob([JSON.stringify(summary, null, 2)], {
      type: 'application/json'
    });

    try {
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: URL.createObjectURL(summaryBlob),
          filename: summaryFilename,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        });
      });

      console.log(`📊 Saved batch summary: ${summaryFilename}`);
      return { success: true, filename: summaryFilename, downloadId: downloadId };

    } catch (error) {
      console.error('❌ Failed to save batch summary:', error);
      return { success: false, error: error.message };
    }
  }

  // Load and parse existing metadata file (for debugging/analysis)
  async loadMetadata(metadataFilename) {
    try {
      // This is a simplified version - in practice you'd need to read from filesystem
      // For now, we'll return a placeholder
      console.log(`📖 Would load metadata from: ${metadataFilename}`);
      return { success: false, error: 'File reading not implemented in extension context' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Validate metadata structure
  validateMetadata(metadata) {
    const requiredFields = [
      'sessionId',
      'downloadTimestamp',
      'orderId',
      'filename'
    ];

    const missingFields = requiredFields.filter(field => !metadata[field]);

    if (missingFields.length > 0) {
      return {
        valid: false,
        errors: [`Missing required fields: ${missingFields.join(', ')}`]
      };
    }

    return { valid: true };
  }

  // Generate metadata for export/analysis
  generateExportMetadata(downloads) {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      extensionVersion: this.extensionVersion,
      totalRecords: downloads.length,

      downloads: downloads.map((download, index) => ({
        index: index + 1,
        orderId: download.orderId,
        filename: download.filename,
        downloadTimestamp: download.downloadTimestamp,
        verified: download.verified,
        fileSize: download.fileSize || 0,
        marketplace: download.marketplace,
        error: download.error
      })),

      summary: {
        successful: downloads.filter(d => d.verified).length,
        failed: downloads.filter(d => !d.verified).length,
        marketplaces: [...new Set(downloads.map(d => d.marketplace))].filter(Boolean),
        dateRange: this.calculateDateRange(downloads)
      }
    };

    return exportData;
  }

  // Calculate date range from downloads
  calculateDateRange(downloads) {
    const timestamps = downloads
      .map(d => new Date(d.downloadTimestamp))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a - b);

    if (timestamps.length === 0) return null;

    return {
      earliest: timestamps[0].toISOString(),
      latest: timestamps[timestamps.length - 1].toISOString(),
      span: timestamps[timestamps.length - 1] - timestamps[0]
    };
  }
}

// Singleton instance
const metadataManager = new MetadataManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetadataManager;
}
