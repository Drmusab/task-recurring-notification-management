/**
 * Plugin Service Types
 * 
 * Shared type definitions for plugin service container
 * used across registration modules (docks, tabs, topbar, etc.)
 */

import type { Plugin } from "siyuan";
import type { TaskStorage } from "@backend/core/storage/TaskStorage";
import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
import type { Scheduler } from "@backend/core/engine/Scheduler";
import type { EventService } from "@backend/services/EventService";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { BlockMetadataService } from "@backend/core/api/BlockMetadataService";
import type { TaskCreationService } from "@backend/core/services/TaskCreationService";
import type { AutoMigrationService } from "@backend/core/services/AutoMigrationService";
import type { PluginSettings } from "@backend/core/settings/PluginSettings";

/**
 * Container for all plugin services that UI components need.
 * Passed to dock panels, tabs, and modals for dependency injection.
 */
export interface PluginServices {
  plugin: Plugin;
  taskStorage: TaskStorage;
  recurrenceEngine: RecurrenceEngine;
  scheduler: Scheduler;
  eventService: EventService;
  pluginEventBus: PluginEventBus;
  blockMetadataService: BlockMetadataService;
  taskCreationService: TaskCreationService;
  autoMigrationService: AutoMigrationService;
  settings: PluginSettings;
  isMobile: boolean;
}
