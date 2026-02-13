/**
 * TagHierarchy - Support for hierarchical tags with inheritance
 * Phase 4: Dependencies + Advanced Query
 * 
 * Handles tags like: #project/work/client-a
 * Supports queries like: tag includes #project/work (matches all subtags)
 */

/**
 * Tag node in hierarchy tree
 */
export interface TagNode {
  name: string;
  fullPath: string;
  parent: TagNode | null;
  children: Map<string, TagNode>;
}

/**
 * Tag hierarchy manager
 */
export class TagHierarchy {
  private root: TagNode;
  private tagIndex: Map<string, TagNode>;
  
  constructor() {
    this.root = {
      name: '',
      fullPath: '',
      parent: null,
      children: new Map(),
    };
    this.tagIndex = new Map();
  }
  
  /**
   * Add a tag to the hierarchy
   * Example: #project/work/client-a → creates nodes for project, work, client-a
   */
  addTag(tagPath: string): TagNode {
    // Remove leading # if present
    const cleanPath = tagPath.startsWith('#') ? tagPath.substring(1) : tagPath;
    
    // Check if already exists
    if (this.tagIndex.has(cleanPath)) {
      return this.tagIndex.get(cleanPath)!;
    }
    
    // Split path
    const parts = cleanPath.split('/').filter(p => p.length > 0);
    if (parts.length === 0) {
      return this.root;
    }
    
    // Build hierarchy
    let current = this.root;
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      if (!current.children.has(part)) {
        const node: TagNode = {
          name: part,
          fullPath: currentPath,
          parent: current,
          children: new Map(),
        };
        current.children.set(part, node);
        this.tagIndex.set(currentPath, node);
      }
      
      current = current.children.get(part)!;
    }
    
    return current;
  }
  
  /**
   * Get tag node by path
   */
  getTag(tagPath: string): TagNode | undefined {
    const cleanPath = tagPath.startsWith('#') ? tagPath.substring(1) : tagPath;
    return this.tagIndex.get(cleanPath);
  }
  
  /**
   * Check if a tag exists
   */
  hasTag(tagPath: string): boolean {
    return this.getTag(tagPath) !== undefined;
  }
  
  /**
   * Get all parent tags (ancestors)
   * Example: #project/work/client-a → [#project, #project/work]
   */
  getAncestors(tagPath: string): string[] {
    const node = this.getTag(tagPath);
    if (!node) return [];
    
    const ancestors: string[] = [];
    let current = node.parent;
    
    while (current && current !== this.root) {
      ancestors.push(`#${current.fullPath}`);
      current = current.parent;
    }
    
    return ancestors.reverse();
  }
  
  /**
   * Get all child tags (descendants)
   * Example: #project → [#project/work, #project/home, #project/work/client-a, ...]
   */
  getDescendants(tagPath: string): string[] {
    const node = this.getTag(tagPath);
    if (!node) return [];
    
    const descendants: string[] = [];
    
    const traverse = (n: TagNode) => {
      for (const child of n.children.values()) {
        descendants.push(`#${child.fullPath}`);
        traverse(child);
      }
    };
    
    traverse(node);
    
    return descendants;
  }
  
  /**
   * Get all tags at a specific level
   */
  getLevel(level: number): string[] {
    const tags: string[] = [];
    
    const traverse = (node: TagNode, currentLevel: number) => {
      if (currentLevel === level && node !== this.root) {
        tags.push(`#${node.fullPath}`);
      }
      
      if (currentLevel < level) {
        for (const child of node.children.values()) {
          traverse(child, currentLevel + 1);
        }
      }
    };
    
    traverse(this.root, 0);
    
    return tags;
  }
  
  /**
   * Get root tags (level 1)
   */
  getRootTags(): string[] {
    return this.getLevel(1);
  }
  
  /**
   * Get all tags in hierarchy
   */
  getAllTags(): string[] {
    return Array.from(this.tagIndex.keys()).map(path => `#${path}`);
  }
  
  /**
   * Check if tagPath matches queryTag (with hierarchy support)
   * Examples:
   * - matchesTag('#project/work', '#project') → true (child of)
   * - matchesTag('#project', '#project/work') → false (parent of)
   * - matchesTag('#project/work', '#project/work') → true (exact)
   */
  matchesTag(tagPath: string, queryTag: string): boolean {
    const cleanTag = tagPath.startsWith('#') ? tagPath.substring(1) : tagPath;
    const cleanQuery = queryTag.startsWith('#') ? queryTag.substring(1) : queryTag;
    
    // Exact match
    if (cleanTag === cleanQuery) {
      return true;
    }
    
    // Check if tagPath is a descendant of queryTag
    return cleanTag.startsWith(`${cleanQuery}/`);
  }
  
  /**
   * Find tags matching a pattern (supports wildcards)
   * Example: #project/star/client matches #project/work/client, #project/home/client
   */
  findTagsMatching(pattern: string): string[] {
    const cleanPattern = pattern.startsWith('#') ? pattern.substring(1) : pattern;
    const regex = new RegExp('^' + cleanPattern.replace(/\*/g, '[^/]+') + '$');
    
    const matches: string[] = [];
    for (const [path] of this.tagIndex) {
      if (regex.test(path)) {
        matches.push(`#${path}`);
      }
    }
    
    return matches;
  }
  
  /**
   * Get tag suggestions for autocomplete
   * Returns tags that start with the given prefix
   */
  getSuggestions(prefix: string, limit: number = 10): string[] {
    const cleanPrefix = prefix.startsWith('#') ? prefix.substring(1) : prefix;
    const suggestions: string[] = [];
    
    for (const [path] of this.tagIndex) {
      if (path.startsWith(cleanPrefix)) {
        suggestions.push(`#${path}`);
        if (suggestions.length >= limit) {
          break;
        }
      }
    }
    
    return suggestions;
  }
  
  /**
   * Build hierarchy from an array of tag paths
   */
  buildFromTags(tags: string[]): void {
    for (const tag of tags) {
      this.addTag(tag);
    }
  }
  
  /**
   * Clear the hierarchy
   */
  clear(): void {
    this.root.children.clear();
    this.tagIndex.clear();
  }
  
  /**
   * Get tree structure (for visualization)
   */
  getTreeStructure(): any {
    const buildTree = (node: TagNode): any => {
      if (node.children.size === 0) {
        return { name: node.name, fullPath: node.fullPath };
      }
      
      return {
        name: node.name,
        fullPath: node.fullPath,
        children: Array.from(node.children.values()).map(child => buildTree(child)),
      };
    };
    
    return Array.from(this.root.children.values()).map(child => buildTree(child));
  }
  
  /**
   * Get tag depth
   */
  getDepth(tagPath: string): number {
    const cleanPath = tagPath.startsWith('#') ? tagPath.substring(1) : tagPath;
    return cleanPath.split('/').length;
  }
  
  /**
   * Get sibling tags (same parent, same level)
   */
  getSiblings(tagPath: string): string[] {
    const node = this.getTag(tagPath);
    if (!node || !node.parent) return [];
    
    const siblings: string[] = [];
    for (const child of node.parent.children.values()) {
      if (child !== node) {
        siblings.push(`#${child.fullPath}`);
      }
    }
    
    return siblings;
  }
  
  /**
   * Merge two tag paths (find common parent)
   * Example: mergeTagPaths('#project/work', '#project/home') → '#project'
   */
  findCommonParent(tagPath1: string, tagPath2: string): string | null {
    const ancestors1 = this.getAncestors(tagPath1);
    const ancestors2 = this.getAncestors(tagPath2);
    
    // Find common ancestors
    for (let i = Math.min(ancestors1.length, ancestors2.length) - 1; i >= 0; i--) {
      if (ancestors1[i] === ancestors2[i]) {
        return ancestors1[i] || null;
      }
    }
    
    return null;
  }
}

/**
 * Extract tags from task description or metadata
 */
export function extractTags(text: string): string[] {
  const tagRegex = /#[a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)*/g;
  const matches = text.match(tagRegex);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Check if any of the task's tags match the query tag (with hierarchy)
 */
export function taskHasTag(taskTags: string[], queryTag: string, hierarchy: TagHierarchy): boolean {
  for (const tag of taskTags) {
    if (hierarchy.matchesTag(tag, queryTag)) {
      return true;
    }
  }
  return false;
}

/**
 * Group tags by level
 */
export function groupTagsByLevel(tags: string[]): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  
  for (const tag of tags) {
    const level = tag.split('/').length;
    if (!groups.has(level)) {
      groups.set(level, []);
    }
    groups.get(level)!.push(tag);
  }
  
  return groups;
}

/**
 * Sort tags hierarchically (parents before children)
 */
export function sortTagsHierarchically(tags: string[]): string[] {
  return tags.sort((a, b) => {
    const cleanA = a.startsWith('#') ? a.substring(1) : a;
    const cleanB = b.startsWith('#') ? b.substring(1) : b;
    
    // If one is a prefix of the other, parent comes first
    if (cleanA.startsWith(`${cleanB}/`)) return 1;
    if (cleanB.startsWith(`${cleanA}/`)) return -1;
    
    // Otherwise, lexicographic sort
    return cleanA.localeCompare(cleanB);
  });
}
