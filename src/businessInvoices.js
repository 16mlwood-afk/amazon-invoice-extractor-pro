// Functions are available via window.amazonInvoiceDownloader (loaded from common.js)
// START_OBFUSCATE
function initBusinessDownload(initialStartDate, initialEndDate) {
  startDate = new Date(initialStartDate);
  endDate = new Date(initialEndDate);
  const normalizedStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const normalizedEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  console.log('Genormaliseerde startdatum:', normalizedStartDate);
  console.log('Genormaliseerde einddatum:', normalizedEndDate);
  processBusinessPage(normalizedStartDate, normalizedEndDate);
}
function processBusinessPage(startDate, endDate) {
  findInvoiceLinks(startDate, endDate).then(result => {
    if (result.links.length > 0) {
      downloadInvoices(result.links).then(() => {
        if (!result.startDateReached && window.amazonInvoiceDownloader.goToNextPage()) {
          setTimeout(() => processBusinessPage(startDate, endDate), 2000);
        } else {
          console.log('Download completed or start date reached');
          chrome.runtime.sendMessage({ action: "downloadComplete" });
        }
      });
    } else if (!result.startDateReached && window.amazonInvoiceDownloader.goToNextPage()) {
      setTimeout(() => processBusinessPage(startDate, endDate), 2000);
    } else {
      console.log('No invoices found or start date reached');
      chrome.runtime.sendMessage({ action: "downloadComplete" });
    }
  });
}
function findInvoiceLinks(normalizedStartDate, normalizedEndDate) {
  const marketplace = window.amazonInvoiceDownloader.detectMarketplace();
  const config = window.amazonInvoiceDownloader.marketplaceConfig[marketplace];
  const invoiceLinks = [];
  let pageStartDateReached = false;

  console.log('Genormaliseerde startdatum:', normalizedStartDate);
  console.log('Genormaliseerde einddatum:', normalizedEndDate);

  const orderBlocks = document.querySelectorAll('.a-box.a-color-offset-background.order-header, .order-info');
  console.log(`Aantal gevonden orderblokken: ${orderBlocks.length}`);

  orderBlocks.forEach((block) => {
    const dateElement = block.querySelector(config.dateSelector);
    const orderDate = dateElement ? dateElement.textContent.trim() : 'Niet gevonden';
    const parsedOrderDate = window.amazonInvoiceDownloader.parseDate(orderDate, config.monthNames);

    if (parsedOrderDate) {
      const normalizedParsedOrderDate = new Date(parsedOrderDate.getFullYear(), parsedOrderDate.getMonth(), parsedOrderDate.getDate());

      console.log('Genormaliseerde besteldatum:', normalizedParsedOrderDate);

      if (normalizedParsedOrderDate < normalizedStartDate) {
        pageStartDateReached = true;
        return;
      }

      if (normalizedParsedOrderDate > normalizedEndDate) {
        console.log('Besteldatum is na einddatum, order overslaan');
        return;
      }

      // Check both selectors for the order number
      let orderNumberElement = block.querySelector(config.orderNumberSelector);
      if (!orderNumberElement) {
        orderNumberElement = block.querySelector('.yohtmlc-order-id .value bdi');
      }
      const orderNumber = orderNumberElement ? orderNumberElement.textContent.trim() : 'Not found';
      console.log(`Order number: ${orderNumber}`);
      const invoiceLinkElements = block.querySelectorAll(config.invoiceLinkSelector);
      console.log(`Number of invoice links found: ${invoiceLinkElements.length}`);
      invoiceLinkElements.forEach((link, linkIndex) => {
        const linkText = link.textContent.trim();
        console.log(`Invoice link ${linkIndex + 1} found:`, linkText);
        if (Array.isArray(config.invoiceText) ? config.invoiceText.includes(linkText) : config.invoiceText === linkText) {
          console.log(`Valid invoice link found: ${linkText}`);
          const fullUrl = new URL(link.getAttribute('href'), window.location.origin).href;
          console.log(`Found invoice URL: ${fullUrl}`);
          invoiceLinks.push({
            date: orderDate,
            orderNumber: orderNumber,
            url: fullUrl,
            text: linkText
          });
          console.log(`Invoice link added for order block ${blockIndex + 1}`);
        }
      });
    }
  });

  console.log(`Total number of invoice links found: ${invoiceLinks.length}`);
  return { links: invoiceLinks, startDateReached: pageStartDateReached };
}
function downloadInvoices(invoiceLinks) {
  console.log(`Starting download of ${invoiceLinks.length} invoices`);
  return new Promise((resolve) => {
    let downloadedCount = 0;
    invoiceLinks.forEach((linkInfo, index) => {
      setTimeout(() => {
        downloadInvoice(linkInfo).then(() => {
          downloadedCount++;
          window.amazonInvoiceDownloader.updateProgress(downloadedCount, invoiceLinks.length);
          if (downloadedCount === invoiceLinks.length) {
            resolve();
          }
        });
      }, index * 1000);
    });
  });
}
// END_OBFUSCATE

function downloadInvoice(linkInfo) {
  return new Promise((resolve) => {
    console.log('Download invoice started for:', linkInfo);
    chrome.runtime.sendMessage({
      action: "fetchInvoicePage",
      url: linkInfo.url
    }, response => {
      if (response && response.html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(response.html, 'text/html');
        const pdfLinks = doc.querySelectorAll('a[href*="/documents/download/"][href$=".pdf"]');
        
        if (pdfLinks.length > 0) {
          const downloadPromises = Array.from(pdfLinks).map((pdfLink, index) => {
            return new Promise((downloadResolve) => {
              const pdfUrl = new URL(pdfLink.getAttribute('href'), window.location.origin).href;
              console.log(`Found PDF link ${index + 1}: ${pdfUrl}`);
              
              // Send all necessary information to businessInvoices.js
              chrome.runtime.sendMessage({
                action: "downloadBusinessPDF",
                url: pdfUrl,
                orderNumber: linkInfo.orderNumber,
                linkText: pdfLink.textContent.trim(),
                orderDate: linkInfo.date
              }, downloadResponse => {
                if (chrome.runtime.lastError) {
                  console.error('Error sending downloadBusinessPDF request:', chrome.runtime.lastError);
                } else if (downloadResponse && downloadResponse.error) {
                  console.error('Error downloading PDF:', downloadResponse.error);
                } else {
                  console.log(`PDF download ${index + 1} started with ID:`, downloadResponse.downloadId);
                }
                
                downloadResolve();
              });
            });
          });

          Promise.all(downloadPromises).then(() => {
            resolve();
          });
        } else {
          console.error('No PDF links found in the invoice page');
          resolve();
        }
      } else {
        console.error('Error fetching the invoice page:', response.error);
        resolve();
      }
    });
  });
}

// Add business-specific functions to the global object
Object.assign(window.amazonInvoiceDownloader, {
  initBusinessDownload,
  processBusinessPage
});