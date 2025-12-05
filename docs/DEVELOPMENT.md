# 🚀 Amazon Invoice Extractor Pro - Development Guide

## Table of Contents
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Build Process](#build-process)
- [Deployment](#deployment)
- [Code Standards](#code-standards)
- [Testing](#testing)

## Development Workflow

### ⚠️ **CRITICAL: Never Edit `dist/` Files Directly**

The `dist/` directory contains **auto-generated files** that will be **overwritten** during builds. Always edit the **source files** in the root directory.

#### ✅ Correct Workflow
```bash
# 1. Edit source files (root directory)
vim popup.js
vim options.css

# 2. Build the extension
npm run package

# 3. Test from dist/
# Load dist/ as unpacked extension in Chrome

# 4. Deploy when ready
npm run deploy
```

#### ❌ Wrong Workflow (Don't Do This)
```bash
# NEVER edit dist files directly!
vim dist/popup.js  # ❌ Bad - will be overwritten
```

### Why This Matters
- **Source Control**: Source files are tracked in git, dist files are not
- **Consistency**: Ensures all deployments use the same build process
- **Collaboration**: Multiple developers work from the same source
- **Debugging**: Source maps and error reporting work correctly

## Project Structure

```
amazon-invoice-extractor/
├── 📁 src/                    # Source files (edit these)
│   ├── popup.js              # Popup UI logic
│   ├── popup.html            # Popup UI markup
│   ├── options.js            # Settings page logic
│   ├── options.html          # Settings page markup
│   ├── content.js            # Content script
│   ├── background.js         # Background service worker
│   └── *.css                 # Stylesheets
├── 📁 dist/                  # 🚫 AUTO-GENERATED (don't edit)
│   ├── popup.js              # Built popup script
│   ├── popup.html            # Built popup markup
│   └── ...                   # All other built files
├── 📁 utils/                 # Utility classes
├── 📁 handlers/              # Specialized handlers
├── 📁 scripts/               # Build scripts
├── 📁 images/                # Extension icons
├── manifest.json             # Extension manifest
├── package.json              # NPM configuration
└── DEVELOPMENT.md            # This file
```

## Build Process

### Available Commands

```bash
# Validate extension files
npm run validate

# Build dist/ from source files
npm run package

# Full deploy (validate + package + instructions)
npm run deploy

# Clean dist/ directory
npm run clean
```

### Build Script Details

The `scripts/package.js` script:
- Copies source files to `dist/`
- Includes only necessary files for the extension
- Creates `version.json` with build metadata
- Validates the package structure

## Deployment

### For Development
```bash
# 1. Build the extension
npm run package

# 2. Load in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the `dist/` folder
```

### For Production
```bash
# 1. Build and validate
npm run deploy

# 2. The deployment ZIP is created:
# amazon-invoice-extractor-pro-v2.0.0.zip

# 3. Upload to Chrome Web Store or distribute manually
```

## Code Standards

### JavaScript
- Use modern ES6+ syntax
- Follow Chrome extension best practices
- Include JSDoc comments for functions
- Use consistent naming conventions

### CSS
- Use CSS custom properties (variables)
- Follow BEM methodology where applicable
- Include responsive design considerations
- Minimize specificity conflicts

### File Organization
- Keep related functionality together
- Use descriptive filenames
- Include file headers with purpose/description

## Testing

### Manual Testing Checklist

#### Basic Functionality
- [ ] Extension loads without errors
- [ ] Popup opens correctly
- [ ] Settings page accessible
- [ ] History page loads

#### Date Filtering
- [ ] Preset buttons work (This Month, Last Month, etc.)
- [ ] Custom date range selection
- [ ] Navigation to correct Amazon URLs

#### Download Process
- [ ] Invoice detection works
- [ ] Queue processing functions
- [ ] Error handling for failed downloads
- [ ] Duplicate detection works

#### Multi-Marketplace
- [ ] Different Amazon domains supported
- [ ] Correct marketplace detection
- [ ] Appropriate URL construction

### Cross-Browser Testing
- [ ] Chrome (primary target)
- [ ] Edge (secondary target)
- [ ] Firefox (if supporting Manifest V3)

## Troubleshooting

### Common Issues

#### "Extension not working"
1. Check console for errors
2. Verify dist/ files are up to date (`npm run package`)
3. Reload extension in chrome://extensions/

#### "Date filtering not working"
1. Check browser network tab for navigation requests
2. Verify URL construction in popup.js
3. Test with different date ranges

#### "Build fails"
1. Run `npm run validate` for detailed errors
2. Check file permissions
3. Ensure all dependencies are installed

## Contributing

1. **Fork** the repository
2. **Create** a feature branch
3. **Edit source files** (never dist/)
4. **Test thoroughly**
5. **Run build process**: `npm run package`
6. **Submit** pull request

## Support

For development questions:
- Check this guide first
- Review existing issues
- Create detailed bug reports
- Include console logs when reporting issues

---

**Remember: Always edit source files, never dist files! 🔒**
