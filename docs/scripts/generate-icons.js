/**
 * Icon Generation Script
 * Generates SVG icons for the recurring task management plugin
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, '..', 'src', 'assets', 'icons');

// SVG icon templates with consistent stroke width and style
const iconTemplates = {
  navigation: {
    inbox: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3h12v10H2V3z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M2 8h4l1 2h2l1-2h4" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>`,
    },
    today: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M2 6h12" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 2v2M11 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="8" cy="9.5" r="1.5" fill="currentColor"/>
      </svg>`,
    },
    calendar: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M2 6h12" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 2v2M11 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    },
    done: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
    folder: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h5l1.5 2H14v7H2V4z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
      </svg>`,
    },
    search: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M10 10l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    },
    list: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 4h9M4 8h9M4 12h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="2" cy="4" r="0.75" fill="currentColor"/>
        <circle cx="2" cy="8" r="0.75" fill="currentColor"/>
        <circle cx="2" cy="12" r="0.75" fill="currentColor"/>
      </svg>`,
    },
    insights: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M8 9v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M6 12l2 2 2-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
  },
  actions: {
    close: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    },
    check: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8l3 3 7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      20: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
    delay: {
      20: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M10 6v4l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
    skip: {
      20: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 5l8 5-8 5V5zM14 5v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
    save: {
      20: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 4h9l3 3v9H4V4z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
        <path d="M7 4v4h5V4M7 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
    },
    refresh: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8a6 6 0 0111-3.5M14 8a6 6 0 01-11 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M13 1v3.5h-3.5M3 15v-3.5h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      20: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 10a7 7 0 0113-3.5M17 10a7 7 0 01-13 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M16 3v3.5h-3.5M4 17v-3.5h3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
    delete: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9h6V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      20: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 5h12M7 5V4a1 1 0 011-1h4a1 1 0 011 1v1M6 5v11h8V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
    import: {
      20: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 4v9M7 10l3 3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 15v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
    },
  },
  status: {
    warning: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L2 13h12L8 2z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
        <path d="M8 6v3M8 11h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      20: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3L3 16h14L10 3z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>
        <path d="M10 7v4M10 13h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
    },
    trophy: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 3h8v3a4 4 0 01-8 0V3z" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M8 9v3M6 12h4M4 3H2v1a2 2 0 002 2M12 3h2v1a2 2 0 01-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    },
    streak: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2C6 4 5 6 5 8c0 1.657 1.343 3 3 3s3-1.343 3-3c0-2-1-4-3-6zM8 11c-.5.5-1 1-1 1.5 0 .552.448 1 1 1s1-.448 1-1c0-.5-.5-1-1-1.5z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
      </svg>`,
    },
    clock: {
      16: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="9" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M8 6v3l2 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M6 2h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    },
  },
  features: {
    suggestion: {
      24: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="10" r="4" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M12 14v6M9 18l3 2 3-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
    analytics: {
      24: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 20V10M12 20V4M20 20v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
    },
    consolidate: {
      24: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M4 9h16M9 4v16" stroke="currentColor" stroke-width="2"/>
      </svg>`,
    },
    delegate: {
      24: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="16" cy="10" r="2.5" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M3 18v-1a4 4 0 014-4h4a4 4 0 014 4v1M14 18v-1a3 3 0 013-3h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
    },
  },
};

// Create icon files
function generateIcons() {
  console.log('Generating SVG icons...\n');

  Object.entries(iconTemplates).forEach(([category, icons]) => {
    const categoryDir = path.join(ICONS_DIR, category);
    
    // Ensure directory exists
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    Object.entries(icons).forEach(([name, sizes]) => {
      Object.entries(sizes).forEach(([size, svg]) => {
        const filename = `${category}-${name}-${size}.svg`;
        const filepath = path.join(categoryDir, filename);
        
        fs.writeFileSync(filepath, svg.trim());
        console.log(`✓ Created ${category}/${filename}`);
      });
    });
  });

  console.log('\n✅ Icon generation complete!');
  console.log(`📁 Icons saved to: ${ICONS_DIR}`);
}

generateIcons();
