/**
 * Bulk selection store for managing task selections in bulk mode
 */
import { writable, derived } from 'svelte/store';

interface BulkSelectionState {
  enabled: boolean;
  selectedIds: Set<string>;
  lastSelectedIndex?: number;
}

const initialState: BulkSelectionState = {
  enabled: false,
  selectedIds: new Set<string>(),
  lastSelectedIndex: undefined,
};

const createBulkSelectionStore = () => {
  const { subscribe, set, update } = writable<BulkSelectionState>(initialState);

  return {
    subscribe,
    enableBulkMode: () => update(state => ({ ...state, enabled: true })),
    disableBulkMode: () => set(initialState),
    clear: () => set(initialState),
    toggleTask: (taskId: string) => update(state => {
      const newSelectedIds = new Set(state.selectedIds);
      if (newSelectedIds.has(taskId)) {
        newSelectedIds.delete(taskId);
      } else {
        newSelectedIds.add(taskId);
      }
      return { ...state, selectedIds: newSelectedIds };
    }),
    selectAll: (taskIds: string[]) => update(state => ({
      ...state,
      selectedIds: new Set(taskIds),
    })),
    clearSelection: () => update(state => ({
      ...state,
      selectedIds: new Set<string>(),
      lastSelectedIndex: undefined,
    })),
    selectRange: (taskIds: string[], startIndex: number, endIndex: number) => {
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      const rangeIds = taskIds.slice(start, end + 1);
      update(state => ({
        ...state,
        selectedIds: new Set(rangeIds),
        lastSelectedIndex: endIndex,
      }));
    },
    rangeSelect: (startId: string, endId: string, tasks: Array<{id: string}>) => {
      const taskIds = tasks.map(t => t.id);
      const startIndex = taskIds.indexOf(startId);
      const endIndex = taskIds.indexOf(endId);
      
      if (startIndex === -1 || endIndex === -1) return;
      
      const start = Math.min(startIndex, endIndex);
      const end = Math.max(startIndex, endIndex);
      const rangeIds = taskIds.slice(start, end + 1);
      
      update(state => ({
        ...state,
        selectedIds: new Set(rangeIds),
        lastSelectedIndex: endIndex,
      }));
    },
  };
};

export const bulkSelectionStore = createBulkSelectionStore();

// Derived store for selected count
export const selectedCount = derived(bulkSelectionStore, $state => $state.selectedIds.size);
