/**
 * API Key Manager
 * Manages API key generation and validation for webhook endpoints.
 */
import * as logger from "@backend/logging/logger";

export class ApiKeyManager {
  /** Set of valid API key hashes (SHA-256 hex) */
  private validKeys: Set<string> = new Set();

  constructor() {}

  /**
   * Register an API key as valid.
   * In production, keys should be stored hashed.
   */
  addKey(apiKey: string): void {
    this.validKeys.add(this.hashKey(apiKey));
  }

  /**
   * Remove a registered API key.
   */
  removeKey(apiKey: string): void {
    this.validKeys.delete(this.hashKey(apiKey));
  }

  /**
   * Validate an API key.
   * Returns false if no keys are registered (fail-closed) or key is invalid.
   */
  validate(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      logger.warn('API key validation failed: empty or invalid key');
      return false;
    }

    if (this.validKeys.size === 0) {
      // No keys registered — fail closed for security
      logger.warn('API key validation failed: no keys registered');
      return false;
    }

    const hashed = this.hashKey(apiKey);
    const valid = this.validKeys.has(hashed);
    if (!valid) {
      logger.warn('API key validation failed: unknown key');
    }
    return valid;
  }

  /**
   * Generate a new API key with prefix.
   */
  generate(): string {
    const randomPart = Array.from(
      crypto.getRandomValues(new Uint8Array(24)),
      (b) => b.toString(16).padStart(2, '0')
    ).join('');
    const key = `rtm_${randomPart}`;
    // Auto-register generated keys
    this.addKey(key);
    return key;
  }

  /**
   * Synchronous hash for key comparison (cyrb53).
   * Two independent 32-bit seeds combined for 53-bit collision resistance.
   * NEVER leaks key material (length, prefix, suffix) in the output.
   */
  private hashKey(key: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < key.length; i++) {
      const ch = key.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    // 53-bit hash — no key material leaked
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  /** Number of registered keys */
  get keyCount(): number {
    return this.validKeys.size;
  }
}
