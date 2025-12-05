// ===== ORDER-SCRAPER.JS =====
// Order scraping and preparation logic

(function() {
  // ===== PREVENT MULTIPLE INJECTIONS =====
  if (window.__amazonInvoiceExtensionLoaded) {
    // Silently exit if already loaded
    return;
  }

// Extract scraping logic into separate function
async function scrapeOrdersFromCurrentPage(startDate, endDate) {
  const orderSelectors = [
    '.order-card',
    '.order',
    '[data-order-id]',
    '.a-box-group.order'
  ];

  let orders = [];
  for (const selector of orderSelectors) {
    orders = document.querySelectorAll(selector);
    if (orders.length > 0) {
      console.log(`  ✅ Found ${orders.length} orders with: ${selector}`);
      break;
    }
  }

  if (orders.length === 0) {
    return [];
  }

  // Filter orders by date range
  const filteredOrders = [];

  for (const order of orders) {
    const orderDate = extractOrderDate(order);
    if (orderDate) {
      const normalizedOrderDate = normalizeDate(new Date(orderDate));
      const normalizedStartDate = normalizeDate(new Date(startDate));
      const normalizedEndDate = normalizeDate(new Date(endDate));

      if (normalizedOrderDate >= normalizedStartDate && normalizedOrderDate <= normalizedEndDate) {
        filteredOrders.push(order);
      }
    }
  }

  return filteredOrders;
}

// Load pagination settings from storage
async function loadPaginationSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('paginationDelay', (data) => {
      const defaults = {
        paginationDelay: 1.5, // seconds
        enabled: true
      };

      resolve({
        paginationDelay: data.paginationDelay || defaults.paginationDelay,
        enabled: defaults.enabled
      });
    });
  });
}

// Resume pagination after page reload
async function resumePagination(savedState) {
  console.log('🔄 Resuming pagination after page reload...');

  try {
    // Use existing paginationManager if available, otherwise create one
    let paginationManager;
    if (typeof getPaginationManager === 'function') {
      // Use the module-scoped instance from content-main.js
      paginationManager = await getPaginationManager();
      console.log('✅ Using shared paginationManager instance');
    } else {
      // Fallback: create new instance
      console.log('⚠️ getPaginationManager not available, creating new instance');
      paginationManager = new PaginationManager({
        delayBetweenPages: 1500, // Will be overridden if needed
        showProgress: true
      });
    }

    // Show initial loading state while we analyze the page
    paginationManager.updateHeader('🔄', 'Resuming Collection');
    paginationManager.showStatusMessage('Analyzing current page...', '🔍');
    paginationManager.showLoadingState('Checking page content...');

    // Wait a moment for page to fully load
    await sleep(1000);

    const paginationInfo = paginationManager.getPaginationInfo();

    // Update pagination manager state
    paginationManager.state.currentPage = paginationInfo.currentPage;
    paginationManager.state.totalPages = savedState.totalPages;
    paginationManager.state.startDate = savedState.startDate;
    paginationManager.state.endDate = savedState.endDate;
    paginationManager.state.accountType = savedState.accountType;

    console.log(`📄 Resumed on page ${paginationInfo.currentPage} of ${savedState.totalPages}`);

    // 🔍 DIAGNOSTIC: Log page state after resume
    console.log('🔍 AFTER RESUME:');
    console.log('  Current URL:', window.location.href);
    console.log('  Current page params:', new URLSearchParams(window.location.search).toString());
    const currentStartIndex = new URLSearchParams(window.location.search).get('startIndex');
    console.log('  Current startIndex:', currentStartIndex);
    console.log('  Saved state currentPage:', savedState.currentPage);

    // Update UI to show we're back on track
    paginationManager.hideLoadingState();
    paginationManager.showStatusMessage(`Processing page ${paginationInfo.currentPage} of ${savedState.totalPages}`, '📄');

    // Restore previously collected order IDs
    paginationManager.state.collectedOrderIds = savedState.collectedOrderIds || [];
    console.log(`📊 Restored ${paginationManager.state.collectedOrderIds.length} previously collected order IDs`);

    // CRITICAL: Restore download items from previous pages
    // Ensure we get a proper array reference, not a corrupted object
    if (Array.isArray(savedState.downloadItems)) {
      paginationManager.state.downloadItems = savedState.downloadItems;
      console.log(`📦 Restored ${paginationManager.state.downloadItems.length} download items from previous pages`);
    } else {
      console.error('🔴 CRITICAL: savedState.downloadItems is not an array!', typeof savedState.downloadItems, savedState.downloadItems);
      paginationManager.state.downloadItems = [];
      console.log('📦 Initialized empty downloadItems array due to corruption');
    }

    // Add debug ID for tracking
    paginationManager.state.downloadItems.__debug_id__ = Math.random();
    console.log(`🔗 DOWNLOADITEMS DEBUG: Array reference after restore:`, paginationManager.state.downloadItems);
    console.log(`🔗 DOWNLOADITEMS DEBUG: Array object ID:`, paginationManager.state.downloadItems.__debug_id__);

    console.log(`🔍 RESUME SUMMARY:`);
    console.log(`  - Collected Order IDs: ${paginationManager.state.collectedOrderIds.length}`);
    console.log(`  - Download Items: ${paginationManager.state.downloadItems.length}`);
    console.log(`  - Current Page: ${paginationInfo.currentPage}/${savedState.totalPages}`);

    // Check if we have more pages to process
    if (paginationInfo.currentPage >= savedState.totalPages) {
      console.log('📄 Pagination complete - all pages processed');

      // Scrape final page orders and add them to the existing download items
      const finalPageOrders = await scrapeOrdersFromCurrentPage(
        savedState.startDate,
        savedState.endDate
      );

      console.log(`📄 Final page (${paginationInfo.currentPage}) scraped ${finalPageOrders.length} orders in date range`);

      // Add final page orders to download items
      for (let i = 0; i < finalPageOrders.length; i++) {
        const orderInfo = await prepareOrderForDownload(
          finalPageOrders[i],
          paginationManager.state.downloadItems?.length || 0 + i,
          finalPageOrders.length,  // Total for this page (better than 0!)
          savedState.startDate,
          savedState.endDate
        );
        if (orderInfo) {
          paginationManager.state.downloadItems.push(orderInfo);
        }
      }

      console.log(`📊 Final download items count: ${paginationManager.state.downloadItems?.length || 0}`);

      // CRITICAL FIX: Save completion state and reload page instead of returning
      console.log('💾 Saving pagination completion state...');

      // Mark pagination as complete
      paginationManager.state.isRunning = false;
      paginationManager.state.isComplete = true;
      paginationManager.state.completedAt = Date.now();

      // Notify popup that collection is complete
      chrome.runtime.sendMessage({
        action: 'collectionComplete',
        data: {
          collectedItems: paginationManager.state.downloadItems?.length || 0,
          status: 'Collection complete - ready for download'
        }
      }).catch(() => {}); // Ignore if popup closed

      // Save the final state with download items
      await paginationManager.saveState();

      console.log(`✅ Pagination state saved with ${paginationManager.state.downloadItems?.length || 0} download items`);

      // Force page reload to trigger download initialization
      console.log('🔄 Reloading page to trigger download initialization...');
      window.location.reload();
    }

    // Continue pagination from current page
    console.log(`📄 Continuing pagination from page ${paginationInfo.currentPage + 1}`);

    // Wait a moment for page to fully load
    await sleep(2000);

    // Continue with the pagination loop and return collected orders
    return await continuePaginationLoop(paginationManager, savedState);

  } catch (error) {
    console.error('❌ Error resuming pagination:', error);
    await PaginationManager.clearState();
  }
}

// Continue the pagination loop after resuming
async function continuePaginationLoop(paginationManager, savedState) {
  // FIXED: Extract download info immediately instead of storing DOM elements
  // This prevents loss of orders across page reloads

  // Set pagination as active
  paginationManager.state.isRunning = true;
  paginationManager.state.isComplete = false;
  await paginationManager.saveState();

  console.log(`🔗 DOWNLOADITEMS DEBUG: Entering continuePaginationLoop`);
  console.log(`🔗 DOWNLOADITEMS DEBUG: paginationManager.state.downloadItems:`, paginationManager.state.downloadItems);
  console.log(`🔗 DOWNLOADITEMS DEBUG: Array object ID:`, paginationManager.state.downloadItems?.__debug_id__ || 'UNDEFINED');
  console.log(`🔗 DOWNLOADITEMS DEBUG: Array length:`, paginationManager.state.downloadItems?.length || 0);

  let currentPage = paginationManager.state.currentPage;
  const paginationStartTime = Date.now();

  // Show progress overlay
  paginationManager.showProgressOverlay(currentPage, savedState.totalPages, 0, "Resuming...");

  // Initialize pagination progress notification
  if (typeof notificationManager !== 'undefined') {
    notificationManager.showProgress(
      'Processing Pages',
      `Starting from page ${currentPage} of ${savedState.totalPages}...`,
      Math.round((currentPage / savedState.totalPages) * 100)
    );
  }

  while (currentPage < savedState.totalPages && !paginationManager.state.cancelled) {
    console.log(`\n📄 === Processing Page ${currentPage}/${savedState.totalPages} ===`);

    // UPDATE UI: Show what we're doing
    notifyInfo(`Processing page ${currentPage} of ${savedState.totalPages}...`);

    // Show pagination progress notification
    if (typeof notificationManager !== 'undefined') {
      const orderCount = paginationManager.state.downloadItems?.length || 0;
      notificationManager.showProgress(
        'Processing Pages',
        `Page ${currentPage} of ${savedState.totalPages} (${orderCount} orders collected)...`,
        Math.round((currentPage / savedState.totalPages) * 100)
      );
    }

    // Update progress overlay
    const downloadItemsCount = paginationManager.state.downloadItems?.length || 0;
    console.log(`📊 DEBUG: downloadItems array:`, paginationManager.state.downloadItems);
    console.log(`📊 DEBUG: downloadItems length: ${downloadItemsCount}`);

    const avgTimePerPage = downloadItemsCount > 0 ? (Date.now() - paginationStartTime) / currentPage : 2000;
    const remainingPages = savedState.totalPages - currentPage;
    const estimatedTimeRemaining = Math.ceil((remainingPages * avgTimePerPage) / 1000);
    const timeString = estimatedTimeRemaining > 60
      ? `~${Math.ceil(estimatedTimeRemaining / 60)}m remaining`
      : `~${estimatedTimeRemaining}s remaining`;

    console.log(`📊 Calling showProgressOverlay: page ${currentPage}/${savedState.totalPages}, items: ${downloadItemsCount}, time: ${timeString}`);
    paginationManager.showProgressOverlay(currentPage, savedState.totalPages, downloadItemsCount, timeString);

    // Send collection progress update to popup
    chrome.runtime.sendMessage({
      action: 'updateProgress',  // Changed from 'type' to 'action'
      progress: (currentPage / savedState.totalPages) * 100,
      current: downloadItemsCount,
      currentPage: currentPage,
      totalPages: savedState.totalPages,
      status: `Collecting page ${currentPage}/${savedState.totalPages}... Found ${downloadItemsCount} invoice(s)`
    }).catch(() => {}); // Ignore if popup is closed

    // ===== SMART DATE-BASED PAGINATION CONTROL =====
    // First, get ALL orders on this page (before filtering by date)
    const orderSelectors = [
      '.order-card',
      '.order',
      '[data-order-id]',
      '.a-box-group.order'
    ];

    let allOrdersOnPage = [];
    for (const selector of orderSelectors) {
      allOrdersOnPage = document.querySelectorAll(selector);
      if (allOrdersOnPage.length > 0) {
        console.log(`  📊 Found ${allOrdersOnPage.length} total orders on page with selector: ${selector}`);

        // UPDATE UI: Show orders found
        notifyInfo(`Found ${allOrdersOnPage.length} orders on page ${currentPage}`);
        break;
      }
    }

    // Extract dates from ALL orders on this page with safety checks
    const orderDates = [];
    for (const order of allOrdersOnPage) {
      const dateStr = extractOrderDate(order);
      if (dateStr) {
        // Parse the date string back to a Date object for comparison
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          orderDates.push(parsedDate);
        }
      }
    }

    // Analyze date range of orders on this page
    if (orderDates.length === 0) {
      console.log('⚠️ No valid order dates found on this page - continuing to next page');
      // If no valid dates found, continue to next page (might be an error, but don't stop)
    } else {
      const newestOrderDate = new Date(Math.max(...orderDates));
      const oldestOrderDate = new Date(Math.min(...orderDates));

      console.log(`📅 Page date range: ${oldestOrderDate.toISOString().split('T')[0]} to ${newestOrderDate.toISOString().split('T')[0]}`);

      // Early exit: If all orders are older than start date, we've passed the date range - STOP!
      const normalizedNewestOrderDate = normalizeDate(newestOrderDate);
      const normalizedSearchStart = normalizeDate(new Date(savedState.startDate));

      if (normalizedNewestOrderDate < normalizedSearchStart) {
        console.log('✅ All orders before start date - stopping pagination early');
        break; // EXIT LOOP - no need to continue to older pages
      }

      // If all orders are newer than end date, continue to next page (older orders)
      const normalizedOldestOrderDate = normalizeDate(oldestOrderDate);
      const normalizedSearchEnd = normalizeDate(new Date(savedState.endDate));

      if (normalizedOldestOrderDate > normalizedSearchEnd) {
        // Continue pagination to find orders within date range
        // Amazon doesn't guarantee chronological sorting within year filters
        console.log('ℹ️ All orders after end date - continuing to find orders within date range');

        // Continue to next page without collecting these orders
        currentPage++;
        if (currentPage <= savedState.totalPages) {
          const hasMorePages = await paginationManager.navigateToNextPage();
          if (!hasMorePages) {
            console.log('📄 No more pages available');
            break;
          }
        } else {
          console.log('📄 Reached total pages limit');
          break;
        }
        continue; // Skip to next iteration
      }
    }

    // Scrape orders that are actually in our date range
    const pageOrders = await scrapeOrdersFromCurrentPage(savedState.startDate, savedState.endDate);

    if (pageOrders.length > 0) {
      console.log(`🔗 DOWNLOADITEMS DEBUG: Before processing page orders`);
      console.log(`🔗 DOWNLOADITEMS DEBUG: Array length:`, paginationManager.state.downloadItems?.length || 0);
      console.log(`🔗 DOWNLOADITEMS DEBUG: Array reference:`, paginationManager.state.downloadItems);
      console.log(`🔗 DOWNLOADITEMS DEBUG: Array object ID:`, paginationManager.state.downloadItems?.__debug_id__ || 'UNDEFINED');

      // CRITICAL: Extract download info NOW before page navigation
      for (let i = 0; i < pageOrders.length; i++) {
        const orderInfo = await prepareOrderForDownload(
          pageOrders[i],
          paginationManager.state.downloadItems?.length || 0 + i,
          pageOrders.length,  // Total for this page (better than 0!)
          savedState.startDate,
          savedState.endDate
        );

        if (orderInfo) {
          // Check for duplicates before adding
          const isDuplicate = paginationManager.state.downloadItems.some(
            item => item.orderId === orderInfo.orderId
          );

          if (!isDuplicate) {
            console.log(`🔗 DOWNLOADITEMS DEBUG: Adding item ${i+1}/${pageOrders.length}: ${orderInfo.orderId}`);
            console.log(`🔗 DOWNLOADITEMS DEBUG: Before push - Array length:`, paginationManager.state.downloadItems?.length || 0);

            // Store the extracted info (not DOM elements)
            // Safety check: This should NEVER trigger with proper initialization
            if (!Array.isArray(paginationManager.state.downloadItems)) {
              console.error('🔴 CRITICAL: downloadItems is not an array!', typeof paginationManager.state.downloadItems);
              throw new Error('downloadItems array was not initialized properly');
            }
            paginationManager.state.downloadItems.push(orderInfo);

            console.log(`🔗 DOWNLOADITEMS DEBUG: After push - Array length:`, paginationManager.state.downloadItems?.length || 0);

            // Send progress update to popup
            chrome.runtime.sendMessage({
              action: 'updateProgress',  // Changed from 'type' to 'action'
              progress: (paginationManager.state.currentPage / paginationManager.state.totalPages) * 100,
              current: paginationManager.state.downloadItems.length,
              currentPage: paginationManager.state.currentPage,
              totalPages: paginationManager.state.totalPages,
              status: `Collecting page ${paginationManager.state.currentPage}/${paginationManager.state.totalPages}... Found ${paginationManager.state.downloadItems.length} invoice(s)`
            }).catch(() => {}); // Ignore if popup is closed
          } else {
            console.log(`⏭️ Skipping duplicate item in array: ${orderInfo.orderId}`);
          }
        }
      }

      // Still collect IDs for tracking
      const pageOrderIds = pageOrders.map(order => {
        const orderNum = order.textContent.match(/\d{3}-\d{7}-\d{7}/)?.[0];
        return orderNum;
      }).filter(id => id);

      console.log(`🔍 PAGE ANALYSIS: Found ${pageOrderIds.length} order IDs on this page:`, pageOrderIds.slice(0, 5), pageOrderIds.length > 5 ? `...and ${pageOrderIds.length - 5} more` : '');
      console.log(`🔍 Already collected IDs (${paginationManager.state.collectedOrderIds.length}):`, paginationManager.state.collectedOrderIds.slice(0, 5), paginationManager.state.collectedOrderIds.length > 5 ? `...and ${paginationManager.state.collectedOrderIds.length - 5} more` : '');

      const newOrderIds = pageOrderIds.filter(id => {
        const isNew = !paginationManager.state.collectedOrderIds.includes(id);
        if (!isNew) {
          console.log(`⚠️  DUPLICATE DETECTED: Order ${id} already collected, skipping`);
        }
        return isNew;
      });

      paginationManager.state.collectedOrderIds.push(...newOrderIds);

      console.log(`  ✅ Extracted ${paginationManager.state.downloadItems.length} download items so far`);
      console.log(`📊 Added ${newOrderIds.length} new order IDs from this page (total collected: ${paginationManager.state.collectedOrderIds.length})`);
      console.log(`📊 Duplicates skipped: ${pageOrderIds.length - newOrderIds.length}`);

      // UPDATE UI: Show progress
      notifyInfo(`Collected ${paginationManager.state.downloadItems.length} invoices so far...`);
    } else {
      console.log(`  ℹ️ No orders found in date range on this page`);
    }

    // Try to go to next page
    currentPage++;
    if (currentPage <= savedState.totalPages) {
      const hasMorePages = await paginationManager.navigateToNextPage();

      if (!hasMorePages) {
        console.log('📄 No more pages available');
        break;
      }
    } else {
      break;
    }
  }

  // Hide progress overlay
  paginationManager.hideProgressOverlay();

  // Check if cancelled
  if (paginationManager.state.cancelled) {
    console.log('🛑 Download cancelled by user');
    notifyInfo('Download cancelled');
    await PaginationManager.clearState();
    return;
  }

  console.log(`\n📊 === Pagination Complete ===`);
  console.log(`  Total pages processed: ${currentPage - 1}`);
  console.log(`  Total download items prepared: ${paginationManager.state.downloadItems?.length || 0}`);
  console.log(`🔗 DOWNLOADITEMS DEBUG: Final array reference:`, paginationManager.state.downloadItems);
  console.log(`🔗 DOWNLOADITEMS DEBUG: Final array object ID:`, paginationManager.state.downloadItems?.__debug_id__ || 'UNDEFINED');

  // CRITICAL FIX: Save completion state and reload page instead of returning
  // This prevents context destruction issues where the calling function is lost during pagination
  console.log('💾 Saving pagination completion state...');

  // Mark pagination as complete
  paginationManager.state.isRunning = false;
  paginationManager.state.isComplete = true;
  paginationManager.state.completedAt = Date.now();

  // DEBUG: Log state before save
  console.log('🔍 DEBUG: State before save:', {
    isComplete: paginationManager.state.isComplete,
    isRunning: paginationManager.state.isRunning,
    itemCount: paginationManager.state.downloadItems?.length,
    currentPage: paginationManager.state.currentPage
  });

  // Save the final state with download items
  await paginationManager.saveState();

  console.log(`✅ Pagination state saved with ${paginationManager.state.downloadItems?.length || 0} download items`);

  // Force page reload to trigger download initialization
  // This ensures downloads start in a fresh JavaScript context
  console.log('🔄 Reloading page to trigger download initialization...');
  window.location.reload();

  // This return will never be reached due to reload, but included for clarity
  return paginationManager.state.downloadItems || [];
}

// Start download process with pre-collected orders (skip pagination)
async function startDownloadWithOrders(allOrders, startDate, endDate, accountType, previouslyCollectedOrderIds = []) {
  console.log(`📊 Starting download of ${allOrders.length} invoices within date range...`);
  if (previouslyCollectedOrderIds.length > 0) {
    console.log(`📊 Combining with ${previouslyCollectedOrderIds.length} previously collected order IDs from earlier pages`);
  }
  const startTime = Date.now();

  if (allOrders.length === 0) {
    console.log('  ❌ No orders found in date range');
    notifyError(`No orders found between ${startDate} and ${endDate}`);
    return;
  }

  try {
    const marketplace = detectMarketplace();
    console.log('  Marketplace:', marketplace);

    // Get adaptive settings
    const adaptiveSettings = bandwidthManager.getAdaptiveSettings({
      maxConcurrent: 3,
      delayBetween: 1500,
      throttleRate: 8
    });

    console.log(`📊 Using adaptive settings: ${adaptiveSettings.profile} profile (${adaptiveSettings.maxConcurrent} concurrent, ${adaptiveSettings.delayBetween}ms delay)`);

    // Create download queue
    const downloadQueue = new DownloadQueue({
      maxConcurrent: adaptiveSettings.maxConcurrent,
      delayBetween: adaptiveSettings.delayBetween,
      throttleRate: adaptiveSettings.throttleRate,
      pauseOnError: false,
      retryFailed: true,
      maxRetries: 2,
      retryDelay: 3000
    });

    // Set up queue event handlers
    downloadQueue.onProgress = (stats) => {
      const current = stats.completed + stats.failed;
      notifyDownloadProgress(current, stats.total, `Downloaded ${stats.completed}/${stats.total} invoices...`);

      if (typeof notificationManager !== 'undefined') {
        notificationManager.showProgress(
          'Downloading Invoices',
          `Downloaded ${stats.completed}/${stats.total} invoices...`,
          Math.round((current / stats.total) * 100)
        );
      }
    };

    downloadQueue.onItemComplete = (item, status, result) => {
      if (status === 'success') {
        console.log(`✅ Downloaded: ${item.filename}`);
      } else {
        console.error(`❌ Failed: ${item.filename}`, result);
      }
    };

    downloadQueue.onComplete = (completed, failed) => {
      const duration = Date.now() - startTime;
      const durationSec = (duration / 1000).toFixed(1);

      console.log(`✅ DOWNLOAD COMPLETE: ${completed.length} successful, ${failed.length} failed`);
      console.log(`  ⏱️  Total time: ${durationSec}s`);

      // Build summary message
      let summaryMessage = '';
      if (completed.length > 0 && failed.length === 0) {
        summaryMessage = `✅ Successfully downloaded ${completed.length} invoice${completed.length > 1 ? 's' : ''} in ${durationSec}s`;
      } else if (completed.length > 0 && failed.length > 0) {
        summaryMessage = `⚠️ Downloaded ${completed.length} invoice${completed.length > 1 ? 's' : ''}, ${failed} failed`;
      } else if (completed.length === 0 && failed.length > 0) {
        summaryMessage = `❌ All ${failed.length} downloads failed. Check your internet connection.`;
      } else {
        summaryMessage = '❓ No downloads completed';
      }

      console.log('  📊 ' + summaryMessage);

      // Record session in history
      const sessionDuration = Date.now() - startTime;
      const sessionData = {
        marketplace: detectMarketplace(),
        successful: completed.length,
        failed: failed.length,
        skipped: 0,
        duration: sessionDuration,
        sessionType: 'multi_page_download',
        downloads: completed.map(c => ({
          orderId: c.item.orderId,
          filename: c.item.filename,
          success: true
        })),
        errors: failed.map(f => ({
          orderId: f.item.orderId,
          error: f.error?.message || 'Unknown error'
        }))
      };

      chrome.runtime.sendMessage({
        action: 'recordSession',
        sessionData: sessionData
      });

      if (failed.length > 0) {
        notifyDownloadFailed(failed.length, failed.map(f => ({
          orderId: f.item.orderId,
          filename: f.item.filename,
          error: f.error?.message || 'Unknown error'
        })));
        notifyDownloadStatus(`${completed.length} downloaded, ${failed.length} failed`);
      } else {
        notifyDownloadStatus(`All ${completed.length} invoices downloaded successfully!`);
      }

      // Export session summary
      const sessionSummaryData = {
        sessionId: `session_${Date.now()}`,
        marketplace: detectMarketplace(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        successful: completed.length,
        failed: failed.length,
        total: completed.length + failed.length,
        downloads: completed.map(c => ({
          orderId: c.item.orderId,
          filename: c.item.filename,
          path: generateOrganizedFilename(c.item.orderId, null, c.item.index),
          downloaded: new Date().toISOString(),
          success: true,
          marketplace: detectMarketplace()
        })),
        errors: failed.map(f => ({
          orderId: f.item.orderId,
          error: f.error?.message || 'Unknown error',
          timestamp: new Date().toISOString()
        }))
      };

      chrome.runtime.sendMessage({
        action: 'exportSessionSummary',
        sessionData: sessionSummaryData
      });

      // Show completion notification
      if (typeof notificationManager !== 'undefined') {
        const title = failed.length === 0 ? 'Download Complete!' : 'Download Finished';
        const message = failed.length === 0
          ? `Successfully downloaded ${completed.length} invoices`
          : `Downloaded ${completed.length} invoices, ${failed.length} failed`;
        notificationManager.showCompletion(title, message);
      }

      notifyComplete(completed.length);
    };

    // Prepare download items
    const downloadItems = [];
    for (let i = 0; i < allOrders.length; i++) {
      const order = allOrders[i];
      const orderInfo = await prepareOrderForDownload(order, i, allOrders.length, startDate, endDate);
      if (orderInfo) {
        downloadItems.push(orderInfo);
      }
    }

    console.log(`📋 Prepared ${downloadItems.length} items for download queue`);

    // Check if everything was already downloaded
    if (downloadItems.length === 0) {
      const alreadyDownloadedCount = allOrders.length - downloadItems.length;

      let message = '';
      if (alreadyDownloadedCount === allOrders.length) {
        message = `All ${allOrders.length} invoices have already been downloaded.\n` +
                 `To re-download, clear your download history in Settings.`;
      } else {
        message = `No new invoices to download.\n` +
                 `${alreadyDownloadedCount} invoices were already downloaded.`;
      }

      console.log('  ℹ️  ' + message.replace(/\n/g, '\n      '));
      notifyInfo(message);
      return;
    }

    // Show what we're about to download
    console.log(`  📥 Will download ${downloadItems.length} new invoices`);
    if (allOrders.length - downloadItems.length > 0) {
      console.log(`  ⏭️  Skipping ${allOrders.length - downloadItems.length} already downloaded`);
    }

    // Add items to queue and start
    downloadQueue.add(downloadItems);
    await downloadQueue.start();

  } catch (error) {
    console.error('❌ Download error:', error);
    notifyError(error.message);
  }
}

async function prepareOrderForDownload(order, index, total, searchStartDate, searchEndDate) {
  // More descriptive logging during different phases
  const progressDisplay = total > 0
    ? `${index + 1}/${total}`
    : `${index + 1} (total pending)`;
  console.log(`  Preparing order ${progressDisplay}...`);

  try {
    // Extract order ID first (needed for URL construction)
    const orderNum = order.textContent.match(/\d{3}-\d{7}-\d{7}/)?.[0];
    if (!orderNum) {
      console.log(`    ⚠️  Could not extract order ID, using index: order_${index}`);
      return null;
    }

    console.log(`    📋 Order ID: ${orderNum}`);

    // Try to find invoice link (may be popover or direct link)
    const invoiceLink = order.querySelector('a[href*="invoice"], a[href*="facture"], a[href*="rechnung"]');

    let pdfUrl = null;

    if (invoiceLink) {
      const invoicePageUrl = invoiceLink.href;
      console.log(`    📄 Found invoice link: ${invoicePageUrl}`);

      // Check if it's already a direct PDF URL
      if (invoicePageUrl.includes('/documents/download/') && invoicePageUrl.endsWith('/invoice.pdf')) {
        console.log(`    ✅ Direct PDF URL found: ${invoicePageUrl}`);
        pdfUrl = invoicePageUrl;
      }
      // Check if it's a CSS summary URL
      else if (invoicePageUrl.includes('/gp/css/summary/print')) {
        console.log(`    ✅ CSS summary URL found: ${invoicePageUrl}`);
        pdfUrl = invoicePageUrl;
      }
      // For popover URLs or other invoice page URLs, try to construct direct URL
      else {
        console.log(`    🔄 Non-direct URL, attempting to construct direct PDF URL`);

        // Try to construct direct PDF URL from order ID
        const marketplace = detectMarketplace();
        const baseUrl = marketplace === 'DE' ? 'https://www.amazon.de' : 'https://www.amazon.com';
        const directPdfUrl = `${baseUrl}/your-orders/invoice/documents/download/${orderNum.replace(/-/g, '')}/invoice.pdf`;

        console.log(`    🎯 Constructed direct PDF URL: ${directPdfUrl}`);

        // Validate the constructed URL by checking if it looks reasonable
        if (directPdfUrl.includes(orderNum.replace(/-/g, ''))) {
          pdfUrl = directPdfUrl;
          console.log(`    ✅ Using constructed direct PDF URL`);
        } else {
          // Fall back to extraction from the original URL
          console.log(`    🔄 Falling back to URL extraction from: ${invoicePageUrl}`);
          pdfUrl = await extractPdfUrlFromInvoicePage(invoicePageUrl);
        }
      }
    } else {
      console.log(`    ⏭️  No invoice link found, trying to construct URL from order ID`);

      // Try to construct direct PDF URL even without a link
      const marketplace = detectMarketplace();
      const baseUrl = marketplace === 'DE' ? 'https://www.amazon.de' : 'https://www.amazon.com';
      const constructedUrl = `${baseUrl}/your-orders/invoice/documents/download/${orderNum.replace(/-/g, '')}/invoice.pdf`;

      console.log(`    🎯 Constructed URL from order ID: ${constructedUrl}`);
      pdfUrl = constructedUrl;
    }

    // Extract order date
    const orderDate = extractOrderDate(order);

    // Generate custom filename
    const marketplace = detectMarketplace();
    const filename = generateFilename({
      marketplace: marketplace,
      orderDate: orderDate,
      orderNumber: index + 1,  // Auto-incrementing number (1-based)
      orderId: orderNum,       // Optional: full order ID
      searchStartDate: searchStartDate,  // Optional: from user's search
      searchEndDate: searchEndDate       // Optional: from user's search
    });

    // Check if already downloaded
    const alreadyDownloaded = await checkDuplicate(orderNum);
    if (alreadyDownloaded) {
      console.log(`    ⏭️  Already downloaded: ${orderNum}`);
      return null;
    }

    // Only return orders with direct PDF URLs
    if (!pdfUrl || (!pdfUrl.includes('/documents/download/') && !pdfUrl.includes('/invoice.pdf'))) {
      console.log(`    ❌ Skipping order ${orderNum} - no direct PDF URL available`);
      return null;
    }

    return {
      url: pdfUrl,
      invoiceUrl: pdfUrl, // Both fields should contain the direct PDF URL
      filename: filename,
      orderId: orderNum,
      index: index,
      orderDate: orderDate
    };

  } catch (error) {
    console.error(`    ❌ Error preparing order ${index + 1}:`, error);
    return null;
  }
}

async function extractPdfUrlFromInvoicePage(invoicePageUrl) {
  console.log('📄 Requesting PDF URL extraction from background:', invoicePageUrl);

  return new Promise((resolve, reject) => {
    // Send message to background script to extract PDF URL
    chrome.runtime.sendMessage({
      action: 'extractPdfUrl',
      invoicePageUrl: invoicePageUrl
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to send extractPdfUrl message:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && response.success) {
        const pdfUrl = response.pdfUrl;
        console.log('✅ Received PDF URL from background:', pdfUrl);
        resolve(pdfUrl);
      } else {
        const error = response?.error || 'Unknown error';
        console.warn('⚠️ PDF extraction failed, cannot provide direct PDF URL:', error);
        resolve(null); // Don't fallback to original URL - return null to skip this order
      }
    });
  });
}

// Helper function for filename generation
function generateFilename(options) {
  const {
    marketplace,
    orderDate,
    orderNumber,
    orderId,
    searchStartDate,
    searchEndDate
  } = options;

  // Format auto-number with leading zeros
  const paddedNumber = String(orderNumber).padStart(3, '0');

  // Format date if needed (remove dashes, reformat, etc.)
  const formattedDate = orderDate.replace(/-/g, '');

  // Build filename based on preference
  // Option 1: Simple pattern
  return `invoice-${marketplace}-${formattedDate}-${paddedNumber}.pdf`;

  // Option 2: With search dates
  // return `invoices-${searchStartDate}-to-${searchEndDate}-${paddedNumber}.pdf`;

  // Option 3: With order ID
  // return `${marketplace}-${formattedDate}-${orderId}-${paddedNumber}.pdf`;
}

// Export functions to global scope
window.scrapeOrdersFromCurrentPage = scrapeOrdersFromCurrentPage;
window.loadPaginationSettings = loadPaginationSettings;
window.resumePagination = resumePagination;
window.continuePaginationLoop = continuePaginationLoop;
window.startDownloadWithOrders = startDownloadWithOrders;
window.prepareOrderForDownload = prepareOrderForDownload;
})();
