#!/usr/bin/env node

/**
 * Extension Validation Script
 * Validates the extension before deployment
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function validateExtension() {
  console.log('🔍 Validating Amazon Invoice Extractor Pro...');

  const errors = [];
  const warnings = [];

  // Check development workflow first
  console.log('📋 Checking development workflow...');
  try {
    const workflowCheck = require('./check-workflow.js');
    // workflowCheck handles its own output and returns status
    if (workflowCheck && workflowCheck.valid === false) {
      warnings.push('Development workflow issues detected - run "npm run package" to sync files');
    }
  } catch (error) {
    errors.push('Development workflow check failed: ' + error.message);
  }

  try {
    // Check manifest.json
    console.log('📋 Checking manifest.json...');
    const manifestPath = path.join(PUBLIC_DIR, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      errors.push('manifest.json not found');
    } else {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // Validate manifest structure
      if (manifest.manifest_version !== 3) {
        errors.push('Manifest version must be 3');
      }

      if (!manifest.name || !manifest.version) {
        errors.push('Manifest missing name or version');
      }

      // Check required permissions
      const requiredPerms = ['activeTab', 'storage', 'downloads', 'tabs', 'scripting', 'notifications'];
      const missingPerms = requiredPerms.filter(p => !manifest.permissions?.includes(p));
      if (missingPerms.length > 0) {
        errors.push(`Missing required permissions: ${missingPerms.join(', ')}`);
      }

      // Check content scripts
      if (!manifest.content_scripts || manifest.content_scripts.length === 0) {
        warnings.push('No content scripts defined in manifest');
      }
    }

    // Check essential files
    console.log('📁 Checking essential files...');
    const essentialFiles = [
      ['src/popup/popup.html', 'src/popup/popup.js', 'src/popup/popup.css'],
      ['src/background/background.js'],
      ['src/content/helpers.js', 'src/content/download-manager.js', 'src/content/pagination-manager.js', 'src/content/order-scraper.js', 'src/content/content-main.js'],
      ['src/options/options.html', 'src/options/options.js'],
      ['src/history/history.html', 'src/history/history.js']
    ].flat();

    for (const file of essentialFiles) {
      const filePath = path.join(ROOT_DIR, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`Essential file missing: ${file}`);
      }
    }

    // Check images directory
    console.log('🖼️  Checking images...');
    const imagesDir = path.join(PUBLIC_DIR, 'images');
    if (!fs.existsSync(imagesDir)) {
      errors.push('images/ directory not found');
    } else {
      const requiredImages = ['icon16.PNG', 'icon48.PNG', 'icon128.PNG'];
      for (const image of requiredImages) {
        const imagePath = path.join(imagesDir, image);
        if (!fs.existsSync(imagePath)) {
          warnings.push(`Icon missing: ${image}`);
        }
      }
    }

    // Basic syntax check for main files
    console.log('💻 Basic syntax check...');
    const jsFiles = [
      'src/popup/popup.js',
      'src/background/background.js',
      'src/content/helpers.js',
      'src/content/download-manager.js',
      'src/content/pagination-manager.js',
      'src/content/order-scraper.js',
      'src/content/content-main.js',
      'src/options/options.js',
      'src/history/history.js'
    ];

    for (const jsFile of jsFiles) {
      const filePath = path.join(ROOT_DIR, jsFile);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          // Basic syntax check
          new Function(content.replace(/importScripts/g, '//importScripts'));
        } catch (syntaxError) {
          errors.push(`Syntax error in ${jsFile}: ${syntaxError.message}`);
        }
      }
    }

    // Summary
    console.log('\n📊 Validation Summary:');
    console.log(`❌ Errors: ${errors.length}`);
    console.log(`⚠️  Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(error => console.log(`  • ${error}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    if (errors.length === 0) {
      console.log('\n✅ Validation passed! Extension is ready for deployment.');

      if (warnings.length === 0) {
        console.log('🎉 No warnings - perfect deployment candidate!');
      }
    } else {
      console.log('\n❌ Fix the errors before deploying.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run validation
try {
  validateExtension();
} catch (error) {
  console.error('❌ Validation failed:', error);
  process.exit(1);
}
