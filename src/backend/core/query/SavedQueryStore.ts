/**
 * SavedQueryStore - Persistent storage for saved queries
 * Ported from obsidian-tasks Presets system with localStorage backend
 * 
 * Phase 1: Query Enhancement
 */

export interface SavedQuery {
  id: string;
  name: string;
  queryString: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  folder?: string;
  /** Number of times this query has been executed */
  useCount?: number;
  /** Last execution timestamp */
  lastUsedAt?: string;
  /** User-defined color for UI display */
  color?: string;
  /** Pin to top of saved queries list */
  pinned?: boolean;
}

export interface SavedQueryFolder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  /** Emoji icon for visual identification */
  icon?: string;
}

export interface SavedQueryCollection {
  queries: SavedQuery[];
  folders: SavedQueryFolder[];
  /** Schema version for migrations */
  version: number;
}

/**
 * SavedQueryStore manages persistence of saved queries to localStorage
 */
export class SavedQueryStore {
  private static readonly STORAGE_KEY = 'tasks-saved-queries';
  private static readonly CURRENT_VERSION = 1;
  
  /**
   * Load all saved queries from localStorage
   */
  static load(): SavedQuery[] {
    try {
      const collection = this.loadCollection();
      return collection.queries;
    } catch (error) {
      console.error('Failed to load saved queries:', error);
      return [];
    }
  }

  /**
   * Load complete collection (queries + folders)
   */
  static loadCollection(): SavedQueryCollection {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      
      if (!json) {
        return this.createEmptyCollection();
      }
      
      const parsed = JSON.parse(json);
      
      // Handle legacy format (array of queries without version)
      if (Array.isArray(parsed)) {
        return {
          queries: parsed,
          folders: [],
          version: this.CURRENT_VERSION
        };
      }
      
      // Validate structure
      if (!parsed.version || !Array.isArray(parsed.queries)) {
        console.warn('Invalid saved query collection, resetting to empty');
        return this.createEmptyCollection();
      }
      
      return parsed as SavedQueryCollection;
    } catch (error) {
      console.error('Failed to parse saved queries:', error);
      return this.createEmptyCollection();
    }
  }

  /**
   * Save a single query (create or update)
   */
  static save(query: SavedQuery): void {
    const collection = this.loadCollection();
    const existingIndex = collection.queries.findIndex(q => q.id === query.id);
    
    if (existingIndex >= 0) {
      // Update existing
      collection.queries[existingIndex] = {
        ...query,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Create new
      collection.queries.push({
        ...query,
        createdAt: query.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        useCount: 0
      });
    }
    
    this.saveCollection(collection);
  }

  /**
   * Update an existing query (partial update)
   */
  static update(queryId: string, updates: Partial<Omit<SavedQuery, 'id' | 'createdAt'>>): void {
    const collection = this.loadCollection();
    const query = collection.queries.find(q => q.id === queryId);
    
    if (query) {
      // Merge updates while preserving required fields
      Object.assign(query, updates, {
        updatedAt: new Date().toISOString()
      });
      this.saveCollection(collection);
    }
  }

  /**
   * Batch update multiple queries (for reordering, etc.)
   */
  static saveAll(queries: SavedQuery[]): void {
    const collection = this.loadCollection();
    collection.queries = queries.map(q => ({
      ...q,
      updatedAt: new Date().toISOString()
    }));
    this.saveCollection(collection);
  }

  /**
   * Delete a saved query
   */
  static delete(queryId: string): void {
    const collection = this.loadCollection();
    collection.queries = collection.queries.filter(q => q.id !== queryId);
    this.saveCollection(collection);
  }

  /**
   * Get query by ID
   */
  static get(queryId: string): SavedQuery | null {
    const queries = this.load();
    return queries.find(q => q.id === queryId) || null;
  }

  /**
   * Increment use count and update last used timestamp
   */
  static recordUse(queryId: string): void {
    const collection = this.loadCollection();
    const query = collection.queries.find(q => q.id === queryId);
    
    if (query) {
      query.useCount = (query.useCount || 0) + 1;
      query.lastUsedAt = new Date().toISOString();
      query.updatedAt = new Date().toISOString();
      this.saveCollection(collection);
    }
  }

  /**
   * Get queries by folder
   */
  static getByFolder(folderId: string | null): SavedQuery[] {
    const queries = this.load();
    return queries.filter(q => q.folder === folderId);
  }

  /**
   * Search queries by name or description
   */
  static search(searchTerm: string): SavedQuery[] {
    const queries = this.load();
    const term = searchTerm.toLowerCase();
    
    return queries.filter(q => 
      q.name.toLowerCase().includes(term) ||
      (q.description && q.description.toLowerCase().includes(term)) ||
      q.queryString.toLowerCase().includes(term) ||
      (q.tags && q.tags.some(tag => tag.toLowerCase().includes(term)))
    );
  }

  /**
   * Get most recently used queries
   */
  static getRecentlyUsed(limit: number = 5): SavedQuery[] {
    const queries = this.load();
    return queries
      .filter(q => q.lastUsedAt)
      .sort((a, b) => {
        const dateA = new Date(a.lastUsedAt!).getTime();
        const dateB = new Date(b.lastUsedAt!).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
  }

  /**
   * Get most frequently used queries
   */
  static getMostUsed(limit: number = 5): SavedQuery[] {
    const queries = this.load();
    return queries
      .filter(q => q.useCount && q.useCount > 0)
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, limit);
  }

  /**
   * Get pinned queries
   */
  static getPinned(): SavedQuery[] {
    const queries = this.load();
    return queries.filter(q => q.pinned);
  }

  /**
   * Export queries as JSON string
   */
  static export(): string {
    const collection = this.loadCollection();
    return JSON.stringify(collection, null, 2);
  }

  /**
   * Import queries from JSON string (merges with existing)
   */
  static import(json: string, overwrite: boolean = false): { imported: number; skipped: number; errors: string[] } {
    const result = {
      imported: 0,
      skipped: 0,
      errors: [] as string[]
    };
    
    try {
      const imported = JSON.parse(json);
      
      // Handle both collection format and legacy array format
      let importedQueries: SavedQuery[] = [];
      
      if (Array.isArray(imported)) {
        importedQueries = imported;
      } else if (imported.queries && Array.isArray(imported.queries)) {
        importedQueries = imported.queries;
      } else {
        result.errors.push('Invalid import format: expected array of queries or collection object');
        return result;
      }
      
      const collection = this.loadCollection();
      const existingIds = new Set(collection.queries.map(q => q.id));
      
      for (const query of importedQueries) {
        // Validate query
        if (!query.id || !query.name || !query.queryString) {
          result.errors.push(`Invalid query object: ${JSON.stringify(query)}`);
          continue;
        }
        
        if (existingIds.has(query.id) && !overwrite) {
          result.skipped++;
          continue;
        }
        
        if (existingIds.has(query.id) && overwrite) {
          // Replace existing
          const index = collection.queries.findIndex(q => q.id === query.id);
          collection.queries[index] = {
            ...query,
            updatedAt: new Date().toISOString()
          };
        } else {
          // Add new
          collection.queries.push({
            ...query,
            importedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as SavedQuery);
        }
        
        result.imported++;
      }
      
      this.saveCollection(collection);
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
    
    return result;
  }

  /**
   * Duplicate a query with new ID
   */
  static duplicate(queryId: string): SavedQuery | null {
    const original = this.get(queryId);
    if (!original) return null;
    
    const duplicate: SavedQuery = {
      ...original,
      id: this.generateId(),
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useCount: 0,
      lastUsedAt: undefined
    };
    
    this.save(duplicate);
    return duplicate;
  }

  /**
   * Clear all saved queries (with confirmation in UI)
   */
  static clear(): void {
    const collection = this.createEmptyCollection();
    this.saveCollection(collection);
  }

  /**
   * Get statistics about saved queries
   */
  static getStats(): {
    totalQueries: number;
    totalFolders: number;
    totalUses: number;
    averageUsesPerQuery: number;
    oldestQuery: string | null;
    newestQuery: string | null;
  } {
    const collection = this.loadCollection();
    const queries = collection.queries;
    
    const totalUses = queries.reduce((sum, q) => sum + (q.useCount || 0), 0);
    const sorted = [...queries].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    return {
      totalQueries: queries.length,
      totalFolders: collection.folders.length,
      totalUses,
      averageUsesPerQuery: queries.length > 0 ? totalUses / queries.length : 0,
      oldestQuery: sorted[0]?.createdAt || null,
      newestQuery: sorted[sorted.length - 1]?.createdAt || null
    };
  }

  /**
   * Generate unique ID for new queries
   */
  static generateId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new empty query template
   */
  static createTemplate(name: string = 'New Query'): SavedQuery {
    return {
      id: this.generateId(),
      name,
      queryString: '',
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      useCount: 0
    };
  }

  // Folder management

  /**
   * Save a folder
   */
  static saveFolder(folder: SavedQueryFolder): void {
    const collection = this.loadCollection();
    const existingIndex = collection.folders.findIndex(f => f.id === folder.id);
    
    if (existingIndex >= 0) {
      collection.folders[existingIndex] = folder;
    } else {
      collection.folders.push(folder);
    }
    
    this.saveCollection(collection);
  }

  /**
   * Delete a folder (moves queries to root)
   */
  static deleteFolder(folderId: string): void {
    const collection = this.loadCollection();
    
    // Remove folder
    collection.folders = collection.folders.filter(f => f.id !== folderId);
    
    // Move queries to root
    collection.queries.forEach(q => {
      if (q.folder === folderId) {
        q.folder = undefined;
      }
    });
    
    this.saveCollection(collection);
  }

  /**
   * Get all folders
   */
  static getFolders(): SavedQueryFolder[] {
    const collection = this.loadCollection();
    return collection.folders;
  }

  // Private helper methods

  private static saveCollection(collection: SavedQueryCollection): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(collection));
    } catch (error) {
      console.error('Failed to save query collection:', error);
      throw error;
    }
  }

  private static createEmptyCollection(): SavedQueryCollection {
    return {
      queries: [],
      folders: [],
      version: this.CURRENT_VERSION
    };
  }
}
