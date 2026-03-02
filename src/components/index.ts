/**
 * Components Layer — Svelte 5 UI Components
 *
 * All Svelte components organized by feature domain.
 * Components receive DTOs via props and dispatch events upward.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Components consume DTOs only
 *   ✔ Actions dispatched via event handlers
 *   ✔ No backend/domain imports
 *   ❌ No direct mutations
 *   ❌ No SiYuan API calls
 *
 * ── Import Convention ────────────────────────────────────────
 * Svelte components are imported directly by path:
 *   import TaskCard from "@components/tasks/TaskCard.svelte";
 *   import Dashboard from "@components/dashboard/Dashboard.svelte";
 *
 * This barrel exports TypeScript modules only (helpers, types, indexes).
 */

// ── Dashboard ────────────────────────────────────────────────
export * as dashboardComponents from "@frontend/components/dashboard/index";

// ── Query ────────────────────────────────────────────────────
export * as queryComponents from "@frontend/components/query/index";

// ── Shared Utilities ─────────────────────────────────────────
export type { IQuery } from "@frontend/components/shared/IQuery";
