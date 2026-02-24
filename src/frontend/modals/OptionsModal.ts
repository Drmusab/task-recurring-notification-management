/**
 * OptionsModal - Settings modal for TaskEditorModal
 *
 * Refactored to use SiYuan's native Dialog component directly,
 * eliminating the Obsidian compatibility layer dependency.
 * Persists field visibility via SiYuan plugin.loadData/saveData API.
 *
 * Uses SiYuan CSS classes (b3-label, b3-switch) for native look & feel.
 */

import { Dialog } from "siyuan";
import type { Plugin } from "siyuan";

/** Current editor field visibility settings */
export interface EditorFieldVisibility {
  priority: boolean;
  recurrence: boolean;
  due: boolean;
  scheduled: boolean;
  start: boolean;
  before_this: boolean;
  after_this: boolean;
  status: boolean;
  aiPanel: boolean;
  blockActions: boolean;
  tagsCategory: boolean;
}

const STORAGE_KEY = "task-editor-field-visibility";

/** In-memory cache so repeated opens don't need async load */
let cachedVisibility: EditorFieldVisibility | null = null;
/** Plugin reference for storage access */
let pluginRef: Plugin | null = null;

/**
 * Initialize the OptionsModal storage bridge.
 * Must be called once during plugin onload() before any modal is opened.
 */
export async function initOptionsStorage(plugin: Plugin): Promise<void> {
  pluginRef = plugin;
  try {
    const stored = await plugin.loadData(STORAGE_KEY);
    if (stored && typeof stored === "object") {
      cachedVisibility = { ...getDefaultVisibility(), ...stored };
    }
  } catch { /* ignore — use defaults */ }
}

function getDefaultVisibility(): EditorFieldVisibility {
  return {
    priority: true,
    recurrence: true,
    due: true,
    scheduled: true,
    start: true,
    before_this: true,
    after_this: true,
    status: true,
    aiPanel: true,
    blockActions: true,
    tagsCategory: true,
  };
}

function loadFieldVisibility(): EditorFieldVisibility {
  return cachedVisibility ?? getDefaultVisibility();
}

async function saveFieldVisibility(vis: EditorFieldVisibility): Promise<void> {
  cachedVisibility = vis;
  if (pluginRef) {
    try {
      await pluginRef.saveData(STORAGE_KEY, vis);
    } catch {
      console.warn("[OptionsModal] Failed to persist field visibility");
    }
  }
}

export interface OptionsModalParams {
  onSave: () => void;
}

/**
 * Open the Task Editor Options modal using SiYuan's native Dialog.
 * No Obsidian compatibility layer needed.
 */
export function openOptionsModal({ onSave }: OptionsModalParams): Dialog {
  const fieldVisibility = loadFieldVisibility();

  const dialog = new Dialog({
    title: "Task Editor Options",
    content: `<div id="options-modal-content" class="fn__flex-column" style="padding: 16px; gap: 4px; overflow-y: auto; max-height: 70vh;"></div>`,
    width: "520px",
    destroyCallback: () => {
      onSave();
    },
  });

  const container = dialog.element.querySelector("#options-modal-content") as HTMLElement;
  if (!container) return dialog;

  // Section header
  const header = document.createElement("h4");
  header.textContent = "Visible Fields";
  header.style.cssText = "margin: 0 0 12px; color: var(--b3-theme-on-surface);";
  container.appendChild(header);

  const fields: Array<{ key: keyof EditorFieldVisibility; label: string; desc: string }> = [
    { key: "priority", label: "Priority", desc: "Show priority selector in task editor" },
    { key: "recurrence", label: "Recurrence", desc: "Show recurrence input in task editor" },
    { key: "due", label: "Due Date", desc: "Show due date input in task editor" },
    { key: "scheduled", label: "Scheduled Date", desc: "Show scheduled date input in task editor" },
    { key: "start", label: "Start Date", desc: "Show start date input in task editor" },
    { key: "status", label: "Status", desc: "Show status selector in task editor" },
    { key: "aiPanel", label: "AI Suggestions", desc: "Show AI suggestions panel in task editor" },
    { key: "blockActions", label: "Block Actions", desc: "Show block actions editor in task editor" },
    { key: "tagsCategory", label: "Tags & Category", desc: "Show tags and category editor" },
  ];

  for (const field of fields) {
    const item = document.createElement("label");
    item.className = "fn__flex b3-label";
    item.innerHTML = `
      <div class="fn__flex-1">
        <span class="fn__flex">${field.label}</span>
        <div class="b3-label__text">${field.desc}</div>
      </div>
      <div class="fn__space"></div>
      <input class="b3-switch fn__flex-center" type="checkbox" ${fieldVisibility[field.key] ? "checked" : ""}>
    `;
    const toggle = item.querySelector("input") as HTMLInputElement;
    toggle.addEventListener("change", () => {
      fieldVisibility[field.key] = toggle.checked;
      // Handle dependencies (before_this + after_this are grouped)
      if (field.key === "before_this" || field.key === "after_this") {
        fieldVisibility.before_this = toggle.checked;
        fieldVisibility.after_this = toggle.checked;
      }
      saveFieldVisibility({ ...fieldVisibility });
      onSave();
    });
    container.appendChild(item);
  }

  // Close button
  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = "display: flex; justify-content: flex-end; margin-top: 16px;";
  const closeBtn = document.createElement("button");
  closeBtn.className = "b3-button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => dialog.destroy());
  btnContainer.appendChild(closeBtn);
  container.appendChild(btnContainer);

  return dialog;
}
