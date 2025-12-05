if (!window.amazonInvoiceDownloader) {
  window.amazonInvoiceDownloader = {};
}

class BusinessInvoiceHandler {
  constructor(config = {}) {
    this.config = config;
    this.errorHandler = window.amazonInvoiceDownloader.errorHandler;
    this.domQueryHelper = new window.amazonInvoiceDownloader.DOMQueryHelper();
    this.downloadState = window.amazonInvoiceDownloader.downloadState;
  }

  async initialize(startDate, endDate) {
    try {
      this.startDate = this.normalizeDate(startDate);
      this.endDate = this.normalizeDate(endDate);
      this.marketplace = window.amazonInvoiceDownloader.detectMarketplace();

      console.log('Business handler initialized:', {
        marketplace: this.marketplace,
        dateRange: { start: this.startDate, end: this.endDate }
      });

      return this.processCurrentPage();
    } catch (error) {
      console.error('Error initializing business handler:', error);
      throw error;
    }
  }

  async processCurrentPage() {
    try {
      console.log(`Processing business page ${this.downloadState.currentPage}`);
      const result = await this.findInvoiceLinks();

      if (result.error) {
        console.error('Error finding invoice links:', result);
        return;
      }

      if (result.links.length > 0) {
        // Update total in state
        const currentTotal = this.downloadState.progress.total;
        this.downloadState.setTotal(currentTotal + result.links.length);

        await this.downloadInvoices(result.links);

        // Decide next action
        if (!result.startDateReached && await this.hasNextPage()) {
          this.downloadState.incrementPage();
          await this.goToNextPage();
        } else {
          console.log('All invoices have been downloaded');
          this.downloadState.setStatus('complete');
          chrome.runtime.sendMessage({ action: "downloadComplete" });
        }
      } else if (!result.startDateReached && await this.hasNextPage()) {
        this.downloadState.incrementPage();
        await this.goToNextPage();
      } else {
        console.log('No invoices found and start date reached');
        this.downloadState.setStatus('complete');
        chrome.runtime.sendMessage({ action: "downloadComplete" });
      }
    } catch (error) {
      console.error('Error in processCurrentPage:', error);
      this.errorHandler.handleError('DOM_QUERY_FAILED', {
        function: 'processCurrentPage',
        error: error.message
      });
    }
  }

  async findInvoiceLinks() {
    try {
      const marketplace = this.marketplace;
      const marketplaceConfig = window.amazonInvoiceDownloader.marketplaceConfig[marketplace];

      if (!marketplaceConfig) {
        return this.errorHandler.handleError('NO_CONFIG', { marketplace });
      }

      const invoiceLinks = [];
      let pageStartDateReached = false;

      console.log('Finding invoice links with date range:', this.downloadState.dateRange);

      // Use safe DOM querying with fallback selectors
      const orderBlocks = await this.domQueryHelper.querySelectorAll(
        '.a-box.a-color-offset-background.order-info',
        {
          fallbackSelectors: ['.order-info', '.a-box.order-info'],
          required: false
        }
      );

      console.log(`Number of order blocks found: ${orderBlocks.length}`);

      if (orderBlocks.length === 0) {
        return this.errorHandler.handleError('NO_ORDERS_FOUND', {
          marketplace,
          suggestion: 'Try refreshing the page or navigating to a different page'
        });
      }

      for (let blockIndex = 0; blockIndex < orderBlocks.length; blockIndex++) {
        const block = orderBlocks[blockIndex];
        console.log(`Processing order block ${blockIndex + 1}`);

        try {
          const dateElement = block.querySelector(marketplaceConfig.dateSelector);
          const orderDate = this.domQueryHelper.getTextContent(dateElement, 'Not found');
          console.log(`Order date: ${orderDate}`);

          const parsedOrderDate = this.normalizeDate(window.amazonInvoiceDownloader.parseDate(orderDate, marketplaceConfig.monthNames));

          if (!parsedOrderDate) {
            console.warn(`Could not parse date for order block ${blockIndex + 1}: ${orderDate}`);
            continue;
          }

          console.log('Date comparison:', {
            parsedOrderDate: parsedOrderDate.toISOString(),
            startDate: this.startDate.toISOString(),
            endDate: this.endDate.toISOString()
          });

          if (parsedOrderDate < this.startDate) {
            console.log('Start date reached, stopping search');
            pageStartDateReached = true;
            break; // Stop processing further blocks
          }

          if (parsedOrderDate > this.endDate) {
            console.log('Order date is after end date, skipping this order');
            continue;
          }

          const orderNumberElement = block.querySelector(marketplaceConfig.orderNumberSelector);
          const orderNumber = this.domQueryHelper.getTextContent(orderNumberElement, 'Not found');
          console.log(`Order number: ${orderNumber}`);

          const popoverTriggers = block.querySelectorAll('a.a-popover-trigger');
          console.log(`Number of popover triggers found: ${popoverTriggers.length}`);

          if (popoverTriggers.length > 0) {
            for (const trigger of popoverTriggers) {
              const triggerText = this.domQueryHelper.getTextContent(trigger);

              if (Array.isArray(marketplaceConfig.invoiceText)
                  ? marketplaceConfig.invoiceText.includes(triggerText)
                  : marketplaceConfig.invoiceText === triggerText) {

                console.log(`Invoice trigger found: ${triggerText}`);

                let popoverData = null;
                const parentSpan = trigger.closest('span.a-declarative');
                if (parentSpan) {
                  popoverData = this.domQueryHelper.getAttribute(parentSpan, 'data-a-popover');
                } else {
                  // Check the trigger element itself
                  popoverData = this.domQueryHelper.getAttribute(trigger, 'data-a-popover');
                }

                if (popoverData) {
                  try {
                    const popoverConfig = JSON.parse(popoverData);
                    if (popoverConfig.url) {
                      const fullUrl = this.domQueryHelper.createFullUrl(popoverConfig.url);
                      console.log(`Found invoice URL: ${fullUrl}`);

                      invoiceLinks.push({
                        date: orderDate,
                        orderNumber: orderNumber,
                        url: fullUrl,
                        text: triggerText
                      });
                      console.log(`Invoice link added for order block ${blockIndex + 1}`);
                    } else {
                      console.log(`No URL found in popover configuration for trigger "${triggerText}"`);
                    }
                  } catch (error) {
                    console.error('Error parsing popover data:', error);
                    this.errorHandler.handleError('PARSING_FAILED', {
                      context: 'popover parsing',
                      triggerText,
                      error: error.message
                    });
                  }
                } else {
                  console.log(`No data-a-popover attribute found for trigger "${triggerText}"`);
                }
              }
            }
          } else {
            console.log('No popover triggers found for this order block');
          }

          console.log(`Number of invoice links found so far: ${invoiceLinks.length}`);
        } catch (error) {
          console.error(`Error processing order block ${blockIndex + 1}:`, error);
          this.errorHandler.handleError('DOM_QUERY_FAILED', {
            blockIndex,
            error: error.message
          });
        }
      }

      console.log(`Total number of invoice links found: ${invoiceLinks.length}`);
      return { links: invoiceLinks, startDateReached: pageStartDateReached };

    } catch (error) {
      console.error('Error in findInvoiceLinks:', error);
      return this.errorHandler.handleError('DOM_QUERY_FAILED', {
        function: 'findInvoiceLinks',
        error: error.message,
        marketplace: this.marketplace
      });
    }
  }

  async downloadInvoices(invoiceLinks) {
    console.log(`Starting download of ${invoiceLinks.length} invoices`);
    return new Promise((resolve) => {
      let downloadedCount = 0;
      const config = window.amazonInvoiceDownloader.config;
      const delayBetweenInvoices = config?.DOWNLOAD?.DELAY_BETWEEN_INVOICES_MS || 1000;

      invoiceLinks.forEach((linkInfo, index) => {
        setTimeout(async () => {
          try {
            await this.downloadInvoice(linkInfo);
            downloadedCount++;
            this.downloadState.incrementProgress();

            if (downloadedCount === invoiceLinks.length) {
              resolve();
            }
          } catch (error) {
            console.error(`Failed to download invoice ${index + 1}:`, error);
            this.errorHandler.handleError('DOWNLOAD_FAILED', {
              linkInfo,
              error: error.message
            });
            downloadedCount++; // Still count as processed

            if (downloadedCount === invoiceLinks.length) {
              resolve();
            }
          }
        }, index * delayBetweenInvoices);
      });
    });
  }

  async downloadInvoice(linkInfo) {
    return new Promise((resolve, reject) => {
      const config = window.amazonInvoiceDownloader.config;
      const timeout = config?.NETWORK?.REQUEST_TIMEOUT_MS || 30000;
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      chrome.runtime.sendMessage({
        action: "fetchInvoicePage",
        url: linkInfo.url
      }, response => {
        clearTimeout(timeoutId);

        try {
          if (response && response.html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.html, 'text/html');
            const pdfLinks = doc.querySelectorAll('a[href*="/documents/download/"][href$=".pdf"]');

            if (pdfLinks.length > 0) {
              const downloadPromises = Array.from(pdfLinks).map((pdfLink, index) => {
                return new Promise((downloadResolve) => {
                  try {
                    const pdfUrl = this.domQueryHelper.createFullUrl(pdfLink.getAttribute('href'));
                    console.log(`Found PDF link ${index + 1}: ${pdfUrl}`);

                    const safeOrderNumber = linkInfo.orderNumber.replace(/[^0-9-]/g, '');
                    const safeLinkText = this.domQueryHelper.getTextContent(pdfLink).replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const fileName = `${safeOrderNumber}_${safeLinkText}.pdf`;

                    chrome.runtime.sendMessage({
                      action: "downloadBusinessPDF",
                      url: pdfUrl,
                      filename: fileName
                    }, downloadResponse => {
                      if (chrome.runtime.lastError) {
                        console.error('Error sending downloadBusinessPDF request:', chrome.runtime.lastError);
                        this.errorHandler.handleError('DOWNLOAD_FAILED', {
                          linkInfo,
                          chromeError: chrome.runtime.lastError
                        });
                      } else if (downloadResponse && downloadResponse.error) {
                        console.error('Error downloading PDF:', downloadResponse.error);
                        this.errorHandler.handleError('DOWNLOAD_FAILED', {
                          linkInfo,
                          downloadError: downloadResponse.error
                        });
                      } else if (downloadResponse && downloadResponse.success) {
                        console.log(`PDF download ${index + 1} started with ID:`, downloadResponse.downloadId);
                      } else {
                        console.error('Unexpected response while downloading PDF:', downloadResponse);
                      }
                      downloadResolve();
                    });
                  } catch (error) {
                    console.error(`Error processing PDF link ${index + 1}:`, error);
                    this.errorHandler.handleError('DOWNLOAD_FAILED', {
                      linkInfo,
                      pdfIndex: index,
                      error: error.message
                    });
                    downloadResolve(); // Continue with other PDFs
                  }
                });
              });

              Promise.all(downloadPromises).then(() => {
                resolve();
              }).catch(error => {
                console.error('Error in download promises:', error);
                reject(error);
              });
            } else {
              console.error('No PDF links found in the invoice page');
              this.errorHandler.handleError('PDF_NOT_FOUND', {
                linkInfo,
                suggestion: 'The invoice may not be available for this order'
              });
              resolve(); // Don't fail the whole process
            }
          } else if (response && response.error) {
            console.error('Error fetching the invoice page:', response.error);
            this.errorHandler.handleError('NETWORK_ERROR', {
              linkInfo,
              responseError: response.error
            });
            reject(new Error(response.error));
          } else {
            console.error('Unexpected response while fetching the invoice page');
            this.errorHandler.handleError('NETWORK_ERROR', {
              linkInfo,
              response
            });
            reject(new Error('Unexpected response from fetchInvoicePage'));
          }
        } catch (error) {
          console.error('Error in downloadInvoice:', error);
          this.errorHandler.handleError('DOWNLOAD_FAILED', {
            linkInfo,
            error: error.message
          });
          reject(error);
        }
      });
    });
  }

  async hasNextPage() {
    try {
      const pagination = await this.domQueryHelper.querySelector('.a-pagination', { required: false });
      if (!pagination) {
        console.log('No pagination found');
        return false;
      }

      const currentPageItem = pagination.querySelector('li.a-selected');
      if (!currentPageItem) {
        console.log('No current page indicator found');
        return false;
      }

      const nextPageItem = currentPageItem.nextElementSibling;
      if (!nextPageItem || nextPageItem.classList.contains('a-disabled')) {
        console.log('Next page item disabled or not found');
        return false;
      }

      const nextPageLink = nextPageItem.querySelector('a');
      return !!nextPageLink;
    } catch (error) {
      console.error('Error checking for next page:', error);
      this.errorHandler.handleError('DOM_QUERY_FAILED', {
        function: 'hasNextPage',
        error: error.message
      });
      return false;
    }
  }

  async goToNextPage() {
    try {
      console.log(`Navigating to next page from page ${this.downloadState.currentPage}`);

      const pagination = await this.domQueryHelper.querySelector('.a-pagination');
      const currentPageItem = pagination.querySelector('li.a-selected');

      if (!currentPageItem) {
        throw new Error('Current page indicator not found');
      }

      const nextPageItem = currentPageItem.nextElementSibling;
      if (!nextPageItem || nextPageItem.classList.contains('a-disabled')) {
        throw new Error('No valid next page available');
      }

      const nextPageLink = nextPageItem.querySelector('a');
      if (!nextPageLink) {
        throw new Error('Next page link not found');
      }

      const nextPageUrl = this.domQueryHelper.createFullUrl(nextPageLink.href);
      console.log(`Navigating to page ${this.downloadState.currentPage + 1}: ${nextPageUrl}`);

      // Add delay before navigation
      const config = window.amazonInvoiceDownloader.config;
      const navigationDelay = config?.PAGINATION?.NEXT_PAGE_DELAY_MS || 2000;
      await new Promise(resolve => setTimeout(resolve, navigationDelay));

      chrome.runtime.sendMessage({
        action: "navigateToNextPage",
        url: nextPageUrl
      });

    } catch (error) {
      console.error('Error navigating to next page:', error);
      this.errorHandler.handleError('DOM_QUERY_FAILED', {
        function: 'goToNextPage',
        error: error.message
      });
      // Complete the download if we can't navigate
      this.downloadState.setStatus('complete');
      chrome.runtime.sendMessage({ action: "downloadComplete" });
    }
  }

  normalizeDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return null;
    }
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  }
}

// Export to global namespace
window.amazonInvoiceDownloader.BusinessInvoiceHandler = BusinessInvoiceHandler;

// Export for both environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js (for tests)
  module.exports = BusinessInvoiceHandler;
} else {
  // Browser (for extension)
  window.amazonInvoiceDownloader.BusinessInvoiceHandler = BusinessInvoiceHandler;
}
