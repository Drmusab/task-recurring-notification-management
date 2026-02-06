/**
 * Re-export StatusRegistry from its canonical location.
 * This shim exists because modules import from '@shared/types/StatusRegistry'.
 */
export { StatusRegistry } from "@backend/core/models/StatusRegistry";
