/**
 * Lazy-loaded D3 module
 * Loads D3 only when charts/visualizations are rendered
 * Reduces initial bundle size by ~200KB
 */

let d3Module: any = null;

/**
 * Lazy-load D3.js library
 * @returns Promise resolving to the D3 module
 */
export async function loadD3(): Promise<any> {
  if (!d3Module) {
    d3Module = await import('d3');
  }
  return d3Module;
}

/**
 * Get cached D3 module (null if not yet loaded)
 * @returns D3 module or null
 */
export function getD3(): any | null {
  return d3Module;
}
