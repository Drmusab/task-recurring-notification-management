import { describe, it, expect } from 'vitest';
import { Validator } from '../../src/backend/webhooks/utils/Validator';
import { WebhookError } from '../../src/backend/webhooks/types/Error';

describe('Validator', () => {
  describe('validateRequest', () => {
    it('should accept valid request', () => {
      const validRequest = {
        command: 'v1/tasks/create',
        data: { title: 'Test Task' },
        meta: {
          requestId: 'req_001',
          timestamp: '2026-01-24T14:30:00.000Z',
          source: 'test',
        },
      };

      expect(() => Validator.validateRequest(validRequest)).not.toThrow();
    });

    it('should reject missing command', () => {
      const invalidRequest = {
        data: {},
        meta: { requestId: 'req_001', timestamp: '2026-01-24T14:30:00.000Z', source: 'test' },
      };

      expect(() => Validator.validateRequest(invalidRequest)).toThrow(WebhookError);
      expect(() => Validator.validateRequest(invalidRequest)).toThrow('Missing or invalid "command" field');
    });

    it('should reject invalid command format', () => {
      const invalidRequest = {
        command: 'invalid-command',
        data: {},
        meta: { requestId: 'req_001', timestamp: '2026-01-24T14:30:00.000Z', source: 'test' },
      };

      expect(() => Validator.validateRequest(invalidRequest)).toThrow('v{major}/{category}/{action}');
    });

    it('should reject non-ISO8601 timestamp', () => {
      const invalidRequest = {
        command: 'v1/tasks/create',
        data: {},
        meta: { requestId: 'req_001', timestamp: '2026-01-24', source: 'test' },
      };

      expect(() => Validator.validateRequest(invalidRequest)).toThrow('ISO-8601');
    });

    it('should accept valid idempotency key', () => {
      const validRequest = {
        command: 'v1/tasks/create',
        data: {},
        meta: {
          requestId: 'req_001',
          timestamp: '2026-01-24T14:30:00.000Z',
          source: 'test',
          idempotencyKey: 'slack_msg_123_create',
        },
      };

      expect(() => Validator.validateRequest(validRequest)).not.toThrow();
    });

    it('should reject invalid idempotency key characters', () => {
      const invalidRequest = {
        command: 'v1/tasks/create',
        data: {},
        meta: {
          requestId: 'req_001',
          timestamp: '2026-01-24T14:30:00.000Z',
          source: 'test',
          idempotencyKey: 'invalid key!@#',
        },
      };

      expect(() => Validator.validateRequest(invalidRequest)).toThrow('alphanumeric');
    });
  });

  describe('validateTimestampFreshness', () => {
    it('should accept recent timestamp', () => {
      const recent = new Date().toISOString();
      expect(() => Validator.validateTimestampFreshness(recent)).not.toThrow();
    });

    it('should reject old timestamp', () => {
      const old = new Date(Date.now() - 400000).toISOString(); // 400 seconds ago
      expect(() => Validator.validateTimestampFreshness(old)).toThrow('too old');
    });

    it('should reject future timestamp', () => {
      const future = new Date(Date.now() + 120000).toISOString(); // 2 minutes in future
      expect(() => Validator.validateTimestampFreshness(future)).toThrow('in the future');
    });
  });
});
