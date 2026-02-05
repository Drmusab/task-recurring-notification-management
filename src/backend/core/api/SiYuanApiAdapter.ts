import * as logger from "@shared/utils/misc/logger";

export type SiYuanCapability = "setBlockAttrs" | "dataDir";

export type CapabilityMap = Record<SiYuanCapability, boolean>;

export interface SiYuanBlockAPI {
  setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void>;
}

export interface SiYuanEnvironmentAPI {
  getDataDir(): string | null;
}

export interface SiYuanApiIssue {
  feature: string;
  capability: SiYuanCapability;
  message: string;
  cause?: unknown;
}

const reportedIssues = new Set<string>();

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
  setBlockAttrs?: unknown;
  siyuan?: {
    config?: {
      system?: {
        dataDir?: string;
      };
    };
  };
};

/**
 * Adapter layer that isolates access to SiYuan globals.
 *
 * Why: Avoids scattered globalThis usage, enforces runtime capability checks,
 * and provides a single extension point for future SiYuan API versions or mocks.
 *
 * To extend: Add a new capability to SiYuanCapability, expose a typed method,
 * and update supportedCapabilities to advertise availability.
 */
export class SiYuanApiAdapter implements SiYuanBlockAPI, SiYuanEnvironmentAPI {
  readonly supportedCapabilities: CapabilityMap;
  private globalScope: SiYuanGlobal;

  constructor(globalScope: SiYuanGlobal = globalThis as SiYuanGlobal) {
    this.globalScope = globalScope;
    this.supportedCapabilities = {
      setBlockAttrs: this.isSetBlockAttrsAvailable(),
      dataDir: this.isDataDirAvailable(),
    };
  }

  private isSetBlockAttrsAvailable(): boolean {
    return typeof this.globalScope?.setBlockAttrs === "function";
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
   * Set block attributes via the SiYuan API.
   */
  async setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    const setBlockAttrs = this.getSetBlockAttrs();

    try {
      await setBlockAttrs(blockId, attrs);
    } catch (err) {
      throw new SiYuanApiExecutionError(
        "Block attribute sync",
        "setBlockAttrs",
        "Failed to sync block attributes via SiYuan API.",
        err,
      );
    }
  }

  private getSetBlockAttrs(): (blockId: string, attrs: Record<string, string>) => Promise<void> {
    if (!this.isSetBlockAttrsAvailable()) {
      throw new SiYuanCapabilityError(
        "Block attribute sync",
        "setBlockAttrs",
        "Block attribute sync unavailable in this SiYuan version. Tasks will continue without block sync.",
      );
    }

    return this.globalScope.setBlockAttrs as (blockId: string, attrs: Record<string, string>) => Promise<void>;
  }
}
