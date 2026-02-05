import type ReminderPlugin from "main";

declare global {
  interface Window {
    app: ;
  }
}
declare module "" {
  interface App {
    plugins: {
      plugins: {
        "-reminder-plugin": ReminderPlugin;
      };
    };
  }
}
