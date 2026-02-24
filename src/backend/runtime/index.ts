/**
 * Backend Runtime Layer — Barrel Export
 *
 * The runtime/ directory contains the bridge between SiYuan kernel
 * and the task domain engine. All block I/O and mutation subscriptions
 * go through SiYuanRuntimeBridge.
 */

export {
  SiYuanRuntimeBridge,
  type BlockMutation,
  type CheckboxToggleEvent,
  type BlockTreeNode,
  type RuntimeEvent,
} from "./SiYuanRuntimeBridge";
