<script lang="ts">
  /**
   * DashboardWidget - Wrapper component for dashboard widgets with drag-drop support
   * Phase 4.3: Custom Dashboards
   */
  
  import { onMount, onDestroy } from 'svelte';
  import type { Widget } from './WidgetTypes';
  import { dragDropManager } from './DragDropManager';
  
  export let widget: Widget;
  export let editMode: boolean = false;
  export let showBorders: boolean = true;
  export let onResize: ((widgetId: string, size: Widget['size']) => void) | undefined = undefined;
  export let onRemove: ((widgetId: string) => void) | undefined = undefined;
  export let onToggleVisibility: ((widgetId: string) => void) | undefined = undefined;
  
  let isDragging = false;
  let isDraggedOver = false;
  let showMenu = false;
  
  // Subscribe to drag state
  let unsubscribe: (() => void) | null = null;
  
  onMount(() => {
    unsubscribe = dragDropManager.subscribe((state) => {
      isDragging = dragDropManager.isDraggingWidget(widget.id);
      isDraggedOver = dragDropManager.isDraggedOver(widget.id);
    });
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
  
  function handleDragStart(event: DragEvent) {
    if (!editMode) return;
    dragDropManager.startDrag(widget.id, event);
  }
  
  function handleDragOver(event: DragEvent) {
    if (!editMode) return;
    dragDropManager.dragOver(widget.id, event);
  }
  
  function handleDragLeave() {
    if (!editMode) return;
    dragDropManager.dragLeave(widget.id);
  }
  
  function handleDrop(event: DragEvent) {
    if (!editMode) return;
    event.preventDefault();
    // Drop handling is managed by parent component
  }
  
  function handleDragEnd() {
    dragDropManager.endDrag();
  }
  
  function handleTouchStart(event: TouchEvent) {
    if (!editMode) return;
    dragDropManager.startDrag(widget.id, event);
  }
  
  function handleTouchMove(event: TouchEvent) {
    if (!editMode) return;
    dragDropManager.handleTouchMove(event);
  }
  
  function handleTouchEnd(event: TouchEvent) {
    if (!editMode) return;
    // Touch end handling is managed by parent component
  }
  
  function cycleSize() {
    if (!onResize) return;
    
    const sizes: Widget['size'][] = ['small', 'medium', 'large', 'full-width'];
    const currentIndex = sizes.indexOf(widget.size);
    const nextIndex = (currentIndex + 1) % sizes.length;
    const nextSize = sizes[nextIndex];
    
    if (nextSize) {
      onResize(widget.id, nextSize);
    }
  }
  
  function getSizeIcon(size: Widget['size']): string {
    switch (size) {
      case 'small': return '◻️';
      case 'medium': return '◼️';
      case 'large': return '⬛';
      case 'full-width': return '▬';
      default: return '◻️';
    }
  }
  
  function getSizeClass(size: Widget['size']): string {
    switch (size) {
      case 'small': return 'widget-small';
      case 'medium': return 'widget-medium';
      case 'large': return 'widget-large';
      case 'full-width': return 'widget-full-width';
      default: return 'widget-medium';
    }
  }
</script>

<div
  class="widget-container {getSizeClass(widget.size)}"
  class:edit-mode={editMode}
  class:is-dragging={isDragging}
  class:is-dragged-over={isDraggedOver}
  class:show-borders={showBorders}
  class:hidden={!widget.visible}
  data-widget-id={widget.id}
  draggable={editMode}
  role="region"
  aria-label={widget.title}
  aria-grabbed={editMode && isDragging}
  on:dragstart={handleDragStart}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  on:dragend={handleDragEnd}
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
>
  {#if editMode}
    <!-- Edit Mode Controls -->
    <div class="widget-controls">
      <!-- Drag Handle -->
      <div class="drag-handle" title="Drag to reorder">
        <span class="drag-icon">⋮⋮</span>
      </div>
      
      <!-- Widget Menu -->
      <div class="widget-menu">
        <button
          class="menu-toggle"
          on:click={() => showMenu = !showMenu}
          title="Widget options"
        >
          ⚙️
        </button>
        
        {#if showMenu}
          <div class="menu-dropdown">
            <!-- Resize -->
            <button class="menu-item" on:click={cycleSize} title="Change size">
              {getSizeIcon(widget.size)} Resize
            </button>
            
            <!-- Hide -->
            {#if onToggleVisibility}
              <button class="menu-item" on:click={() => onToggleVisibility?.(widget.id)}>
                {widget.visible ? '👁️' : '👁️‍🗨️'} {widget.visible ? 'Hide' : 'Show'}
              </button>
            {/if}
            
            <!-- Remove -->
            {#if onRemove && widget.type === 'custom-metric'}
              <button class="menu-item danger" on:click={() => onRemove?.(widget.id)}>
                🗑️ Remove
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Widget Content -->
  <div class="widget-content">
    <slot />
  </div>
</div>

<style>
  .widget-container {
    position: relative;
    background: var(--b3-card-background, #fff);
    border-radius: 8px;
    padding: 16px;
    transition: all 0.3s ease;
    min-height: 120px;
  }
  
  .widget-container.show-borders {
    border: 1px solid var(--b3-border-color, #e5e7eb);
  }
  
  .widget-container.hidden {
    opacity: 0.3;
    pointer-events: none;
  }
  
  /* Size classes */
  .widget-small {
    grid-column: span 1;
  }
  
  .widget-medium {
    grid-column: span 2;
  }
  
  .widget-large {
    grid-column: span 3;
  }
  
  .widget-full-width {
    grid-column: 1 / -1;
  }
  
  /* Edit mode */
  .widget-container.edit-mode {
    cursor: move;
    border: 2px dashed var(--b3-border-color, #e5e7eb);
  }
  
  .widget-container.edit-mode:hover {
    border-color: var(--b3-theme-primary, #3b82f6);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  }
  
  /* Drag states */
  .widget-container.is-dragging {
    opacity: 0.5;
    transform: scale(0.95);
    cursor: grabbing;
  }
  
  .widget-container.is-dragged-over {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
  }
  
  /* Controls */
  .widget-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 8px;
    z-index: 10;
  }
  
  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--b3-theme-surface, #f3f4f6);
    border-radius: 4px;
    cursor: grab;
    transition: all 0.2s ease;
  }
  
  .drag-handle:hover {
    background: var(--b3-theme-primary-lighter, #dbeafe);
  }
  
  .drag-handle:active {
    cursor: grabbing;
  }
  
  .drag-icon {
    font-size: 12px;
    color: var(--b3-theme-on-surface, #6b7280);
    user-select: none;
  }
  
  /* Widget Menu */
  .widget-menu {
    position: relative;
  }
  
  .menu-toggle {
    width: 24px;
    height: 24px;
    background: var(--b3-theme-surface, #f3f4f6);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s ease;
  }
  
  .menu-toggle:hover {
    background: var(--b3-theme-primary-lighter, #dbeafe);
  }
  
  .menu-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--b3-card-background, #fff);
    border: 1px solid var(--b3-border-color, #e5e7eb);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    min-width: 150px;
    z-index: 100;
  }
  
  .menu-item {
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    font-size: 0.875rem;
    color: var(--b3-theme-on-background, #1f2937);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.2s ease;
  }
  
  .menu-item:hover {
    background: var(--b3-theme-surface, #f3f4f6);
  }
  
  .menu-item.danger {
    color: #ef4444;
  }
  
  .menu-item.danger:hover {
    background: #fee2e2;
  }
  
  /* Widget Content */
  .widget-content {
    width: 100%;
    height: 100%;
  }
  
  /* Mobile adjustments */
  @media (max-width: 768px) {
    .widget-large,
    .widget-medium {
      grid-column: span 2;
    }
    
    .widget-small {
      grid-column: span 1;
    }
  }
  
  @media (max-width: 480px) {
    .widget-container {
      grid-column: 1 / -1 !important;
    }
  }
</style>
