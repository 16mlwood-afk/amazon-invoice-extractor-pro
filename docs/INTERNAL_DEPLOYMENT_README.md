# 🚀 Amazon Invoice Extractor Pro v2.1.0 - Internal Deployment

## Overview

This document provides instructions for deploying the Amazon Invoice Extractor Pro extension internally within your organization. The extension has been validated and packaged for enterprise use.

## 📦 Deployment Package

**Location**: `/Users/masonwood/amazon-invoice-extractor/dist/` (696KB)
**Files**: 36 files total
**Version**: 2.1.0
**Build Date**: December 7, 2025

### Package Contents
- ✅ **Extension Core**: manifest.json, popup.*, background.js, content.js
- ✅ **Options Page**: options.html, options.js, options.css
- ✅ **Business Logic**: businessInvoices.js, nonBusinessInvoices.js, pdfDownloader.js
- ✅ **Utilities**: 13 utility modules in utils/
- ✅ **Configuration**: config/, handlers/, state/
- ✅ **Assets**: images/ (icons and logos)
- ✅ **Documentation**: version.json with feature list

## 🛠️ Internal Installation Instructions

### Method 1: Unpacked Extension (Recommended for Development/Testing)

1. **Extract the package** (if using ZIP):
   ```bash
   unzip amazon-invoice-extractor-pro-v2.1.0.zip -d amazon-invoice-extractor-pro
   ```

2. **Open Chrome Developer Mode**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

3. **Load Unpacked Extension**:
   - Click "Load unpacked"
   - Select the `dist/` folder (or extracted folder)
   - Extension appears in extension list

4. **Verify Installation**:
   - Check that extension icon appears in toolbar
   - Click icon to open popup
   - Test basic functionality

### Method 2: Packed Extension (.crx) for Distribution

For wider internal distribution, create a .crx file:

1. **Create CRX package**:
   ```bash
   # Using Chrome's extension developer tools
   # 1. Go to chrome://extensions/
   # 2. Enable Developer mode
   # 3. Click "Pack extension"
   # 4. Select the dist/ folder
   # 5. Choose private key file (create one for your organization)
   ```

2. **Distribute the .crx file**:
   - Share via internal network
   - Users double-click .crx to install
   - Chrome will prompt for installation

## ⚙️ Configuration & Settings

### Extension Settings
Users can access comprehensive settings via:
- **Extension popup** → Settings button (⚙️)
- **Chrome Settings** → Extensions → "Amazon Invoice Extractor Pro" → Details → Extension options

### Available Configuration Options

#### Download Behavior
- **Concurrent Downloads**: 1-10 simultaneous downloads
- **Delay Between Downloads**: 0-3000ms (rate limiting)
- **Skip Duplicates**: Check existing files
- **Auto-retry Failed**: 1-5 retry attempts

#### File Organization
- **Folder Structure**: Flat, by-year, by-month, by-marketplace
- **Base Folder**: Customizable root folder name
- **Filename Template**: Multiple naming patterns

#### Advanced Features
- **Bandwidth Management**: Adaptive speed control
- **Metadata Files**: JSON sidecar files
- **Verbose Logging**: Debug information
- **Session History**: Download tracking

## 🔧 Enterprise Integration

### Group Policy Deployment (Windows)
For organization-wide deployment:

1. **Create .crx file** using Chrome's developer tools
2. **Host on internal server** accessible to all users
3. **Configure Group Policy**:
   ```
   Computer Configuration → Policies → Administrative Templates → Google Chrome → Extensions
   - Enable "Configure the list of force-installed extensions"
   - Add extension ID and update URL
   ```

### macOS MDM Deployment
For managed macOS devices:

1. **Package as .dmg** installer
2. **Use MDM solution** (Jamf, Intune, etc.)
3. **Deploy via device management profile**

### Update Management
- **Automatic Updates**: Host extension on internal server
- **Manual Updates**: Distribute new versions via internal channels
- **Version Tracking**: Check version.json for feature changes

## 📊 Usage Analytics & Monitoring

### Extension Health
- **Built-in Diagnostics**: Health check in popup
- **Error Reporting**: Console logs for troubleshooting
- **Performance Metrics**: Download success rates

### User Activity Tracking
- **Download History**: Per-user session tracking
- **Success Rates**: Automatic calculation
- **Marketplace Usage**: Track which domains used

## 🆘 Troubleshooting & Support

### Common Issues

**Extension Not Loading**:
- Verify Chrome version 88+ (Manifest V3 requirement)
- Check that all files are present in dist/ folder
- Ensure manifest.json is valid

**Download Failures**:
- Check network connectivity to Amazon domains
- Verify user has download permissions
- Review rate limiting settings

**Settings Not Saving**:
- Confirm Chrome storage permissions
- Check for conflicting extensions
- Try clearing extension data

### Debug Mode
Enable verbose logging in extension settings for detailed troubleshooting information.

### Support Resources
- **Health Check**: Built-in diagnostic tool
- **Console Logs**: Chrome DevTools → Console
- **Error Logs**: Automatic error reporting

## 🔒 Security Considerations

### Data Handling
- **No External Servers**: All processing local
- **No Data Collection**: Extension doesn't send data externally
- **Local Storage Only**: Settings stored locally in Chrome

### Permissions Required
- `activeTab`: Access current Amazon page
- `storage`: Save settings and history
- `downloads`: Download invoice files
- `tabs`: Multi-tab management
- `scripting`: Content script injection
- `notifications`: Progress updates

### Network Access
- **Amazon Domains Only**: Restricted to amazon.com and regional variants
- **HTTPS Only**: Secure connections required
- **No External APIs**: Self-contained operation

## 📋 Feature Overview

### Core Features
- 🌍 **9 Marketplace Support**: US, EU, JP Amazon domains
- ⚡ **Queue Management**: Smart download queuing
- 📊 **History Dashboard**: Session tracking and analytics
- 🔔 **Notifications**: Real-time progress updates
- ⚙️ **Options Page**: Comprehensive settings
- 🔍 **Health Checks**: Built-in diagnostics

### Enterprise Benefits
- **Professional UI**: Clean, business-appropriate design
- **Reliability**: Error recovery and retry logic
- **Scalability**: Configurable performance settings
- **Monitoring**: Built-in analytics and reporting
- **Integration**: Export capabilities for accounting software

## 🎯 Next Steps

1. **Test Installation**: Install on test machines
2. **Configure Settings**: Set appropriate defaults for your organization
3. **Distribute Package**: Share with users via preferred method
4. **Monitor Usage**: Track adoption and gather feedback
5. **Plan Updates**: Establish update process for future versions

## 📞 Support Contact

For deployment issues or questions:
- Check this documentation first
- Review extension health check diagnostics
- Enable debug logging for detailed troubleshooting

---

**Ready for internal deployment! 🚀**

The Amazon Invoice Extractor Pro v2.1.0 is packaged and ready for enterprise distribution within your organization.
