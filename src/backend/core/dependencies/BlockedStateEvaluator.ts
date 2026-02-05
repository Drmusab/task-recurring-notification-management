import { DependencyIndex } from '@backend/core/dependencies/DependencyIndex';

export interface BlockedExplanation {
  taskId: string;
  blockers: string[];
  chains: string[][];
}

export class BlockedStateEvaluator {
  constructor(private index: DependencyIndex) {}

  isBlocked(taskId: string): boolean {
    const blockers = this.index.getBlockers(taskId);
    if (blockers.length === 0) return false;
    return blockers.some((blockerId) => !this.index.isCompleted(blockerId));
  }

  isBlocking(taskId: string): boolean {
    const dependents = this.index.getBlocked(taskId);
    if (dependents.length === 0) return false;
    return dependents.some((dependentId) => !this.index.isCompleted(dependentId));
  }

  explainBlocked(taskId: string, depthLimit = 5): BlockedExplanation {
    const blockers = this.index.getBlockers(taskId);
    const chains: string[][] = [];

    for (const blockerId of blockers) {
      if (this.index.isCompleted(blockerId)) {
        continue;
      }
      const chain = this.buildChain(blockerId, depthLimit);
      chains.push(chain);
    }

    return {
      taskId,
      blockers: blockers.filter((blockerId) => !this.index.isCompleted(blockerId)),
      chains,
    };
  }

  private buildChain(startId: string, depthLimit: number): string[] {
    const chain: string[] = [startId];
    const visited = new Set<string>([startId]);
    let currentId = startId;
    let depth = 0;

    while (depth < depthLimit) {
      const blockers = this.index.getBlockers(currentId).filter((id) => !this.index.isCompleted(id));
      if (blockers.length === 0) break;

      const nextId = blockers[0];
      if (visited.has(nextId)) break;

      chain.push(nextId);
      visited.add(nextId);
      currentId = nextId;
      depth += 1;
    }

    return chain;
  }
}
