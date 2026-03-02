/**
 * SQL Sanitization Utilities for SiYuan API
 *
 * SiYuan's /api/query/sql endpoint passes statements directly to SQLite.
 * All user/runtime-supplied values MUST be escaped to prevent injection.
 *
 * Rules:
 *   - Single quotes are escaped by doubling: ' → ''
 *   - Backslashes are escaped: \ → \\
 *   - Null bytes are stripped
 *   - Block IDs are validated against SiYuan's canonical format
 */

/**
 * Escape a string value for use inside a SQLite single-quoted literal.
 * Usage: `SELECT * FROM blocks WHERE id = '${escapeSqlString(blockId)}'`
 */
export function escapeSqlString(value: string): string {
  if (typeof value !== "string") {
    return "";
  }
  // Strip null bytes, escape single quotes and backslashes
  return value
    .replace(/\0/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''");
}

/**
 * SiYuan block ID format: 14-digit timestamp + hyphen + 7 alphanumeric chars.
 * Example: "20210817205410-2kvfpfn"
 */
const SIYUAN_BLOCK_ID_PATTERN = /^[0-9]{14}-[a-z0-9]{7}$/;

/**
 * Validate that a string is a well-formed SiYuan block ID.
 * Rejects any value that does not match the canonical pattern,
 * preventing injection via malformed block IDs.
 */
export function isValidBlockId(id: string): boolean {
  return typeof id === "string" && SIYUAN_BLOCK_ID_PATTERN.test(id);
}

/**
 * Assert a value is a valid SiYuan block ID, or throw.
 */
export function assertBlockId(id: string, label = "blockId"): void {
  if (!isValidBlockId(id)) {
    throw new Error(`Invalid SiYuan block ID for ${label}: "${id}"`);
  }
}
