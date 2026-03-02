/**
 * Utils / Error Classes — Typed error hierarchy for the entire plugin.
 *
 * Domain errors live in @domain/errors.ts. This module re-exports them
 * and adds infrastructure-level errors (SiYuan API, webhooks, etc.).
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure — no imports from services, engine, runtime
 *   ✔ Each error carries structured context
 *   ✔ Serializable (no circular references)
 *   ✔ `.name` set for reliable `instanceof` checks across bundles
 */

// ── Re-export all domain errors ──────────────────────────────
export {
  DomainError,
  TaskNotFoundError,
  InvalidTaskStateError,
  TaskValidationError,
  CircularDependencyError,
  DependencyResolutionError,
  BlockValidationError,
  RecurrenceError,
  PipelineStageError,
} from "@domain/errors";

// ──────────────────────────────────────────────────────────────
// Infrastructure Errors
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when a SiYuan kernel API call returns a non-zero code
 * or fails at the network/transport layer.
 */
export class SiYuanApiError extends Error {
  /** SiYuan response code (non-zero), or -1 for transport errors */
  readonly code: number;
  /** The API endpoint that was called */
  readonly endpoint: string;
  /** Raw message from the kernel */
  readonly kernelMessage: string;

  constructor(code: number, endpoint: string = "", kernelMessage: string = "") {
    super(
      `SiYuan API error [${endpoint}] code=${code}` +
        (kernelMessage ? `: ${kernelMessage}` : ""),
    );
    this.name = "SiYuanApiError";
    this.code = code;
    this.endpoint = endpoint;
    this.kernelMessage = kernelMessage;
  }
}

/**
 * Thrown when a SiYuan capability (global API, dataDir, etc.) is unavailable.
 */
export class SiYuanCapabilityError extends Error {
  readonly capability: string;
  readonly feature: string;

  constructor(feature: string, capability: string, message: string) {
    super(message);
    this.name = "SiYuanCapabilityError";
    this.feature = feature;
    this.capability = capability;
  }
}

// ──────────────────────────────────────────────────────────────
// Webhook / Integration Errors
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when a webhook delivery fails.
 */
export class WebhookDeliveryError extends Error {
  readonly targetUrl: string;
  readonly statusCode?: number;
  readonly attempt: number;

  constructor(targetUrl: string, message: string, statusCode?: number, attempt: number = 1) {
    super(`Webhook delivery failed to ${targetUrl}: ${message}`);
    this.name = "WebhookDeliveryError";
    this.targetUrl = targetUrl;
    this.statusCode = statusCode;
    this.attempt = attempt;
  }
}

// ──────────────────────────────────────────────────────────────
// Cache Errors
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when a cache operation fails (rebuild, invalidation, etc.).
 */
export class CacheError extends Error {
  readonly cacheLayer: string;

  constructor(cacheLayer: string, message: string) {
    super(`Cache error [${cacheLayer}]: ${message}`);
    this.name = "CacheError";
    this.cacheLayer = cacheLayer;
  }
}

// ──────────────────────────────────────────────────────────────
// Boot / Runtime Errors
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when the plugin boot sequence fails at a specific phase.
 */
export class BootSequenceError extends Error {
  readonly phase: number;
  readonly phaseName: string;

  constructor(phase: number, phaseName: string, message: string) {
    super(`Boot sequence failed at phase ${phase} (${phaseName}): ${message}`);
    this.name = "BootSequenceError";
    this.phase = phase;
    this.phaseName = phaseName;
  }
}

/**
 * Thrown when a service is accessed before it has been initialized.
 */
export class ServiceNotInitializedError extends Error {
  readonly serviceName: string;

  constructor(serviceName: string) {
    super(`Service "${serviceName}" has not been initialized. Ensure boot sequence has completed.`);
    this.name = "ServiceNotInitializedError";
    this.serviceName = serviceName;
  }
}
