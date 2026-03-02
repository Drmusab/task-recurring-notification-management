/**
 * Search store for managing search queries and filters
 */
import { writable } from 'svelte/store';
import type { TaskDTO } from '../services/DTOs';

export type SmartFilter = 'today' | 'overdue' | 'high-priority' | 'recurring' | 'no-due-date' | 'completed';

interface SearchState {
  query: string;
  fields: string[];
  activeFilters: Set<SmartFilter>;
}

const initialState: SearchState = {
  query: '',
  fields: ['description', 'tags', 'notes'],
  activeFilters: new Set<SmartFilter>(),
};

const createSearchStore = () => {
  const { subscribe, set, update } = writable<SearchState>(initialState);

  return {
    subscribe,
    setQuery: (query: string) => update(state => ({ ...state, query })),
    setFields: (fields: string[]) => update(state => ({ ...state, fields })),
    toggleFilter: (filter: SmartFilter) => update(state => {
      const newFilters = new Set(state.activeFilters);
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
      } else {
        newFilters.add(filter);
      }
      return { ...state, activeFilters: newFilters };
    }),
    clearFilters: () => update(state => ({ ...state, activeFilters: new Set<SmartFilter>() })),
    clear: () => set(initialState),
  };
};

export const searchStore = createSearchStore();

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
function getTodayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Calculate counts for each filter
 */
export function calculateFilterCounts(tasks: TaskDTO[]): Record<SmartFilter, number> {
  const today = getTodayDateString();
  
  return {
    today: tasks.filter(task => {
      if (!task.dueAt) return false;
      const taskDate = task.dueAt.split('T')[0];
      return taskDate === today;
    }).length,
    overdue: tasks.filter(task => task.isOverdue).length,
    'high-priority': tasks.filter(task => task.priority === 'high' || task.priority === 'highest').length,
    recurring: tasks.filter(task => task.isRecurring).length,
    'no-due-date': tasks.filter(task => !task.dueAt).length,
    completed: tasks.filter(task => task.status === 'done' || task.status === 'completed' || !task.enabled).length,
  };
}
