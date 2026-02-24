/**
 * Blocks module — SiYuan block operations
 *
 * Legacy fetch-based utilities are kept for backward compatibility.
 * New code should use SiYuanRuntimeBridge for reactive block operations.
 *
 * @see backend/runtime/SiYuanRuntimeBridge.ts for event-driven block API
 */
export * from './blocks';
export * from './ReactiveBlockLayer';
