/**
 * DomainVersion — Schema Version for Domain Entities
 *
 * Controls migration and backward compatibility.
 * Every DomainTask carries a version field of this type.
 *
 * Version history:
 *   1 — Legacy frequency-based recurrence (pre-Phase 3)
 *   2 — RRule-based recurrence (Phase 3)
 *   3 — Immutable domain model (Phase 4 — this refactor)
 *
 * Migration rules:
 *   - V1 → V3: Convert frequency to Recurrence RRule + freeze
 *   - V2 → V3: Attach analytics snapshot + lifecycle state + freeze
 *   - V3 → V3: No migration needed
 *
 * FORBIDDEN:
 *   ❌ Import Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 */

// ──────────────────────────────────────────────────────────────
// Version Type
// ──────────────────────────────────────────────────────────────

/**
 * Domain schema version.
 *
 * Numeric type — allows comparison: oldVersion < CURRENT_DOMAIN_VERSION
 */
export type DomainVersion = number;

/** Current domain schema version */
export const CURRENT_DOMAIN_VERSION: DomainVersion = 3;

/** Minimum supported version (for migration) */
export const MIN_SUPPORTED_VERSION: DomainVersion = 1;

// ──────────────────────────────────────────────────────────────
// Version Checks
// ──────────────────────────────────────────────────────────────

/**
 * Check if a version needs migration.
 */
export function needsMigration(version: DomainVersion): boolean {
  return version < CURRENT_DOMAIN_VERSION;
}

/**
 * Check if a version is supported (can be migrated).
 */
export function isVersionSupported(version: DomainVersion): boolean {
  return version >= MIN_SUPPORTED_VERSION && version <= CURRENT_DOMAIN_VERSION;
}

/**
 * Check if a version is the current domain version.
 */
export function isCurrentVersion(version: DomainVersion): boolean {
  return version === CURRENT_DOMAIN_VERSION;
}

// ──────────────────────────────────────────────────────────────
// Version Changelog (for documentation / debugging)
// ──────────────────────────────────────────────────────────────

export interface VersionChangelogEntry {
  readonly version: DomainVersion;
  readonly name: string;
  readonly description: string;
  readonly breaking: boolean;
}

export const VERSION_CHANGELOG: readonly VersionChangelogEntry[] = Object.freeze([
  {
    version: 1,
    name: "Legacy Frequency",
    description: "Original task model with frequency-based recurrence (daily/weekly/monthly)",
    breaking: false,
  },
  {
    version: 2,
    name: "RRule Recurrence",
    description: "Phase 3: RFC 5545 RRule-based recurrence, dual-engine mode with legacy frequency",
    breaking: false,
  },
  {
    version: 3,
    name: "Immutable Domain",
    description: "Phase 4: Fully immutable DomainTask, lifecycle state machine, analytics snapshot, dependency links, recurrence instance isolation",
    breaking: true,
  },
]);
