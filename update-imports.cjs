/**
 * Automated Import Path Updater
 * Updates all old @/ imports to use new path aliases
 */

const fs = require('fs');
const path = require('path');

// Import mapping rules
const mappings = [
  // Backend mappings
  { from: '@/core/', to: '@backend/core/' },
  { from: '@/adapters/', to: '@backend/adapters/' },
  { from: '@/services/', to: '@backend/services/' },
  { from: '@/commands/', to: '@backend/commands/' },
  { from: '@/parser/', to: '@backend/parsers/' },
  { from: '@/recurrence/', to: '@backend/recurrence/' },
  { from: '@/events/', to: '@backend/events/' },
  { from: '@/webhook/', to: '@backend/webhooks/' },
  { from: '@/bulk/', to: '@backend/bulk/' },
  { from: '@/features/', to: '@backend/features/' },
  
  // Shared mappings
  { from: '@/types/', to: '@shared/types/' },
  { from: '@/Config/', to: '@shared/config/' },
  { from: '@/lib/', to: '@shared/utils/lib/' },
  { from: '@/utils/', to: '@shared/utils/misc/' },
  { from: '@/DateTime/', to: '@shared/utils/dateTime/' },
  { from: '@/Task/', to: '@shared/utils/task/' },
  { from: '@/Statuses/', to: '@shared/types/' },
  { from: '@/assets/', to: '@shared/assets/' },
  
  // Frontend mappings
  { from: '@/ui/', to: '@components/common/' },
  { from: '@/shehab/', to: '@modals/' },
  { from: '@/stores/', to: '@stores/' },
  { from: '@/calendar/', to: '@components/calendar/' },
  { from: '@/Visualizations/', to: '@components/analytics/' },
  { from: '@/Renderer/', to: '@frontend/utils/' },
  { from: '@/reminder/', to: '@components/reminders/' },
  { from: '@/src_tracker/', to: '@components/dashboard/' },
  { from: '@/Api/', to: '@frontend/api/' },
  { from: './styles/', to: '@frontend/styles/' },
];

function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    for (const mapping of mappings) {
      const regex = new RegExp(mapping.from.replace(/\//g, '\\/'), 'g');
      if (regex.test(content)) {
        content = content.replace(regex, mapping.to);
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

function walkDirectory(dir, callback) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        walkDirectory(filePath, callback);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.svelte')) {
      callback(filePath);
    }
  }
}

// Run the updater
console.log('Starting import path update...');
let updateCount = 0;

walkDirectory(path.join(__dirname, 'src'), (filePath) => {
  if (updateImportsInFile(filePath)) {
    updateCount++;
  }
});

console.log(`\nComplete! Updated ${updateCount} files.`);
