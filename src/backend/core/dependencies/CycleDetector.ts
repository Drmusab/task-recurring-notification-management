import { DependencyIndex } from '@backend/core/dependencies/DependencyIndex';

export class CycleDetector {
  constructor(private index: DependencyIndex) {}

  findCycleFrom(taskId: string): string[] {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];

    const dfs = (currentId: string): boolean => {
      visited.add(currentId);
      stack.add(currentId);
      path.push(currentId);

      for (const depId of this.index.getBlockers(currentId)) {
        if (!visited.has(depId)) {
          if (dfs(depId)) {
            return true;
          }
        } else if (stack.has(depId)) {
          const cycleStart = path.indexOf(depId);
          if (cycleStart !== -1) {
            path.splice(0, cycleStart);
          }
          return true;
        }
      }

      path.pop();
      stack.delete(currentId);
      return false;
    };

    if (dfs(taskId)) {
      return [...path];
    }

    return [];
  }

  findCycleForEdge(fromTaskId: string, toTaskId: string): string[] {
    if (fromTaskId === toTaskId) {
      return [fromTaskId, toTaskId];
    }

    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (currentId: string): boolean => {
      visited.add(currentId);
      path.push(currentId);

      if (currentId === fromTaskId) {
        return true;
      }

      for (const nextId of this.index.getBlockers(currentId)) {
        if (visited.has(nextId)) continue;
        if (dfs(nextId)) {
          return true;
        }
      }

      path.pop();
      return false;
    };

    if (dfs(toTaskId)) {
      return [fromTaskId, ...path];
    }

    return [];
  }
}
