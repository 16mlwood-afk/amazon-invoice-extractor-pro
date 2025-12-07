#!/usr/bin/env node

/**
 * Extension Packaging Script
 * Creates a production-ready extension package
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
const VERSION = packageJson.version;

// Files to include in the extension package
const INCLUDE_FILES = [
  // Public assets
  'public/manifest.json',
  'public/images/',

  // UI files (flatten to root)
  { src: 'src/popup/popup.html', dest: 'popup.html' },
  { src: 'src/popup/popup.js', dest: 'popup.js' },
  { src: 'src/popup/popup.css', dest: 'popup.css' },
  { src: 'src/popup/modules/', dest: 'modules/' },
  { src: 'src/popup/styles/', dest: 'styles/' },
  { src: 'src/options/options.html', dest: 'options.html' },
  { src: 'src/options/options.js', dest: 'options.js' },
  { src: 'src/options/options.css', dest: 'options.css' },
  { src: 'src/options/settings.css', dest: 'settings.css' },
  { src: 'src/history/history.html', dest: 'history.html' },
  { src: 'src/history/history.js', dest: 'history.js' },

  // Core scripts
  // Note: All utils files are copied via the 'src/utils/' directory copy below
  { src: 'src/content/helpers.js', dest: 'content/helpers.js' },
  { src: 'src/content/download-manager.js', dest: 'content/download-manager.js' },
  { src: 'src/content/pagination-manager.js', dest: 'pagination-manager.js' },
  { src: 'src/content/order-scraper.js', dest: 'order-scraper.js' },
  { src: 'src/content/content-main.js', dest: 'content-main.js' },
  { src: 'src/background/background.js', dest: 'background.js' },
  'src/businessInvoices.js',
  'src/nonBusinessInvoices.js',
  'src/pdfDownloader.js',
  'src/tax-bundle.js',
  'src/taxInvoices.js',
  'src/common.js',

  // Modules
  { src: 'src/utils/', dest: 'utils/' },
  { src: 'src/managers/', dest: 'managers/' },
  { src: 'src/config/', dest: 'config/' },
  { src: 'src/handlers/', dest: 'handlers/' },
  { src: 'src/state/', dest: 'state/' }
];

// Files to exclude from packaging
const EXCLUDE_PATTERNS = [
  'node_modules/',
  'scripts/',
  'dist/',
  '*.zip',
  '.git/',
  '.DS_Store',
  'package.json',
  'package-lock.json',
  'README.md',
  '*.log',
  '.cursor/',
  'terminals/'
];

function packageExtension() {
  console.log(`📦 Packaging Amazon Invoice Extractor Pro v${VERSION}...`);

  try {
    // Clean dist directory
    if (fs.existsSync(DIST_DIR)) {
      fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });

    // Copy included files
    for (const item of INCLUDE_FILES) {
      let srcPath, destPath, displayName;

      if (typeof item === 'string') {
        // Directory or simple file copy
        srcPath = path.join(ROOT_DIR, item);
        if (item.startsWith('public/')) {
          destPath = path.join(DIST_DIR, item.substring(7));
        } else {
          destPath = path.join(DIST_DIR, item);
        }
        displayName = item;
      } else {
        // Object with custom src/dest mapping
        srcPath = path.join(ROOT_DIR, item.src);
        destPath = path.join(DIST_DIR, item.dest);
        displayName = item.src;
      }

      if (fs.existsSync(srcPath)) {
        if (fs.statSync(srcPath).isDirectory()) {
          copyDirectoryRecursive(srcPath, destPath);
          console.log(`📁 Copied directory: ${displayName}`);
        } else {
          // Ensure destination directory exists for files
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(srcPath, destPath);
          console.log(`📄 Copied file: ${displayName}`);
        }
      } else {
        console.warn(`⚠️  File not found: ${displayName}`);
      }
    }

    // Create version info
    const versionInfo = {
      version: VERSION,
      buildDate: new Date().toISOString(),
      buildId: Date.now().toString(36),
      features: [
        'Multi-marketplace support',
        'Advanced queue management',
        'Download history dashboard',
        'Professional options page',
        'Notification system',
        'Health check diagnostics',
        'Bandwidth management',
        'Settings & preferences',
        'Export session summaries',
        'Metadata sidecar files',
        'Structured logging system',
        'Performance monitoring & metrics',
        'Enhanced debugging capabilities'
      ]
    };

    fs.writeFileSync(path.join(DIST_DIR, 'version.json'), JSON.stringify(versionInfo, null, 2));
    console.log('📋 Created version.json');

    // Validate the packaged extension
    validatePackage();

    console.log('✅ Extension packaged successfully!');
    console.log(`📂 Output directory: ${DIST_DIR}`);
    console.log(`📦 Ready for Chrome Web Store deployment or manual installation`);

  } catch (error) {
    console.error('❌ Packaging failed:', error);
    process.exit(1);
  }
}

function copyDirectoryRecursive(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const items = fs.readdirSync(source);

  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);

    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectoryRecursive(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

function validatePackage() {
  console.log('🔍 Validating package...');

  const manifestPath = path.join(DIST_DIR, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json not found in package');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Validate required fields
  const requiredFields = ['manifest_version', 'name', 'version', 'description', 'permissions', 'host_permissions', 'options_ui'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      throw new Error(`Missing required manifest field: ${field}`);
    }
  }

  // Validate permissions
  const requiredPermissions = ['storage', 'downloads', 'notifications', 'identity', 'tabs'];
  for (const perm of requiredPermissions) {
    if (!manifest.permissions.includes(perm)) {
      throw new Error(`Missing required permission: ${perm}`);
    }
  }

  // Check that all referenced files exist
  const filesToCheck = [
    manifest.action?.default_popup,
    manifest.background?.service_worker,
    ...(manifest.content_scripts?.flatMap(cs => cs.js) || [])
  ].filter(Boolean);

  for (const file of filesToCheck) {
    const filePath = path.join(DIST_DIR, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Referenced file not found: ${file}`);
    }
  }

  console.log('✅ Package validation passed');
}

function createZipArchive() {
  console.log('📦 Skipping ZIP creation (archiver dependency not available)');
  console.log('📦 Use manual ZIP creation or install dependencies for automated packaging');
}

// Run the packaging
try {
  packageExtension();
} catch (error) {
  console.error('❌ Packaging failed:', error);
  process.exit(1);
}
