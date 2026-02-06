/**
 * Re-export WebhookError from its canonical location.
 * This shim exists because modules import from '@backend/webhook/types/Error' (singular).
 */
export { WebhookError } from "@backend/webhooks/types/Error";
