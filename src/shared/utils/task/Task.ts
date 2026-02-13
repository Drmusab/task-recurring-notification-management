/**
 * Re-export Task from backend canonical location.
 * This shim exists because some shared modules import from '@shared/utils/task/Task'.
 */
export { type Task } from "@backend/core/models/Task";
