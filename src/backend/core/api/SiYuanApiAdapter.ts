import * as logger from "@backend/logging/logger";
import {
  setBlockAttrs as clientSetBlockAttrs,
  SiYuanApiError,
} from "@backend/core/api/SiYuanApiClient";

type SiYuanCapability = "setBlockAttrs" | "dataDir";

type CapabilityMap = Record<SiYuanCapability, boolean>;

export interface SiYuanBlockAPI {
  setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void>;
}

export interface SiYuanEnvironmentAPI {
  getDataDir(): string | null;
}

interface SiYuanApiIssue {
  feature: string;
  capability: SiYuanCapability;
  message: string;
  cause?: unknown;
}

const reportedIssues = new Set<string>();

/**
 * Reset the reported issues deduplication set.
 * Called on plugin unload to prevent stale suppressions across hot-reloads.
 */
export function resetReportedIssues(): void {
  reportedIssues.clear();
}

/**
 * Centralized logging for SiYuan API capability and runtime failures.
 */
export function reportSiYuanApiIssue(issue: SiYuanApiIssue): void {
  const key = `${issue.feature}:${issue.capability}:${issue.message}`;
  if (reportedIssues.has(key)) {
    return;
  }

  reportedIssues.add(key);

  logger.warn(issue.message, {
    feature: issue.feature,
    capability: issue.capability,
    cause: issue.cause,
  });
}

export class SiYuanCapabilityError extends Error {
  readonly capability: SiYuanCapability;
  readonly feature: string;

  constructor(feature: string, capability: SiYuanCapability, message: string) {
    super(message);
    this.name = "SiYuanCapabilityError";
    this.feature = feature;
    this.capability = capability;
  }
}

export class SiYuanApiExecutionError extends Error {
  readonly capability: SiYuanCapability;
  readonly feature: string;
  readonly cause?: unknown;

  constructor(feature: string, capability: SiYuanCapability, message: string, cause?: unknown) {
    super(message);
    this.name = "SiYuanApiExecutionError";
    this.feature = feature;
    this.capability = capability;
    this.cause = cause;
  }
}

type SiYuanGlobal = {
  siyuan?: {
    config?: {
      system?: {
        dataDir?: string;
      };
    };
  };
};

/**
 * Adapter layer that isolates access to SiYuan globals and kernel API.
 *
 * `setBlockAttrs` now delegates to the canonical `SiYuanApiClient` (kernel HTTP API)
 * instead of the unreliable `globalThis.setBlockAttrs` injected global.
 *
 * `getDataDir` still reads from `globalThis.siyuan.config.system.dataDir`
 * (a synchronous runtime global, not an API call).
 */
export class SiYuanApiAdapter implements SiYuanBlockAPI, SiYuanEnvironmentAPI {
  readonly supportedCapabilities: CapabilityMap;
  private globalScope: SiYuanGlobal;

  constructor(globalScope: SiYuanGlobal = globalThis as SiYuanGlobal) {
    this.globalScope = globalScope;
    this.supportedCapabilities = {
      setBlockAttrs: true, // Always available via kernel API
      dataDir: this.isDataDirAvailable(),
    };
  }

  private isDataDirAvailable(): boolean {
    return typeof this.globalScope?.siyuan?.config?.system?.dataDir === "string";
  }

  /**
   * Return the configured SiYuan data directory when available.
   */
  getDataDir(): string | null {
    if (!this.isDataDirAvailable()) {
      return null;
    }

    return this.globalScope.siyuan?.config?.system?.dataDir ?? null;
  }

  /**
   * Set block attributes via the canonical SiYuan kernel API client.
   * Delegates to SiYuanApiClient.setBlockAttrs() which validates response.code === 0.
   */
  async setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    try {
      await clientSetBlockAttrs(blockId, attrs);
    } catch (err) {
      if (err instanceof SiYuanApiError) {
        throw new SiYuanApiExecutionError(
          "Block attribute sync",
          "setBlockAttrs",
          `Failed to sync block attributes via SiYuan API: ${err.kernelMessage}`,
          err,
        );
      }
      throw new SiYuanApiExecutionError(
        "Block attribute sync",
        "setBlockAttrs",
        "Failed to sync block attributes via SiYuan API.",
        err,
      );
    }
  }
}
