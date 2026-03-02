/**
 * Models / DTOs — Data Transfer Objects for Frontend Consumption (§5)
 *
 * DTOs are read-only projections of domain entities. The frontend
 * consumes ONLY these shapes — never domain entities directly.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ DTOs are plain objects (no methods)
 *   ✔ All fields are readonly
 *   ✔ Created via DomainMapper.toDTO() only
 *   ❌ No domain entity imports in frontend code
 *   ❌ No mutations
 */

// ── Re-export canonical DTO from DomainMapper ────────────────
export type { TaskDTO, PersistedTask } from "@domain/DomainMapper";
export { toDTO, toPersistence, fromPersistence } from "@domain/DomainMapper";

// ──────────────────────────────────────────────────────────────
// View Models (Frontend-specific projections)
// ──────────────────────────────────────────────────────────────

/**
 * Dashboard summary view model.
 */
export interface DashboardSummaryDTO {
  readonly totalTasks: number;
  readonly dueTodayCount: number;
  readonly overdueCount: number;
  readonly completedTodayCount: number;
  readonly blockedCount: number;
  readonly upcomingCount: number;
  readonly completionRate: number;
  readonly currentStreak: number;
}

/**
 * Reminder view model.
 */
export interface ReminderDTO {
  readonly taskId: string;
  readonly taskName: string;
  readonly dueAt: string;
  readonly isOverdue: boolean;
  readonly priority?: string;
  readonly snoozeCount: number;
  readonly maxSnoozes: number;
}

/**
 * AI Suggestion view model.
 */
export interface AISuggestionDTO {
  readonly id: string;
  readonly taskId: string;
  readonly type: "reschedule" | "priority" | "dependency" | "pattern";
  readonly title: string;
  readonly description: string;
  readonly confidence: number;
  readonly suggestedAction?: Record<string, unknown>;
}

/**
 * Dependency graph visualization node.
 */
export interface DependencyNodeDTO {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly isBlocked: boolean;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
}

/**
 * Analytics summary view model.
 */
export interface AnalyticsSummaryDTO {
  readonly completionRate: number;
  readonly missRate: number;
  readonly averageCompletionTime: number;
  readonly bestStreak: number;
  readonly currentStreak: number;
  readonly healthScore: number;
  readonly totalCompleted: number;
  readonly totalMissed: number;
  readonly totalTasks: number;
}

/**
 * Recurrence info view model.
 */
export interface RecurrenceInfoDTO {
  readonly rrule: string;
  readonly humanReadable: string;
  readonly nextDueAt?: string;
  readonly seriesId?: string;
  readonly occurrenceIndex?: number;
}

/**
 * Task create input (from frontend).
 */
export interface TaskCreateInput {
  readonly name: string;
  readonly dueAt?: string;
  readonly priority?: string;
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly description?: string;
  readonly recurrenceText?: string;
  readonly dependsOn?: readonly string[];
  readonly blockId?: string;
}

/**
 * Task update patch (from frontend).
 */
export interface TaskUpdatePatch {
  readonly name?: string;
  readonly dueAt?: string | null;
  readonly priority?: string;
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly description?: string;
  readonly recurrenceText?: string;
}

/**
 * Configuration interfaces.
 */
export interface PluginConfig {
  readonly checkInterval: number;
  readonly notificationTimeout: number;
  readonly enableAI: boolean;
  readonly enableWebhooks: boolean;
  readonly dateFormat: string;
  readonly language: string;
  readonly maxSnoozes: number;
  readonly defaultPriority: string;
}

/**
 * Webhook configuration.
 */
export interface WebhookConfig {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly events: readonly string[];
  readonly secret?: string;
  readonly retryCount: number;
}
