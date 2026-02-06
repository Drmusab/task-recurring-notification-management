/**
 * Webhook config re-exports and recurrence limits.
 */
export type { WebhookConfig } from "@shared/config/WebhookConfig";
export { DEFAULT_WEBHOOK_CONFIG, createWebhookConfig } from "@shared/config/WebhookConfig";

export interface RecurrenceLimitsConfig {
  maxInterval: number;
  minInterval: number;
  maxOccurrences: number;
  allowedFrequencies: string[];
}

export const DEFAULT_RECURRENCE_LIMITS: RecurrenceLimitsConfig = {
  maxInterval: 365,
  minInterval: 1,
  maxOccurrences: 1000,
  allowedFrequencies: ["daily", "weekly", "monthly", "yearly"],
};
