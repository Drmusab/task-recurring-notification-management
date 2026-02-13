import type ReminderPlugin from "@frontend/components/reminders/main";

declare global {
  interface Window {
    app: Record<string, unknown>;
  }
}

declare module "siyuan" {
  interface App {
    plugins: {
      plugins: {
        "-reminder-plugin": ReminderPlugin;
      };
    };
  }
}
