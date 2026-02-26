/**
 * Lazy-loaded D3 module
 * Loads D3 only when charts/visualizations are rendered
 * Reduces initial bundle size by ~200KB
 */

type D3Module = typeof import('d3');

let d3Module: D3Module | null = null;

/**
 * Lazy-load D3.js library
 * @returns Promise resolving to the D3 module
 */
export async function loadD3(): Promise<D3Module> {
  if (!d3Module) {
    d3Module = await import('d3');
  }
  return d3Module;
}

/**
 * Get cached D3 module (null if not yet loaded)
 * @returns D3 module or null
 */
export function getD3(): D3Module | null {
  return d3Module;
}
