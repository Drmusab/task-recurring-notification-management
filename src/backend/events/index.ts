/**
 * Events module barrel
 *
 * Re-exports event types and the escalation / notification pipeline.
 */
export * from "./types/EventTypes";
// SubscriptionTypes removed — dead code (no production consumers)
export { NotificationService } from "./NotificationService";
export type { WebhookRegistration, DispatchResult, NotificationServiceStats } from "./NotificationService";
export { EscalationManager } from "./EscalationManager";
export type { EscalationCheckResult, EscalationManagerStats } from "./EscalationManager";
