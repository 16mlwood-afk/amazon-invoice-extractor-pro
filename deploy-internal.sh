#!/bin/bash

# Bison Invoice Manager - Internal Deployment Script
# This script helps with internal distribution of the extension

set -e

# Extract version from package.json
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')

echo "🚀 Bison Invoice Manager v${VERSION} - Internal Deployment"
echo "=========================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in project root directory${NC}"
    echo "Please run this script from the amazon-invoice-extractor directory"
    exit 1
fi

echo -e "${BLUE}📋 Checking build status...${NC}"

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}⚠️  Build directory not found. Running deployment build...${NC}"
    npm run deploy
fi

# Verify build integrity
if [ ! -f "dist/manifest.json" ]; then
    echo -e "${RED}❌ Error: Build incomplete - manifest.json missing${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build verified${NC}"

# Show package information
echo -e "${BLUE}📦 Package Information:${NC}"
echo "  Location: $(pwd)/dist"
echo "  Size: $(du -sh dist | cut -f1)"
echo "  Files: $(find dist -type f | wc -l) files"

ZIP_FILE="bison-invoice-manager-v${VERSION}.zip"
if [ -f "$ZIP_FILE" ]; then
    echo "  ZIP: $(pwd)/$ZIP_FILE ($(du -sh "$ZIP_FILE" | cut -f1))"
fi

echo ""
echo -e "${BLUE}🛠️  Deployment Options:${NC}"
echo "1. Unpacked Extension (Developer Mode)"
echo "2. Create CRX Package"
echo "3. Show Installation Instructions"
echo "4. Exit"

echo ""
read -p "Choose deployment method (1-4): " choice

case $choice in
    1)
        echo -e "${GREEN}📂 Unpacked Extension Deployment${NC}"
        echo ""
        echo "To install as unpacked extension:"
        echo "1. Open Chrome and go to chrome://extensions/"
        echo "2. Enable 'Developer mode' (top-right toggle)"
        echo "3. Click 'Load unpacked'"
        echo "4. Select this directory: $(pwd)/dist"
        echo "5. Extension will appear in your extensions list"
        echo ""
        echo -e "${YELLOW}Note: This method is for testing/development only${NC}"
        ;;
    2)
        echo -e "${GREEN}📦 Creating CRX Package${NC}"
        echo ""
        echo "To create a CRX package for distribution:"
        echo "1. Open Chrome and go to chrome://extensions/"
        echo "2. Enable 'Developer mode'"
        echo "3. Click 'Pack extension'"
        echo "4. Select root directory: $(pwd)/dist"
        echo "5. Choose a private key file (create one for your organization)"
        echo "6. The .crx file will be created in the same directory"
        echo ""
        echo "For organization-wide deployment, use Group Policy or MDM solutions."
        ;;
    3)
        echo -e "${GREEN}📋 Installation Instructions${NC}"
        echo ""
        echo "INTERNAL INSTALLATION GUIDE"
        echo "==========================="
        echo ""
        echo "1. DOWNLOAD THE EXTENSION:"
        echo "   - Get the dist/ folder or $ZIP_FILE"
        echo "   - Extract ZIP if downloaded"
        echo ""
        echo "2. INSTALL IN CHROME:"
        echo "   - Open Chrome browser"
        echo "   - Go to chrome://extensions/"
        echo "   - Enable 'Developer mode' (top-right corner)"
        echo "   - Click 'Load unpacked'"
        echo "   - Select the extracted 'dist' folder"
        echo "   - Extension appears in list"
        echo ""
        echo "3. VERIFY INSTALLATION:"
        echo "   - Check toolbar for extension icon"
        echo "   - Click icon to open popup"
        echo "   - Test on an Amazon page"
        echo ""
        echo "4. CONFIGURE SETTINGS:"
        echo "   - Click settings icon (⚙️) in popup"
        echo "   - Or go to Extension options in chrome://extensions/"
        echo "   - Configure download behavior, folders, etc."
        echo ""
        echo "5. START USING:"
        echo "   - Navigate to Amazon order history"
        echo "   - Click extension icon"
        echo "   - Select date range and download"
        ;;
    4)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Please select 1-4.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ Deployment information provided!${NC}"
echo ""
echo -e "${BLUE}📚 Additional Resources:${NC}"
echo "  - Full documentation: INTERNAL_DEPLOYMENT_README.md"
echo "  - Troubleshooting: Check extension health diagnostics"
echo "  - Support: Review console logs in Chrome DevTools"

echo ""
echo -e "${GREEN}🚀 Ready for internal deployment!${NC}"
