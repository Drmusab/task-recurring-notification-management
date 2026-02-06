/**
 * DockAdapter - Abstracts SiYuan addDock API differences across versions.
 *
 * SiYuan v2.x used direct element, v3.x passes dock object with element property.
 * This adapter handles both cases to ensure cross-version compatibility.
 *
 * @module DockAdapter
 */

import * as logger from "@backend/logging/logger";

export interface DockInitResult {
  element: HTMLElement;
}

/**
 * Extract the actual DOM element from whatever SiYuan passes to the dock init callback.
 *
 * Handles:
 *  - v3.x: dock object with `.element` property
 *  - v2.x: direct HTMLElement
 *  - Edge case: dock object with nested `.element.element`
 *  - Fallback: create a container if nothing works
 *
 * @param dockArg - The argument passed to dock init callback
 * @returns Object containing the resolved HTMLElement
 */
export function resolveDockElement(dockArg: unknown): DockInitResult {
  // Case 1: dock is an object with .element (SiYuan v3.x standard)
  if (dockArg && typeof dockArg === "object") {
    const obj = dockArg as Record<string, unknown>;

    // Direct .element property
    if (obj.element instanceof HTMLElement) {
      return { element: obj.element };
    }

    // Some versions nest it under data or config
    if (obj.data && typeof obj.data === "object") {
      const dataObj = obj.data as Record<string, unknown>;
      if (dataObj.element instanceof HTMLElement) {
        return { element: dataObj.element };
      }
    }
  }

  // Case 2: dock itself is an HTMLElement (SiYuan v2.x pattern)
  if (dockArg instanceof HTMLElement) {
    return { element: dockArg };
  }

  // Case 3: dock has a parentElement-like hierarchy
  if (dockArg && typeof dockArg === "object" && "querySelector" in dockArg) {
    return { element: dockArg as unknown as HTMLElement };
  }

  // Fallback: create a detached container and warn
  logger.error(
    "[DockAdapter] Could not resolve dock element from argument",
    { type: typeof dockArg, value: dockArg }
  );

  const fallback = document.createElement("div");
  fallback.className = "rtm-dock-fallback";
  fallback.style.cssText = "width:100%;height:100%;overflow:auto;";

  // Try to attach to document body as last resort
  if (typeof document !== "undefined" && document.body) {
    // Don't actually attach — return detached so plugin doesn't crash
    logger.warn(
      "[DockAdapter] Using detached fallback container. Dashboard may not be visible."
    );
  }

  return { element: fallback };
}

/**
 * Validate that the dock element is actually in the DOM and visible.
 *
 * @param el - The element to validate
 * @returns true if element is valid and connected
 */
export function validateDockElement(el: HTMLElement): boolean {
  if (!el) return false;
  if (!el.isConnected) {
    logger.warn("[DockAdapter] Dock element is not connected to DOM");
    return false;
  }
  return true;
}
