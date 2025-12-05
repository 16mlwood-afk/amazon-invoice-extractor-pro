console.log('NonBusinessInvoices script geladen');

(function() {
  let startDate;
  let currentPage = 1;
  let totalInvoices = 0;
  // START_OBFUSCATE
  let downloadedInvoices = 0;

  function initNonBusinessDownload(initialStartDate, initialEndDate) {
    startDate = new Date(initialStartDate);
    endDate = new Date(initialEndDate);
    const normalizedStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const normalizedEndDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    processNonBusinessPage(normalizedStartDate, normalizedEndDate);
  }

  function processNonBusinessPage(normalizedStartDate, normalizedEndDate) {
    console.log(`Processing non-business invoices page ${currentPage}`);

    waitForElements(['.a-box.a-color-offset-background.order-header', '.order-info']).then(() => {
      const { links, startDateReached } = findInvoiceLinksNonBusiness(normalizedStartDate, normalizedEndDate);
      console.log(`Found non-business invoice links on page ${currentPage}:`, links.length);

      if (links.length > 0) {
        totalInvoices += links.length;
        downloadInvoicesNonBusiness(links).then(() => {
          console.log('All non-business invoices on this page have been downloaded');
          goToNextPage(startDateReached);
        });
      } else {
        console.log('No non-business invoices found on this page or all invoices are older than the start date');
        goToNextPage(startDateReached);
      }
    }).catch(error => {
      console.error('Error processing the current page:', error);
      goToNextPage(false);
    });
  }

  function findInvoiceLinksNonBusiness(normalizedStartDate, normalizedEndDate) {
    const marketplace = detectMarketplace();
    const config = window.amazonInvoiceDownloader.marketplaceConfig[marketplace];
    const invoiceLinks = [];
    let pageStartDateReached = false;

    console.log('Normalized StartDate:', normalizedStartDate);
    console.log('Normalized EndDate:', normalizedEndDate);

    const orderBlocks = document.querySelectorAll('.a-box.a-color-offset-background.order-header, .order-info');
    console.log(`Number of order blocks found: ${orderBlocks.length}`);

    orderBlocks.forEach((block) => {
      const dateElement = block.querySelector(config.dateSelector);
      const orderDate = dateElement ? dateElement.textContent.trim() : 'Not found';
      const parsedOrderDate = parseDate(orderDate, config.monthNames);

      if (parsedOrderDate) {
        // Normaliseer de parsedOrderDate naar middernacht in de lokale tijdzone
        const normalizedParsedOrderDate = new Date(parsedOrderDate.getFullYear(), parsedOrderDate.getMonth(), parsedOrderDate.getDate());

        console.log('Normalized ParsedOrderDate:', normalizedParsedOrderDate);

        if (normalizedParsedOrderDate < normalizedStartDate) {
          pageStartDateReached = true;
          return;
        }

        if (normalizedParsedOrderDate > normalizedEndDate) {
          console.log('Order date is after end date, skipping this order');
          return;
        }

        const orderNumberElement = block.querySelector(config.orderNumberSelector);
        const orderNumber = orderNumberElement ? orderNumberElement.textContent.trim() : 'Not found';

        const invoiceLinkElement = block.querySelector(config.invoiceLinkSelector);
        if (invoiceLinkElement) {
          const linkText = invoiceLinkElement.textContent.trim();
          if (config.invoiceText.some(text => linkText.includes(text))) {
            invoiceLinks.push({
              date: orderDate,
              orderNumber: orderNumber,
              url: new URL(invoiceLinkElement.href, window.location.origin).href
            });
          }
        }
      }
    });

    return { links: invoiceLinks, startDateReached: pageStartDateReached };
  }

  function parseUSDate(dateString) {
    const [month, day, year] = dateString.split(' ');
    const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(month);
    return new Date(year, monthIndex, parseInt(day));
  }

  function downloadInvoicesNonBusiness(invoiceLinks) {
    return new Promise((resolve) => {
      let downloadedCount = 0;
      invoiceLinks.forEach((linkInfo, index) => {
        setTimeout(() => {
          downloadInvoiceNonBusiness(linkInfo).then(() => {
            downloadedCount++;
            if (downloadedCount === invoiceLinks.length) {
              resolve();
            }
          });
        }, index * 1000);
      });
    });
  }

  function downloadInvoiceNonBusiness(linkInfo) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "fetchInvoicePage",
        url: linkInfo.url,
        orderNumber: linkInfo.orderNumber
      }, async response => {
        if (response && response.html) {
          await processInvoicePageNonBusiness(response.html, linkInfo);
        }
        
        downloadedInvoices++;
        updateProgress(downloadedInvoices, totalInvoices);
        resolve();
      });
    });
  }

  function updateProgress(current, total) {
    if (typeof current === 'number' && typeof total === 'number' && total > 0) {
      const percentage = Math.round((current / total) * 100);
      chrome.runtime.sendMessage({
        action: "updateProgress",
        progress: percentage
      });
    } else {
      console.error('Invalid values for updateProgress:', { current, total });
    }
  }

  async function processInvoicePageNonBusiness(html, linkInfo) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const pdfLinks = doc.querySelectorAll('a[href*="/documents/download/"][href$=".pdf"]');
    
    for (const pdfLink of pdfLinks) {
      const pdfUrl = new URL(pdfLink.getAttribute('href'), window.location.origin).href;
      const linkText = pdfLink.textContent.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${linkInfo.orderNumber}_${linkText}.pdf`;
      
      await new Promise(resolve => {
        chrome.runtime.sendMessage({
          action: "downloadPDF",
          url: pdfUrl,
          filename: fileName 
        }, downloadResponse => {
          if (downloadResponse && downloadResponse.success) {
            console.log(`PDF download started: ${fileName}`);
          }// END_OBFUSCATE
          resolve();
        });
      });
    }
  }

  window.nonBusinessInvoices = {
    initNonBusinessDownload,
    processNonBusinessPage
  };
})();