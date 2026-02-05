/**
 * This module contains the 1 Plugin depended modules.
 * This was introduced to avoid huge main.ts file.
 *
 * Some modules has a dependency on ReminderPlugin which causes the circular dependency but we accept it currently to improve the readability of the code.
 * In the future, we will refactor the code to remove the circular dependency.
 *
 * @module plugin
 */
export { NotificationWorker } from "@components/reminders/plugin/notification-worker";
export { ReminderPluginUI } from "@components/reminders/plugin/ui";
export { ReminderPluginFileSystem } from "@components/reminders/plugin/filesystem";
export { PluginData } from "@components/reminders/plugin/data";
