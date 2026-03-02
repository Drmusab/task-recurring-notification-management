/**
 * Runtime Layer — SiYuan Platform Bridge
 *
 * Bridges SiYuan's block-based runtime to the plugin's domain model.
 * Handles checkbox toggles, block mutations, and tree traversal.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Only layer allowed to call SiYuan block APIs (via infrastructure/)
 *   ✔ Translates block events → domain events
 *   ✔ Delegates mutations to services/
 *   ❌ No direct domain model construction
 */

export {
  SiYuanRuntimeBridge,
  type BlockMutation,
  type CheckboxToggleEvent,
  type BlockTreeNode,
  type RuntimeEvent,
} from "@backend/runtime";

// ── Execution Pipeline (Spec §3.4) ──────────────────────────
export {
  ExecutionPipeline,
  type ExecutionPipelineDeps,
  type ExecutionResult,
  type TaskPipelineResult,
  type StageResult,
} from "./ExecutionPipeline";

// ── Canonical Scheduler (Spec §4.4) ─────────────────────────
export {
  Scheduler as CanonicalScheduler,
  type SchedulerConfig,
  type TickResult,
} from "./Scheduler";
