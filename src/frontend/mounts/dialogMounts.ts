/**
 * Dialog Mount Adapters
 *
 * Wraps Svelte modal components into SiYuan Dialog-based lifecycle mounts.
 * Each function opens a SiYuan Dialog and mounts the appropriate Svelte component inside.
 *
 * Pattern: new Dialog({...}) → querySelector container → mount(Component, {target, props})
 * Based on official plugin-sample Dialog usage pattern (svelteDialog in Svelte sample).
 *
 * Uses dynamic import() for code-splitting instead of require().
 */

import { Dialog, showMessage } from "siyuan";
import { mount, unmount } from "svelte";
import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import type { PluginServices } from "../../plugin/types";
import type { MountHandle, DialogMountOptions } from "./types";

// ─── Task Edit Dialog ───────────────────────────────────────

/**
 * Open a full-featured task editor in a SiYuan Dialog.
 * Uses the existing TaskModal.ts pattern (Dialog + createUnifiedEditor).
 *
 * Can be triggered from:
 *   - blockMenu (click-blockicon event → "Edit as Task")
 *   - slashCommand (protyleSlash → "Insert Recurring Task")
 *   - commandPalette (addCommand → Ctrl+Shift+N)
 *   - task click (from Dashboard/Calendar views)
 */
export async function openTaskEditDialog(options: DialogMountOptions): Promise<MountHandle> {
  const {
    plugin,
    services,
    task = null,
    onSave,
    onDelete,
    title,
    width = "700px",
    height = "auto",
  } = options;

  const isEditing = task !== null;
  const dialogTitle =
    title ||
    (isEditing
      ? plugin.i18n?.editTask || "Edit Task"
      : plugin.i18n?.createTask || "Create Task");

  let svelteHandle: ReturnType<typeof mount> | null = null;

  const dialog = new Dialog({
    title: dialogTitle,
    content: `<div id="task-edit-dialog-root" class="task-editor-modal" style="padding:16px;"></div>`,
    width,
    height,
    destroyCallback: () => {
      if (svelteHandle) {
        try {
          unmount(svelteHandle);
        } catch {
          /* already unmounted */
        }
        svelteHandle = null;
      }
    },
  });

  // Mount the unified editor inside the dialog
  const container = dialog.element.querySelector(
    "#task-edit-dialog-root"
  ) as HTMLElement;

  if (container) {
    try {
      // Use the existing createUnifiedEditor from EditTaskUnified.ts
      // which mounts EditTask + BlockActionsEditor + TagsCategoryEditor + AISuggestionsPanel
      const { createUnifiedEditor } = await import("@components/shared/EditTaskUnified");

      const defaultTask = task || {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        status: "todo",
        priority: "medium",
        dueAt: "",
        enabled: true,
        frequency: { type: "once" as const },
        dependsOn: [],
        blockActions: [],
        tags: [],
        category: "",
        completionCount: 0,
        missCount: 0,
        currentStreak: 0,
        bestStreak: 0,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const editor = createUnifiedEditor(container, {
        task: defaultTask,
        statusOptions: [],
        onSubmit: async (updatedTask: Task) => {
          if (onSave) {
            await onSave(updatedTask);
          }
          // Also sync to block DB and emit refresh
          if (services.blockMetadataService) {
            await services.blockMetadataService.syncTaskToBlock(updatedTask);
          }
          services.pluginEventBus.emit("task:refresh", undefined);
          dialog.destroy();
        },
        onCancel: () => {
          dialog.destroy();
        },
        allTasks: [],
      });

      // Store reference so destroyCallback can clean up
      // The createUnifiedEditor returns {destroy} handle
      const originalDestroy = dialog.element.querySelector(
        "#task-edit-dialog-root"
      );
      if (originalDestroy) {
        (originalDestroy as any).__editorInstance = editor;
      }
    } catch (err) {
      console.error("[TaskRecurring] Failed to mount task editor in dialog:", err);
      container.innerHTML = `<div style="padding:20px;color:var(--b3-theme-error);">Failed to load task editor</div>`;
    }
  }

  return {
    destroy() {
      dialog.destroy();
    },
  };
}

// ─── Recurrence Editor Dialog ───────────────────────────────

/**
 * Open the recurrence pattern editor in a SiYuan Dialog.
 * Wraps shared/modals/RecurrenceEditorModal.svelte.
 */
export async function openRecurrenceDialog(options: {
  plugin: Plugin;
  currentPattern?: string;
  onSave?: (pattern: string) => void;
}): Promise<MountHandle> {
  const { plugin, currentPattern = "", onSave } = options;
  let svelteHandle: ReturnType<typeof mount> | null = null;

  const dialog = new Dialog({
    title: plugin.i18n?.editRecurrence || "Edit Recurrence",
    content: `<div id="recurrence-dialog-root" style="padding:16px;"></div>`,
    width: "500px",
    height: "auto",
    destroyCallback: () => {
      if (svelteHandle) {
        try { unmount(svelteHandle); } catch { /* ok */ }
        svelteHandle = null;
      }
    },
  });

  const container = dialog.element.querySelector("#recurrence-dialog-root") as HTMLElement;
  if (container) {
    try {
      const { default: RecurrenceEditorModal } = await import("@components/shared/modals/RecurrenceEditorModal.svelte");
      svelteHandle = mount(RecurrenceEditorModal, {
        target: container,
        props: {
          pattern: currentPattern,
          onSave: (pattern: string) => {
            if (onSave) onSave(pattern);
            dialog.destroy();
          },
          onCancel: () => dialog.destroy(),
        },
      });
    } catch (err) {
      console.error("[TaskRecurring] Failed to mount recurrence editor:", err);
      container.innerHTML = `<div style="padding:20px;color:var(--b3-theme-error);">Failed to load recurrence editor</div>`;
    }
  }

  return { destroy: () => dialog.destroy() };
}

// ─── About Dialog ───────────────────────────────────────────

/**
 * Open the About dialog in a SiYuan Dialog.
 * Wraps shared/modals/AboutDialog.svelte.
 */
export async function openAboutDialog(plugin: Plugin): Promise<MountHandle> {
  let svelteHandle: ReturnType<typeof mount> | null = null;

  const dialog = new Dialog({
    title: plugin.i18n?.about || "About",
    content: `<div id="about-dialog-root" style="padding:16px;"></div>`,
    width: "450px",
    height: "auto",
    destroyCallback: () => {
      if (svelteHandle) {
        try { unmount(svelteHandle); } catch { /* ok */ }
        svelteHandle = null;
      }
    },
  });

  const container = dialog.element.querySelector("#about-dialog-root") as HTMLElement;
  if (container) {
    try {
      const { default: AboutDialog } = await import("@components/shared/modals/AboutDialog.svelte");
      svelteHandle = mount(AboutDialog, {
        target: container,
        props: { plugin },
      });
    } catch (err) {
      container.innerHTML = `<div style="padding:20px;">Task Recurring Notification Management Plugin</div>`;
    }
  }

  return { destroy: () => dialog.destroy() };
}

// ─── Keyboard Shortcuts Dialog ──────────────────────────────

/**
 * Open the keyboard shortcuts reference dialog.
 * Wraps shared/modals/KeyboardShortcutsDialog.svelte.
 */
export async function openKeyboardShortcutsDialog(plugin: Plugin): Promise<MountHandle> {
  let svelteHandle: ReturnType<typeof mount> | null = null;

  const dialog = new Dialog({
    title: plugin.i18n?.keyboardShortcuts || "Keyboard Shortcuts",
    content: `<div id="shortcuts-dialog-root" style="padding:16px;"></div>`,
    width: "550px",
    height: "auto",
    destroyCallback: () => {
      if (svelteHandle) {
        try { unmount(svelteHandle); } catch { /* ok */ }
        svelteHandle = null;
      }
    },
  });

  const container = dialog.element.querySelector("#shortcuts-dialog-root") as HTMLElement;
  if (container) {
    try {
      const { default: KeyboardShortcutsDialog } = await import("@components/shared/modals/KeyboardShortcutsDialog.svelte");
      svelteHandle = mount(KeyboardShortcutsDialog, {
        target: container,
        props: {},
      });
    } catch (err) {
      container.innerHTML = `<div style="padding:20px;color:var(--b3-theme-on-surface-light);">Keyboard shortcuts unavailable</div>`;
    }
  }

  return { destroy: () => dialog.destroy() };
}

// ─── Confirmation Dialog ────────────────────────────────────

/**
 * Open a confirmation dialog using SiYuan Dialog.
 * Returns a promise that resolves to true (confirmed) or false (cancelled).
 */
export function openConfirmationDialog(options: {
  plugin: Plugin;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): MountHandle & { result: Promise<boolean> } {
  const {
    plugin,
    title = "Confirm",
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
  } = options;

  let resolvePromise: (value: boolean) => void;
  const result = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });

  const dialog = new Dialog({
    title,
    content: `
      <div style="padding:16px 20px;">
        <p style="margin:0 0 20px;color:var(--b3-theme-on-background);font-size:14px;">${message}</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="b3-button b3-button--cancel" id="confirm-dialog-cancel">${cancelLabel}</button>
          <button class="b3-button b3-button--text" id="confirm-dialog-ok">${confirmLabel}</button>
        </div>
      </div>`,
    width: "400px",
    height: "auto",
    destroyCallback: () => {
      resolvePromise!(false);
    },
  });

  const okBtn = dialog.element.querySelector("#confirm-dialog-ok");
  const cancelBtn = dialog.element.querySelector("#confirm-dialog-cancel");

  okBtn?.addEventListener("click", () => {
    resolvePromise!(true);
    dialog.destroy();
  });

  cancelBtn?.addEventListener("click", () => {
    resolvePromise!(false);
    dialog.destroy();
  });

  return {
    destroy: () => dialog.destroy(),
    result,
  };
}
