import { writable } from 'svelte/store';
import { getSettings, updateSettings } from "@shared/config/Settings";

// This store is to be used by the UI only
export const settingsStore = writable(getSettings());

let isInitialSync = true;
settingsStore.subscribe((settings) => {
    // Skip the initial subscription call to avoid unnecessary writes on mount
    if (isInitialSync) {
        isInitialSync = false;
        return;
    }
    try {
        updateSettings(settings);
    } catch (err) {
        console.error('Failed to persist settings:', err);
    }
});
