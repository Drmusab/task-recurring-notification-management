import type { Editor } from "@shared/utils/misc/siyuan-compat";
import type { ReminderPluginUI } from "plugin/ui";

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
