/**
 * Application Layer — Composition Root & Boot/Shutdown Sequences
 *
 * This is the "wiring" layer. It constructs all services in dependency order,
 * connects them, and provides deterministic startup and teardown sequences.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Only layer that knows about ALL other layers
 *   ✔ Services are constructed here, not at import time
 *   ✔ Boot order is deterministic and documented
 *   ❌ No business logic — pure construction + wiring
 */

// ── Service Registry ─────────────────────────────────────────
export {
  createServiceRegistry,
  toPluginServices,
} from "./ServiceRegistry";

export type {
  ServiceRegistry,
  CoreServices,
  CQRSServices,
  EngineServices,
  RuntimeValidationServices,
  PipelineServices,
  IntelligenceServices,
  UIServices,
} from "./ServiceRegistry";

// ── Boot Sequence ────────────────────────────────────────────
export {
  bootCoreServices,
  bootCQRSLayer,
  runMigration,
  bootEngineLayer,
  startEngineController,
  bootRuntimeValidation,
  bootPipelines,
  bootIntelligence,
  startCQRSRuntime,
} from "./BootSequence";

export type { CQRSStartOptions } from "./BootSequence";

// ── Shutdown Sequence ────────────────────────────────────────
export { shutdownAll } from "./ShutdownSequence";

// ── Webhook Boot ─────────────────────────────────────────────
export { bootWebhookSystem, shutdownWebhookSystem } from "./WebhookBoot";
export type { WebhookServices } from "./WebhookBoot";
