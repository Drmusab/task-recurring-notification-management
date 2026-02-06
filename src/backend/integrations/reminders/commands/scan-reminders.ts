import type ReminderPlugin from "@frontend/components/reminders/main";

export function scanReminders(
  checking: boolean,
  plugin: ReminderPlugin,
): boolean {
  if (checking) {
    return true;
  }
  plugin.fileSystem.reloadRemindersInAllFiles();
  return true;
}
