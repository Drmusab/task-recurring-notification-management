/**
 * Re-export ISettings and defaultSettings from their canonical location.
 * This shim exists because calendar modules import from 'src/settings'.
 */
export { type ISettings, defaultSettings } from "@components/calendar/settings";
