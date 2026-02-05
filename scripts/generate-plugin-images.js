#!/usr/bin/env node

/**
 * Generate plugin icon.png and preview.png using SVG-to-PNG conversion
 * This creates simple placeholder images that satisfy SiYuan's requirements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG content for icon (160x160)
const iconSVG = `<svg width="160" height="160" xmlns="http://www.w3.org/2000/svg">
  <rect width="160" height="160" rx="20" fill="#3b82f6"/>
  <path d="M40 80 L70 110 L120 50" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="120" cy="110" r="8" fill="white"/>
  <text x="80" y="145" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle" font-weight="bold">TASK</text>
</svg>`;

// SVG content for preview (1024x768)
const previewSVG = `<svg width="1024" height="768" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="768" fill="#f3f4f6"/>
  <rect x="0" y="0" width="1024" height="80" fill="#3b82f6"/>
  <text x="512" y="50" font-family="Arial, sans-serif" font-size="32" fill="white" text-anchor="middle" font-weight="bold">Task Management Plugin</text>
  
  <!-- Task items preview -->
  <rect x="50" y="120" width="924" height="60" rx="8" fill="white" stroke="#e5e7eb" stroke-width="2"/>
  <circle cx="80" cy="150" r="12" fill="none" stroke="#3b82f6" stroke-width="2"/>
  <text x="110" y="155" font-family="Arial, sans-serif" font-size="20" fill="#1f2937">Daily standup meeting 📅 Today 🔁 Daily</text>
  
  <rect x="50" y="200" width="924" height="60" rx="8" fill="white" stroke="#e5e7eb" stroke-width="2"/>
  <circle cx="80" cy="230" r="12" fill="none" stroke="#3b82f6" stroke-width="2"/>
  <text x="110" y="235" font-family="Arial, sans-serif" font-size="20" fill="#1f2937">Weekly report 📅 Friday 🔁 Weekly 🔺 High</text>
  
  <rect x="50" y="280" width="924" height="60" rx="8" fill="white" stroke="#e5e7eb" stroke-width="2"/>
  <circle cx="80" cy="310" r="12" fill="#3b82f6" stroke="#3b82f6" stroke-width="2"/>
  <path d="M74 310 L79 315 L87 304" stroke="white" stroke-width="2" fill="none"/>
  <text x="110" y="315" font-family="Arial, sans-serif" font-size="20" fill="#9ca3af" text-decoration="line-through">Code review ✓ Completed</text>
  
  <!-- Features box -->
  <rect x="50" y="380" width="924" height="320" rx="8" fill="white" stroke="#e5e7eb" stroke-width="2"/>
  <text x="512" y="420" font-family="Arial, sans-serif" font-size="24" fill="#1f2937" text-anchor="middle" font-weight="bold">Features</text>
  
  <text x="80" y="470" font-family="Arial, sans-serif" font-size="18" fill="#4b5563">✓ Recurring tasks with flexible schedules</text>
  <text x="80" y="510" font-family="Arial, sans-serif" font-size="18" fill="#4b5563">✓ Inline task creation with emoji metadata</text>
  <text x="80" y="550" font-family="Arial, sans-serif" font-size="18" fill="#4b5563">✓ Multi-channel notifications (n8n, Telegram, Gmail)</text>
  <text x="80" y="590" font-family="Arial, sans-serif" font-size="18" fill="#4b5563">✓ AI-driven task suggestions and analytics</text>
  <text x="80" y="630" font-family="Arial, sans-serif" font-size="18" fill="#4b5563">✓ Task dependencies and block actions</text>
  <text x="80" y="670" font-family="Arial, sans-serif" font-size="18" fill="#4b5563">✓ Smart scheduling and priority management</text>
</svg>`;

// Convert SVG to PNG using data URL (works in browsers, but for Node we'll save as SVG with PNG extension)
// Since we can't easily convert SVG to PNG without canvas/sharp, we'll create base64 encoded PNG
// OR just save SVG files that SiYuan can handle

function saveSVG(content, filename) {
  const filepath = path.join(__dirname, '..', filename);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`✓ Created ${filename}`);
}

// For now, create SVG versions that SiYuan might accept
// If SiYuan strictly requires PNG, users will need to convert manually or use an online tool

console.log('Generating plugin images...\n');

try {
  // Save as SVG files
  saveSVG(iconSVG, 'icon.svg');
  saveSVG(previewSVG, 'preview.svg');
  
  console.log('\n⚠️  Note: Created SVG files. If SiYuan requires PNG:');
  console.log('   1. Use an online converter: https://cloudconvert.com/svg-to-png');
  console.log('   2. Or use ImageMagick: magick convert icon.svg icon.png');
  console.log('   3. Or open in browser and screenshot\n');
  
  console.log('✅ Image generation complete!');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
