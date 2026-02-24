/**
 * Icon Registration Module
 * 
 * Registers all SVG symbol icons used by the plugin.
 * Based on official plugin-sample addIcons() pattern.
 * 
 * Icons are registered as SVG <symbol> elements that can be referenced
 * via <use xlink:href="#iconId"> throughout SiYuan UI.
 */

import type { Plugin } from "siyuan";

/**
 * Register all custom SVG icons for the plugin.
 * Must be called first in onload() before any addTopBar/addDock calls.
 */
export function registerCustomIcons(plugin: Plugin): void {
  plugin.addIcons(`
    <symbol id="iconTaskRecurring" viewBox="0 0 32 32">
      <path d="M16 4 A 12 12 0 0 1 28 16 L 24 16 A 8 8 0 0 0 16 8 Z" fill="currentColor"/>
      <path d="M16 28 A 12 12 0 0 1 4 16 L 8 16 A 8 8 0 0 0 16 24 Z" fill="currentColor"/>
      <path d="M28 16 L 24 12 L 24 20 Z" fill="currentColor"/>
      <path d="M4 16 L 8 12 L 8 20 Z" fill="currentColor"/>
      <rect x="10" y="14" width="12" height="4" rx="1" fill="currentColor" opacity="0.6"/>
    </symbol>
    <symbol id="iconTaskNotification" viewBox="0 0 32 32">
      <path d="M16 4c-2.2 0-4 1.8-4 4v8l-3 3v2h14v-2l-3-3V8c0-2.2-1.8-4-4-4zm-2 24c0 1.1.9 2 2 2s2-.9 2-2h-4z" fill="currentColor"/>
    </symbol>
    <symbol id="iconTaskCalendar" viewBox="0 0 32 32">
      <path d="M26 4h-4V2h-2v2h-8V2H10v2H6c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 20H6V10h20v14z" fill="currentColor"/>
      <rect x="9" y="13" width="4" height="3" fill="currentColor"/>
      <rect x="14" y="13" width="4" height="3" fill="currentColor"/>
      <rect x="19" y="13" width="4" height="3" fill="currentColor"/>
      <rect x="9" y="18" width="4" height="3" fill="currentColor"/>
      <rect x="14" y="18" width="4" height="3" fill="currentColor"/>
    </symbol>
    <symbol id="iconTaskDashboard" viewBox="0 0 32 32">
      <rect x="4" y="4" width="10" height="10" rx="2" fill="currentColor" opacity="0.8"/>
      <rect x="18" y="4" width="10" height="6" rx="2" fill="currentColor" opacity="0.6"/>
      <rect x="4" y="18" width="10" height="6" rx="2" fill="currentColor" opacity="0.6"/>
      <rect x="18" y="14" width="10" height="14" rx="2" fill="currentColor" opacity="0.8"/>
    </symbol>
  `);
}
