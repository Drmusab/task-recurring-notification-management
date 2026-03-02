# Webhook System — Architecture & Integration Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Event Flow](#event-flow)
3. [Configuration](#configuration)
4. [Security](#security)
5. [Retry & Queue](#retry--queue)
6. [n8n Integration](#n8n-integration)
7. [Frontend Settings UI](#frontend-settings-ui)
8. [Logging & Debugging](#logging--debugging)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The webhook system follows a **clean architecture** with three layers:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│  WebhookSettings.svelte ←→ Webhook.store.ts             │
└──────────────────────┬──────────────────────────────────┘
                       │ (Svelte stores)
┌──────────────────────▼──────────────────────────────────┐
│                 Application Layer                        │
│  WebhookBoot.ts → WebhookManager (orchestrator)         │
│  ServiceRegistry.webhook                                │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Infrastructure Layer                        │
│  webhook-manager.ts   (lifecycle + public API)          │
│  webhook-events.ts    (domain → webhook mapping)        │
│  webhook-dispatcher.ts (HTTP delivery engine)           │
│  webhook-queue.ts     (persistent priority queue)       │
│  webhook-retry.ts     (exponential backoff engine)      │
│  webhook-security.ts  (HMAC-SHA256 + domain whitelist)  │
│  webhook-types.ts     (single source of truth)          │
│  webhook-logger.ts    (structured ring-buffer logger)   │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Infrastructure-only HTTP calls | No domain layer pollution |
| Web Crypto API for HMAC | Built into Electron, no npm deps |
| Ring-buffer logger | Fixed memory, no unbounded growth |
| Token-bucket rate limiter | Prevents self-DoS on burst events |
| Plugin `loadData/saveData` persistence | SiYuan-native, survives restarts |
| Opt-in (disabled by default) | Zero runtime cost when unused |

---

## Event Flow

```
DomainTask mutation
       │
       ▼
  EventBus.emit("task:completed", payload)
       │
       ▼
  WebhookManager (subscriber)
       │
       ▼
  webhook-events.ts — fromDomainEvent()
  Maps DomainEventType → WebhookEventType
  Builds canonical WebhookPayload
       │
       ▼
  webhook-queue.ts — enqueue()
  Deduplicates, applies priority, persists
       │
       ▼
  webhook-dispatcher.ts — flush()
  For each active endpoint:
    ├─ webhook-security.ts — buildSignatureHeaders()
    ├─ HTTP POST with timeout
    ├─ On success → log + dequeue
    └─ On failure → webhook-retry.ts — schedule retry
       │
       ▼
  webhook-logger.ts — deliverySuccess() / deliveryFailure()
```

### Supported Domain Events → Webhook Events

| Domain Event (`EventBus`) | Webhook Event | Description |
|---------------------------|---------------|-------------|
| `task:created` | `task.created` | New task created |
| `task:updated` | `task.updated` | Task properties changed |
| `task:completed` | `task.completed` | Task marked complete |
| `task:deleted` | `task.deleted` | Task removed |
| `task:overdue` | `task.overdue` | Task passed due date |
| `task:rescheduled` | `task.rescheduled` | Due date changed |
| `task:recurring:generated` | `task.recurring.generated` | Recurrence generated next occurrence |
| — | `task.due_soon` | Approaching due date |
| — | `task.dependency.resolved` | Blocking dependency completed |
| — | `task.escalated` | Task escalated by attention system |
| — | `system.test` | Test ping from settings UI |
| — | `system.health` | System health check |

---

## Configuration

### Webhook Settings Structure

```typescript
interface WebhookSettings {
  enabled: boolean;                    // Global kill switch
  endpoints: WebhookEndpoint[];       // List of webhook endpoints
  retryPolicy: WebhookRetryPolicy;    // Global retry configuration
  globalHeaders: Record<string, string>; // Headers added to ALL requests
  payloadFormat: "full" | "compact";  // Payload size control
  includeTaskSnapshot: boolean;       // Include full task data in payload
  domainWhitelist: string[];          // Allowed destination domains
  rateLimitPerMinute: number;         // Max deliveries per minute
}

interface WebhookEndpoint {
  id: string;                         // UUID
  name: string;                       // Human label
  url: string;                        // Destination URL
  secret: string;                     // HMAC signing key
  events: WebhookEventType[];         // Subscribed events
  enabled: boolean;                   // Per-endpoint toggle
  headers?: Record<string, string>;   // Per-endpoint custom headers
  timeout?: number;                   // Request timeout (ms)
}
```

### Default Values

| Setting | Default | Notes |
|---------|---------|-------|
| `enabled` | `false` | Must opt-in |
| `retryPolicy.maxRetries` | `5` | Per delivery attempt |
| `retryPolicy.baseDelayMs` | `1000` | 1 second initial delay |
| `retryPolicy.maxDelayMs` | `300000` | 5 minute max delay |
| `retryPolicy.backoffMultiplier` | `2` | Exponential backoff |
| `rateLimitPerMinute` | `60` | 1 per second sustained |
| `payloadFormat` | `"full"` | Includes task snapshot |

---

## Security

### HMAC-SHA256 Signature Verification

Every webhook delivery includes these headers:

| Header | Description |
|--------|-------------|
| `x-webhook-signature-256` | `sha256=<hex-encoded HMAC>` |
| `x-webhook-timestamp` | Unix timestamp (ms) of signing |
| `x-webhook-delivery` | Unique delivery UUID |
| `x-webhook-event` | Event type (e.g., `task.completed`) |
| `x-webhook-source` | `siyuan-task-plugin` |

#### Verification Algorithm (receiver side)

```javascript
const crypto = require('crypto');

function verifySignature(secret, body, receivedSignature, timestamp) {
  // 1. Check timestamp freshness (reject > 5 min old)
  const age = Date.now() - parseInt(timestamp, 10);
  if (age > 5 * 60 * 1000) throw new Error('Timestamp expired');

  // 2. Compute expected signature
  const payload = `${timestamp}.${body}`;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // 3. Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expected)
  );
}
```

### Domain Whitelisting

If `domainWhitelist` is non-empty, only URLs whose hostname matches a whitelist entry are allowed. This prevents accidental data exfiltration to unintended endpoints.

### Rate Limiting

Token-bucket rate limiter prevents self-DoS during burst events (e.g., bulk task import). When rate limited, deliveries are queued and retried after the bucket refills.

---

## Retry & Queue

### Retry Policy

Exponential backoff with jitter:

```
delay = min(baseDelay × backoffMultiplier^attempt, maxDelay) + random_jitter
```

| Attempt | Delay (base=1s, mult=2×) |
|---------|--------------------------|
| 0 | ~1s |
| 1 | ~2s |
| 2 | ~4s |
| 3 | ~8s |
| 4 | ~16s |
| 5 (max) | Exhausted → logged as failure |

### Retryable Status Codes

| Code | Retryable | Reason |
|------|-----------|--------|
| 200–299 | No | Success |
| 400, 401, 403 | No | Client error (won't fix itself) |
| 404, 405 | No | Wrong URL/method |
| 429 | **Yes** | Rate limited by receiver |
| 500 | **Yes** | Server error |
| 502, 503, 504 | **Yes** | Gateway/timeout |

### Persistent Queue

- Stored via `plugin.saveData("webhook-queue")`
- Survives plugin restarts and SiYuan reboots
- Priority-ordered (overdue events get priority)
- Deduplication: same event + same endpoint within 5s window
- Capacity limit: 1000 entries (oldest evicted)

---

## n8n Integration

### Setup Steps

1. **In n8n**: Create a Webhook node with POST method and a custom path (e.g., `/siyuan-tasks`)
2. **In SiYuan Plugin Settings → Webhooks**:
   - Enable webhooks
   - Add endpoint: paste n8n webhook URL
   - Set a shared secret (same in both systems)
   - Select events to subscribe to
3. **Test**: Click "Test" button to send a ping. Verify n8n receives it.

### Example n8n Workflow

See [docs/n8n-example-workflow.json](./n8n-example-workflow.json) for a complete importable workflow that:
- Receives webhook events
- Verifies HMAC signatures
- Routes by event type (completed, overdue, created, rescheduled)
- Sends Telegram notifications for completed/overdue tasks
- Creates Notion database entries for new tasks
- Logs rescheduled events for analytics

### Payload Format

```json
{
  "event": "task.completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "siyuan-task-plugin",
  "version": "2.0.0",
  "deliveryId": "d_abc123",
  "data": {
    "task": {
      "id": "20240115103000-abc",
      "title": "Review quarterly report",
      "status": "completed",
      "priority": "high",
      "dueAt": "2024-01-15T17:00:00.000Z",
      "completedAt": "2024-01-15T10:30:00.000Z",
      "tags": ["work", "quarterly"],
      "recurrence": null
    },
    "previousStatus": "in_progress",
    "triggeredBy": "user"
  }
}
```

---

## Frontend Settings UI

The `WebhookSettings.svelte` component provides:

| Section | Features |
|---------|----------|
| **Global Toggle** | Enable/disable all webhooks + status bar |
| **Endpoints** | Add, edit, remove, toggle, test per endpoint |
| **Event Types** | Checkbox grid for subscribing per endpoint |
| **Security** | Domain whitelist, rate limit configuration |
| **Retry Policy** | Max retries, delays, backoff multiplier |
| **Delivery Log** | Timestamped table of recent deliveries with status |
| **Queue** | Current queue size and items awaiting delivery |

Access via: **Settings → Webhooks** tab

---

## Logging & Debugging

### Webhook Logger

The dedicated webhook logger (`webhook-logger.ts`) provides:

- **Ring buffer** with configurable max size (default 500 entries)
- **Categories**: `lifecycle`, `delivery`, `retry`, `security`, `general`
- **Levels**: `debug`, `info`, `warn`, `error`
- **Query API**: Filter by level, category, endpoint, time range, text search
- **Export**: JSON and CSV export for analysis

### Accessing Logs

From the WebhookSettings UI in the Delivery Log section, or programmatically:

```typescript
import * as webhookLogger from "@infrastructure/logging/webhook-logger";

// Recent errors
const errors = webhookLogger.getErrors();

// Delivery stats
const stats = webhookLogger.getStats();

// Custom query
const filtered = webhookLogger.query({
  category: "delivery",
  level: "error",
  since: Date.now() - 3600000, // last hour
});

// Export for analysis
const csv = webhookLogger.exportAsCsv();
```

---

## API Reference

### WebhookManager (Public API)

```typescript
class WebhookManager {
  // Lifecycle
  initialize(): Promise<void>
  start(): void
  stop(): void
  shutdown(): Promise<void>

  // Settings
  getSettings(): WebhookSettings
  updateSettings(patch: Partial<WebhookSettings>): Promise<void>

  // Endpoints
  addEndpoint(params: CreateEndpointParams): Promise<WebhookEndpoint>
  updateEndpoint(id: string, patch: UpdateEndpointParams): Promise<void>
  removeEndpoint(id: string): Promise<void>
  toggleEndpoint(id: string, enabled: boolean): Promise<void>

  // Testing
  testEndpoint(endpointId: string): Promise<WebhookTestResult>

  // Diagnostics
  getStatus(): WebhookSystemStatus
  getDeliveryLog(): DeliveryLogEntry[]
}
```

### WebhookStore (Frontend Svelte Store)

```typescript
// Subscribe to store for reactive UI updates
import { webhookStore } from "@frontend/stores/Webhook.store";

// Derived stores
import {
  webhooksEnabled,
  webhookEndpoints,
  activeEndpointCount,
  availableEventTypes,
} from "@frontend/stores/Webhook.store";
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No webhooks delivered | System disabled | Enable in Settings → Webhooks |
| All endpoints show "error" | Invalid URL or network issue | Check URLs, test with ping |
| "Domain not whitelisted" | Domain whitelist active | Add domain to whitelist |
| "Rate limited" | Too many events in burst | Increase rate limit or reduce subscribed events |
| Signature verification fails | Secret mismatch | Ensure same secret in plugin & receiver |
| Queue growing unbounded | Receiver offline + retries exhausted | Check receiver availability |
| "Timeout" errors | Receiver too slow | Increase endpoint timeout (default 10s) |

---

## File Map

| File | Purpose |
|------|---------|
| `src/infrastructure/webhooks/webhook-types.ts` | Canonical type definitions (SSOT) |
| `src/infrastructure/webhooks/webhook-manager.ts` | Orchestrator — public API |
| `src/infrastructure/webhooks/webhook-events.ts` | Domain → webhook event mapping |
| `src/infrastructure/webhooks/webhook-dispatcher.ts` | HTTP delivery engine |
| `src/infrastructure/webhooks/webhook-queue.ts` | Persistent priority queue |
| `src/infrastructure/webhooks/webhook-retry.ts` | Exponential backoff engine |
| `src/infrastructure/webhooks/webhook-security.ts` | HMAC-SHA256, domains, rate limiting |
| `src/infrastructure/logging/webhook-logger.ts` | Structured ring-buffer logger |
| `src/frontend/stores/Webhook.store.ts` | Svelte reactive store |
| `src/frontend/components/settings/WebhookSettings.svelte` | Settings UI component |
| `src/application/WebhookBoot.ts` | Boot & shutdown wiring |
| `src/application/ServiceRegistry.ts` | `webhook` field in registry |
| `docs/n8n-example-workflow.json` | Importable n8n workflow |
| `tests/unit/webhooks/webhook-infrastructure.test.ts` | Unit tests |
