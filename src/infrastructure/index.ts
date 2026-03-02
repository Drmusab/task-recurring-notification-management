/**
 * Infrastructure Layer
 * 
 * SiYuan API adapters, external service clients, persistence.
 * All SiYuan kernel communication is centralized through this layer.
 */

// SiYuan API adapters & utilities
export * from './api';

// Integrations
export * from './integrations/siyuan/DockAdapter';

// ── File Operations ──────────────────────────────────────────
export {
  initializeFile,
  replaceTaskWithTasks,
  readTaskFromFile,
  writeToFile,
  getMetadataCache,
  getVault,
  getWorkspace,
} from "@backend/core/file";

export type {
  FileInitOptions,
  ReplaceTaskOptions,
} from "@backend/core/file";

// ── Canonical SiYuanApiAdapter (Architecture Spec v3 §3.3) ──
export { SiYuanApiAdapter, siyuanApi } from "./SiYuanApiAdapter";
export type { BlockAttributes, BootProgress, NotificationResult, BlockChild, BlockKramdown } from "./SiYuanApiAdapter";
