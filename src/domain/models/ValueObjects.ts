/**
 * Value Objects — Domain Primitive Types
 *
 * Branded types for domain-level type safety.
 * These ensure that raw strings cannot be passed where
 * domain-specific identifiers are expected.
 *
 * @module ValueObjects
 * @version 1.0.0
 */

// ── Branded type helper ────────────────────────────────────────

/**
 * Brand a primitive type to prevent accidental substitution.
 * e.g., TaskId and ISODateString are both `string` at runtime,
 * but TypeScript will reject one where the other is expected.
 */
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

// ── Domain Primitives ──────────────────────────────────────────

/**
 * Unique task identifier (UUID v4 or short ID).
 * Created only by TaskFactory or generateTaskId().
 */
export type TaskId = Brand<string, 'TaskId'>;

/**
 * ISO 8601 date-time string (e.g., "2025-06-15T14:30:00.000Z").
 * Always in UTC unless timezone metadata is attached separately.
 */
export type ISODateString = Brand<string, 'ISODateString'>;

// ── Type Guards ────────────────────────────────────────────────

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z?)?$/;

/**
 * Validate and narrow a string to ISODateString.
 */
export function isISODateString(value: unknown): value is ISODateString {
  if (typeof value !== 'string') return false;
  if (!ISO_DATE_REGEX.test(value)) return false;
  return !isNaN(new Date(value).getTime());
}

/**
 * Validate and narrow a string to TaskId.
 * Accepts UUID v4 and short task-xxx-yyy format.
 */
export function isTaskId(value: unknown): value is TaskId {
  if (typeof value !== 'string') return false;
  if (value.length === 0) return false;
  // Accept UUID v4 or short ID
  return /^[a-f0-9-]{8,36}$/.test(value) || /^task-[a-z0-9]+-[a-z0-9]+$/.test(value);
}

// ── Constructors (unsafe — for use inside factories only) ──────

/**
 * Unsafely brand a string as TaskId.
 * Should ONLY be called from TaskFactory or generateTaskId().
 */
export function unsafeTaskId(raw: string): TaskId {
  return raw as TaskId;
}

/**
 * Unsafely brand a string as ISODateString.
 * Should ONLY be called from validated contexts.
 */
export function unsafeISODateString(raw: string): ISODateString {
  return raw as ISODateString;
}
