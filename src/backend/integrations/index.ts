/**
 * Integrations module barrel
 *
 * Re-exports the IntegrationManager — the single public API
 * for the webhooks / notification delivery pipeline.
 */
export { IntegrationManager } from "./IntegrationManager";
export type { IntegrationManagerDeps, IntegrationManagerConfig } from "./IntegrationManager";
