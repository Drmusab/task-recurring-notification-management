/**
 * Infrastructure Layer — SiYuan API Adapters
 *
 * This layer handles ALL external communication with the SiYuan kernel.
 * It normalizes raw API responses into DTOs and ensures:
 *
 *  - Every call validates `response.code === 0`
 *  - Typed errors for all failure modes
 *  - Zero business logic — adapter pattern only
 *
 * ── Re-exports from canonical implementation ──────────────────
 */

// ── Core HTTP Layer ──────────────────────────────────────────
export {
  SiYuanApiError,
  siyuanRequest,
  siyuanRequestSafe,
  setBlockAttrs,
  getBlockAttrs,
  getChildBlocks,
  getBlockKramdown,
  querySql,
  pushMsg,
  pushErrMsg,
  getBootProgress,
  flushTransaction,
} from "@backend/core/api/SiYuanApiClient";

// ── Capability Adapter ───────────────────────────────────────
export {
  SiYuanApiAdapter,
  SiYuanCapabilityError,
  SiYuanApiExecutionError,
  resetReportedIssues,
  reportSiYuanApiIssue,
} from "@backend/core/api/SiYuanApiAdapter";
export type {
  SiYuanBlockAPI,
  SiYuanEnvironmentAPI,
} from "@backend/core/api/SiYuanApiAdapter";

// ── Block API Service ────────────────────────────────────────
export { TaskBlockService } from "@backend/core/api/block-api";

// ── Block Metadata ───────────────────────────────────────────
export { BlockMetadataService } from "@backend/core/api/BlockMetadataService";

// ── Notification Adapter ─────────────────────────────────────
export {
  notify,
  notifyInfo,
  notifyWarn,
  notifyError,
} from "@backend/core/api/NotificationAdapter";
export type {
  NotificationLevel,
  NotifyOptions,
} from "@backend/core/api/NotificationAdapter";
