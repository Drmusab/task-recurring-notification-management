/**
 * Settings UI Module
 * 
 * Handles the plugin settings dialog using SiYuan's native Setting class.
 * Based on official plugin-sample openSetting() pattern.
 */

import { Setting, showMessage } from "siyuan";
import type { Plugin } from "siyuan";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";

export interface SettingsCallbacks {
  saveSettings: () => Promise<void>;
  syncTasksToBlockDB: () => Promise<void>;
}

/**
 * Build and display the settings dialog.
 * Called by the plugin's openSetting() override.
 */
export function openSettingsDialog(
  plugin: Plugin,
  settings: PluginSettings,
  callbacks: SettingsCallbacks
): void {
  const settingDialog = new Setting({
    confirmCallback: () => {
      callbacks.saveSettings();
    },
  });

  // ── Recurrence settings ──
  const rruleCheckbox = document.createElement("input");
  rruleCheckbox.type = "checkbox";
  rruleCheckbox.className = "b3-switch fn__flex-center";
  rruleCheckbox.checked = settings.recurrence.useRRuleByDefault;
  rruleCheckbox.addEventListener("change", () => {
    settings.recurrence.useRRuleByDefault = rruleCheckbox.checked;
  });
  settingDialog.addItem({
    title: plugin.i18n?.useRRuleByDefault || "Use RRule by default",
    description:
      plugin.i18n?.useRRuleByDefaultDesc ||
      "Use RFC 5545 RRule format for new recurring tasks",
    actionElement: rruleCheckbox,
  });

  const autoMigrateCheckbox = document.createElement("input");
  autoMigrateCheckbox.type = "checkbox";
  autoMigrateCheckbox.className = "b3-switch fn__flex-center";
  autoMigrateCheckbox.checked = settings.recurrence.autoMigrateOnEdit;
  autoMigrateCheckbox.addEventListener("change", () => {
    settings.recurrence.autoMigrateOnEdit = autoMigrateCheckbox.checked;
  });
  settingDialog.addItem({
    title: plugin.i18n?.autoMigrateOnEdit || "Auto-migrate on edit",
    description:
      plugin.i18n?.autoMigrateOnEditDesc ||
      "Automatically convert legacy tasks to RRule when edited",
    actionElement: autoMigrateCheckbox,
  });

  // ── Date tracking ──
  const autoAddDoneCheckbox = document.createElement("input");
  autoAddDoneCheckbox.type = "checkbox";
  autoAddDoneCheckbox.className = "b3-switch fn__flex-center";
  autoAddDoneCheckbox.checked = settings.dates.autoAddDone;
  autoAddDoneCheckbox.addEventListener("change", () => {
    settings.dates.autoAddDone = autoAddDoneCheckbox.checked;
  });
  settingDialog.addItem({
    title: plugin.i18n?.autoAddDone || "Auto-add done date",
    description:
      plugin.i18n?.autoAddDoneDesc ||
      "Automatically set done date when completing tasks",
    actionElement: autoAddDoneCheckbox,
  });

  const autoAddCreatedCheckbox = document.createElement("input");
  autoAddCreatedCheckbox.type = "checkbox";
  autoAddCreatedCheckbox.className = "b3-switch fn__flex-center";
  autoAddCreatedCheckbox.checked = settings.dates.autoAddCreated;
  autoAddCreatedCheckbox.addEventListener("change", () => {
    settings.dates.autoAddCreated = autoAddCreatedCheckbox.checked;
  });
  settingDialog.addItem({
    title: plugin.i18n?.autoAddCreated || "Auto-add created date",
    description:
      plugin.i18n?.autoAddCreatedDesc ||
      "Automatically set created date when creating tasks",
    actionElement: autoAddCreatedCheckbox,
  });

  // ── Block Actions ──
  const blockActionsCheckbox = document.createElement("input");
  blockActionsCheckbox.type = "checkbox";
  blockActionsCheckbox.className = "b3-switch fn__flex-center";
  blockActionsCheckbox.checked = settings.blockActions.enabled;
  blockActionsCheckbox.addEventListener("change", () => {
    settings.blockActions.enabled = blockActionsCheckbox.checked;
  });
  settingDialog.addItem({
    title: plugin.i18n?.enableBlockActions || "Enable block actions",
    description:
      plugin.i18n?.enableBlockActionsDesc ||
      "Link tasks to SiYuan blocks for smart actions",
    actionElement: blockActionsCheckbox,
  });

  // ── Block DB Sync button ──
  const blockSyncBtn = document.createElement("button");
  blockSyncBtn.className =
    "b3-button b3-button--outline fn__flex-center fn__size200";
  blockSyncBtn.textContent =
    plugin.i18n?.syncBlockMetadata || "Sync Block Metadata";
  blockSyncBtn.addEventListener("click", () => {
    callbacks.syncTasksToBlockDB();
    try {
      showMessage("Block metadata sync started", 6000, "info");
    } catch {
      // showMessage may not be available during early lifecycle
    }
  });
  settingDialog.addItem({
    title: "Block DB Sync",
    description:
      "Sync task metadata to SiYuan block attributes for DB queries",
    actionElement: blockSyncBtn,
  });
}
