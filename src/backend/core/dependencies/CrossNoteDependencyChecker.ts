// @ts-nocheck
import type { Task, CrossNoteDependency, DependencyCondition } from '@backend/core/models/Task';
import type { SiYuanApiAdapter } from '@backend/core/api/SiYuanApiAdapter';

/**
 * Result of a dependency check
 */
export interface DependencyCheckResult {
  dependencyId: string;
  isMet: boolean;
  lastChecked: string;
  error?: string;
}

/**
 * Cross-Note Dependency Checker
 * Evaluates dependencies on other SiYuan notes and blocks
 */
export class CrossNoteDependencyChecker {
  constructor(private siyuanAPI: SiYuanApiAdapter) {}

  /**
   * Check if a single dependency is met
   */
  async checkDependency(dep: CrossNoteDependency): Promise<boolean> {
    try {
      switch (dep.type) {
        case 'blockExists':
          return await this.checkBlockExists(dep);
        
        case 'blockContent':
          return await this.checkBlockContent(dep);
        
        case 'noteAttribute':
          return await this.checkNoteAttribute(dep);
        
        case 'tagPresence':
          return await this.checkTagPresence(dep);
        
        case 'backlinks':
          return await this.checkBacklinks(dep);
        
        default:
          return false;
      }
    } catch (error) {
      console.error(`Error checking dependency ${dep.id}:`, error);
      return false;
    }
  }

  /**
   * Check all dependencies for a task
   */
  async checkAllDependencies(task: Task): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    if (!task.crossNoteDependencies || task.crossNoteDependencies.length === 0) {
      return results;
    }

    for (const dep of task.crossNoteDependencies) {
      const isMet = await this.checkDependency(dep);
      results.set(dep.id, isMet);
      
      // Update dependency status
      dep.status = isMet ? 'met' : 'unmet';
      dep.lastChecked = new Date().toISOString();
    }

    return results;
  }

  /**
   * Watch dependencies and trigger callback when they change
   * Note: This is a simplified implementation. Real-time watching would require
   * SiYuan's event system or polling.
   */
  watchDependencies(
    task: Task,
    callback: (status: Map<string, boolean>) => void
  ): () => void {
    // Poll every 30 seconds
    const intervalId = setInterval(async () => {
      const status = await this.checkAllDependencies(task);
      callback(status);
    }, 30000);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }

  /**
   * Suggest dependencies based on task content
   * This is a simplified implementation - could be enhanced with NLP
   */
  async suggestDependencies(task: Task): Promise<CrossNoteDependency[]> {
    const suggestions: CrossNoteDependency[] = [];

    // If task has a linked block, suggest watching it
    if (task.linkedBlockId) {
      suggestions.push({
        id: this.generateDependencyId(),
        type: 'blockExists',
        target: { blockId: task.linkedBlockId },
        condition: { operator: 'exists' },
        status: 'checking',
        lastChecked: new Date().toISOString()
      });
    }

    // Extract block references from task name or description
    const blockRefs = this.extractBlockReferences(task.name + ' ' + (task.description || ''));
    for (const blockId of blockRefs) {
      suggestions.push({
        id: this.generateDependencyId(),
        type: 'blockContent',
        target: { blockId },
        condition: { operator: 'exists' },
        status: 'checking',
        lastChecked: new Date().toISOString()
      });
    }

    return suggestions;
  }

  // Private helper methods

  private async checkBlockExists(dep: CrossNoteDependency): Promise<boolean> {
    if (!dep.target.blockId && !dep.target.notePath) {
      return false;
    }

    // For SiYuan, we'd use the SQL API to check if a block exists
    // This is a placeholder - actual implementation would query SiYuan's database
    try {
      if (dep.target.blockId) {
        // Check if block exists by ID
        return await this.blockExistsById(dep.target.blockId);
      } else if (dep.target.notePath) {
        // Check if note exists by path
        return await this.noteExistsByPath(dep.target.notePath);
      }
    } catch (error) {
      console.error('Error checking block existence:', error);
      return false;
    }

    return false;
  }

  private async checkBlockContent(dep: CrossNoteDependency): Promise<boolean> {
    if (!dep.target.blockId) {
      return false;
    }

    try {
      const content = await this.getBlockContent(dep.target.blockId);
      if (!content) {
        return false;
      }

      return this.evaluateCondition(content, dep.condition);
    } catch (error) {
      console.error('Error checking block content:', error);
      return false;
    }
  }

  private async checkNoteAttribute(dep: CrossNoteDependency): Promise<boolean> {
    if (!dep.target.blockId || !dep.target.attribute) {
      return false;
    }

    try {
      const attrValue = await this.getBlockAttribute(dep.target.blockId, dep.target.attribute);
      if (attrValue === null) {
        return false;
      }

      return this.evaluateCondition(attrValue, dep.condition);
    } catch (error) {
      console.error('Error checking note attribute:', error);
      return false;
    }
  }

  private async checkTagPresence(dep: CrossNoteDependency): Promise<boolean> {
    if (!dep.target.tag) {
      return false;
    }

    // This would query SiYuan for blocks with the specified tag
    // Placeholder implementation
    return false;
  }

  private async checkBacklinks(dep: CrossNoteDependency): Promise<boolean> {
    if (!dep.target.blockId) {
      return false;
    }

    try {
      const backlinks = await this.getBacklinks(dep.target.blockId);
      const count = backlinks.length;

      if (dep.condition.operator === 'exists') {
        return count > 0;
      } else if (dep.condition.operator === 'greaterThan' && typeof dep.condition.value === 'number') {
        return count > dep.condition.value;
      } else if (dep.condition.operator === 'lessThan' && typeof dep.condition.value === 'number') {
        return count < dep.condition.value;
      } else if (dep.condition.operator === 'equals' && typeof dep.condition.value === 'number') {
        return count === dep.condition.value;
      }

      return false;
    } catch (error) {
      console.error('Error checking backlinks:', error);
      return false;
    }
  }

  private evaluateCondition(value: string, condition: DependencyCondition): boolean {
    const caseSensitive = condition.caseSensitive ?? false;
    const normalizedValue = caseSensitive ? value : value.toLowerCase();
    const normalizedCondValue = caseSensitive 
      ? String(condition.value ?? '')
      : String(condition.value ?? '').toLowerCase();

    switch (condition.operator) {
      case 'exists':
        return !!value;
      
      case 'equals':
        return normalizedValue === normalizedCondValue;
      
      case 'contains':
        return normalizedValue.includes(normalizedCondValue);
      
      case 'greaterThan':
        if (typeof condition.value === 'number') {
          const numValue = parseFloat(value);
          return !isNaN(numValue) && numValue > condition.value;
        }
        return value > String(condition.value ?? '');
      
      case 'lessThan':
        if (typeof condition.value === 'number') {
          const numValue = parseFloat(value);
          return !isNaN(numValue) && numValue < condition.value;
        }
        return value < String(condition.value ?? '');
      
      case 'matches':
        try {
          const regex = new RegExp(String(condition.value ?? ''), caseSensitive ? '' : 'i');
          return regex.test(value);
        } catch {
          return false;
        }
      
      default:
        return false;
    }
  }

  // Placeholder methods for SiYuan API integration
  // These would be implemented using the actual SiYuan API

  private async blockExistsById(blockId: string): Promise<boolean> {
    // Placeholder: Would use SiYuan SQL API: SELECT * FROM blocks WHERE id = ?
    // For now, assume blocks exist if they have valid format
    return blockId.length > 0;
  }

  private async noteExistsByPath(path: string): Promise<boolean> {
    // Placeholder: Would check if a note exists at the given path
    return path.length > 0;
  }

  private async getBlockContent(blockId: string): Promise<string | null> {
    // Placeholder: Would use SiYuan API to get block content
    // In real implementation: SELECT content FROM blocks WHERE id = ?
    return null;
  }

  private async getBlockAttribute(blockId: string, attr: string): Promise<string | null> {
    // Placeholder: Would use SiYuan's custom attributes API
    try {
      // This would call siyuanAPI methods when available
      return null;
    } catch {
      return null;
    }
  }

  private async getBacklinks(blockId: string): Promise<string[]> {
    // Placeholder: Would query SiYuan for all blocks linking to this block
    // In real implementation: SELECT * FROM refs WHERE def_block_id = ?
    return [];
  }

  private extractBlockReferences(text: string): string[] {
    // Extract SiYuan block references in format ((20210101123456-abcdefg))
    const blockRefPattern = /\(\((\d{14}-[a-z0-9]{7})\)\)/g;
    const matches = text.matchAll(blockRefPattern);
    return Array.from(matches, m => m[1]);
  }

  private generateDependencyId(): string {
    return `dep_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
