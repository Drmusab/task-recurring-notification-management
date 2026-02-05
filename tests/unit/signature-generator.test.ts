import { describe, it, expect } from 'vitest';
import { SignatureGenerator } from '@backend/webhooks/outbound/SignatureGenerator';

describe('SignatureGenerator', () => {
  const secret = 'test-secret-key';

  describe('generate', () => {
    it('should generate consistent signature for same payload', () => {
      const payload = { event: 'task.created', taskId: 'task_001' };

      const sig1 = SignatureGenerator.generate(payload, secret);
      const sig2 = SignatureGenerator.generate(payload, secret);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = { event: 'task.created', taskId: 'task_001' };
      const payload2 = { event: 'task.created', taskId: 'task_002' };

      const sig1 = SignatureGenerator.generate(payload1, secret);
      const sig2 = SignatureGenerator.generate(payload2, secret);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = { event: 'task.created', taskId: 'task_001' };

      const sig1 = SignatureGenerator.generate(payload, 'secret1');
      const sig2 = SignatureGenerator.generate(payload, 'secret2');

      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verify', () => {
    it('should verify valid signature', () => {
      const payload = { event: 'task.created', taskId: 'task_001' };
      const signature = SignatureGenerator.generate(payload, secret);

      const isValid = SignatureGenerator.verify(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = { event: 'task.created', taskId: 'task_001' };
      const invalidSignature = 'invalid-signature';

      const isValid = SignatureGenerator.verify(payload, invalidSignature, secret);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const payload = { event: 'task.created', taskId: 'task_001' };
      const signature = SignatureGenerator.generate(payload, 'secret1');

      const isValid = SignatureGenerator.verify(payload, signature, 'secret2');

      expect(isValid).toBe(false);
    });

    it('should reject tampered payload', () => {
      const originalPayload = { event: 'task.created', taskId: 'task_001' };
      const signature = SignatureGenerator.generate(originalPayload, secret);

      const tamperedPayload = { event: 'task.created', taskId: 'task_002' };
      const isValid = SignatureGenerator.verify(tamperedPayload, signature, secret);

      expect(isValid).toBe(false);
    });
  });
});
