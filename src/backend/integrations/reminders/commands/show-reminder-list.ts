import type { ReminderPluginUI } from "@backend/integrations/reminders/ui";

export function showReminderList(checking: boolean, ui: ReminderPluginUI) {
  if (!checking) {
    ui.showReminderList();
  }
  return true;
}
