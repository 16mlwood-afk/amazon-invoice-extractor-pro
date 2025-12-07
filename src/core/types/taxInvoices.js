console.log('Content script loaded:', chrome.runtime.getURL(chrome.runtime.getManifest().content_scripts[0].js[0]));
console.log('Amazon Tax Invoices Downloader script loaded');

let taxStartDate;
let taxEndDate;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startTaxDownload") {
    console.log('StartTaxDownload message received:', request);
    taxStartDate = new Date(request.startDate);
    taxEndDate = new Date(request.endDate);
    processTaxInvoicesPage();
  }
  if (request.action === "ping") {
    sendResponse({pong: true});
  }
  if (request.action === "checkAndDownloadPDF") {
    console.log('CheckAndDownloadPDF message received');
    checkAndDownloadPDF();
    sendResponse({status: "PDF check started"});
  }
  return true; // Geeft aan dat we asynchroon zullen antwoorden
});
// START_OBFUSCATE
function processTaxInvoicesPage() {
  console.log('Processing tax invoices page');
  const invoiceRows = document.querySelectorAll('.fba-core-data tr');
  let totalInvoices = 0;
  let downloadedInvoices = 0;

  const downloadPromises = Array.from(invoiceRows).map((row) => {
    const viewButton = row.querySelector('button[data-enddate]');
    if (viewButton) {
      const endDate = new Date(viewButton.getAttribute('data-enddate'));
      if (endDate >= taxStartDate && endDate <= taxEndDate) {
        totalInvoices++;
        const invoiceNumber = viewButton.getAttribute('data-invoice');
        return downloadTaxInvoice(viewButton, invoiceNumber)
          .then(() => {
            downloadedInvoices++;
            updateProgress(downloadedInvoices, totalInvoices);
          })
          .catch((error) => {
            console.error(`Error downloading invoice ${invoiceNumber}:`, error);
          });
      }
    }
    return null;
  }).filter(Boolean);

  Promise.all(downloadPromises).then(() => {
    if (totalInvoices === 0) {
      console.log('No invoices found that meet the start date criteria');
    }
    chrome.runtime.sendMessage({ action: "taxDownloadComplete" });
  });
}

function downloadTaxInvoice(viewButton, invoiceNumber) {
  return new Promise((resolve, reject) => {
    viewButton.click();
    chrome.runtime.onMessage.addListener(function listener(request, sender, sendResponse) {
      if (request.action === "pdfOpened") {
        chrome.runtime.onMessage.removeListener(listener);
        const pdfUrl = request.url;
        console.log(`PDF geopend: ${pdfUrl}`);
        chrome.runtime.sendMessage({
          action: "createTab",
          url: pdfUrl,
          filename: `${invoiceNumber}.pdf`
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Fout bij het openen van PDF tab:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log(`Tax invoice ${invoiceNumber} tab geopend voor download`);
            resolve();
          }
        });
      }
    });
  });
}

function updateProgress(downloaded, total) {
  const progress = (downloaded / total) * 100;
  console.log(`Voortgang: ${progress.toFixed(2)}%`);
  chrome.runtime.sendMessage({
    action: "updateTaxProgress",
    progress: progress
  });
}

function checkAndDownloadPDF() {
  console.log('Controleren op openstaande PDF downloads');
  const pdfLinks = document.querySelectorAll('a[href*="/documents/download/"][href$=".pdf"]');
  pdfLinks.forEach((link, index) => {
    const pdfUrl = link.href;
    const fileName = `tax_invoice_${index + 1}.pdf`;
    console.log(`PDF gevonden: ${pdfUrl}`);
    chrome.runtime.sendMessage({
      action: "downloadPDF",
      url: pdfUrl,
      filename: fileName
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Fout bij het verzenden van downloadPDF bericht:', chrome.runtime.lastError);
      } else {
        console.log(`Download gestart voor ${fileName}`);
      }
    });
  });
}
// END_OBFUSCATE