/**
 * DockAdapter - Abstracts SiYuan addDock API differences across versions.
 *
 * SiYuan v3.x passes dock object with `.element` property to init callback.
 * This adapter normalizes access and provides a safe fallback.
 *
 * Based on official plugin-sample addDock() pattern where:
 *   init: (dock) => { dock.element.innerHTML = ... }
 *
 * @module DockAdapter
 */

export interface DockInitResult {
  element: HTMLElement;
}

/**
 * Extract the actual DOM element from the dock init callback argument.
 *
 * Official SiYuan pattern (v3.x): dock.element is an HTMLElement.
 * Provides graceful fallback for edge cases.
 *
 * @param dockArg - The dock argument passed to init callback
 * @returns Object containing the resolved HTMLElement
 */
export function resolveDockElement(dockArg: unknown): DockInitResult {
  // Standard case: dock object with .element (SiYuan v3.x - official pattern)
  if (dockArg && typeof dockArg === "object") {
    const obj = dockArg as Record<string, unknown>;
    if (obj.element instanceof HTMLElement) {
      return { element: obj.element };
    }
  }

  // Legacy case: dock itself is an HTMLElement (SiYuan v2.x)
  if (dockArg instanceof HTMLElement) {
    return { element: dockArg };
  }

  // Fallback: create a detached container to prevent crash
  console.warn(
    "[DockAdapter] Could not resolve dock element — using detached fallback.",
    { type: typeof dockArg }
  );

  const fallback = document.createElement("div");
  fallback.className = "rtm-dock-fallback";
  fallback.style.cssText = "width:100%;height:100%;overflow:auto;";
  return { element: fallback };
}

/**
 * Validate that the dock element is actually in the DOM.
 *
 * @param el - The element to validate
 * @returns true if element is connected to DOM
 */
export function validateDockElement(el: HTMLElement): boolean {
  if (!el) return false;
  if (!el.isConnected) {
    console.warn("[DockAdapter] Dock element is not connected to DOM");
    return false;
  }
  return true;
}
