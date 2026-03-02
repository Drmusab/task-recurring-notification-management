/**
 * Events Layer — EventBus, Event Definitions, Subscribers
 *
 * Central typed pub/sub system for ALL domain and runtime events.
 * Every state change in the system flows through EventBus.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ All state changes MUST emit events
 *   ✔ Events are fire-and-forget (no return values)
 *   ✔ Subscribers MUST NOT throw (wrap in try/catch)
 *   ❌ No synchronous blocking in handlers
 *   ❌ No circular event chains
 */

// ── EventBus + Event Map ─────────────────────────────────────
export { PluginEventBus, pluginEventBus } from "@backend/core/events/PluginEventBus";
export type { PluginEventMap } from "@backend/core/events/PluginEventBus";

// ── Escalation Events ────────────────────────────────────────
export { EscalationManager } from "@backend/events/EscalationManager";

// ── Notification Events ──────────────────────────────────────
export { NotificationService as EventNotificationService } from "@backend/events/NotificationService";

// ── Canonical EventBus (Architecture Spec v3 §7) ────────────
export { EventBus, eventBus } from "./EventBus";
export type { DomainEventType, EventPayloadMap, EventHandler, WebhookRef } from "./EventBus";
