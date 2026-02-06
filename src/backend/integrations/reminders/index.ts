/**
 * This module contains the 1 Plugin depended modules.
 * This was introduced to avoid huge main.ts file.
 *
 * Some modules has a dependency on ReminderPlugin which causes the circular dependency but we accept it currently to improve the readability of the code.
 * In the future, we will refactor the code to remove the circular dependency.
 *
 * @module plugin
 */
export { NotificationWorker } from "@backend/integrations/reminders/notification-worker";
export { ReminderPluginUI } from "@backend/integrations/reminders/ui";
export { ReminderPluginFileSystem } from "@backend/integrations/reminders/filesystem";
export { PluginData } from "@backend/integrations/reminders/data";
