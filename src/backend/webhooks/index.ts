/**
 * Webhooks module barrel
 *
 * Re-exports the full runtime-validated webhook pipeline:
 *
 *   SignatureGenerator     — HMAC-SHA256 signing + dedup keys
 *   WebhookEventMapper     — event payload mapping with recurrence context
 *   WebhookQueue           — priority queue with dedup
 *   OutboundWebhookEmitter — validation gate (dependency, recurrence, block)
 *   IntegrationDispatcher  — HTTP delivery engine
 *   RetryManager           — block-validated retry with AI urgency guard
 *   WebhookService         — top-level orchestrator
 *
 * Legacy types (Request, Response, Error) remain for backward compatibility.
 */

// ── Types ──
export * from "./types/Error";
export * from "./types/Response";

// ── Signature ──
export { SignatureGenerator } from "./SignatureGenerator";
export type { SignedPayload, SignatureContext, SignatureHeaders, SignatureGeneratorStats } from "./SignatureGenerator";

// ── Mapper ──
export { WebhookEventMapper } from "./WebhookEventMapper";
export type { MapperContext, EscalationEventInput, EscalationResolvedInput, ValidatedMappingContext, WebhookEventMapperStats } from "./WebhookEventMapper";

// ── Queue ──
export { WebhookQueue } from "./WebhookQueue";
export type { WebhookQueueItem, WebhookDeliveryTarget, WebhookQueueStats } from "./WebhookQueue";

// ── Emitter (validation gate) ──
export { OutboundWebhookEmitter } from "./OutboundWebhookEmitter";
export type { EmitterDeps, EmitInput, EmitResult, EmitterStats, SuppressionReason, WebhookTarget, FireResult } from "./OutboundWebhookEmitter";

// ── Dispatcher (HTTP delivery) ──
export { IntegrationDispatcher } from "./IntegrationDispatcher";
export type { IntegrationDispatcherDeps, DispatchBatchResult, IntegrationDispatcherStats } from "./IntegrationDispatcher";

// ── Retry ──
export { RetryManager } from "./RetryManager";
export type { RetryConfig, DeliveryRecord, RetryManagerStats } from "./RetryManager";

// ── Service (orchestrator) ──
export { WebhookService } from "./WebhookService";
export type { WebhookServiceDeps, WebhookServiceConfig, WebhookRegistration, WebhookServiceStats } from "./WebhookService";
