/**
 * Nested Content Detector
 * Detects if a task has nested content (child items, indented blocks)
 * to prevent accidental data loss when deleting tasks
 */

/**
 * Interface for task line position in document
 */
export interface TaskPosition {
  blockId: string;
  lineNumber: number;
  indentLevel: number;
  content: string;
}

/**
 * Result of nested content detection
 */
export interface NestedContentResult {
  hasNestedContent: boolean;
  nestedItemCount: number;
  nestedBlockTypes: string[];
  nestedContent: string[];
}

/**
 * Check if task has nested list items or indented blocks
 * 
 * This is a critical safety check before deleting a completed task.
 * In SiYuan, tasks can have:
 * - Child list items (indented further)
 * - Nested code blocks
 * - Nested quotes/callouts
 * - Any indented content that would be deleted along with the task
 * 
 * @param taskPosition - Position info of the task
 * @param documentLines - All lines in the document
 * @returns Detection result
 */
export function detectNestedContent(
  taskPosition: TaskPosition,
  documentLines: string[]
): NestedContentResult {
  const { lineNumber, indentLevel } = taskPosition;
  
  const nestedContent: string[] = [];
  const nestedBlockTypes = new Set<string>();
  let nestedItemCount = 0;
  
  // Scan lines after this task
  for (let i = lineNumber + 1; i < documentLines.length; i++) {
    const line = documentLines[i];
    
    // Empty lines don't affect nesting
    if (!line || line.trim() === '') {
      continue;
    }
    
    const currentIndent = getIndentLevel(line);
    
    // If we hit a line at same or lower indent, nesting ends
    if (currentIndent <= indentLevel) {
      break;
    }
    
    // This line is nested under our task
    nestedItemCount++;
    nestedContent.push(line.trim());
    
    // Detect block type
    const blockType = detectBlockType(line.trim());
    if (blockType) {
      nestedBlockTypes.add(blockType);
    }
  }
  
  return {
    hasNestedContent: nestedItemCount > 0,
    nestedItemCount,
    nestedBlockTypes: Array.from(nestedBlockTypes),
    nestedContent,
  };
}

/**
 * Calculate indent level (number of leading tabs/spaces)
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match || !match[1]) return 0;
  
  const whitespace = match[1];
  
  // Count tabs as 4 spaces
  const tabCount = (whitespace.match(/\t/g) || []).length;
  const spaceCount = (whitespace.match(/ /g) || []).length;
  
  return tabCount * 4 + spaceCount;
}

/**
 * Detect type of nested block
 */
function detectBlockType(line: string): string | null {
  // List items
  if (/^[-*+]\s/.test(line)) return 'list-item';
  if (/^\d+\.\s/.test(line)) return 'ordered-list';
  if (/^- \[[ xX]\]\s/.test(line)) return 'task-item';
  
  // Code blocks
  if (/^```/.test(line)) return 'code-block';
  if (/^~~~/.test(line)) return 'code-block';
  
  // Quotes
  if (/^>/.test(line)) return 'blockquote';
  
  // Headings
  if (/^#{1,6}\s/.test(line)) return 'heading';
  
  // Tables
  if (/^\|.+\|/.test(line)) return 'table';
  
  // Default: paragraph
  return 'paragraph';
}

/**
 * Generate human-readable warning message about nested content
 */
export function generateNestedContentWarning(
  result: NestedContentResult,
  taskName: string
): string {
  if (!result.hasNestedContent) {
    return '';
  }
  
  const parts: string[] = [
    `⚠️ Task "${taskName}" has ${result.nestedItemCount} nested item(s).`,
  ];
  
  if (result.nestedBlockTypes.length > 0) {
    parts.push(`Types: ${result.nestedBlockTypes.join(', ')}`);
  }
  
  parts.push('Deleting this task will also delete all nested content.');
  
  return parts.join(' ');
}

/**
 * Check if a task block has child list items (quick check)
 * Optimized version for fast checking without full analysis
 */
export function hasChildListItems(
  taskPosition: TaskPosition,
  documentLines: string[]
): boolean {
  const { lineNumber, indentLevel } = taskPosition;
  
  // Check next line only (most common case)
  if (lineNumber + 1 < documentLines.length) {
    const nextLine = documentLines[lineNumber + 1];
    
    if (nextLine && nextLine.trim()) {
      const nextIndent = getIndentLevel(nextLine);
      
      if (nextIndent > indentLevel) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Parse SiYuan markdown to extract task positions
 * This is a utility function to find all tasks in a document
 */
export function findTaskPositions(documentContent: string): TaskPosition[] {
  const lines = documentContent.split('\n');
  const positions: TaskPosition[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!line) continue;  // Skip undefined lines
    
    // Match task lines (both formats)
    // Format 1: - [ ] Task
    // Format 2: ◻️ Task, ✅ Task, etc.
    const isTaskFormat1 = /^(\s*)- \[[ xX]\]\s/.test(line);
    const isTaskFormat2 = /^(\s*)[◻✅❌⏳🔲]/u.test(line);
    
    if (isTaskFormat1 || isTaskFormat2) {
      positions.push({
        blockId: `task-${i}`, // Placeholder - real implementation would use SiYuan block IDs
        lineNumber: i,
        indentLevel: getIndentLevel(line),
        content: line.trim(),
      });
    }
  }
  
  return positions;
}
