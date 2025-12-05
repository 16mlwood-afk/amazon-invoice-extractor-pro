console.log('Tax bundle loaded');

let taxStartDate;
let processedInvoices = new Set();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startTaxDownload") {
    console.log('StartTaxDownload message received:', request);
    initTaxDownload(request.startDate);
  }
  if (request.action === "ping") {
    sendResponse({pong: true});
  }
  if (request.action === "checkAndDownloadPDF") {
    console.log('CheckAndDownloadPDF message received');
    checkAndDownloadPDF();
    sendResponse({status: "PDF check started"});
  }
  return true;
});

function initTaxDownload(initialStartDate) {
  console.log('Initialiseren tax download met startdatum:', initialStartDate);
  taxStartDate = new Date(initialStartDate);
  processTaxInvoicesPage();
}

// START_OBFUSCATE
function processTaxInvoicesPage() {
    console.log('Processing tax invoices page');
    const invoiceRows = document.querySelectorAll('.fba-core-data tr');
    let totalInvoices = 0;
    let downloadedInvoices = 0;
    let startDateReached = false;

    const downloadPromises = Array.from(invoiceRows).map((row) => {
        const viewButton = row.querySelector('button[data-enddate]');
        if (viewButton) {
            const endDate = new Date(viewButton.getAttribute('data-enddate'));
            const invoiceNumber = viewButton.getAttribute('data-invoice');
            
            if (endDate >= taxStartDate && !processedInvoices.has(invoiceNumber)) {
                totalInvoices++;
                processedInvoices.add(invoiceNumber);
                return downloadTaxInvoice(viewButton, invoiceNumber)
                    .then(() => {
                        downloadedInvoices++;
                        updateProgress(downloadedInvoices, totalInvoices);
                    })
                    .catch((error) => {
                        console.error(`Error downloading invoice ${invoiceNumber}:`, error);
                    });
            } else if (endDate < taxStartDate) {
                startDateReached = true;
            }
        }
        return Promise.resolve();
    });

    Promise.all(downloadPromises).then(() => {
        if (totalInvoices === 0 || startDateReached) {
            console.log('No more invoices to process or start date reached');
            chrome.runtime.sendMessage({ action: "taxDownloadComplete" });
        } else {
            goToNextPage();
        }
    });
}

function goToNextPage() {
    const nextButton = document.querySelector('li.a-last a');
    if (nextButton) {
        console.log('Going to next page');
        nextButton.click();
        setTimeout(processTaxInvoicesPage, 2000);
    } else {
        console.log('No more pages, download complete');
        chrome.runtime.sendMessage({ action: "taxDownloadComplete" });
    }
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

// PDF Downloader functionaliteit
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Bericht ontvangen in pdfDownloader:', request);
    // START_OBFUSCATE
    if (request.action === "checkAndDownloadPDF") {
        const pdfUrl = window.location.href;
        console.log(`Controleer URL: ${pdfUrl}`);

        if (pdfUrl.endsWith('.pdf')) {
            console.log('URL eindigt op .pdf, start download');
            const filename = pdfUrl.split('/').pop();
            chrome.runtime.sendMessage({
                action: "downloadPDF",
                url: pdfUrl,
                filename: filename
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Fout bij het verzenden van downloadPDF verzoek:', chrome.runtime.lastError);
                } else {
                    console.log(`PDF download gestart met ID:`, response.downloadId);
                    // Sluit het huidige tabblad
                    chrome.runtime.sendMessage({ action: "closeCurrentTab" });
                }
            });
        } else {
            console.log('URL eindigt niet op .pdf, tabblad blijft open');
        }
    }

    if (request.action === "downloadOpenedPDF") {
        const pdfUrl = window.location.href;
        const filename = request.filename;
        console.log(`PDF URL: ${pdfUrl}, Bestandsnaam: ${filename}`);

        if (pdfUrl.endsWith('.pdf')) {
            chrome.runtime.sendMessage({
                action: "downloadPDF",
                url: pdfUrl,
                filename: filename
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Fout bij het verzenden van downloadPDF verzoek:', chrome.runtime.lastError);
                    sendResponse({ error: chrome.runtime.lastError });
                } else {
                    console.log(`PDF download gestart met ID:`, response.downloadId);
                    sendResponse({ success: true });
                    // Sluit het huidige tabblad na een korte vertraging
                    setTimeout(() => {
                        chrome.runtime.sendMessage({ action: "closeCurrentTab" });
                    }, 1000);
                }
            });
        } else {
            console.log('URL eindigt niet op .pdf, tabblad blijft open');
            sendResponse({ success: false, message: 'URL eindigt niet op .pdf' });
        }
    }
    // END_OBFUSCATE
    return true;
});
