/**
 * OptionsModal - Settings modal for TaskEditorModal
 * 
 * Allows users to configure display options for the task editor.
 * WHY: TaskModal references this but it was missing from the codebase.
 */

import { App, Modal, Setting } from "@shared/utils/compat/siyuan-compat";
import { getSettings, updateSettings } from "@shared/config/Settings";

export interface OptionsModalParams {
  app: App;
  onSave: () => void;
}

export class OptionsModal extends Modal {
  private onSave: () => void;

  constructor({ app, onSave }: OptionsModalParams) {
    super(app);
    this.onSave = onSave;
  }

  public onOpen(): void {
    this.titleEl.setText('Task Editor Options');
    const { contentEl } = this;
    
    contentEl.empty();
    contentEl.addClass('tasks-options-modal');

    const settings = getSettings();

    // Show/Hide sections in Edit Modal
    contentEl.createEl('h3', { text: 'Visible Fields' });

    const editModalSettings = settings.isShownInEditModal || {};

    // Priority field visibility
    new Setting(contentEl)
      .setName('Priority')
      .setDesc('Show priority selector in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.priority !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              priority: value
            }
          });
          this.onSave();
        }));

    // Recurrence field visibility
    new Setting(contentEl)
      .setName('Recurrence')
      .setDesc('Show recurrence input in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.recurrence !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              recurrence: value
            }
          });
          this.onSave();
        }));

    // Due date visibility
    new Setting(contentEl)
      .setName('Due Date')
      .setDesc('Show due date input in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.due !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              due: value
            }
          });
          this.onSave();
        }));

    // Scheduled date visibility
    new Setting(contentEl)
      .setName('Scheduled Date')
      .setDesc('Show scheduled date input in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.scheduled !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              scheduled: value
            }
          });
          this.onSave();
        }));

    // Start date visibility
    new Setting(contentEl)
      .setName('Start Date')
      .setDesc('Show start date input in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.start !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              start: value
            }
          });
          this.onSave();
        }));

    // Dependencies visibility
    new Setting(contentEl)
      .setName('Dependencies')
      .setDesc('Show dependency picker in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.before_this !== false && editModalSettings.after_this !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              before_this: value,
              after_this: value
            }
          });
          this.onSave();
        }));

    // Status visibility
    new Setting(contentEl)
      .setName('Status')
      .setDesc('Show status selector in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.status !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              status: value
            }
          });
          this.onSave();
        }));

    // AI Panel visibility
    new Setting(contentEl)
      .setName('AI Suggestions')
      .setDesc('Show AI suggestions panel in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.aiPanel !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              aiPanel: value
            }
          });
          this.onSave();
        }));

    // Block Actions visibility
    new Setting(contentEl)
      .setName('Block Actions')
      .setDesc('Show block actions editor in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.blockActions !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              blockActions: value
            }
          });
          this.onSave();
        }));

    // Tags & Category visibility
    new Setting(contentEl)
      .setName('Tags & Category')
      .setDesc('Show tags and category editor in task editor')
      .addToggle(toggle => toggle
        .setValue(editModalSettings.tagsCategory !== false)
        .onChange(async (value) => {
          await updateSettings({
            ...settings,
            isShownInEditModal: {
              ...editModalSettings,
              tagsCategory: value
            }
          });
          this.onSave();
        }));

    // Close button
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Close')
        .onClick(() => this.close()));
  }

  public onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
