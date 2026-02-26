/**
 * Dependency subsystem barrel exports
 *
 * Architecture: Block-Validated Dependency Graph
 *
 * Modules:
 *   DependencyGraph        → block-validated DAG with cycle detection
 *   DependencyValidator    → block-attr validation before execution
 *   DependencyExecutionGuard → scheduler/AI/frontend gate
 *   DependencyResolver     → topological ordering + visualization
 *   DependencyManager      → lifecycle orchestrator
 */

// ── Core graph ───────────────────────────────────────────────
export { DependencyGraph } from "./DependencyGraph";
export type {
  DependencyNode,
  GraphEdge,
  DependencyGraphStats,
  DependencyGraphDeps,
} from "./DependencyGraph";

// ── Validation ───────────────────────────────────────────────
export { DependencyValidator } from "./DependencyValidator";
export type {
  ValidationResult,
  DependencyValidatorDeps,
} from "./DependencyValidator";

// ── Execution guard ──────────────────────────────────────────
export { DependencyExecutionGuard } from "./DependencyExecutionGuard";
export type {
  CanExecuteResult,
  ExecutionGuardDeps,
} from "./DependencyExecutionGuard";

// ── Resolver / visualization ─────────────────────────────────
export { DependencyResolver } from "./DependencyResolver";
export type {
  VisualizationNode,
  VisualizationEdge,
  GraphVisualizationData,
  VisualizationOptions,
  DependencyResolverDeps,
} from "./DependencyResolver";

// ── Orchestrator ─────────────────────────────────────────────
export { DependencyManager } from "./DependencyManager";
export type { DependencyManagerDeps } from "./DependencyManager";
