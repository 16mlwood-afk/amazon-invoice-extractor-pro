#!/usr/bin/env node

/**
 * Development Workflow Checker
 * Ensures developers follow proper source/dist file practices
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('🔍 Checking development workflow...');

// Check if dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  console.log('ℹ️  No dist directory found - run "npm run package" first');
  process.exit(0);
}

// Files that should NEVER be edited directly in dist (with their source locations)
const PROTECTED_FILES = [
  { dist: 'popup.js', source: 'src/popup/popup.js' },
  { dist: 'popup.html', source: 'src/popup/popup.html' },
  { dist: 'popup.css', source: 'src/popup/popup.css' },
  { dist: 'options.js', source: 'src/options/options.js' },
  { dist: 'options.html', source: 'src/options/options.html' },
  { dist: 'options.css', source: 'src/options/options.css' },
  { dist: 'settings.css', source: 'src/options/settings.css' },
  { dist: 'content.js', source: 'src/content/content.js' },
  { dist: 'background.js', source: 'src/background/background.js' },
  { dist: 'history.js', source: 'src/history/history.js' },
  { dist: 'history.html', source: 'src/history/history.html' },
  { dist: 'manifest.json', source: 'public/manifest.json' }
];

let hasWarnings = false;

for (const file of PROTECTED_FILES) {
  const distPath = path.join(DIST_DIR, file.dist);
  const sourcePath = path.join(ROOT_DIR, file.source);

  if (fs.existsSync(distPath) && fs.existsSync(sourcePath)) {
    try {
      const distContent = fs.readFileSync(distPath, 'utf8');
      const sourceContent = fs.readFileSync(sourcePath, 'utf8');

      if (distContent !== sourceContent) {
        console.log(`⚠️  WARNING: ${file} differs between source and dist!`);
        console.log(`   Source: ${sourcePath}`);
        console.log(`   Dist: ${distPath}`);
        console.log('   → Run "npm run package" to sync, or check if source needs updating');
        hasWarnings = true;
      }
    } catch (error) {
      console.log(`❌ Error checking ${file}:`, error.message);
    }
  }
}

if (hasWarnings) {
  console.log('');
  console.log('💡 Remember: Edit source files, not dist files!');
  console.log('   Run "npm run package" to sync dist with source');
  return { valid: false, warnings: hasWarnings };
} else {
  console.log('✅ Development workflow looks good!');
  console.log('   Source and dist files are properly synced');
  return { valid: true, warnings: false };
}
