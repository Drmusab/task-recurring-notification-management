/**
 * Task order store for managing drag-and-drop task ordering
 */
import { writable } from 'svelte/store';
import type { TaskDTO } from '../services/DTOs';

interface TaskOrderState {
  orderMap: Map<string, number>; // taskId -> order
}

const initialState: TaskOrderState = {
  orderMap: new Map<string, number>(),
};

const createTaskOrderStore = () => {
  const { subscribe, set, update } = writable<TaskOrderState>(initialState);

  return {
    subscribe,
    setOrder: (taskId: string, order: number) => update(state => {
      const newOrderMap = new Map(state.orderMap);
      newOrderMap.set(taskId, order);
      return { orderMap: newOrderMap };
    }),
    updateOrders: (orders: Map<string, number>) => set({ orderMap: new Map(orders) }),
    clear: () => set(initialState),
    reorder: (tasks: TaskDTO[], fromIndex: number, toIndex: number) => {
      const reordered = [...tasks];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved!);
      
      const newOrderMap = new Map<string, number>();
      reordered.forEach((task, index) => {
        newOrderMap.set(task.id, index);
      });
      
      set({ orderMap: newOrderMap });
      return reordered;
    },
  };
};

export const taskOrderStore = createTaskOrderStore();

/**
 * Assign sequential order to tasks
 */
export function reorderTasks(tasks: TaskDTO[]): TaskDTO[] {
  return tasks.map((task, index) => ({
    ...task,
    order: index,
  }));
}

/**
 * Sort tasks by order field
 */
export function sortTasksByOrder(tasks: TaskDTO[]): TaskDTO[] {
  return [...tasks].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });
}

/**
 * Initialize order for tasks that don't have it
 */
export function initializeTaskOrder(tasks: TaskDTO[]): TaskDTO[] {
  return tasks.map((task, index) => ({
    ...task,
    order: task.order ?? index,
  }));
}
