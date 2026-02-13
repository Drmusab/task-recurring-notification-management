/**
 * DragDropManager - Handles drag-and-drop operations for dashboard widgets
 * Phase 4.3: Custom Dashboards
 */

import type { Widget, DragDropState } from './WidgetTypes';

export class DragDropManager {
  private dragState: DragDropState = {
    isDragging: false,
    draggedWidgetId: null,
    draggedOverWidgetId: null,
    dropEffect: 'none'
  };
  
  private listeners: Set<(state: DragDropState) => void> = new Set();
  private touchStartPos: { x: number; y: number } | null = null;
  
  /**
   * Subscribe to drag state changes
   */
  subscribe(listener: (state: DragDropState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener({ ...this.dragState }));
  }
  
  /**
   * Start dragging a widget
   */
  startDrag(widgetId: string, event: DragEvent | TouchEvent): void {
    this.dragState = {
      isDragging: true,
      draggedWidgetId: widgetId,
      draggedOverWidgetId: null,
      dropEffect: 'move'
    };
    
    if ('dataTransfer' in event && event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', widgetId);
      
      // Custom drag image (optional)
      const dragElement = (event.target as HTMLElement).closest('.widget-container');
      if (dragElement) {
        const rect = dragElement.getBoundingClientRect();
        event.dataTransfer.setDragImage(
          dragElement as Element,
          rect.width / 2,
          rect.height / 2
        );
      }
    } else if ('touches' in event && event.touches.length > 0) {
      // Touch event handling
      const touch = event.touches[0];
      if (touch) {
        this.touchStartPos = {
          x: touch.clientX,
          y: touch.clientY
        };
      }
    }
    
    this.notifyListeners();
  }
  
  /**
   * Handle drag over widget
   */
  dragOver(widgetId: string, event: DragEvent | TouchEvent): void {
    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    
    if ('dataTransfer' in event && event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    
    if (this.dragState.draggedOverWidgetId !== widgetId) {
      this.dragState.draggedOverWidgetId = widgetId;
      this.notifyListeners();
    }
  }
  
  /**
   * Handle drag leave widget
   */
  dragLeave(widgetId: string): void {
    if (this.dragState.draggedOverWidgetId === widgetId) {
      this.dragState.draggedOverWidgetId = null;
      this.notifyListeners();
    }
  }
  
  /**
   * Handle drop on widget
   */
  drop(
    targetWidgetId: string,
    widgets: Widget[],
    event: DragEvent | TouchEvent
  ): Widget[] | null {
    if (!this.dragState.isDragging || !this.dragState.draggedWidgetId) {
      return null;
    }
    
    event.preventDefault();
    
    const draggedId = this.dragState.draggedWidgetId;
    if (draggedId === targetWidgetId) {
      this.endDrag();
      return null;
    }
    
    // Reorder widgets
    const reorderedWidgets = this.reorderWidgets(widgets, draggedId, targetWidgetId);
    
    this.endDrag();
    return reorderedWidgets;
  }
  
  /**
   * End drag operation
   */
  endDrag(): void {
    this.dragState = {
      isDragging: false,
      draggedWidgetId: null,
      draggedOverWidgetId: null,
      dropEffect: 'none'
    };
    this.touchStartPos = null;
    this.notifyListeners();
  }
  
  /**
   * Reorder widgets based on drag-drop
   */
  private reorderWidgets(
    widgets: Widget[],
    draggedId: string,
    targetId: string
  ): Widget[] {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const draggedIndex = sorted.findIndex(w => w.id === draggedId);
    const targetIndex = sorted.findIndex(w => w.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      return widgets;
    }
    
    // Remove dragged widget
    const [draggedWidget] = sorted.splice(draggedIndex, 1);
    
    if (!draggedWidget) {
      return widgets;
    }
    
    // Insert at target position
    const newTargetIndex = draggedIndex < targetIndex ? targetIndex : targetIndex;
    sorted.splice(newTargetIndex, 0, draggedWidget);
    
    // Update order values
    return sorted.map((widget, index) => ({
      ...widget,
      order: index
    }));
  }
  
  /**
   * Get current drag state
   */
  getState(): DragDropState {
    return { ...this.dragState };
  }
  
  /**
   * Check if a widget is currently being dragged
   */
  isDraggingWidget(widgetId: string): boolean {
    return this.dragState.draggedWidgetId === widgetId;
  }
  
  /**
   * Check if a widget is the current drop target
   */
  isDraggedOver(widgetId: string): boolean {
    return this.dragState.draggedOverWidgetId === widgetId;
  }
  
  /**
   * Touch move handler for mobile drag
   */
  handleTouchMove(event: TouchEvent): void {
    if (!this.dragState.isDragging || !this.touchStartPos) return;
    
    const touch = event.touches[0];
    if (!touch) return;
    
    const deltaX = Math.abs(touch.clientX - this.touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - this.touchStartPos.y);
    
    // Threshold for starting drag (prevent accidental drags)
    if (deltaX > 10 || deltaY > 10) {
      event.preventDefault();
      
      // Find element under touch
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const widgetElement = element?.closest('[data-widget-id]');
      
      if (widgetElement) {
        const widgetId = widgetElement.getAttribute('data-widget-id');
        if (widgetId) {
          this.dragOver(widgetId, event);
        }
      }
    }
  }
  
  /**
   * Touch end handler for mobile drop
   */
  handleTouchEnd(
    event: TouchEvent,
    widgets: Widget[]
  ): Widget[] | null {
    if (!this.dragState.isDragging) return null;
    
    const touch = event.changedTouches[0];
    if (!touch) {
      this.endDrag();
      return null;
    }
    
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const widgetElement = element?.closest('[data-widget-id]');
    
    if (widgetElement && this.dragState.draggedWidgetId) {
      const targetWidgetId = widgetElement.getAttribute('data-widget-id');
      if (targetWidgetId) {
        return this.drop(targetWidgetId, widgets, event);
      }
    }
    
    this.endDrag();
    return null;
  }
}

/**
 * Singleton instance
 */
export const dragDropManager = new DragDropManager();
