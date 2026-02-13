<script lang="ts">
  /**
   * Accessible SVG Icon Component
   * WCAG 2.1 AA Compliant
   * 
   * @accessibility
   * - Decorative icons: Use aria-hidden="true" (no alt prop)
   * - Semantic icons: Provide alt text via alt prop
   * - Supports all sizes and theme colors
   * - High contrast mode compatible
   */

  export let category: 'navigation' | 'actions' | 'status' | 'features' = 'actions';
  export let name: string;
  export let size: 16 | 20 | 24 = 16;
  export let alt: string | undefined = undefined;
  export let className: string = '';

  // Determine if icon is decorative (no alt text) or semantic (has alt text)
  const isDecorative = alt === undefined || alt === '';
  
  // Generate aria attributes based on icon purpose
  $: ariaAttrs = isDecorative ? {
    'aria-hidden': true,
    role: 'presentation'
  } : {
    role: 'img',
    'aria-label': alt
  };

  // Icon registry - maps category/name to SVG paths
  // This would be populated from the icon system
  const getIconPath = (cat: string, iconName: string): string => {
    // Placeholder - would load from assets/icons/
    return `M${size / 2},${size / 2} L${size},${size} M0,${size} L${size},0`;
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {size} {size}"
  class="icon icon-{category}-{name} {className}"
  {...ariaAttrs}
  xmlns="http://www.w3.org/2000/svg"
>
  <path d={getIconPath(category, name)} fill="currentColor" />
</svg>

<style>
  .icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
    color: inherit;
    transition: color 0.2s ease;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .icon {
      stroke: currentColor;
      stroke-width: 0.5px;
    }
  }

  /* Ensure icons don't cause layout shifts */
  :global(.icon-inline) {
    margin: 0 0.25em;
  }
</style>
