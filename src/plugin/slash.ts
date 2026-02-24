/**
 * Slash Command Registration Module
 * 
 * Registers protyle slash commands for inline task creation.
 * Based on official plugin-sample protyleSlash pattern.
 */

import type { Plugin } from "siyuan";

/**
 * Register slash commands for the protyle editor.
 * Allows inline task creation via "/" menu in the editor.
 */
export function registerProtyleSlash(
  plugin: Plugin,
  openQuickTaskEditor: () => void
): void {
  plugin.protyleSlash = [
    {
      filter: [
        "insert recurring task",
        "插入循环任务",
        "task",
        "recurring",
        "cxxrw",
      ],
      html: `<div class="b3-list-item__first"><svg class="b3-list-item__graphic"><use xlink:href="#iconTaskRecurring"></use></svg><span class="b3-list-item__text">${plugin.i18n?.createTask || "Create Recurring Task"}</span></div>`,
      id: "insertRecurringTask",
      callback: (protyle: any) => {
        // Insert a task placeholder block, then open the task editor
        protyle.insert(
          `<div data-type="NodeParagraph" data-node-id=""><div contenteditable="true" spellcheck="false">📋 ${plugin.i18n?.createTask || "New Recurring Task"}</div></div>`
        );
        // Open the task editor modal for full configuration
        openQuickTaskEditor();
      },
    },
  ];
}
