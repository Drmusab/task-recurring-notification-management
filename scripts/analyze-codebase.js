/**
 * Comprehensive Codebase Analysis Script
 * Analyzes imports, exports, dependencies, and unused code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

// Analysis results
const analysis = {
  files: {},
  orphanFiles: [],
  duplicateCandidates: {},
  circularDependencies: [],
  unusedExports: {},
  brokenImports: [],
  frontendBackendConnections: {},
  statistics: {
    totalFiles: 0,
    totalLines: 0,
    backendFiles: 0,
    frontendFiles: 0,
    sharedFiles: 0,
    domainFiles: 0,
  }
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
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        getAllTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.svelte')) {
      // Exclude test files for main analysis
      if (!file.endsWith('.test.ts') && !file.endsWith('.spec.ts')) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

/**
 * Extract imports from a file
 */
function extractImports(content, filePath) {
  const imports = [];
  
  // Match various import patterns
  const importRegex = /import\s+(?:{[^}]+}|[^'"]+)\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  
  let match;
  
  // Standard imports
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      path: match[1],
      type: 'import',
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Dynamic imports
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push({
      path: match[1],
      type: 'dynamic',
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  // Require statements
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push({
      path: match[1],
      type: 'require',
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  return imports;
}

/**
 * Extract exports from a file
 */
function extractExports(content) {
  const exports = [];
  
  // Named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  const exportListRegex = /export\s+{([^}]+)}/g;
  const defaultExportRegex = /export\s+default\s+/g;
  
  let match;
  
  // Named declarations
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: 'named' });
  }
  
  // Export lists
  while ((match = exportListRegex.exec(content)) !== null) {
    const items = match[1].split(',').map(item => {
      const name = item.trim().split(/\s+as\s+/)[0].trim();
      return { name, type: 'named' };
    });
    exports.push(...items);
  }
  
  // Default export
  if (defaultExportRegex.test(content)) {
    exports.push({ name: 'default', type: 'default' });
  }
  
  return exports;
}

/**
 * Resolve import path to absolute file path
 */
function resolveImportPath(importPath, currentFile) {
  // Handle path aliases
  const aliases = {
    '@/': 'src/',
    '@backend/': 'src/backend/',
    '@frontend/': 'src/frontend/',
    '@shared/': 'src/shared/',
    '@infrastructure/': 'src/infrastructure/',
    '@components/': 'src/frontend/components/',
    '@stores/': 'src/frontend/stores/',
    '@hooks/': 'src/frontend/hooks/',
    '@modals/': 'src/frontend/modals/',
    '@views/': 'src/frontend/views/',
    '@domain/': 'src/domain/',
  };
  
  let resolvedPath = importPath;
  
  // Check if it's an alias
  for (const [alias, replacement] of Object.entries(aliases)) {
    if (importPath.startsWith(alias)) {
      resolvedPath = importPath.replace(alias, replacement);
      resolvedPath = path.join(projectRoot, resolvedPath);
      break;
    }
  }
  
  // Relative import
  if (importPath.startsWith('.')) {
    const currentDir = path.dirname(currentFile);
    resolvedPath = path.join(currentDir, importPath);
  }
  
  // Try to resolve with extensions
  const extensions = ['.ts', '.tsx', '.svelte', '/index.ts', '/index.tsx'];
  
  for (const ext of extensions) {
    const testPath = resolvedPath + ext;
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }
  
  // If it's a directory, try index
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    const indexPath = path.join(resolvedPath, 'index.ts');
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }
  
  return null;
}

/**
 * Analyze a single file
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  
  // Extract imports and exports
  const imports = extractImports(content, filePath);
  const exports = extractExports(content);
  
  // Categorize file
  let category = 'other';
  if (relativePath.includes('src/backend/core/')) category = 'backend-core';
  else if (relativePath.includes('src/backend/')) category = 'backend';
  else if (relativePath.includes('src/frontend/')) category = 'frontend';
  else if (relativePath.includes('src/shared/')) category = 'shared';
  else if (relativePath.includes('src/domain/')) category = 'domain';
  else if (relativePath.includes('src/infrastructure/')) category = 'infrastructure';
  
  return {
    path: relativePath,
    absolutePath: filePath,
    category,
    lines,
    imports: imports.map(imp => ({
      ...imp,
      resolved: resolveImportPath(imp.path, filePath)
    })),
    exports,
    importedBy: [], // Will be populated later
  };
}

/**
 * Detect duplicate code patterns
 */
function detectDuplicates(allFiles) {
  const candidates = {};
  
  // Group files with similar names
  for (const file of allFiles) {
    const fileName = path.basename(file.path, path.extname(file.path));
    
    if (!candidates[fileName]) {
      candidates[fileName] = [];
    }
    
    candidates[fileName].push(file.path);
  }
  
  // Filter to only files with duplicates
  const duplicates = {};
  for (const [name, paths] of Object.entries(candidates)) {
    if (paths.length > 1) {
      duplicates[name] = paths;
    }
  }
  
  return duplicates;
}

/**
 * Find orphan files (not imported by anything)
 */
function findOrphanFiles(allFiles) {
  const entryPoints = [
    'src/index.ts',
    'src/frontend/index.ts',
    'src/backend/index.ts',
    'src/backend/core/index.ts'
  ];
  
  return allFiles.filter(file => {
    // Entry points are never orphans
    if (entryPoints.some(ep => file.path.endsWith(ep))) {
      return false;
    }
    
    // Files with no importers are orphans
    return file.importedBy.length === 0;
  }).map(f => f.path);
}

/**
 * Map frontend-backend connections
 */
function mapFrontendBackendConnections(allFiles) {
  const connections = {};
  
  const frontendFiles = allFiles.filter(f => f.category === 'frontend');
  const backendCoreFiles = allFiles.filter(f => f.category === 'backend-core');
  
  for (const frontendFile of frontendFiles) {
    const backendImports = frontendFile.imports.filter(imp => {
      const resolved = imp.resolved;
      return resolved && resolved.includes('backend/core/');
    });
    
    if (backendImports.length > 0) {
      connections[frontendFile.path] = backendImports.map(imp => {
        const resolved = path.relative(projectRoot, imp.resolved || '').replace(/\\/g, '/');
        return resolved;
      });
    }
  }
  
  return connections;
}

/**
 * Main analysis function
 */
function runAnalysis() {
  console.log('🔍 Starting comprehensive codebase analysis...\n');
  
  // Get all TypeScript files
  const allFilePaths = getAllTsFiles(srcDir);
  console.log(`📁 Found ${allFilePaths.length} TypeScript/Svelte files\n`);
  
  // Analyze each file
  console.log('📊 Analyzing files...');
  const allFiles = allFilePaths.map(analyzeFile);
  
  // Build reverse dependency map (who imports whom)
  for (const file of allFiles) {
    for (const imp of file.imports) {
      if (imp.resolved) {
        const importedFile = allFiles.find(f => f.absolutePath === imp.resolved);
        if (importedFile) {
          importedFile.importedBy.push(file.path);
        } else {
          // Broken import
          analysis.brokenImports.push({
            file: file.path,
            import: imp.path,
            line: imp.line
          });
        }
      }
    }
  }
  
  // Store file analysis
  allFiles.forEach(file => {
    analysis.files[file.path] = file;
  });
  
  // Calculate statistics
  analysis.statistics.totalFiles = allFiles.length;
  analysis.statistics.totalLines = allFiles.reduce((sum, f) => sum + f.lines, 0);
  analysis.statistics.backendFiles = allFiles.filter(f => f.category === 'backend' || f.category === 'backend-core').length;
  analysis.statistics.frontendFiles = allFiles.filter(f => f.category === 'frontend').length;
  analysis.statistics.sharedFiles = allFiles.filter(f => f.category === 'shared').length;
  analysis.statistics.domainFiles = allFiles.filter(f => f.category === 'domain').length;
  
  // Detect duplicates
  console.log('🔎 Detecting duplicate file candidates...');
  analysis.duplicateCandidates = detectDuplicates(allFiles);
  
  // Find orphan files
  console.log('🗑️  Finding orphan files...');
  analysis.orphanFiles = findOrphanFiles(allFiles);
  
  // Map frontend-backend connections
  console.log('🔗 Mapping frontend-backend connections...');
  analysis.frontendBackendConnections = mapFrontendBackendConnections(allFiles);
  
  // Write results
  const analysisDir = path.join(projectRoot, 'analysis');
  if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
  }
  
  // Write dependency graph JSON
  fs.writeFileSync(
    path.join(analysisDir, 'dependency-graph.json'),
    JSON.stringify(analysis, null, 2)
  );
  
  // Generate summary report
  generateSummaryReport(analysisDir);
  
  console.log('\n✅ Analysis complete!');
  console.log(`📄 Results saved to: ${analysisDir}`);
}

/**
 * Generate human-readable summary report
 */
function generateSummaryReport(analysisDir) {
  const report = [];
  
  report.push('# Codebase Analysis Report');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');
  
  report.push('## Statistics');
  report.push('');
  report.push(`- **Total Files**: ${analysis.statistics.totalFiles}`);
  report.push(`- **Total Lines of Code**: ${analysis.statistics.totalLines.toLocaleString()}`);
  report.push(`- **Backend Files**: ${analysis.statistics.backendFiles}`);
  report.push(`- **Frontend Files**: ${analysis.statistics.frontendFiles}`);
  report.push(`- **Shared Files**: ${analysis.statistics.sharedFiles}`);
  report.push(`- **Domain Files**: ${analysis.statistics.domainFiles}`);
  report.push('');
  
  report.push('## Orphan Files (Not Imported)');
  report.push('');
  report.push(`Found ${analysis.orphanFiles.length} orphan files:`);
  report.push('');
  analysis.orphanFiles.slice(0, 50).forEach(file => {
    report.push(`- \`${file}\``);
  });
  if (analysis.orphanFiles.length > 50) {
    report.push(`- ... and ${analysis.orphanFiles.length - 50} more`);
  }
  report.push('');
  
  report.push('## Duplicate File Name Candidates');
  report.push('');
  const duplicateCount = Object.keys(analysis.duplicateCandidates).length;
  report.push(`Found ${duplicateCount} files with duplicate names:`);
  report.push('');
  Object.entries(analysis.duplicateCandidates).slice(0, 20).forEach(([name, paths]) => {
    report.push(`### ${name}`);
    paths.forEach(p => report.push(`- \`${p}\``));
    report.push('');
  });
  report.push('');
  
  report.push('## Broken Imports');
  report.push('');
  report.push(`Found ${analysis.brokenImports.length} broken imports:`);
  report.push('');
  analysis.brokenImports.slice(0, 30).forEach(broken => {
    report.push(`- **${broken.file}:${broken.line}** - Cannot resolve \`${broken.import}\``);
  });
  if (analysis.brokenImports.length > 30) {
    report.push(`- ... and ${analysis.brokenImports.length - 30} more`);
  }
  report.push('');
  
  report.push('## Frontend-Backend Connections');
  report.push('');
  const connectionCount = Object.keys(analysis.frontendBackendConnections).length;
  report.push(`Found ${connectionCount} frontend files importing from backend/core:`);
report.push('');
  Object.entries(analysis.frontendBackendConnections).slice(0, 20).forEach(([frontend, backends]) => {
    report.push(`### ${frontend}`);
    backends.forEach(b => report.push(`- \`${b}\``));
    report.push('');
  });
  report.push('');
  
  // Write report
  fs.writeFileSync(
    path.join(analysisDir, 'static-analysis-report.md'),
    report.join('\n')
  );
}

// Run the analysis
runAnalysis();
