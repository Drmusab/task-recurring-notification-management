import { createHash, createHmac, randomUUID } from 'crypto';

import type { TaskRecurringEnvelope, TaskRecurringOperation } from './types';

export function buildEnvelope<TData>(operation: TaskRecurringOperation, data: TData): TaskRecurringEnvelope<TData> {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'n8n',
    operation,
    data,
  };
}

export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function digestPayload(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}
