/**
 * Query context for placeholder resolution
 */
export interface QueryContext {
  filePath?: string;
  fileName?: string;
  folder?: string;
  root?: string;
}

/**
 * Placeholder resolver for query strings
 * Supports dynamic placeholders like {{query.file.folder}}
 */
export class PlaceholderResolver {
  /**
   * Resolve all placeholders in a query string
   */
  resolve(query: string, context: QueryContext): string {
    if (!query) return query;
    
    const replacements = this.buildReplacements(context);
    
    let resolved = query;
    for (const [placeholder, value] of Object.entries(replacements)) {
      // Check if placeholder exists in query before creating regex
      if (query.includes(placeholder)) {
        // Create regex only when needed
        const regex = new RegExp(this.escapeRegex(placeholder), 'g');
        resolved = resolved.replace(regex, value);
      }
    }
    
    return resolved;
  }
  
  /**
   * Check if a query string contains placeholders
   */
  hasPlaceholders(query: string): boolean {
    return /\{\{query\.[^}]+\}\}/.test(query);
  }
  
  /**
   * Extract all placeholders from a query string
   */
  extractPlaceholders(query: string): string[] {
    const matches = query.match(/\{\{query\.[^}]+\}\}/g);
    return matches ? [...new Set(matches)] : [];
  }
  
  /**
   * Build replacement map from context
   */
  private buildReplacements(context: QueryContext): Record<string, string> {
    const filePath = context.filePath || '';
    
    return {
      '{{query.file.path}}': filePath,
      '{{query.file.folder}}': context.folder || this.getFolderFromPath(filePath),
      '{{query.file.name}}': context.fileName || this.getFileNameFromPath(filePath),
      '{{query.file.root}}': context.root || this.getRootFromPath(filePath),
    };
  }
  
  /**
   * Extract folder from file path
   */
  private getFolderFromPath(path: string): string {
    if (!path) return '';
    const parts = path.split('/');
    if (parts.length <= 1) return '';
    return parts.slice(0, -1).join('/');
  }
  
  /**
   * Extract file name from file path
   */
  private getFileNameFromPath(path: string): string {
    if (!path) return '';
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  }
  
  /**
   * Extract root folder from file path
   */
  private getRootFromPath(path: string): string {
    if (!path) return '';
    const parts = path.split('/');
    return parts[0] || '';
  }
  
  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Singleton instance for easy access
 */
export const placeholderResolver = new PlaceholderResolver();
