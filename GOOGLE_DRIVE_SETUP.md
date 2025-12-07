# Google Drive Integration Setup

## Overview
The Amazon Invoice Extractor Pro now supports automatic upload of downloaded invoices to Google Drive for streamlined accounting workflows.

## Features
- ✅ Automatic folder creation in Google Drive
- ✅ Batch upload of all downloaded invoices
- ✅ CSV summary generation with metadata
- ✅ Smart filing date calculation
- ✅ User-friendly notifications

## Setup Instructions

### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 2. OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure OAuth consent screen if not done already
4. Select application type: "Chrome Extension"
5. Enter your Chrome Extension ID (from `chrome://extensions/`)
6. Download the credentials JSON file

### 3. Extension Configuration
1. Open `public/manifest.json`
2. Replace `"YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE"` with your actual OAuth client ID
3. Re-package the extension: `npm run package`

### 4. Chrome Web Store Deployment
When submitting to Chrome Web Store:
1. Upload the packaged extension
2. In the store listing, provide your OAuth client ID
3. The extension will request Google Drive permissions on first use

## How It Works

### User Flow
1. User checks "📁 Upload to Google Drive after download" in Advanced Options
2. Extension downloads invoices as usual
3. Upon completion, automatically uploads to Google Drive
4. Creates organized folder structure: `Amazon_Invoices_Pending/[SessionName]`
5. Generates `_SESSION_SUMMARY.csv` with all metadata
6. Shows notification with filing deadline

### Folder Structure
```
Google Drive/
├── Amazon_Invoices_Pending/
│   ├── Amazon_DE_Session_001_Q1_Aug_Oct/
│   │   ├── Invoice_12345.pdf
│   │   ├── Invoice_67890.pdf
│   │   └── _SESSION_SUMMARY.csv
│   └── Amazon_US_Session_002_Q2_Nov_Jan/
│       ├── Invoice_11111.pdf
│       └── _SESSION_SUMMARY.csv
```

### CSV Summary Format
```csv
Order_ID,Invoice_Number,Date,Marketplace,Filename,Download_Time
123-4567890,INV-001,2025-08-15,Amazon DE,Invoice_12345.pdf,2025-12-06T10:30:00Z
```

## Permissions Required
- `identity`: OAuth authentication with Google
- `https://www.googleapis.com/auth/drive.file`: Create and manage Google Drive files

## Error Handling
- Automatic retry on upload failures
- Graceful fallback if Google Drive unavailable
- Detailed error logging for troubleshooting

## Security Notes
- Only uploads to user-owned Google Drive
- No data sent to external servers
- OAuth tokens stored securely by Chrome
- Files uploaded directly from user's downloads folder

## Testing
To test the integration:
1. Load the extension locally
2. Download some invoices
3. Check Google Drive for uploaded files
4. Verify CSV summary contains correct metadata

## Support
For issues with Google Drive integration:
- Check browser console for error messages
- Verify OAuth client ID is correct
- Ensure Google Drive API is enabled
- Confirm extension has proper permissions</contents>
</xai:function_call">The Google Drive integration is now fully implemented and ready for testing! 🚀