/**
 * SignatureGenerator — HMAC-SHA256 Webhook Payload Signing
 *
 * Signs webhook payloads using HMAC-SHA256 with a shared secret.
 * Generates deduplication keys from: taskID + dueAt + recurrenceInstance
 * to prevent duplicate automation triggers.
 *
 * Dedup key format: `{taskId}::{dueAtISO}::{recurrenceInstance}`
 *
 * Signature rule:
 *   HMAC(taskID + due + recurrenceInstance) → hex string
 *   This MUST be used to sign all outbound webhooks.
 *
 * Integration:
 *   IntegrationDispatcher.fire() → SignatureGenerator.signWithContext()
 *   OutboundWebhookEmitter.emit() → SignatureGenerator.generateDeduplicationKey()
 *
 * FORBIDDEN:
 *   - Store secrets in memory beyond the signing call scope
 *   - Import frontend / Svelte
 *   - Access DOM
 *   - Cache signed payloads (secrets may rotate)
 */

import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface SignatureContext {
  /** Task ID */
  taskId: string;
  /** Task due date (ISO 8601 or empty) */
  dueAt: string;
  /** Resolved recurrence instance key (ISO timestamp or empty) */
  recurrenceInstance?: string;
}

export interface SignedPayload {
  /** HMAC-SHA256 hex signature */
  signature: string;
  /** Deduplication key (taskId::dueAt::instance) */
  deduplicationKey: string;
  /** ISO timestamp when signature was generated */
  timestamp: string;
}

export interface SignatureHeaders {
  /** HMAC signature header value: sha256={hex} */
  "X-Webhook-Signature": string;
  /** Dedup key header */
  "X-Webhook-Dedup": string;
  /** Signing timestamp */
  "X-Webhook-Timestamp": string;
}

export interface SignatureGeneratorStats {
  totalSigned: number;
  totalUnsigned: number;
  totalDedupKeysGenerated: number;
}

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class SignatureGenerator {
  private active = false;

  // Stats
  private totalSigned = 0;
  private totalUnsigned = 0;
  private totalDedupKeysGenerated = 0;

  // ── Lifecycle ────────────────────────────────────────────────

  start(): void {
    if (this.active) return;
    this.active = true;
    logger.info("[SignatureGenerator] Started");
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    logger.info("[SignatureGenerator] Stopped", this.getStats());
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Generate a deduplication key from task context.
   *
   * Format: `{taskId}::{dueAtISO}::{recurrenceInstance}`
   *
   * Used to prevent duplicate webhook fires for the same task+instance.
   * Two webhook events with the same dedup key are considered duplicates.
   */
  generateDeduplicationKey(ctx: SignatureContext): string {
    this.totalDedupKeysGenerated++;
    const parts = [
      ctx.taskId,
      ctx.dueAt || "no-due",
      ctx.recurrenceInstance || "no-instance",
    ];
    return parts.join("::");
  }

  /**
   * Sign a raw payload string using HMAC-SHA256.
   *
   * @param payload  The JSON string to sign
   * @param secret   The shared secret for HMAC
   * @returns        Hex-encoded HMAC-SHA256 signature
   */
  async sign(payload: string, secret: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
      this.totalSigned++;
      return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // Fallback: no signature if crypto.subtle unavailable (e.g., non-HTTPS context)
      this.totalUnsigned++;
      logger.warn("[SignatureGenerator] HMAC signing unavailable — returning unsigned");
      return "unsigned";
    }
  }

  /**
   * Sign a webhook payload with full task context.
   *
   * The signature covers: deduplicationKey + payload body.
   * This ensures the same task+instance+payload always produces the same
   * signature, enabling receivers to detect duplicate deliveries.
   *
   * @param payload  JSON body string
   * @param secret   HMAC shared secret
   * @param ctx      Task context for dedup key generation
   */
  async signWithContext(
    payload: string,
    secret: string,
    ctx: SignatureContext,
  ): Promise<SignedPayload> {
    const deduplicationKey = this.generateDeduplicationKey(ctx);
    const signableContent = `${deduplicationKey}::${payload}`;
    const signature = await this.sign(signableContent, secret);
    return {
      signature,
      deduplicationKey,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build HTTP headers for a signed webhook delivery.
   *
   * @param signed  Result from signWithContext()
   */
  buildSignatureHeaders(signed: SignedPayload): SignatureHeaders {
    return {
      "X-Webhook-Signature": `sha256=${signed.signature}`,
      "X-Webhook-Dedup": signed.deduplicationKey,
      "X-Webhook-Timestamp": signed.timestamp,
    };
  }

  /**
   * Generate a unique delivery ID.
   */
  generateDeliveryId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `dlv_${crypto.randomUUID()}`;
    }
    return `dlv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Get signing statistics.
   */
  getStats(): SignatureGeneratorStats {
    return {
      totalSigned: this.totalSigned,
      totalUnsigned: this.totalUnsigned,
      totalDedupKeysGenerated: this.totalDedupKeysGenerated,
    };
  }
}
