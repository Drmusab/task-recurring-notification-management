/**
 * Fuzzy Search Utility
 * Provides fuzzy search functionality using Fuse.js
 */

import Fuse from 'fuse.js';
import type { Task } from '@backend/core/models/Task';
import type { SearchField } from '@stores/search.store';

/**
 * Get the weight for a search field
 */
function getFieldWeight(field: SearchField): number {
  const weights: Record<SearchField, number> = {
    description: 0.5,
    tags: 0.3,
    notes: 0.2
  };
  return weights[field] || 0.3;
}

/**
 * Perform fuzzy search on tasks
 * @param tasks Tasks to search
 * @param query Search query
 * @param fields Fields to search in
 * @returns Filtered tasks matching the query
 */
export function fuzzySearchTasks(
  tasks: Task[], 
  query: string, 
  fields: SearchField[]
): Task[] {
  if (!query || query.trim() === '') {
    return tasks;
  }
  
  try {
    // Build Fuse search keys from fields
    const searchKeys = fields.map(field => {
      let key: string;
      switch (field) {
        case 'description':
          key = 'name';
          break;
        case 'tags':
          key = 'tags';
          break;
        case 'notes':
          key = 'description';
          break;
        default:
          key = 'name';
      }
      
      return {
        name: key,
        weight: getFieldWeight(field)
      };
    });
    
    const fuse = new Fuse(tasks, {
      keys: searchKeys,
      threshold: 0.3,
      includeScore: true,
      ignoreLocation: true,
      useExtendedSearch: false
    });
    
    const results = fuse.search(query);
    return results.map(r => r.item);
  } catch (error) {
    // Fallback to simple search if Fuse.js fails
    console.warn('Fuzzy search failed, using simple search:', error);
    return simpleSearchTasks(tasks, query, fields);
  }
}

/**
 * Simple string matching fallback (if Fuse.js fails)
 */
export function simpleSearchTasks(
  tasks: Task[],
  query: string,
  fields: SearchField[]
): Task[] {
  if (!query || query.trim() === '') {
    return tasks;
  }
  
  const lowerQuery = query.toLowerCase();
  
  return tasks.filter(task => {
    for (const field of fields) {
      let value: string | string[] | undefined;
      
      switch (field) {
        case 'description':
          value = task.name;
          break;
        case 'tags':
          value = task.tags;
          break;
        case 'notes':
          value = task.description;
          break;
      }
      
      if (typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      
      if (Array.isArray(value) && value.some(v => v.toLowerCase().includes(lowerQuery))) {
        return true;
      }
    }
    
    return false;
  });
}
