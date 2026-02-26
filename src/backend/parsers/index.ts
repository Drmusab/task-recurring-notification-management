/**
 * Parsers module barrel
 *
 * Parser isolation contract:
 *   - Parsers receive raw block content (string) and produce ReadonlyTask snapshots
 *   - Parsers MUST NOT import TaskStorage, Scheduler, or any engine module
 *   - Parsers MUST NOT mutate task data — output is always a new object
 *   - Parsers MUST NOT call SiYuan API (block content is passed in, not fetched)
 *   - All parser output goes through GlobalFilter before entering storage
 *
 * Status: InlineTaskParser was removed (dead code, no production consumers).
 * This barrel is kept as a contract boundary for future parser implementations.
 */

// Re-export ReadonlyTask for parser consumers
export type { ReadonlyTask } from "@backend/core/models/Task";
