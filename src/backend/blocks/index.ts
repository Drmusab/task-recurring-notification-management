/**
 * Blocks module — SiYuan block runtime layer
 *
 * Pipeline: BlockEventHandler → BlockActionExecutor → BlockAttributeSync → BlockRetryQueue
 *
 * @see ReactiveBlockLayer — orchestrator that creates and manages all components
 * @see BlockEventHandler — receives raw runtimeBridge events, normalizes to BlockEvent
 * @see BlockActionExecutor — lifecycle-safe trigger evaluation + action execution
 * @see BlockAttributeSync — canonical block↔attribute reader/writer
 * @see BlockRetryQueue — exponential backoff retry for failed API calls
 */
export { ReactiveBlockLayer } from './ReactiveBlockLayer';
export type { ReactiveBlockLayerDeps } from './ReactiveBlockLayer';
export { BlockEventHandler } from './BlockEventHandler';
export type { BlockEventHandlerDeps } from './BlockEventHandler';
export { BlockActionExecutor } from './BlockActionExecutor';
export type { BlockActionExecutorDeps } from './BlockActionExecutor';
export { BlockAttributeSync } from './BlockAttributeSync';
export type { BlockTaskAttributes } from './BlockAttributeSync';
export { BlockRetryQueue } from './BlockRetryQueue';
export type { RetryableBlockAction, BlockRetryQueueStats } from './BlockRetryQueue';
