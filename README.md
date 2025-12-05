# Amazon Invoice Extractor Pro v2.0.1

Professional Amazon invoice downloader with multi-marketplace support, advanced queue management, and automated organization.

## 🚀 Features

- **Multi-Marketplace Support**: Works across all Amazon marketplaces (US, UK, DE, FR, IT, NL, etc.)
- **Advanced Queue Management**: Intelligent download queuing with bandwidth adaptation
- **Smart File Organization**: Automatic folder structuring by date and marketplace
- **Download History Dashboard**: Complete session tracking and analytics
- **Professional UI**: Modern, responsive interface with dark/light themes
- **Enterprise Ready**: Robust error handling and health monitoring

## 🔄 Recent Updates

### v2.0.1 - Critical Pagination Fix
- **FIXED**: Fatal pagination bug where DOM elements were lost across page reloads
- **IMPROVED**: Multi-page invoice collection now works reliably across hundreds of pages
- **ENHANCED**: Download preparation happens immediately instead of after all pages are collected
- **RESULT**: No more incomplete downloads when collecting orders from multiple pages

### v2.0.0 - Major Release
- Complete rewrite with Manifest V3 support
- Multi-marketplace coordinated downloads
- Advanced bandwidth adaptation
- Professional download history dashboard
- Enterprise-grade health checking system

## 📁 Project Structure

This project follows a clean, organized structure for maintainability:

```
/
├── src/                          # Source code
│   ├── background/               # Background service worker
│   │   └── background.js
│   ├── content/                  # Content scripts
│   │   └── content.js
│   ├── popup/                    # Extension popup UI
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── options/                  # Options/settings page
│   │   ├── options.html
│   │   ├── options.js
│   │   ├── options.css
│   │   └── settings.css
│   ├── history/                  # Download history page
│   │   ├── history.html
│   │   └── history.js
│   ├── utils/                    # Utility modules
│   │   ├── BandwidthManager.js
│   │   ├── DOMQueryHelper.js
│   │   ├── DownloadQueue.js
│   │   ├── ErrorHandler.js
│   │   ├── FileOrganizer.js
│   │   ├── HealthChecker.js
│   │   ├── HistoryManager.js
│   │   ├── MarketplaceCoordinator.js
│   │   ├── MetadataManager.js
│   │   ├── NotificationManager.js
│   │   └── ScriptLoader.js
│   ├── handlers/                 # Invoice handlers
│   │   └── BusinessInvoiceHandler.js
│   ├── state/                    # State management
│   │   └── DownloadState.js
│   ├── config/                   # Configuration
│   │   └── Config.js
│   ├── businessInvoices.js       # Business account handler
│   ├── nonBusinessInvoices.js    # Consumer account handler
│   ├── pdfDownloader.js          # PDF download utilities
│   ├── tax-bundle.js             # Tax invoice handler
│   ├── taxInvoices.js            # Tax invoice processor
│   └── common.js                 # Shared utilities
├── public/                       # Static assets
│   ├── manifest.json             # Extension manifest
│   └── images/                   # Icons and images
│       ├── icon16.PNG
│       ├── icon48.PNG
│       ├── icon128.PNG
│       ├── logo.png
│       └── settings-icon.png
├── scripts/                      # Build and deployment scripts
│   ├── package.js                # Extension packaging
│   ├── validate.js               # Pre-deployment validation
│   └── check-workflow.js         # Development workflow checks
├── docs/                         # Documentation
│   ├── DEVELOPMENT.md            # Development guide
│   ├── DEPLOYMENT.md             # Deployment instructions
│   └── INTERNAL_DEPLOYMENT_README.md
├── tests/                        # Test files
│   ├── test-history.html
│   └── test-options.html
├── dist/                         # Built extension (generated)
├── package.json
└── README.md
```

## 🛠️ Development

### Prerequisites

- Node.js 16.0.0 or higher
- Chrome browser for testing

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd amazon-invoice-extractor

# Install dependencies (if any)
npm install

# Validate the setup
npm run validate
```

### Development Workflow

1. **Edit source files** in the `src/` directory
2. **Package for testing**:
   ```bash
   npm run package
   ```
3. **Load in Chrome**:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

### Available Scripts

```bash
npm run validate    # Validate extension structure and files
npm run package     # Build extension from source to dist/
npm run deploy      # Full validation + packaging pipeline
npm run clean       # Clean dist/ directory
```

## 📦 Building & Deployment

### Automated Build

```bash
# Validate, package, and prepare for deployment
npm run deploy
```

### Manual Build Steps

```bash
# 1. Validate
npm run validate

# 2. Package
npm run package

# 3. Deploy dist/ folder to Chrome Web Store
```

## 🔧 Architecture

### Core Components

- **Background Service Worker**: Manages downloads and coordinates operations
- **Content Scripts**: Interact with Amazon pages to extract invoice data
- **Popup Interface**: Main user interface for initiating downloads
- **Options Page**: Configuration and settings management
- **History Page**: Download session tracking and analytics

### Key Features

- **Smart Date Detection**: Automatically detects order dates across all Amazon marketplaces
- **Adaptive Queue Management**: Adjusts download speed based on network conditions
- **File Organization**: Creates structured folders by date and marketplace
- **Error Recovery**: Automatic retry logic for failed downloads
- **Progress Tracking**: Real-time download progress and notifications

## 🧪 Testing

Test files are located in the `tests/` directory. Load test pages in Chrome to validate functionality:

- `test-options.html`: Test options page functionality
- `test-history.html`: Test history page functionality

## 📚 Documentation

- **[Development Guide](docs/DEVELOPMENT.md)**: Detailed development setup and guidelines
- **[Deployment Guide](docs/DEPLOYMENT.md)**: Step-by-step deployment instructions
- **[Internal Deployment](docs/INTERNAL_DEPLOYMENT_README.md)**: Internal deployment procedures

## 🤝 Contributing

1. Follow the established project structure
2. Run validation before committing: `npm run validate`
3. Test changes thoroughly across different marketplaces
4. Update documentation as needed

## 📄 License

MIT License - see package.json for details

## 🆘 Support

For issues and questions:
1. Check the documentation in `docs/`
2. Review existing issues
3. Create a new issue with detailed reproduction steps

---

**Built with ❤️ for Amazon sellers and accountants worldwide**
