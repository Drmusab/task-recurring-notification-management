import type { Editor } from "@shared/utils/compat/siyuan-compat";
import type { ReminderPluginUI } from "@backend/integrations/reminders/ui";

export function showDateChooser(
  checking: boolean,
  editor: Editor,
  ui: ReminderPluginUI,
): boolean | void {
  if (checking) {
    return true;
  }

  ui.showAutoComplete(editor);
}
