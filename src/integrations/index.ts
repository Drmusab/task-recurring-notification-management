/**
 * Integrations Layer — External System Connectivity
 *
 * Unifies webhook delivery (outbound), integration management,
 * and external service dispatching under a single boundary.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ All external HTTP goes through this layer
 *   ✔ Webhook signatures are generated here
 *   ✔ Retry logic is self-contained
 *   ❌ No domain mutations
 *   ❌ No SiYuan API calls
 */

// ── Integration Manager ──────────────────────────────────────
export {
  IntegrationManager,
  type IntegrationManagerDeps,
  type IntegrationManagerConfig,
} from "@backend/integrations";

// ── Webhook Service ──────────────────────────────────────────
export {
  WebhookService,
  type WebhookServiceDeps,
  type WebhookServiceConfig,
  type WebhookRegistration,
  type WebhookServiceStats,
} from "@backend/webhooks/WebhookService";

// ── Outbound Webhook Emitter ─────────────────────────────────
export {
  OutboundWebhookEmitter,
  type EmitterDeps,
  type EmitEventType,
  type EmitInput,
  type SuppressionReason,
  type EmitResult,
  type EmitterStats,
  type WebhookTarget,
  type FireResult,
} from "@backend/webhooks/OutboundWebhookEmitter";

// ── Integration Dispatcher ───────────────────────────────────
export {
  IntegrationDispatcher,
  type IntegrationDispatcherDeps,
  type DispatchBatchResult,
  type IntegrationDispatcherStats,
} from "@backend/webhooks/IntegrationDispatcher";

// ── Retry Manager ────────────────────────────────────────────
export {
  RetryManager,
  type RetryManagerDeps,
  type RetryConfig,
  type DeliveryRecord,
  type RetryManagerStats,
} from "@backend/webhooks/RetryManager";

// ── Signature Generator ──────────────────────────────────────
export {
  SignatureGenerator,
  type SignatureContext,
  type SignedPayload,
  type SignatureHeaders,
  type SignatureGeneratorStats,
} from "@backend/webhooks/SignatureGenerator";

// ── Webhook Event Mapper ─────────────────────────────────────
export {
  WebhookEventMapper,
  type MapperContext,
  type EscalationEventInput,
  type EscalationResolvedInput,
  type ValidatedMappingContext,
  type WebhookEventMapperStats,
} from "@backend/webhooks/WebhookEventMapper";

// ── Webhook Queue ────────────────────────────────────────────
export {
  WebhookQueue,
  type WebhookDeliveryTarget,
  type WebhookQueueItem,
  type WebhookQueueStats,
} from "@backend/webhooks/WebhookQueue";

// ── Webhook Types ────────────────────────────────────────────
export { WebhookError } from "@backend/webhooks/types/Error";
export type {
  WebhookResponse,
  WebhookErrorResponse,
  ResponseMeta,
  ErrorDetails,
  ErrorCode,
} from "@backend/webhooks/types/Response";
export type {
  WebhookRequest,
  RequestMeta,
  RequestContext,
} from "@backend/webhooks/types/Request";

// ── Canonical IntegrationService (Architecture Spec v3 §5.2) ──
export { IntegrationService as CanonicalIntegrationService } from "./IntegrationService";
export type {
  WebhookConfig as CanonicalWebhookConfig,
  WebhookDelivery,
} from "./IntegrationService";
