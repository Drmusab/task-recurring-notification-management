/**
 * EditModalShowSettings - Controls which fields are shown in the task edit modal
 * 
 * This file defines the default visibility settings for task editor modal fields.
 */

/**
 * Interface defining which fields should be shown in the edit modal
 */
export interface EditModalShowSettings {
  /** Show priority selector */
  priority: boolean;
  /** Show recurrence input */
  recurrence: boolean;
  /** Show due date input */
  due: boolean;
  /** Show scheduled date input */
  scheduled: boolean;
  /** Show start date input */
  start: boolean;
  /** Show "before this" dependency picker (blocked by) */
  before_this: boolean;
  /** Show "after this" dependency picker (blocking) */
  after_this: boolean;
  /** Show status selector */
  status: boolean;
  /** Show created date input */
  created: boolean;
  /** Show done date input */
  done: boolean;
  /** Show cancelled date input */
  cancelled: boolean;
  /** Show AI suggestions panel */
  aiPanel: boolean;
  /** Show block actions editor */
  blockActions: boolean;
  /** Show tags and category editor */
  tagsCategory: boolean;
}

/**
 * Default settings for which fields are shown in the edit modal.
 * All fields are shown by default.
 */
export const defaultEditModalShowSettings: EditModalShowSettings = {
  priority: true,
  recurrence: true,
  due: true,
  scheduled: true,
  start: true,
  before_this: true,
  after_this: true,
  status: true,
  created: true,
  done: true,
  cancelled: true,
  aiPanel: true,
  blockActions: true,
  tagsCategory: true,
};
