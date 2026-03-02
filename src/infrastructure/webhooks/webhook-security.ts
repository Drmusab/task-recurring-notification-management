/**
 * webhook-security.ts — Webhook Security Layer
 *
 * Provides HMAC-SHA256 payload signing, domain whitelisting,
 * and token-bucket rate limiting for outbound webhook deliveries.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure security concerns — signing, validation, throttling
 *   ✔ Uses Web Crypto API (available in SiYuan Electron runtime)
 *   ✔ All functions are stateless except RateLimiter
 *   ❌ No HTTP calls
 *   ❌ No storage access
 *   ❌ No frontend imports
 */

import type { WebhookEndpoint, WebhookPayload, WebhookSettings } from "./webhook-types";

// ═══════════════════════════════════════════════════════════════
// HMAC-SHA256 Signing
// ═══════════════════════════════════════════════════════════════

/**
 * HTTP headers added to signed webhook deliveries.
 */
export interface WebhookSignatureHeaders {
  readonly "X-Webhook-Signature": string;
  readonly "X-Webhook-Timestamp": string;
  readonly "X-Webhook-Event-ID": string;
}

/** Encoder shared across signing calls. */
const encoder = new TextEncoder();

/**
 * Import a shared secret as an HMAC-SHA256 CryptoKey.
 * Caches import result per secret for the session.
 */
const keyCache = new Map<string, CryptoKey>();

async function importKey(secret: string): Promise<CryptoKey> {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  keyCache.set(secret, key);
  return key;
}

/**
 * Sign a webhook payload body using HMAC-SHA256.
 *
 * The signature is computed as:
 *   HMAC-SHA256(secret, `${timestamp}.${body}`)
 *
 * This prevents replay attacks by binding the timestamp to the signature.
 *
 * @returns hex-encoded signature string prefixed with `sha256=`
 */
export async function signPayload(
  body: string,
  secret: string,
  timestamp: string,
): Promise<string> {
  if (!secret) return "";

  const key = await importKey(secret);
  const message = `${timestamp}.${body}`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  // Convert ArrayBuffer to hex string
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `sha256=${hex}`;
}

/**
 * Build the security headers for a signed delivery.
 *
 * @param body - JSON string of the payload
 * @param endpoint - The target endpoint (contains secret)
 * @param payload - The webhook payload (contains delivery.eventId)
 * @returns Signature headers, or empty object if unsigned
 */
export async function buildSignatureHeaders(
  body: string,
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
): Promise<Partial<WebhookSignatureHeaders>> {
  if (!endpoint.secret) return {};

  const timestamp = new Date().toISOString();
  const signature = await signPayload(body, endpoint.secret, timestamp);

  return {
    "X-Webhook-Signature": signature,
    "X-Webhook-Timestamp": timestamp,
    "X-Webhook-Event-ID": payload.delivery.eventId,
  };
}

/**
 * Clear the signing key cache.
 * Call when secrets change or at shutdown.
 */
export function clearKeyCache(): void {
  keyCache.clear();
}

// ═══════════════════════════════════════════════════════════════
// Domain Whitelisting
// ═══════════════════════════════════════════════════════════════

/**
 * Result of a domain validation check.
 */
export interface DomainValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
}

/** Known localhost patterns. */
const LOCALHOST_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
];

/**
 * Validate that a URL's domain is allowed by the webhook settings.
 *
 * Rules:
 * 1. If allowedDomains is empty → all domains are allowed
 * 2. Localhost URLs are blocked unless allowLocalhost = true
 * 3. Domain must exactly match one entry in allowedDomains (case-insensitive)
 * 4. Wildcard subdomains are supported: `*.example.com` matches `sub.example.com`
 * 5. Only HTTPS is allowed for non-localhost URLs
 */
export function validateDomain(
  url: string,
  settings: Pick<WebhookSettings, "allowedDomains" | "allowLocalhost">,
): DomainValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }

  const hostname = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol.toLowerCase();

  // Check localhost
  const isLocalhost = LOCALHOST_PATTERNS.some(
    (p) => hostname === p || hostname.endsWith(".localhost"),
  );

  if (isLocalhost) {
    if (!settings.allowLocalhost) {
      return { valid: false, reason: "Localhost URLs are not allowed" };
    }
    // Localhost may use http
    return { valid: true };
  }

  // Non-localhost must use HTTPS
  if (protocol !== "https:") {
    return { valid: false, reason: "Only HTTPS URLs are allowed for non-localhost endpoints" };
  }

  // If no whitelist, allow all
  if (!settings.allowedDomains || settings.allowedDomains.length === 0) {
    return { valid: true };
  }

  // Check against whitelist
  const allowed = settings.allowedDomains.some((pattern) => {
    const p = pattern.toLowerCase().trim();
    if (p.startsWith("*.")) {
      // Wildcard: *.example.com matches sub.example.com but not example.com
      const suffix = p.slice(2);
      return hostname.endsWith(`.${suffix}`);
    }
    return hostname === p;
  });

  if (!allowed) {
    return {
      valid: false,
      reason: `Domain "${hostname}" is not in the allowed domains list`,
    };
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
// Rate Limiter (Token Bucket)
// ═══════════════════════════════════════════════════════════════

/**
 * Token-bucket rate limiter for webhook deliveries.
 *
 * Tokens refill at a steady rate. Each delivery consumes one token.
 * When the bucket is empty, deliveries are deferred until tokens refill.
 */
export class WebhookRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private lastRefillTime: number;
  private refillRatePerMs: number;

  /**
   * @param maxPerMinute - Maximum events per minute (0 = unlimited)
   */
  constructor(maxPerMinute: number) {
    this.maxTokens = maxPerMinute <= 0 ? Infinity : maxPerMinute;
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
    this.refillRatePerMs = this.maxTokens === Infinity ? 0 : this.maxTokens / 60_000;
  }

  /**
   * Attempt to consume one token.
   *
   * @returns `true` if allowed, `false` if rate-limited
   */
  tryConsume(): boolean {
    if (this.maxTokens === Infinity) return true;

    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Time in milliseconds until the next token is available.
   * Returns 0 if a token is available now.
   */
  getRetryAfterMs(): number {
    if (this.maxTokens === Infinity) return 0;

    this.refill();

    if (this.tokens >= 1) return 0;

    const deficit = 1 - this.tokens;
    return Math.ceil(deficit / this.refillRatePerMs);
  }

  /**
   * Get current token count (for diagnostics).
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Update the rate limit. Creates a new bucket with the updated rate.
   */
  updateRate(maxPerMinute: number): void {
    const newMax = maxPerMinute <= 0 ? Infinity : maxPerMinute;
    const newRefillRate = newMax === Infinity ? 0 : newMax / 60_000;

    // Preserve proportional fill level
    const fillRatio = this.maxTokens === Infinity ? 1 : this.tokens / this.maxTokens;
    this.maxTokens = newMax;
    this.refillRatePerMs = newRefillRate;
    this.tokens = Math.min(newMax, Math.floor(fillRatio * newMax));
    this.lastRefillTime = Date.now();
  }

  /**
   * Reset the rate limiter to full capacity.
   */
  reset(): void {
    this.tokens = this.maxTokens;
    this.lastRefillTime = Date.now();
  }

  /** Refill tokens based on elapsed time. */
  private refill(): void {
    if (this.refillRatePerMs === 0) return;

    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    if (elapsed <= 0) return;

    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefillTime = now;
  }
}
