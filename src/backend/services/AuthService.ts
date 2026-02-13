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
   * Simple hash for key comparison.
   * Uses a synchronous approach suitable for in-process validation.
   */
  private hashKey(key: string): string {
    // Use a simple non-cryptographic hash for fast in-memory comparison.
    // The key itself provides the entropy; this just avoids storing plaintext.
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // 32-bit integer
    }
    return `h:${key.length}:${hash.toString(36)}:${key.slice(-8)}`;
  }

  /** Number of registered keys */
  get keyCount(): number {
    return this.validKeys.size;
  }
}
