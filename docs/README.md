# Amazon Invoice Extractor Pro v2.0.1

**Professional Amazon invoice management system** with enterprise-grade features for automated document acquisition, organization, and processing across all Amazon marketplaces.

## 🌟 Key Features

### 🚀 **Core Capabilities**
- **Multi-Marketplace Support**: Amazon US, DE, FR, UK, NL, IT, ES, CA, JP
- **Coordinated Multi-Marketplace Downloads**: Download from multiple marketplaces simultaneously
- **Advanced Queue Management**: Intelligent batch processing with rate limiting
- **Reliable Multi-Page Collection**: Fixed pagination bug - now works across hundreds of pages
- **Automated Organization**: Smart file naming and folder structures
- **Real-time Progress**: Live download tracking with detailed statistics
- **Error Recovery**: Automatic retry mechanisms and failure handling

### 📊 **Professional Features**
- **Download History Dashboard**: Complete session tracking and analytics
- **Health Check System**: Comprehensive pre-flight diagnostics including network, permissions, authentication, and storage checks
- **Bandwidth Adaptation**: Automatic performance tuning based on network conditions with 5 adaptive profiles
- **Notification System**: Real-time progress and completion alerts with customizable preferences
- **Export Integration**: JSON exports ready for accounting software parsers

### ⚙️ **Advanced Configuration**
- **Multi-Marketplace Coordination**: Enable/disable specific marketplaces and manage coordinated downloads
- **Flexible File Organization**: 5+ customizable folder structures and naming templates
- **User Preferences**: Comprehensive settings for power users with persistent storage
- **Metadata Sidecar Files**: JSON files with acquisition data for debugging and auditing
- **Session Summaries**: Complete download manifests for automated processing and export
- **Bandwidth Adaptation**: 5 adaptive profiles (Excellent/Good/Normal/Poor/Terrible) that automatically adjust download behavior based on network conditions
- **Error Recovery**: Intelligent retry mechanisms with exponential backoff
- **Download History**: Complete session tracking with analytics and export capabilities

## 📦 Quick Start

1. **Install**: Load the extension folder as unpacked in Chrome developer mode
2. **Navigate**: Go to any Amazon orders page
3. **Configure**: Access advanced settings for your workflow
4. **Download**: Click and watch the professional system handle everything
5. **Process**: Use exported JSON for automated invoice processing

## Development Guidelines

### ⚠️ **Important: Development Workflow**
- **Edit source files only** in the root directory (`popup.js`, `options.css`, etc.)
- **Never edit files in `dist/`** - they are auto-generated
- **Always run `npm run package`** after source changes
- **Deploy from `dist/`** directory only

### Why This Matters
- `dist/` files are overwritten during builds
- Source files are the single source of truth
- Ensures consistent deployment packages
- Maintains development best practices

## Installation

### Option 1: Install Production Version (Recommended)

1. Locate the `amazon-invoice-extractor-ready` folder in your home directory (`/Users/[your-username]/amazon-invoice-extractor-ready`)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `amazon-invoice-extractor-ready` folder
5. The extension will be installed and ready to use

### Option 2: Install Development Version

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `amazon-invoice-extractor` folder
5. The extension will be installed and ready to use

## Usage

### Regular Invoice Downloads

1. Navigate to your Amazon orders page (https://www.amazon.com/your-orders or equivalent for other marketplaces)
2. Click the extension icon in your browser toolbar
3. Select your account type (Business/Consumer) if not auto-detected
4. Choose start and end dates for the invoice range
5. Click "Download" to start the process
6. Monitor progress and wait for completion

### Coordinated Multi-Marketplace Downloads

1. Navigate to any Amazon orders page (https://www.amazon.com/your-orders or equivalent)
2. Click the extension icon and access the settings/options page
3. Enable the marketplaces you want to download from (US, DE, FR, UK, NL, IT, ES, CA, JP)
4. Return to the main popup and select "Coordinated Download" mode
5. Choose start and end dates for the invoice range
6. Click "Start Coordinated Download" to begin parallel processing across all enabled marketplaces
7. Monitor progress across all marketplaces with real-time status updates
8. The system will automatically handle rate limiting and error recovery for each marketplace

### Tax Invoice Downloads (Seller Central)

1. Navigate to Amazon Seller Central Germany (https://sellercentral.amazon.de/)
2. Click the extension icon - it will automatically switch to Tax Invoice mode
3. Select date range for tax invoices
4. Choose between "Open Tax Invoices" (opens in browser tabs) or "Download Tax Invoices" (direct download)
5. The extension will process all available tax invoices in the selected date range

### Health Check Diagnostics

1. Click the extension icon to open the popup
2. Click "Run Health Check" to perform pre-flight diagnostics
3. The system will check:
   - Network connectivity and speed
   - Extension permissions
   - User authentication status
   - Available storage space
   - Download directory writability
   - Browser compatibility
4. Review any issues found and follow recommended fixes
5. Only proceed with downloads when all checks pass

### Settings

1. Click the settings icon (gear) in the extension popup
2. Access additional configuration options including:
   - Marketplace selection for coordinated downloads
   - Bandwidth profile settings
   - Notification preferences
   - File organization templates
   - Advanced queue management settings

## Download Modes

The extension supports three different storage destinations to fit your workflow needs:

### 💾 Local Downloads Only

- **Files saved to**: `Downloads/Amazon-DE/Session_XXX/YYYY-MM_Month/`
- **Best for**: Privacy, offline access, no cloud needed
- **Setup**: No authentication required
- **Use case**: Personal use, local accounting software, maximum privacy

### ☁️ Google Drive Only

- **Files saved to**: `Google Drive/Amazon_Invoices/Amazon-DE/Session_XXX/YYYY-MM_Month/`
- **Best for**: Accounting workflows, team sharing, automatic backup
- **Setup**: Requires Google account authorization (one-time OAuth)
- **Use case**: Professional accounting, shared team access, cloud backup

### 💾 + ☁️ Both (Default)

- **Files saved to both locations** simultaneously
- **Best for**: Maximum redundancy, backup strategy
- **Setup**: Google account authorization recommended
- **Use case**: Critical business documents, maximum data safety, hybrid workflows

### Choosing Your Mode

- **Privacy First**: Use Local Only mode
- **Collaboration**: Use Drive Only mode for team access
- **Maximum Safety**: Use Both mode for critical documents
- **Switch anytime**: Change modes in extension settings without losing data

## Supported Amazon Domains

- Amazon US: `amazon.com`
- Amazon Germany: `amazon.de`
- Amazon Netherlands: `amazon.nl`
- Amazon France: `amazon.fr`
- Amazon UK: `amazon.co.uk`
- Amazon Italy: `amazon.it`
- Amazon Spain: `amazon.es`
- Amazon Canada: `amazon.ca`
- Amazon Japan: `amazon.jp`
- Amazon Seller Central Germany: `sellercentral.amazon.de`

## Permissions

The extension requires the following permissions:

- `activeTab`: Access the currently active tab
- `storage`: Store user preferences, marketplace settings, and download history
- `downloads`: Download invoice files to your computer
- `tabs`: Manage browser tabs for multi-marketplace processing
- `scripting`: Inject content scripts for invoice extraction
- `notifications`: Display progress updates and completion alerts
- Host permissions for all supported Amazon domains

## Recent Updates

### v2.0.1 - Critical Pagination Fix (December 2025)
- **🔴 FIXED**: Fatal pagination bug where DOM elements were lost across page reloads
- **✅ IMPROVED**: Multi-page invoice collection now works reliably across hundreds of pages
- **⚡ ENHANCED**: Download preparation happens immediately instead of after all pages are collected
- **🎯 RESULT**: No more incomplete downloads when collecting orders from multiple pages

### v2.1.0 - Google Drive Integration Release
- Complete rewrite with Manifest V3 support
- Multi-marketplace coordinated downloads
- Advanced bandwidth adaptation
- Professional download history dashboard
- Enterprise-grade health checking system

### Version Changes (Legacy)
- **Removed License System**: Extension now works without any license requirements
- **Fixed Content Script Loading**: Resolved "Receiving end does not exist" errors
- **Improved UI**: Modern HTML structure with proper CSS class matching
- **Enhanced Error Handling**: Better fallback mechanisms for reliability
- **Defensive Content Script**: Graceful handling when utilities aren't loaded yet

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension standards
- **Content Scripts**: Injected into Amazon pages to extract invoice data
- **Background Service Worker**: Handles downloads and coordination
- **Popup Interface**: User-friendly interface for configuration and control
- **Defensive Loading**: Content scripts handle missing utilities gracefully
- **Bandwidth Manager**: Adaptive download behavior based on network conditions
- **Health Checker**: Pre-flight diagnostics and system validation
- **Marketplace Coordinator**: Multi-marketplace parallel processing

### File Structure

- `manifest.json`: Extension configuration and permissions
- `popup.html/popup.js/popup.css`: Main user interface
- `options.html/options.js/options.css`: Advanced settings and configuration
- `content.js`: Core invoice extraction logic
- `businessInvoices.js`: Business account specific functionality
- `nonBusinessInvoices.js`: Consumer account specific functionality
- `taxInvoices.js`: Seller Central tax invoice handling
- `pdfDownloader.js`: PDF download management
- `common.js`: Shared utilities and marketplace configurations
- `background.js`: Background service worker and coordination
- `handlers/`: Specialized invoice handlers
  - `BusinessInvoiceHandler.js`: Advanced business invoice processing
- `utils/`: Professional utility classes
  - `BandwidthManager.js`: Network condition monitoring and adaptation
  - `DOMQueryHelper.js`: Robust DOM querying with fallbacks
  - `DownloadQueue.js`: Advanced queue management and rate limiting
  - `ErrorHandler.js`: Comprehensive error handling and recovery
  - `FileOrganizer.js`: Smart file naming and organization
  - `HealthChecker.js`: Pre-flight diagnostics system
  - `HistoryManager.js`: Download session tracking and analytics
  - `MarketplaceCoordinator.js`: Multi-marketplace parallel processing
  - `MetadataManager.js`: Sidecar file generation and management
  - `NotificationManager.js`: User notification system
  - `ScriptLoader.js`: Dynamic content script loading

## Troubleshooting

### Download Not Starting
- Ensure you're on a supported Amazon orders page
- Try refreshing the page and attempting again
- Check browser console for any error messages

### Content Script Issues
- The extension will automatically attempt to reload content scripts if needed
- Manual page refresh may be required in some cases
- Check browser console for "Amazon Invoice Downloader content script loaded" message

### Extension Not Working
- Run the Health Check diagnostics first to identify specific issues
- Try reloading the extension in `chrome://extensions/`
- Clear browser cache and try again
- Check that you're using the `amazon-invoice-extractor-ready` folder for installation
- Verify all required permissions are granted

## Privacy & Security

- No personal data or user information is collected or stored
- No external servers or APIs are contacted
- All processing happens locally in your browser
- Downloads go directly from Amazon to your computer
- Completely free and open source

## Support

For support, license issues, or feature requests, please contact the developer.

## License

This extension is free and open source software. You are free to use, modify, and distribute it as needed.
