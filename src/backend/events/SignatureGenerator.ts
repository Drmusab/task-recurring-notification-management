import { createHmac } from 'crypto';

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export class SignatureGenerator {
  /**
   * Generate signature
   */
  static generate(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = createHmac('sha256', secret);
    hmac.update(payloadString);
    return hmac.digest('hex');
  }

  /**
   * Verify signature
   */
  static verify(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generate(payload, secret);
    return this.secureCompare(signature, expectedSignature);
  }

  /**
   * Timing-safe string comparison
   */
  private static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
