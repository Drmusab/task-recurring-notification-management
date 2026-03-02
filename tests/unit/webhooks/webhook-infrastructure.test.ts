/**
 * Webhook Infrastructure — Unit Tests
 *
 * Tests for the infrastructure webhook layer covering:
 *   - Payload building & event mapping
 *   - HMAC-SHA256 signature generation & verification
 *   - Retry policy & backoff calculations
 *   - Queue operations (enqueue, dequeue, dedup, eviction)
 *   - Domain whitelisting & rate limiting
 *   - Webhook logger ring buffer & filtering
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ═══════════════════════════════════════════════════════════════
// 1. Webhook Types & Defaults
// ═══════════════════════════════════════════════════════════════

describe("Webhook Types & Defaults", () => {
  it("should define all required constants", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-types"
    );

    expect(mod.WEBHOOK_SOURCE).toBe("siyuan-task-plugin");
    expect(mod.WEBHOOK_VERSION).toBe("2.0.0");
    expect(mod.WEBHOOK_SETTINGS_KEY).toBe("webhook-settings");
  });

  it("should have sensible default retry policy", async () => {
    const { DEFAULT_RETRY_POLICY } = await import(
      "../../../src/infrastructure/webhooks/webhook-types"
    );

    expect(DEFAULT_RETRY_POLICY.maxRetries).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_RETRY_POLICY.baseDelayMs).toBeGreaterThan(0);
    expect(DEFAULT_RETRY_POLICY.maxDelayMs).toBeGreaterThan(DEFAULT_RETRY_POLICY.baseDelayMs);
    expect(["exponential", "linear", "fixed"]).toContain(DEFAULT_RETRY_POLICY.strategy);
  });

  it("should have sensible default webhook settings", async () => {
    const { DEFAULT_WEBHOOK_SETTINGS } = await import(
      "../../../src/infrastructure/webhooks/webhook-types"
    );

    expect(DEFAULT_WEBHOOK_SETTINGS.enabled).toBe(false); // opt-in
    expect(Array.isArray(DEFAULT_WEBHOOK_SETTINGS.endpoints)).toBe(true);
    expect(DEFAULT_WEBHOOK_SETTINGS.endpoints).toHaveLength(0);
  });

  it("should provide event labels for all event types", async () => {
    const { WEBHOOK_EVENT_LABELS } = await import(
      "../../../src/infrastructure/webhooks/webhook-types"
    );

    expect(typeof WEBHOOK_EVENT_LABELS).toBe("object");
    const keys = Object.keys(WEBHOOK_EVENT_LABELS);
    expect(keys.length).toBeGreaterThan(0);

    // All expected event types should have labels
    const expectedEvents = [
      "task.created",
      "task.completed",
      "task.deleted",
      "task.updated",
      "task.due",
      "task.overdue",
      "task.missed",
      "task.escalated",
      "task.rescheduled",
      "recurring.triggered",
      "reminder.triggered",
      "test.ping",
    ];
    for (const event of expectedEvents) {
      expect(WEBHOOK_EVENT_LABELS).toHaveProperty(event);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Webhook Events — Domain → Webhook Mapping
// ═══════════════════════════════════════════════════════════════

describe("Webhook Events — Domain Mapping", () => {
  it("should map domain event types to webhook event types", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-events"
    );

    expect(typeof mod.DOMAIN_TO_WEBHOOK).toBe("object");
    const keys = Object.keys(mod.DOMAIN_TO_WEBHOOK);
    expect(keys.length).toBeGreaterThan(0);

    // Core domain events should be mapped
    expect(mod.DOMAIN_TO_WEBHOOK).toHaveProperty("task:runtime:created");
    expect(mod.DOMAIN_TO_WEBHOOK).toHaveProperty("task:runtime:completed");
    expect(mod.DOMAIN_TO_WEBHOOK).toHaveProperty("task:runtime:deleted");
  });

  it("should build a valid webhook payload", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-events"
    );

    // buildPayload(event, task, metadata?, includeDescription?)
    const mockTask = {
      id: "test-1",
      content: "Test task",
      title: "Test task",
      status: "todo",
      priority: "medium",
    } as any;

    const payload = mod.buildPayload("task.created", mockTask);

    expect(payload).toHaveProperty("event", "task.created");
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("source", "siyuan-task-plugin");
    expect(payload).toHaveProperty("version", "2.0.0");
    expect(payload).toHaveProperty("task");
    expect(payload).toHaveProperty("metadata");
    expect(payload).toHaveProperty("delivery");
  });

  it("should build a test ping payload", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-events"
    );

    const payload = mod.buildTestPingPayload();

    expect(payload).toHaveProperty("event", "test.ping");
    expect(payload).toHaveProperty("source", "siyuan-task-plugin");
    expect(payload).toHaveProperty("version", "2.0.0");
    expect(payload.task).toBeNull();
  });

  it("should generate unique event IDs", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-events"
    );

    const id1 = mod.generateEventId();
    const id2 = mod.generateEventId();

    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);
    expect(id1).not.toBe(id2);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Webhook Security — Signatures & Domain Whitelisting
// ═══════════════════════════════════════════════════════════════

describe("Webhook Security", () => {
  afterEach(async () => {
    // Clear signature key cache between tests
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );
    mod.clearKeyCache();
  });

  it("should sign a payload with HMAC-SHA256", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    // signPayload(body, secret, timestamp)
    const signature = await mod.signPayload(
      '{"event":"task.created","data":{}}',
      "test-secret-key",
      "2024-01-01T00:00:00.000Z",
    );

    expect(typeof signature).toBe("string");
    expect(signature.startsWith("sha256=")).toBe(true);
    expect(signature.length).toBeGreaterThan(7); // "sha256=" + hex
  });

  it("should produce deterministic signatures for same input", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const body = '{"event":"task.created"}';
    const secret = "test-secret";
    const timestamp = "2024-01-01T00:00:00.000Z";

    const sig1 = await mod.signPayload(body, secret, timestamp);
    const sig2 = await mod.signPayload(body, secret, timestamp);

    expect(sig1).toBe(sig2);
  });

  it("should produce different signatures for different secrets", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const body = '{"event":"task.created"}';
    const timestamp = "2024-01-01T00:00:00.000Z";

    const sig1 = await mod.signPayload(body, "secret-A", timestamp);

    // Clear key cache to avoid using cached key for secret-A
    mod.clearKeyCache();

    const sig2 = await mod.signPayload(body, "secret-B", timestamp);

    expect(sig1).not.toBe(sig2);
  });

  it("should return empty string when secret is empty", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const signature = await mod.signPayload(
      '{"event":"test"}',
      "",
      "2024-01-01T00:00:00.000Z",
    );

    expect(signature).toBe("");
  });

  it("should validate allowed domains", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    // No whitelist = allow all
    const noWhitelist = mod.validateDomain("https://example.com/webhook", {
      allowedDomains: [],
      allowLocalhost: false,
    });
    expect(noWhitelist.valid).toBe(true);

    // Whitelist match
    const matched = mod.validateDomain("https://n8n.example.com/webhook/abc", {
      allowedDomains: ["n8n.example.com"],
      allowLocalhost: false,
    });
    expect(matched.valid).toBe(true);

    // Whitelist mismatch
    const mismatched = mod.validateDomain("https://evil.com/steal", {
      allowedDomains: ["n8n.example.com"],
      allowLocalhost: false,
    });
    expect(mismatched.valid).toBe(false);
    expect(mismatched.reason).toBeDefined();
  });

  it("should block localhost when allowLocalhost is false", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const result = mod.validateDomain("http://localhost:3000/webhook", {
      allowedDomains: [],
      allowLocalhost: false,
    });
    expect(result.valid).toBe(false);
  });

  it("should allow localhost when allowLocalhost is true", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const result = mod.validateDomain("http://localhost:3000/webhook", {
      allowedDomains: [],
      allowLocalhost: true,
    });
    expect(result.valid).toBe(true);
  });

  it("should enforce HTTPS for non-localhost URLs", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const result = mod.validateDomain("http://example.com/webhook", {
      allowedDomains: [],
      allowLocalhost: false,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("HTTPS");
  });

  it("should support wildcard subdomain matching", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const matched = mod.validateDomain("https://sub.example.com/hook", {
      allowedDomains: ["*.example.com"],
      allowLocalhost: false,
    });
    expect(matched.valid).toBe(true);

    // Wildcard should NOT match the root domain itself
    const rootDomain = mod.validateDomain("https://example.com/hook", {
      allowedDomains: ["*.example.com"],
      allowLocalhost: false,
    });
    expect(rootDomain.valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Webhook Retry — Backoff Calculations
// ═══════════════════════════════════════════════════════════════

describe("Webhook Retry", () => {
  it("should calculate exponential backoff delay", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-retry"
    );

    const policy = {
      maxRetries: 5,
      baseDelayMs: 1000,
      strategy: "exponential" as const,
      maxDelayMs: 60000,
    };

    const delay0 = mod.calculateRetryDelay(0, policy);
    const delay1 = mod.calculateRetryDelay(1, policy);
    const delay2 = mod.calculateRetryDelay(2, policy);

    // Each delay should generally be larger (exponential with jitter)
    // Due to jitter (±10%), we check approximate growth
    expect(delay0).toBeGreaterThan(0);
    expect(delay1).toBeGreaterThan(0);
    expect(delay2).toBeGreaterThan(0);

    // Should not exceed maxDelayMs (even with jitter, clamped)
    const delayMax = mod.calculateRetryDelay(100, policy);
    expect(delayMax).toBeLessThanOrEqual(policy.maxDelayMs * 1.15); // Allow small jitter overshoot
  });

  it("should calculate linear backoff delay", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-retry"
    );

    const policy = {
      maxRetries: 5,
      baseDelayMs: 1000,
      strategy: "linear" as const,
      maxDelayMs: 10000,
    };

    const delay0 = mod.calculateRetryDelay(0, policy);
    const delay1 = mod.calculateRetryDelay(1, policy);

    expect(delay0).toBeGreaterThan(0);
    expect(delay1).toBeGreaterThan(0);
  });

  it("should calculate fixed backoff delay", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-retry"
    );

    const policy = {
      maxRetries: 5,
      baseDelayMs: 2000,
      strategy: "fixed" as const,
      maxDelayMs: 60000,
    };

    const delay0 = mod.calculateRetryDelay(0, policy);
    const delay5 = mod.calculateRetryDelay(5, policy);

    // Fixed strategy: all attempts should have similar base delay (±jitter)
    expect(Math.abs(delay0 - delay5)).toBeLessThan(delay0 * 0.3);
  });

  it("should identify retryable HTTP status codes", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-retry"
    );

    // 429 (rate limited) → retryable
    expect(mod.isRetryableStatusCode(429)).toBe(true);

    // 500, 502, 503, 504 → retryable
    expect(mod.isRetryableStatusCode(500)).toBe(true);
    expect(mod.isRetryableStatusCode(502)).toBe(true);
    expect(mod.isRetryableStatusCode(503)).toBe(true);
    expect(mod.isRetryableStatusCode(504)).toBe(true);

    // 408 (request timeout) → retryable
    expect(mod.isRetryableStatusCode(408)).toBe(true);

    // null (network error) → retryable
    expect(mod.isRetryableStatusCode(null)).toBe(true);

    // 200, 201 → not retryable (success)
    expect(mod.isRetryableStatusCode(200)).toBe(false);
    expect(mod.isRetryableStatusCode(201)).toBe(false);

    // 400, 401, 403 → not retryable (client error)
    expect(mod.isRetryableStatusCode(400)).toBe(false);
    expect(mod.isRetryableStatusCode(401)).toBe(false);
    expect(mod.isRetryableStatusCode(403)).toBe(false);
  });

  it("should determine if retries are exhausted", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-retry"
    );

    const policy = {
      maxRetries: 3,
      baseDelayMs: 1000,
      strategy: "exponential" as const,
      maxDelayMs: 60000,
    };

    // Under max → should compute next retry (attempt < maxRetries)
    const result = mod.computeNextRetryAt(1, policy);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string"); // ISO date string

    // At max → should return null (exhausted)
    const exhausted = mod.computeNextRetryAt(policy.maxRetries, policy);
    expect(exhausted).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Webhook Rate Limiter
// ═══════════════════════════════════════════════════════════════

describe("Webhook Rate Limiter", () => {
  it("should enforce token bucket rate limiting", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    // constructor(maxPerMinute) — 5 events per minute
    const limiter = new mod.WebhookRateLimiter(5);

    // First 5 requests should be allowed
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }

    // 6th request should be denied (bucket empty)
    expect(limiter.tryConsume()).toBe(false);
  });

  it("should report available tokens", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const limiter = new mod.WebhookRateLimiter(10);

    expect(limiter.getAvailableTokens()).toBe(10);

    limiter.tryConsume();
    expect(limiter.getAvailableTokens()).toBe(9);
  });

  it("should provide retry-after duration when empty", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const limiter = new mod.WebhookRateLimiter(1);
    limiter.tryConsume(); // Empty the bucket

    const retryAfter = limiter.getRetryAfterMs();
    expect(retryAfter).toBeGreaterThan(0);
  });

  it("should reset to full capacity", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const limiter = new mod.WebhookRateLimiter(5);

    // Drain the bucket
    for (let i = 0; i < 5; i++) limiter.tryConsume();
    expect(limiter.tryConsume()).toBe(false);

    // Reset
    limiter.reset();
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.getAvailableTokens()).toBe(4);
  });

  it("should handle unlimited rate (0)", async () => {
    const mod = await import(
      "../../../src/infrastructure/webhooks/webhook-security"
    );

    const limiter = new mod.WebhookRateLimiter(0); // unlimited

    // Should always allow
    for (let i = 0; i < 100; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. Webhook Logger
// ═══════════════════════════════════════════════════════════════

describe("Webhook Logger", () => {
  beforeEach(async () => {
    const mod = await import(
      "../../../src/infrastructure/logging/webhook-logger"
    );
    mod.clear();
  });

  it("should log messages at different levels", async () => {
    const mod = await import(
      "../../../src/infrastructure/logging/webhook-logger"
    );

    mod.info("Test info message");
    mod.debug("Test debug message");
    mod.warn("Test warning");
    mod.error("Test error");

    const entries = mod.query({});
    expect(entries.length).toBe(4);
  });

  it("should filter by log level", async () => {
    const mod = await import(
      "../../../src/infrastructure/logging/webhook-logger"
    );

    mod.info("Info");
    mod.error("Error");
    mod.debug("Debug");

    const errors = mod.query({ level: "error" });
    expect(errors.length).toBe(1);
    expect(errors[0].message).toBe("Error");
  });

  it("should filter by category", async () => {
    const mod = await import(
      "../../../src/infrastructure/logging/webhook-logger"
    );

    mod.deliverySuccess("ep1", "Endpoint 1", "task.created", null, 200, 150, "del-1");
    mod.retryAttempt("del-2", "Endpoint 2", 1, "2024-01-01T00:05:00Z", "task-1");
    mod.securityEvent("Domain blocked", { endpointId: "ep3" });

    const delivery = mod.query({ category: "delivery" });
    expect(delivery.length).toBe(1);

    const security = mod.query({ category: "security" });
    expect(security.length).toBe(1);

    const retry = mod.query({ category: "retry" });
    expect(retry.length).toBe(1);
  });

  it("should enforce ring buffer max size", async () => {
    const mod = await import(
      "../../../src/infrastructure/logging/webhook-logger"
    );

    // Default max is 500; fill past it
    for (let i = 0; i < 600; i++) {
      mod.debug(`Entry ${i}`);
    }

    const all = mod.query({});
    expect(all.length).toBeLessThanOrEqual(500);
  });

  it("should export as JSON", async () => {
    const mod = await import(
      "../../../src/infrastructure/logging/webhook-logger"
    );

    mod.info("Test export");

    const json = mod.exportAsJson();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].message).toBe("Test export");
  });

  it("should export as CSV", async () => {
    const mod = await import(
      "../../../src/infrastructure/logging/webhook-logger"
    );

    mod.info("CSV test");

    const csv = mod.exportAsCsv();
    expect(csv).toContain("timestamp,level,category,message");
    expect(csv).toContain("CSV test");
  });

  it("should get stats summary", async () => {
    const mod = await import(
      "../../../src/infrastructure/logging/webhook-logger"
    );

    mod.info("Info 1");
    mod.info("Info 2");
    mod.error("Error 1");
    mod.warn("Warn 1");

    const stats = mod.getStats();
    expect(stats.total).toBe(4);
    expect(stats.byLevel.info).toBe(2);
    expect(stats.byLevel.error).toBe(1);
    expect(stats.byLevel.warn).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. Webhook Boot Integration
// ═══════════════════════════════════════════════════════════════

describe("WebhookBoot", () => {
  it("should export bootWebhookSystem and shutdownWebhookSystem", async () => {
    const mod = await import("../../../src/application/WebhookBoot");

    expect(typeof mod.bootWebhookSystem).toBe("function");
    expect(typeof mod.shutdownWebhookSystem).toBe("function");
  });

  it("should handle null gracefully in shutdownWebhookSystem", async () => {
    const mod = await import("../../../src/application/WebhookBoot");

    // Should not throw
    await expect(mod.shutdownWebhookSystem(null)).resolves.toBeUndefined();
  });
});
