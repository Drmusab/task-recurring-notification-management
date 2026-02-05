# Outbound Webhooks Guide

## Overview

Outbound webhooks allow external systems to receive real-time notifications when events occur in the Recurring Task Management Plugin.

## Event Types

| Event | Triggered When | Payload |
|-------|---------------|---------|
| `task.created` | New task created | Title, due date, recurrence pattern |
| `task.updated` | Task metadata updated | Updated fields |
| `task.completed` | Task marked complete | Completion time, next occurrence (if recurring) |
| `task.deleted` | Task deleted | Deletion time |
| `task.due` | Task becomes due | Due date, priority |
| `task.overdue` | Task passes due date | Overdue duration |
| `recurrence.paused` | Recurrence paused | Pause reason |
| `recurrence.resumed` | Recurrence resumed | Next due date |
| `recurrence.regenerated` | Next occurrence created | Previous and next due dates |
| `recurrence.skipped` | Occurrence skipped | Skipped dates, next date |
| `notification.sent` | Notification triggered | Notification type |

## Creating a Subscription

```bash
curl -X POST "http://localhost:8080/webhook/v1" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
  "command": "v1/events/subscriptions/create",
  "data": {
    "url": "https://your-server.com/webhook",
    "events": ["task.completed", "task.overdue"],
    "description": "My automation",
    "filters": {
      "tags": ["important"],
      "priority": ["high"]
    }
  },
  "meta": { ... }
}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "sub_abc123",
    "url": "https://your-server.com/webhook",
    "events": ["task.completed", "task.overdue"],
    "secret": "a7f3e9c2b1d4f8e6...",
    "active": true,
    "_note": "Secret is only shown once. Store it securely."
  }
}
```

⚠️ **Save the secret!** It's only shown once and is required for signature verification.

## Receiving Webhooks

### Webhook Payload Format

```json
{
  "event": "task.completed",
  "taskId": "task_xyz789",
  "workspaceId": "default",
  "timestamp": "2026-01-24T14:30:00Z",
  "eventId": "evt_1706108400000_abc123",
  "payload": {
    "title": "Weekly team standup",
    "completedAt": "2026-01-24T14:30:00Z",
    "isRecurring": true,
    "nextDueDate": "2026-01-31T09:00:00Z"
  }
}
```

### Signature Verification

**Headers:**
```
X-Webhook-Signature: a7f3e9c2b1d4f8e6a9c7b2d1f4e8c6a9...
X-Event-Type: task.completed
X-Event-ID: evt_1706108400000_abc123
X-Workspace-ID: default
```

**Verification (Node.js):**
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === expectedSignature;
}

// In your webhook handler:
const signature = req.headers['x-webhook-signature'];
if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
  return res.status(401).send('Invalid signature');
}
```

## Retry Behavior

Failed webhook deliveries are automatically retried with exponential backoff:

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | Immediate | 0s |
| 2 | 1s | 1s |
| 3 | 2s | 3s |
| 4 | 4s | 7s |
| 5 | 8s | 15s |

After 5 failed attempts, the event is marked as "abandoned".

**Success Criteria:** HTTP status 200-299

## Filtering Events

### By Event Type
```json
{
  "events": ["task.completed", "task.overdue"]
}
```

### All Events
```json
{
  "events": ["*"]
}
```

### By Tags
```json
{
  "filters": {
    "tags": ["important", "urgent"]
  }
}
```
Only sends events for tasks with these tags.

### By Priority
```json
{
  "filters": {
    "priority": ["high", "medium"]
  }
}
```
Only sends events for high/medium priority tasks.

## Best Practices

### 1. Respond Quickly
```javascript
app.post('/webhook', async (req, res) => {
  // ✅ Respond immediately
  res.status(200).send('OK');

  // ✅ Process asynchronously
  processEvent(req.body).catch(console.error);
});
```

### 2. Handle Duplicates
```javascript
const processedEvents = new Set();

function processEvent(event) {
  if (processedEvents.has(event.eventId)) {
    console.log('Duplicate event, skipping');
    return;
  }

  processedEvents.add(event.eventId);
  // Process event...
}
```

### 3. Implement Idempotency
```javascript
// Store event IDs in database
async function processEvent(event) {
  const exists = await db.events.findOne({ eventId: event.eventId });
  if (exists) return; // Already processed

  await db.events.insert({ eventId: event.eventId, processedAt: new Date() });
  // Process event...
}
```

### 4. Monitor Failures
Check subscription stats regularly:
```bash
curl ... -d '{ "command": "v1/events/subscriptions/list", ... }'
```

Response includes delivery stats:
```json
{
  "deliveryStats": {
    "totalSent": 1000,
    "totalSucceeded": 995,
    "totalFailed": 5
  }
}
```

## n8n Integration

### Create Webhook Trigger

1. Add "Webhook" node to workflow
2. Set HTTP Method: POST
3. Set Authentication: Header Auth
   - Name: `X-Webhook-Signature`
   - Value: `{{ verifySignature() }}`

4. Add "Function" node for signature verification:
```javascript
const crypto = require('crypto');

const payload = $json;
const signature = $node["Webhook"].context["headers"]["x-webhook-signature"];
const secret = "YOUR_WEBHOOK_SECRET";

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}

return payload;
```

5. Add logic nodes based on event type:
```javascript
if ($json.event === 'task.overdue') {
  // Send Slack message
} else if ($json.event === 'task.completed') {
  // Update Google Sheets
}
```

## Troubleshooting

### Webhooks not being delivered

1. Check subscription is active:
   ```bash
   GET /v1/events/subscriptions/list
   ```

2. Check URL is accessible:
   ```bash
   curl -X POST https://your-url.com/webhook
   ```

3. Check firewall/proxy settings

### Signature verification fails

- Ensure you're using the correct secret
- Verify you're hashing the exact JSON string received
- Check for JSON parsing/re-serialization differences

### High failure rate

- Ensure webhook endpoint responds within 10 seconds
- Return 2xx status code on success
- Check server logs for errors