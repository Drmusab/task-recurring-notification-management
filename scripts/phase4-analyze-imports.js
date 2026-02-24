/**
 * Phase 4: Import Standardization Analysis Script
 * 
 * Analyzes relative imports and suggests conversions to path aliases
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

// Path alias mappings from tsconfig.json
const PATH_ALIASES = {
  '@backend/': 'src/backend/',
  '@frontend/': 'src/frontend/',
  '@shared/': 'src/shared/',
  '@infrastructure/': 'src/infrastructure/',
  '@components/': 'src/frontend/components/',
  '@stores/': 'src/frontend/stores/',
  '@modals/': 'src/frontend/modals/',
  '@domain/': 'src/domain/',
};

/**
 * Get all TypeScript files recursively
 */
function getAllTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, dist, etc.
      if (!['node_modules', 'dist', '.git'].includes(file)) {
        getAllTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Extract imports from a file
 */
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports = [];
  
  lines.forEach((line, index) => {
    // Match: import ... from '../path' or import ... from './path'
    const match = line.match(/import\s+(?:type\s+)?(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"](\.\.?\/[^'"]+)['"]/);
    if (match) {
      imports.push({
        line: index + 1,
        fullLine: line.trim(),
        importPath: match[1],
      });
    }
  });
  
  return imports;
}

/**
 * Resolve relative import to absolute path
 */
function resolveImportPath(filePath, importPath) {
  const fileDir = path.dirname(filePath);
  const resolved = path.resolve(fileDir, importPath);
  
  // Convert to forward slashes and make relative to project root
  let relativePath = path.relative(PROJECT_ROOT, resolved).replace(/\\/g, '/');
  
  // Remove .ts extension if present
  relativePath = relativePath.replace(/\.ts$/, '');
  
  return relativePath;
}

/**
 * Suggest path alias for an import
 */
function suggestAlias(resolvedPath) {
  for (const [alias, prefix] of Object.entries(PATH_ALIASES)) {
    if (resolvedPath.startsWith(prefix)) {
      const aliasPath = resolvedPath.replace(prefix, alias);
      return aliasPath;
    }
  }
  return null;
}

/**
 * Categorize imports by depth
 */
function categorizeImport(importPath) {
  const depth = (importPath.match(/\.\.\//g) || []).length;
  
  if (depth === 0) {
    return 'same-dir';
  } else if (depth === 1) {
    return 'parent';
  } else if (depth === 2) {
    return 'grandparent';
  } else {
    return 'deep'; // 3+ levels up
  }
}

/**
 * Main analysis
 */
function analyzeImports() {
  console.log('🔍 Phase 4: Import Standardization Analysis\n');
  console.log('Scanning TypeScript files...\n');
  
  const files = getAllTsFiles(SRC_DIR);
  console.log(`Found ${files.length} TypeScript files\n`);
  
  const stats = {
    totalFiles: files.length,
    filesWithRelativeImports: 0,
    totalRelativeImports: 0,
    sameDirImports: 0,
    parentImports: 0,
    grandparentImports: 0,
    deepImports: 0,
    canUseAlias: 0,
    alreadyGood: 0,
  };
  
  const suggestions = [];
  const byCategory = {
    'same-dir': [],
    'parent': [],
    'grandparent': [],
    'deep': [],
  };
  
  files.forEach(file => {
    const imports = extractImports(file);
    
    if (imports.length === 0) {
      return;
    }
    
    stats.filesWithRelativeImports++;
    
    imports.forEach(imp => {
      stats.totalRelativeImports++;
      
      const category = categorizeImport(imp.importPath);
      stats[`${category}Imports`]++;
      
      const resolvedPath = resolveImportPath(file, imp.importPath);
      const alias = suggestAlias(resolvedPath);
      
      const relativePath = path.relative(PROJECT_ROOT, file).replace(/\\/g, '/');
      
      const suggestion = {
        file: relativePath,
        line: imp.line,
        current: imp.importPath,
        resolved: resolvedPath,
        suggested: alias,
        category,
        fullLine: imp.fullLine,
      };
      
      if (alias) {
        stats.canUseAlias++;
        suggestions.push(suggestion);
        byCategory[category].push(suggestion);
      } else {
        stats.alreadyGood++;
      }
    });
  });
  
  // Print statistics
  console.log('📊 Import Statistics:');
  console.log(`├─ Total files: ${stats.totalFiles}`);
  console.log(`├─ Files with relative imports: ${stats.filesWithRelativeImports}`);
  console.log(`└─ Total relative imports: ${stats.totalRelativeImports}\n`);
  
  console.log('📏 Import Depth Distribution:');
  console.log(`├─ Same directory (./)     : ${stats.sameDirImports}`);
  console.log(`├─ Parent directory (../)  : ${stats.parentImports}`);
  console.log(`├─ Grandparent (../../)    : ${stats.grandparentImports}`);
  console.log(`└─ Deep (3+ levels)        : ${stats.deepImports}\n`);
  
  console.log('💡 Standardization Opportunities:');
  console.log(`├─ Can use path alias : ${stats.canUseAlias}`);
  console.log(`└─ Already good       : ${stats.alreadyGood}\n`);
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    statistics: stats,
    suggestions,
    byCategory,
  };
  
  const reportPath = path.join(PROJECT_ROOT, 'analysis', 'phase4-import-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ Detailed report saved to: analysis/phase4-import-analysis.json\n`);
  
  // Generate markdown summary
  generateMarkdownSummary(report);
  
  return report;
}

/**
 * Generate markdown summary
 */
function generateMarkdownSummary(report) {
  let md = '# Phase 4: Import Standardization Analysis Report\n\n';
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  
  md += '## Summary Statistics\n\n';
  md += `- **Total Files:** ${report.statistics.totalFiles}\n`;
  md += `- **Files with Relative Imports:** ${report.statistics.filesWithRelativeImports}\n`;
  md += `- **Total Relative Imports:** ${report.statistics.totalRelativeImports}\n`;
  md += `- **Can Use Path Alias:** ${report.statistics.canUseAlias}\n\n`;
  
  md += '## Import Depth Distribution\n\n';
  md += '| Category | Count | Percentage |\n';
  md += '|----------|-------|------------|\n';
  md += `| Same Directory (./) | ${report.statistics.sameDirImports} | ${((report.statistics.sameDirImports / report.statistics.totalRelativeImports) * 100).toFixed(1)}% |\n`;
  md += `| Parent (../) | ${report.statistics.parentImports} | ${((report.statistics.parentImports / report.statistics.totalRelativeImports) * 100).toFixed(1)}% |\n`;
  md += `| Grandparent (../../) | ${report.statistics.grandparentImports} | ${((report.statistics.grandparentImports / report.statistics.totalRelativeImports) * 100).toFixed(1)}% |\n`;
  md += `| Deep (3+) | ${report.statistics.deepImports} | ${((report.statistics.deepImports / report.statistics.totalRelativeImports) * 100).toFixed(1)}% |\n\n`;
  
  md += '## Top Standardization Candidates\n\n';
  md += '### Deep Imports (3+ levels) - HIGHEST PRIORITY\n\n';
  
  const deepImports = report.byCategory.deep.slice(0, 20);
  if (deepImports.length > 0) {
    md += '```typescript\n';
    deepImports.forEach(s => {
      md += `// ${s.file}:${s.line}\n`;
      md += `// Current:  ${s.current}\n`;
      md += `// Suggested: ${s.suggested}\n\n`;
    });
    md += '```\n\n';
  }
  
  md += '### Grandparent Imports (../../) - MEDIUM PRIORITY\n\n';
  const grandparentImports = report.byCategory.grandparent.slice(0, 10);
  if (grandparentImports.length > 0) {
    md += '```typescript\n';
    grandparentImports.forEach(s => {
      md += `// ${s.file}:${s.line}\n`;
      md += `// ${s.current} → ${s.suggested}\n`;
    });
    md += '```\n\n';
  }
  
  md += '## Recommendations\n\n';
  md += '1. **Prioritize deep imports (3+ levels)** - These are hardest to maintain\n';
  md += '2. **Convert cross-layer imports** - Backend ↔ Frontend, Backend ↔ Domain\n';
  md += '3. **Keep same-directory imports** - `./` imports are fine within a module\n';
  md += '4. **Use path aliases consistently** - Standardize on @backend/, @frontend/, etc.\n\n';
  
  const summaryPath = path.join(PROJECT_ROOT, 'analysis', 'phase4-import-summary.md');
  fs.writeFileSync(summaryPath, md);
  console.log(`📄 Markdown summary saved to: analysis/phase4-import-summary.md\n`);
}

// Run analysis
analyzeImports();

export { analyzeImports, extractImports, suggestAlias };
