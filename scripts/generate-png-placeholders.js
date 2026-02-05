#!/usr/bin/env node

/**
 * Generate plugin icon.png and preview.png
 * Creates minimal 1x1 pixel PNGs as placeholders
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1x1 pixel transparent PNG in base64
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Blue 160x160 PNG with checkmark (base64)
const ICON_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAAACXBIWXMAAAsTAAALEwEAmpwYAAABKUlEQVR4nO3SQREAAAgDILV/52lAnAMvMwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMCLAT+9AAEvPNciAAAAAElFTkSuQmCC';

function generatePNG(base64Data, filename) {
  const filepath = path.join(__dirname, '..', filename);
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);
  console.log(`✓ Created ${filename}`);
}

console.log('Generating plugin PNG images...\n');

try {
  generatePNG(ICON_PNG_BASE64, 'icon.png');
  generatePNG(ICON_PNG_BASE64, 'preview.png'); // Use same image for now
  
  console.log('\n✅ PNG generation complete!');
  console.log('📝 Note: These are minimal placeholder PNGs.');
  console.log('   For better visuals, replace with proper images later.\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
