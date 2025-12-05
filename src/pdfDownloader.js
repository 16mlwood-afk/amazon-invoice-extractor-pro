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
    return true; // Geeft aan dat we asynchroon zullen antwoorden
});