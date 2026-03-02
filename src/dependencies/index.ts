/**
 * Dependencies Layer — Task Dependency Graph & Execution Guard
 *
 * Manages dependency relationships between tasks: graph structure,
 * cycle detection, execution gating, and resolution/visualization.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Graph is rebuilt from cache on boot
 *   ✔ ExecutionGuard blocks task execution when dependencies unmet
 *   ✔ Validator prevents cycles on dependency creation
 *   ❌ No direct SiYuan API calls
 *   ❌ No mutations — dependency state flows through services/
 */

export {
  // ── Dependency Graph ───────────────────────────────────────
  DependencyGraph,
  type DependencyNode,
  type GraphEdge,
  type DependencyGraphStats,
  type DependencyGraphDeps,

  // ── Dependency Validator ───────────────────────────────────
  DependencyValidator,
  type DependencyValidatorDeps,

  // ── Dependency Resolver (visualization) ────────────────────
  DependencyResolver,
  type VisualizationNode,
  type VisualizationEdge,
  type GraphVisualizationData,
  type VisualizationOptions,
  type DependencyResolverDeps,

  // ── Dependency Execution Guard ─────────────────────────────
  DependencyExecutionGuard,
  type ExecutionGuardDeps,
  type CanExecuteResult,

  // ── Dependency Manager ─────────────────────────────────────
  DependencyManager,
  type DependencyManagerDeps,
} from "@backend/dependencies";

// Note: ValidationResult is also exported from @backend/dependencies
// but may conflict with engine/recurrence ValidationResult.
// Import explicitly if needed:
//   import { type ValidationResult } from "@backend/dependencies/DependencyValidator";

// ── Canonical DependencyGraph (Architecture Spec v3 §4.3) ────
export { DependencyGraph as CanonicalDependencyGraph } from "./DependencyGraph";
