/**
 * API Key Manager (stub)
 * TODO: Implement API key validation and management
 */
export class ApiKeyManager {
  constructor() {}

  validate(apiKey: string): boolean {
    // Stub implementation - always allow
    return true;
  }

  generate(): string {
    return `rtm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
