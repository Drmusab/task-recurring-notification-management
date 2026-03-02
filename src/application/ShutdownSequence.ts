/**
 * ShutdownSequence — Deterministic service teardown.
 *
 * Extracts the ~100 lines of cleanup from index.ts onunload() into
 * a structured teardown pipeline. Reverse order of BootSequence.
 *
 * Teardown Order:
 *   1. Intelligence layer (AI, attention gate)
 *   2. Pipeline services (reminders, escalation, integration)
 *   3. Runtime validation (ML adapter, lifecycle, validators)
 *   4. Engine (controller, dependency, cache)
 *   5. CQRS (commands, block layer, reactive manager, bridge)
 *   6. Core services (sync, task service, event services, storage)
 *   7. Frontend singletons (stores, mount service)
 *   8. Module-level resets (performance, logging, adapters)
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Reverse order of construction
 *   ✔ Each shutdown is try/catch guarded
 *   ✔ No throws — log and continue
 */

import * as pluginLogger from "@shared/logging/logger";
import { clearLogs as clearBackendLogs } from "@shared/logging/logger";
import { performanceMonitor, logger as perfLogger } from "@shared/utils/PerformanceMonitor";
import { resetReportedIssues } from "@backend/core/api/SiYuanApiAdapter";
import { resetBridgeInstance } from "@backend/core/integration/TaskReminderBridge";
import { resetArchiveCompression } from "@backend/core/storage/ArchiveCompression";
import { resetOptimizedJSON } from "@backend/core/storage/OptimizedJSON";
import { OptimisticUpdateManager } from "@backend/core/ui/OptimisticUpdateManager";
import { TaskUIStateManager } from "@backend/core/ui/TaskUIState";

// ── Frontend singletons ────────────────────────────────────
import { uiQueryService } from "@frontend/services/UIQueryService";
import { uiEventService } from "@frontend/services/UIEventService";
import { uiMutationService } from "@frontend/services/UITaskMutationService";
import { resetSettingsStore } from "@frontend/stores/Settings.store";
import { resetOptionsStorage } from "@frontend/modals/OptionsModal";
import { resetSavedQueryStore } from "@backend/core/query/SavedQueryStore";
import { resetKeyboardShortcutActions } from "@frontend/stores/KeyboardShortcuts.store";
import { resetRuntimeReady } from "@frontend/stores/RuntimeReady.store";
import { taskStore } from "@frontend/stores/Task.store";

import type { ServiceRegistry } from "./ServiceRegistry";
import { shutdownCanonicalServices } from "./CanonicalBoot";
import { shutdownWebhookSystem } from "./WebhookBoot";

/**
 * Shutdown all services in reverse dependency order.
 */
export async function shutdownAll(
  registry: ServiceRegistry,
  cleanups: Array<() => void>,
): Promise<void> {
  pluginLogger.info(`[ShutdownSequence] Starting teardown...`);

  // 0. Event listener cleanups from onLayoutReady
  for (const cleanup of cleanups) {
    try { cleanup(); } catch { /* already cleared */ }
  }

  // 1. Intelligence layer
  if (registry.intelligence) {
    safeCall(() => registry.intelligence!.aiOrchestrator.destroy());
    safeCall(() => registry.intelligence!.attentionGateFilter?.destroy());
    registry.intelligence = null;
  }

  // 1b. Webhook system (before pipelines, since it may still be dispatching)
  await safeCallAsync(() => shutdownWebhookSystem(registry.webhook));
  registry.webhook = null;

  // 2. Pipeline services
  if (registry.pipelines) {
    safeCall(() => registry.pipelines!.executionPipeline.stop());
    safeCall(() => registry.pipelines!.taskQueryEngine.stop());
    safeCall(() => registry.pipelines!.reminderService.stop());
    safeCall(() => registry.pipelines!.escalationManager?.stop());
    safeCall(() => registry.pipelines!.integrationManager.stop());
    registry.pipelines = null;
  }

  // 3. Runtime validation
  if (registry.runtimeValidation) {
    safeCall(() => registry.runtimeValidation!.mlRuntimeAdapter.stop());
    safeCall(() => registry.runtimeValidation!.taskLifecycle.stop());
    registry.runtimeValidation = null;
  }

  // 4. Engine layer
  if (registry.engine) {
    await safeCallAsync(() => registry.engine!.engineController.stop());
    safeCall(() => registry.engine!.dependencyManager.stop());
    safeCall(() => registry.engine!.cacheManager.stop());
    registry.engine = null;
  }

  // 5. CQRS layer
  if (registry.cqrs) {
    safeCall(() => registry.cqrs!.commandRegistry.destroy());
    safeCall(() => registry.cqrs!.reactiveBlockLayer.stop());
    safeCall(() => registry.cqrs!.reactiveTaskManager.destroy());
    safeCall(() => registry.cqrs!.runtimeBridge.stop());
    safeCall(() => registry.cqrs!.taskService.stop());
    safeCall(() => registry.cqrs!.syncService.stop());
    registry.cqrs = null;
  }

  // 6. UI layer (mount service, float handles)
  if (registry.ui) {
    safeCall(() => registry.ui!.mountService.destroyAll());
    safeCall(() => registry.ui!.reminderFloatHandle?.destroy());
    registry.ui = null;
  }

  // 7. Core services
  if (registry.core) {
    await safeCallAsync(() => registry.core!.taskStorage.flush());
    safeCall(() => registry.core!.taskStorage.stopSyncRetryProcessor());
    await safeCallAsync(() => registry.core!.eventService.shutdown());
    await safeCallAsync(() => registry.core!.webhookEventService.shutdown());
    safeCall(() => registry.core!.pluginEventBus.clear());
    registry.core = null;
  }

  // 8. Frontend singleton disconnects
  safeCall(() => uiMutationService.disconnect());
  safeCall(() => uiEventService.disconnect());
  safeCall(() => uiQueryService.disconnect());
  safeCall(() => taskStore.disconnectBackend());

  // 9. Reset store singletons
  safeCall(() => resetSettingsStore());
  safeCall(() => resetOptionsStorage());
  safeCall(() => resetSavedQueryStore());
  safeCall(() => resetKeyboardShortcutActions());
  safeCall(() => resetRuntimeReady());

  // 10. Reset module-level singletons
  safeCall(() => OptimisticUpdateManager.resetInstance());
  safeCall(() => TaskUIStateManager.resetInstance());
  safeCall(() => resetBridgeInstance());
  safeCall(() => resetArchiveCompression());
  safeCall(() => resetOptimizedJSON());
  safeCall(() => resetReportedIssues());

  // 11. Flush logs + metrics
  safeCall(() => clearBackendLogs());
  safeCall(() => performanceMonitor.clearMetrics());
  safeCall(() => perfLogger.clearLogs());

  // 12. Canonical service graph teardown
  safeCall(() => shutdownCanonicalServices());

  pluginLogger.info(`[ShutdownSequence] Teardown complete`);
}

// ── Helpers ─────────────────────────────────────────────────

function safeCall(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    pluginLogger.warn(`[ShutdownSequence] Cleanup error:`, err);
  }
}

async function safeCallAsync(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    pluginLogger.warn(`[ShutdownSequence] Async cleanup error:`, err);
  }
}
