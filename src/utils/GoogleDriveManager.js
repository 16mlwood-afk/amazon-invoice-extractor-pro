// ===== GOOGLE DRIVE MANAGER =====
// Centralized Google Drive operations for the Amazon Invoice Extractor

class GoogleDriveManager {
  constructor() {
    this.folderCache = new Map();
    this.folderLocks = new Map();
  }

  // ===== FOLDER CACHE AND MUTEX FOR DRIVE OPERATIONS =====

  /**
   * Find or create a single folder in Google Drive with caching and mutex locks
   * @param {string} folderName - Name of the folder to find/create
   * @param {string} parentId - Parent folder ID
   * @param {string} token - OAuth token
   * @returns {Promise<string>} - Folder ID
   */
  async findOrCreateDriveFolder(folderName, parentId, token) {
    const lockKey = `${parentId}/${folderName}`;

    // If another call is already creating this folder, wait for it
    if (this.folderLocks.has(lockKey)) {
      console.log(`⏳ Waiting for folder creation: ${folderName}`);
      return await this.folderLocks.get(lockKey);
    }

    // Create lock
    const lockPromise = (async () => {
      try {
        // Check cache first
        if (this.folderCache.has(lockKey)) {
          console.log(`📦 Using cached folder ID for ${folderName}`);
          return this.folderCache.get(lockKey);
        }

        // Search for existing folder
        console.log(`🔍 Searching for folder: ${folderName} in parent: ${parentId}`);
        const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

        const searchResponse = await fetch(searchUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const searchData = await searchResponse.json();

        if (searchData.files && searchData.files.length > 0) {
          // Folder exists, cache and return it
          const folderId = searchData.files[0].id;
          console.log(`✅ Found existing folder: ${folderName} (${folderId})`);
          this.folderCache.set(lockKey, folderId);
          return folderId;
        }

        // Create new folder
        console.log(`📁 Creating new folder: ${folderName}`);
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
          })
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create folder ${folderName}: ${createResponse.status}`);
        }

        const folderData = await createResponse.json();
        const folderId = folderData.id;
        console.log(`📁 Created folder: ${folderName} (${folderId})`);

        // Cache the new folder ID
        this.folderCache.set(lockKey, folderId);
        return folderId;

      } finally {
        // Release lock
        this.folderLocks.delete(lockKey);
      }
    })();

    this.folderLocks.set(lockKey, lockPromise);
    return await lockPromise;
  }

  /**
   * Find or create a root-level folder in Google Drive with caching and mutex locks
   * @param {string} folderName - Name of the root folder to find/create
   * @param {string} token - OAuth token
   * @returns {Promise<string>} - Folder ID
   */
  async findOrCreateRootFolder(folderName, token) {
    const lockKey = `root/${folderName}`;

    // If another call is already creating this folder, wait for it
    if (this.folderLocks.has(lockKey)) {
      console.log(`⏳ Waiting for root folder creation: ${folderName}`);
      return await this.folderLocks.get(lockKey);
    }

    // Create lock
    const lockPromise = (async () => {
      try {
        // Check cache first
        if (this.folderCache.has(lockKey)) {
          console.log(`📦 Using cached root folder ID for ${folderName}`);
          return this.folderCache.get(lockKey);
        }

        // Search for existing root folder
        console.log(`🔍 Searching for root folder: ${folderName}`);
        const query = `name='${folderName}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;

        const searchResponse = await fetch(searchUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const searchData = await searchResponse.json();

        if (searchData.files && searchData.files.length > 0) {
          // Root folder exists, cache and return it
          const folderId = searchData.files[0].id;
          console.log(`✅ Found existing root folder: ${folderName} (${folderId})`);
          this.folderCache.set(lockKey, folderId);
          return folderId;
        }

        // Create new root folder
        console.log(`📁 Creating new root folder: ${folderName}`);
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
          })
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create root folder ${folderName}: ${createResponse.status}`);
        }

        const folderData = await createResponse.json();
        const folderId = folderData.id;
        console.log(`📁 Created root folder: ${folderName} (${folderId})`);

        // Cache the new folder ID
        this.folderCache.set(lockKey, folderId);
        return folderId;

      } finally {
        // Release lock
        this.folderLocks.delete(lockKey);
      }
    })();

    this.folderLocks.set(lockKey, lockPromise);
    return await lockPromise;
  }

  /**
   * Create a nested folder path recursively (e.g., "folder1/folder2/folder3")
   * @param {string} folderPath - Full path like "Amazon_Invoices/Amazon-DE/Session_001_dateRange"
   * @param {string} token - OAuth token
   * @returns {Promise<string>} - Final folder ID
   */
  async createNestedFolderPath(folderPath, token) {
    console.log(`🏗️ Creating nested folder path: ${folderPath}`);

    // Split path into segments and filter out empty ones
    const pathSegments = folderPath.split('/').filter(segment => segment.trim() !== '');

    if (pathSegments.length === 0) {
      throw new Error('Invalid folder path: empty or root only');
    }

    // Start from root
    let currentParentId = 'root';
    let finalFolderId = null;

    // Create each folder in the path
    for (let i = 0; i < pathSegments.length; i++) {
      const folderName = pathSegments[i];
      const isLastSegment = (i === pathSegments.length - 1);

      console.log(`📁 Creating/ensuring folder: ${folderName} (parent: ${currentParentId})`);

      // Create or find this folder
      const folderId = await this.findOrCreateDriveFolder(folderName, currentParentId, token);

      if (isLastSegment) {
        finalFolderId = folderId;
        console.log(`✅ Final folder created/found: ${folderName} (${folderId})`);
      } else {
        // This becomes the parent for the next folder
        currentParentId = folderId;
      }
    }

    if (!finalFolderId) {
      throw new Error(`Failed to create nested folder path: ${folderPath}`);
    }

    console.log(`✅ Nested folder path created: ${folderPath} -> ${finalFolderId}`);
    return finalFolderId;
  }

  // ===== GOOGLE DRIVE AUTHENTICATION =====

  /**
   * Get Google Drive OAuth token
   */
  async getGoogleDriveToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  }

  // ===== FILE OPERATIONS =====

  /**
   * Create folder in Google Drive
   */
  async createDriveFolder(folderName, token) {
    try {
      if (!folderName || !token) {
        throw new Error('Folder name and token are required');
      }

      const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      };

      console.log(`📁 Creating Google Drive folder: ${folderName}`);

      const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create folder ${folderName}: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.id) {
        throw new Error('Invalid response from Google Drive API: no folder ID returned');
      }

      console.log(`✅ Created folder: ${folderName} (${data.id})`);
      return data.id;
    } catch (error) {
      console.error(`❌ Error creating folder ${folderName}:`, error);
      throw error;
    }
  }

  /**
   * Upload single file to Google Drive from URL
   */
  async uploadFileFromUrl(fileUrl, fileName, folderId, token) {
    try {
      if (!fileUrl || !fileName || !folderId || !token) {
        throw new Error('File URL, filename, folder ID, and token are all required');
      }

      console.log(`☁️ Uploading file to Google Drive: ${fileName}`);

      // Fetch the file from the URL
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from ${fileUrl}: ${response.status} ${response.statusText}`);
      }

      const fileData = await response.blob();
      if (fileData.size === 0) {
        throw new Error(`Downloaded file is empty: ${fileName}`);
      }

      console.log(`📦 File fetched successfully: ${fileName} (${fileData.size} bytes)`);

      const metadata = {
        name: fileName,
        parents: [folderId]
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', fileData);

      const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Google Drive upload failed for ${fileName}: ${uploadResponse.status} - ${errorText}`);
      }

      const result = await uploadResponse.json();
      console.log(`✅ File uploaded successfully: ${fileName} (${result.id})`);

      return result;
    } catch (error) {
      console.error(`❌ Error uploading file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Search for existing file in Google Drive by name and size
   * @param {string} filename - Name of the file to search for
   * @param {number} fileSize - Size of the file in bytes
   * @param {string} folderId - Parent folder ID to search in
   * @param {string} token - OAuth token
   * @returns {Promise<Object|null>} File object if found, null otherwise
   */
  async searchDriveFile(filename, fileSize, folderId, token) {
    try {
      // Search for files with matching name in the specified folder
      const query = `name='${filename}' and '${folderId}' in parents and mimeType='application/pdf' and trashed=false`;
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime,md5Checksum)`;

      const searchResponse = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!searchResponse.ok) {
        throw new Error(`Drive search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();

      if (searchData.files && searchData.files.length > 0) {
        // Check for exact size match
        for (const file of searchData.files) {
          if (parseInt(file.size) === fileSize) {
            console.log(`✅ Found existing Drive file: ${filename} (${file.id})`);
            return file;
          }
        }
      }

      console.log(`❌ No matching Drive file found: ${filename}`);
      return null;
    } catch (error) {
      console.error('❌ Drive file search error:', error);
      return null;
    }
  }

  /**
   * Check if file exists in Google Drive (for duplicate prevention)
   * @param {string} filename - Name of the file to check
   * @param {number} fileSize - Size of the file in bytes
   * @param {string} driveFolderId - Drive folder ID
   * @param {string} token - OAuth token
   * @returns {Promise<boolean>} True if file exists
   */
  async checkDriveFileDuplicate(filename, fileSize, driveFolderId, token) {
    const existingFile = await this.searchDriveFile(filename, fileSize, driveFolderId, token);
    return existingFile !== null;
  }

  /**
   * Create nested folder structure in Google Drive
   * @param {string} folderPath - Path like "Amazon-DE/Session_001/2025-07_July"
   * @param {string} rootFolderId - Parent folder ID
   * @param {string} token - OAuth token
   * @returns {Promise<string>} - Final folder ID
   */
  async createNestedDriveFolders(folderPath, rootFolderId, token) {
    try {
      if (!folderPath || !rootFolderId || !token) {
        throw new Error('Folder path, root folder ID, and token are all required');
      }

      const pathParts = folderPath.split('/').filter(part => part.length > 0);
      if (pathParts.length === 0) {
        throw new Error('Folder path must contain at least one folder name');
      }

      console.log(`📁 Creating nested folder structure: ${folderPath}`);

      let currentParentId = rootFolderId;
      let currentPath = '';

      for (let i = 0; i < pathParts.length; i++) {
        const folderName = pathParts[i];
        currentPath += (currentPath ? '/' : '') + folderName;

        try {
          // Use the thread-safe folder creation function
          const newFolderId = await this.findOrCreateDriveFolder(folderName, currentParentId, token);
          if (!newFolderId) {
            throw new Error(`Failed to create/find folder: ${folderName}`);
          }

          currentParentId = newFolderId;
          console.log(`📁 Created/found folder ${i + 1}/${pathParts.length}: ${currentPath}`);
        } catch (folderError) {
          console.error(`❌ Failed to create folder ${folderName} in path ${currentPath}:`, folderError);
          throw new Error(`Folder creation failed at '${currentPath}': ${folderError.message}`);
        }
      }

      console.log(`✅ Nested folder structure created successfully: ${folderPath}`);
      return currentParentId;
    } catch (error) {
      console.error('❌ Error creating nested folder structure:', error);
      throw error;
    }
  }

  /**
   * Upload blob directly to Google Drive
   */
  async uploadBlobToDrive(blob, filename, folderId, token) {
    try {
      if (!blob || !filename || !folderId || !token) {
        throw new Error('Blob, filename, folder ID, and token are all required');
      }

      if (blob.size === 0) {
        throw new Error(`Cannot upload empty blob: ${filename}`);
      }

      console.log(`☁️ Uploading blob to Google Drive: ${filename} (${blob.size} bytes)`);

      const metadata = {
        name: filename,
        parents: [folderId]
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', blob);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Drive upload failed for ${filename}: ${response.status} - ${error}`);
      }

      const result = await response.json();
      console.log(`✅ Blob uploaded successfully: ${filename} (${result.id})`);

      return result;
    } catch (error) {
      console.error(`❌ Error uploading blob ${filename}:`, error);
      throw error;
    }
  }

  // ===== SESSION UPLOAD =====

  /**
   * Upload session folder to Google Drive
   * @param {string} sessionPath - Local path like "Amazon-DE/Session_001_Q1_Aug_Oct"
   * @param {Object} metadata - Session metadata (invoice count, totals, etc.)
   */
  async uploadSessionToGoogleDrive(sessionPath, metadata) {
    console.log('☁️ Starting Google Drive session upload:', sessionPath);

    try {
      // Validate inputs
      if (!sessionPath || typeof sessionPath !== 'string') {
        throw new Error('Valid session path is required');
      }

      if (!metadata || typeof metadata !== 'object') {
        throw new Error('Valid metadata object is required');
      }

      // Get OAuth token for Google Drive
      console.log('🔐 Getting Google Drive authentication token...');
      const token = await this.getGoogleDriveToken();
      if (!token) {
        throw new Error('Failed to obtain Google Drive authentication token');
      }

      // Create folder structure in Drive: Amazon_Invoices_Pending -> session folder
      console.log('📁 Creating folder structure in Google Drive...');
      const rootFolderId = await this.findOrCreateRootFolder('Amazon_Invoices_Pending', token);
      if (!rootFolderId) {
        throw new Error('Failed to create or find root folder in Google Drive');
      }

      const sessionFolderId = await this.findOrCreateDriveFolder(sessionPath, rootFolderId, token);
      if (!sessionFolderId) {
        throw new Error('Failed to create or find session folder in Google Drive');
      }

      // Get downloaded items from metadata
      const downloadedItems = metadata.downloadedItems || [];
      console.log(`📤 Starting upload of ${downloadedItems.length} files to Drive...`);

      if (downloadedItems.length === 0) {
        console.warn('⚠️ No downloaded items found in metadata, uploading only summary CSV');
      }

      // Upload each file from the downloaded items
      let uploadedCount = 0;
      let failedCount = 0;
      const uploadErrors = [];

      for (let i = 0; i < downloadedItems.length; i++) {
        const item = downloadedItems[i];

        if (!item.filename || !item.downloadUrl) {
          console.warn(`⚠️ Skipping item ${i + 1}: missing filename or downloadUrl`, item);
          failedCount++;
          continue;
        }

        try {
          await this.uploadFileFromUrl(item.downloadUrl, item.filename, sessionFolderId, token);
          uploadedCount++;
          console.log(`✅ Uploaded ${uploadedCount}/${downloadedItems.length}: ${item.filename}`);
        } catch (fileError) {
          console.warn(`⚠️ Failed to upload ${item.filename}:`, fileError);
          failedCount++;
          uploadErrors.push({
            filename: item.filename,
            error: fileError.message
          });
        }
      }

      // Always try to upload summary CSV, even if some files failed
      console.log('📊 Uploading session summary CSV...');
      await this.uploadSessionSummaryCSV(metadata, sessionFolderId, token);

      console.log(`✅ Session upload completed: ${uploadedCount} successful, ${failedCount} failed`);

      // Show success notification with appropriate message
      const nextEmailDate = this.getNextFilingEmailDate();
      const title = failedCount > 0 ? '⚠️ Partially Uploaded to Google Drive' : '✅ Uploaded to Google Drive';
      const message = failedCount > 0
        ? `${uploadedCount} invoices uploaded, ${failedCount} failed. Email on ${nextEmailDate}`
        : `${uploadedCount} invoices uploaded. Email will arrive on ${nextEmailDate}`;

      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: title,
          message: message
        });
      } catch (notificationError) {
        console.warn('⚠️ Failed to show upload notification:', notificationError);
      }

      return {
        success: true,
        folderId: sessionFolderId,
        uploadedCount,
        failedCount,
        totalFiles: downloadedItems.length,
        errors: uploadErrors
      };

    } catch (error) {
      console.error('❌ Google Drive upload failed:', error);

      // Show error notification
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '❌ Google Drive Upload Failed',
          message: error.message || 'An unexpected error occurred during upload'
        });
      } catch (notificationError) {
        console.warn('⚠️ Failed to show error notification:', notificationError);
      }

      throw error;
    }
  }

  /**
   * Upload session summary CSV to Drive
   */
  async uploadSessionSummaryCSV(metadata, folderId, token) {
    try {
      if (!metadata || !folderId || !token) {
        throw new Error('Metadata, folder ID, and token are required for CSV upload');
      }

      console.log('📊 Generating and uploading session summary CSV');

      const csvContent = this.generateSessionSummaryCSV(metadata);
      if (!csvContent || csvContent.trim().length === 0) {
        throw new Error('Generated CSV content is empty');
      }

      const blob = new Blob([csvContent], { type: 'text/csv' });

      const fileMetadata = {
        name: '_SESSION_SUMMARY.csv',
        parents: [folderId]
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
      formData.append('file', blob);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload session summary CSV: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Session summary CSV uploaded: ${result.id}`);

      return result;
    } catch (error) {
      console.error('❌ Error uploading session summary CSV:', error);
      throw error;
    }
  }

  /**
   * Generate CSV summary
   */
  generateSessionSummaryCSV(metadata) {
    let csv = 'Order_ID,Invoice_Number,Date,Marketplace,Filename,Download_Time\n';

    for (const item of metadata.downloadedItems) {
      csv += `${item.orderId},${item.invoiceNumber},${item.date},${metadata.marketplace},${item.filename},${item.downloadTime}\n`;
    }

    return csv;
  }

  /**
   * Calculate next filing email date based on current date
   */
  getNextFilingEmailDate() {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    // Determine current accounting quarter (Aug-Jul)
    // Q1: Aug-Oct, Q2: Nov-Jan, Q3: Feb-Apr, Q4: May-Jul

    let nextFilingDate;
    let nextFilingYear = currentYear;

    if (currentMonth >= 7 && currentMonth <= 9) { // Aug-Oct (Q1) - next filing is Feb 1st
      nextFilingDate = 'February 1st';
    } else if (currentMonth >= 10 || currentMonth <= 0) { // Nov-Jan (Q2) - next filing is May 1st
      nextFilingDate = 'May 1st';
    } else if (currentMonth >= 1 && currentMonth <= 3) { // Feb-Apr (Q3) - next filing is Aug 1st
      nextFilingDate = 'August 1st';
    } else if (currentMonth >= 4 && currentMonth <= 6) { // May-Jul (Q4) - next filing is Nov 1st
      nextFilingDate = 'November 1st';
      nextFilingYear = currentYear + 1; // Next year for Q4
    }

    return nextFilingYear > currentYear ? `${nextFilingDate}, ${nextFilingYear}` : nextFilingDate;
  }
}

// Class exported for instantiation in background script

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoogleDriveManager;
}