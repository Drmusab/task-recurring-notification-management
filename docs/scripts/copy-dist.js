#!/usr/bin/env node
/**
 * Post-build script to copy dist files to plugin root
 * Required because SiYuan loads plugins from their root directory
 */

import { copyFileSync, cpSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distDir = join(rootDir, 'dist');

console.log('📦 Copying dist files to plugin root...');

try {
  // Copy main files
  copyFileSync(join(distDir, 'index.js'), join(rootDir, 'index.js'));
  console.log('  ✅ index.js');
  
  copyFileSync(join(distDir, 'index.css'), join(rootDir, 'index.css'));
  console.log('  ✅ index.css');
  
  // Copy i18n folder (remove old first)
  const i18nTarget = join(rootDir, 'i18n');
  if (existsSync(i18nTarget)) {
    rmSync(i18nTarget, { recursive: true, force: true });
  }
  cpSync(join(distDir, 'i18n'), i18nTarget, { recursive: true });
  console.log('  ✅ i18n/');
  
  // Copy assets folder if it exists
  const assetsSource = join(distDir, 'assets');
  if (existsSync(assetsSource)) {
    const assetsTarget = join(rootDir, 'assets');
    if (existsSync(assetsTarget)) {
      rmSync(assetsTarget, { recursive: true, force: true });
    }
    cpSync(assetsSource, assetsTarget, { recursive: true });
    console.log('  ✅ assets/');
  }
  
  console.log('✨ Files copied successfully!');
  console.log('   Plugin is ready to load in SiYuan');
} catch (error) {
  console.error('❌ Error copying files:', error);
  process.exit(1);
}
