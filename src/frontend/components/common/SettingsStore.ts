import { writable } from 'svelte/store';
import { getSettings, updateSettings } from "@shared/config/Settings";

// This store is to be used by the UI only
export const settingsStore = writable(getSettings());

settingsStore.subscribe((settings) => {
    updateSettings(settings);
});
