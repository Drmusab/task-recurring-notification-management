/**
 * Fix relative imports - Convert ../ and ./ imports to use new aliases
 */

const fs = require('fs');
const path = require('path');

function getAbsoluteAlias(filePath, relativePath) {
  // Resolve the absolute path
  const dir = path.dirname(filePath);
  const targetPath = path.resolve(dir, relativePath).replace(/\\/g, '/');
  const srcPath = path.resolve(__dirname, 'src').replace(/\\/g, '/');
  
  // Get relative to src
  let relativeToSrc = path.relative(srcPath, targetPath).replace(/\\/g, '/');
  
  // Map to appropriate alias
  if (relativeToSrc.startsWith('backend/')) {
    return '@' + relativeToSrc;
  } else if (relativeToSrc.startsWith('frontend/components/')) {
    return '@components/' + relativeToSrc.substring('frontend/components/'.length);
  } else if (relativeToSrc.startsWith('frontend/stores/')) {
    return '@stores/' + relativeToSrc.substring('frontend/stores/'.length);
  } else if (relativeToSrc.startsWith('frontend/modals/')) {
    return '@modals/' + relativeToSrc.substring('frontend/modals/'.length);
  } else if (relativeToSrc.startsWith('frontend/')) {
    return '@frontend/' + relativeToSrc.substring('frontend/'.length);
  } else if (relativeToSrc.startsWith('shared/')) {
    return '@shared/' + relativeToSrc.substring('shared/'.length);
  }
  
  // Default
  return '@/' + relativeToSrc;
}

function updateRelativeImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    // Match relative imports: from '../something' or from './something'
    const regex = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      matches.push({ full: match[0], path: match[1], index: match.index });
    }
    
    // Replace from end to start to preserve indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const newAlias = getAbsoluteAlias(filePath, m.path);
      const newImport = `from "${newAlias}"`;
      
      content = content.substring(0, m.index) + newImport + content.substring(m.index + m.full.length);
      updated = true;
    }
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath} (${matches.length} imports)`);
      return matches.length;
    }
    return 0;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return 0;
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
console.log('Starting relative import conversion...');
let totalImports = 0;
let filesUpdated = 0;

walkDirectory(path.join(__dirname, 'src'), (filePath) => {
  const count = updateRelativeImports(filePath);
  if (count > 0) {
    filesUpdated++;
    totalImports += count;
  }
});

console.log(`\nComplete! Updated ${filesUpdated} files, converted ${totalImports} imports.`);
