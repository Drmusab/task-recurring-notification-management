import type ReminderPlugin from "@frontend/components/reminders/main";
import { Content } from "@backend/core/reminders/content";

async function toggleCheck(
  plugin: ReminderPlugin,
  file: TFile,
  lineNumber: number,
) {
  if (!plugin.fileSystem.isMarkdownFile(file)) {
    return;
  }
  const vault = plugin.app.vault;
  const content = new Content(file.path, await vault.read(file));

  const reminder = content
    .getReminders(false)
    .find((r) => r.rowNumber === lineNumber);
  if (reminder) {
    await content.updateReminder(reminder, {
      checked: !reminder.done,
    });
  } else {
    const todo = content.getTodos().find((t) => t.lineIndex === lineNumber);
    if (!todo) {
      return;
    }
    todo.setChecked(!todo.isChecked());
  }
  await vault.modify(file, content.getContent());
}

export function toggleChecklistStatus(
  checking: boolean,
  view: MarkdownView,
  plugin: ReminderPlugin,
): boolean | void {
  if (checking) {
    return true;
  }
  if (view && view.file) {
    toggleCheck(plugin, view.file, view.editor.getCursor().line);
  }
}
