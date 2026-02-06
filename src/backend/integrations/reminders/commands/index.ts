import type ReminderPlugin from "@frontend/components/reminders/main";
import { MarkdownView } from "@shared/utils/compat/siyuan-compat";
import { scanReminders } from "@backend/integrations/reminders/commands/scan-reminders";
import { showReminderList } from "@backend/integrations/reminders/commands/show-reminder-list";
import { convertReminderTimeFormat } from "@backend/integrations/reminders/commands/convert-reminder-time-format";
import { showDateChooser } from "@backend/integrations/reminders/commands/show-date-chooser";
import { toggleChecklistStatus } from "@backend/integrations/reminders/commands/toggle-checklist-status";
import { setDateDisplayFormat } from "@backend/integrations/reminders/commands/set-date-display-format";

export function registerCommands(plugin: ReminderPlugin) {
  plugin.addCommand({
    id: "scan-reminders",
    name: "Scan reminders",
    checkCallback: (checking: boolean) => {
      return scanReminders(checking, plugin);
    },
  });

  plugin.addCommand({
    id: "show-reminders",
    name: "Show reminders",
    checkCallback: (checking: boolean) => {
      return showReminderList(checking, plugin.ui);
    },
  });

  plugin.addCommand({
    id: "convert-reminder-time-format",
    name: "Convert reminder time format",
    checkCallback: (checking: boolean) => {
      return convertReminderTimeFormat(checking, plugin);
    },
  });

  plugin.addCommand({
    id: "show-date-chooser",
    name: "Show calendar popup",
    icon: "calendar-with-checkmark",
    hotkeys: [
      {
        modifiers: ["Meta", "Shift"],
        key: "2", // Shift + 2 = `@`
      },
    ],
    editorCheckCallback: (checking, editor): boolean | void => {
      return showDateChooser(checking, editor, plugin.ui);
    },
  });

  plugin.addCommand({
    id: "toggle-checklist-status",
    name: "Toggle checklist status",
    hotkeys: [
      {
        modifiers: ["Meta", "Shift"],
        key: "Enter",
      },
    ],
    editorCheckCallback: (checking, editor, view): boolean | void => {
      if (view instanceof MarkdownView) {
        return toggleChecklistStatus(checking, view, plugin);
      } else {
        return false;
      }
    },
  });

  plugin.addCommand({
    id: "set-date-display-format",
    name: "Set date display format",
    checkCallback: (checking: boolean) => {
      return setDateDisplayFormat(checking, plugin);
    },
  });
}
