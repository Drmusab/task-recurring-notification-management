<script lang="ts">
  /**
   * DashboardCustomizationToolbar - Controls for customizing dashboard layout
   * Phase 4.3: Custom Dashboards
   */
  
  import type { LayoutPreset } from './WidgetTypes';
  import { dashboardLayoutManager } from './DashboardLayoutManager';
  
  export let editMode: boolean = false;
  export let onToggleEditMode: () => void;
  export let onSaveLayout: () => void;
  export let onResetLayout: () => void;
  export let onExportLayout: () => void;
  export let onImportLayout: ((file: File) => void) | undefined = undefined;
  
  let presets: LayoutPreset[] = [];
  let showPresets = false;
  let showExportImport = false;
  let fileInput: HTMLInputElement;
  
  $: presets = dashboardLayoutManager.getPresets();
  
  function handlePresetSelect(presetId: string) {
    dashboardLayoutManager.loadPreset(presetId);
    showPresets = false;
  }
  
  function handleExport() {
    const exportData = dashboardLayoutManager.exportLayout();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-layout-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showExportImport = false;
    onExportLayout();
  }
  
  function handleImportClick() {
    fileInput.click();
  }
  
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file && onImportLayout) {
      onImportLayout(file);
      showExportImport = false;
    }
    
    // Reset file input
    target.value = '';
  }
</script>

<div class="customization-toolbar">
  <!-- Left Section: Edit Mode Toggle -->
  <div class="toolbar-left">
    <button 
      class="toolbar-btn edit-toggle"
      class:active={editMode}
      on:click={onToggleEditMode}
      title={editMode ? "Exit edit mode" : "Enter edit mode"}
    >
      {#if editMode}
        ✅ Done Editing
      {:else}
        ✏️ Customize
      {/if}
    </button>
    
    {#if editMode}
      <div class="edit-hint">
        💡 Drag widgets to reorder • Click ⚙️ to resize/hide
      </div>
    {/if}
  </div>
  
  <!-- Right Section: Actions -->
  <div class="toolbar-right">
    {#if editMode}
      <!-- Save Button -->
      <button 
        class="toolbar-btn" 
        on:click={onSaveLayout}
        title="Save current layout"
      >
        💾 Save
      </button>
      
      <!-- Presets Dropdown -->
      <div class="dropdown">
        <button 
          class="toolbar-btn"
          on:click={() => showPresets = !showPresets}
          title="Load preset layout"
        >
          📋 Presets
        </button>
        
        {#if showPresets}
          <div class="dropdown-menu">
            {#each presets as preset}
              <button 
                class="dropdown-item"
                on:click={() => handlePresetSelect(preset.id)}
              >
                <span class="preset-icon">{preset.icon}</span>
                <div class="preset-info">
                  <div class="preset-name">{preset.name}</div>
                  <div class="preset-desc">{preset.description}</div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Export/Import Dropdown -->
      <div class="dropdown">
        <button 
          class="toolbar-btn"
          on:click={() => showExportImport = !showExportImport}
          title="Export or import layout"
        >
          📤 Export/Import
        </button>
        
        {#if showExportImport}
          <div class="dropdown-menu">
            <button class="dropdown-item" on:click={handleExport}>
              📤 Export Layout
            </button>
            
            {#if onImportLayout}
              <button class="dropdown-item" on:click={handleImportClick}>
                📥 Import Layout
              </button>
              <input
                bind:this={fileInput}
                type="file"
                accept=".json"
                on:change={handleFileSelect}
                style="display: none;"
              />
            {/if}
          </div>
        {/if}
      </div>
      
      <!-- Reset Button -->
      <button 
        class="toolbar-btn danger" 
        on:click={onResetLayout}
        title="Reset to default layout"
      >
        🔄 Reset
      </button>
    {/if}
  </div>
</div>

<style>
  .customization-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--b3-card-background, #fff);
    border: 1px solid var(--b3-border-color, #e5e7eb);
    border-radius: 8px;
    margin-bottom: 16px;
    gap: 16px;
    flex-wrap: wrap;
  }
  
  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--b3-theme-surface, #f3f4f6);
    color: var(--b3-theme-on-background, #1f2937);
    border: 1px solid var(--b3-border-color, #e5e7eb);
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  
  .toolbar-btn:hover {
    background: var(--b3-theme-primary-lighter, #dbeafe);
    border-color: var(--b3-theme-primary, #3b82f6);
  }
  
  .toolbar-btn.active {
    background: var(--b3-theme-primary, #3b82f6);
    color: #fff;
    border-color: var(--b3-theme-primary, #3b82f6);
  }
  
  .toolbar-btn.edit-toggle {
    font-weight: 700;
  }
  
  .toolbar-btn.danger {
    color: #ef4444;
  }
  
  .toolbar-btn.danger:hover {
    background: #fee2e2;
    border-color: #ef4444;
  }
  
  .edit-hint {
    font-size: 0.75rem;
    color: var(--b3-label-color, #6b7280);
    font-style: italic;
    padding: 4px 8px;
    background: var(--b3-theme-background, #f9fafb);
    border-radius: 4px;
  }
  
  /* Dropdown */
  .dropdown {
    position: relative;
  }
  
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: var(--b3-card-background, #fff);
    border: 1px solid var(--b3-border-color, #e5e7eb);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    min-width: 220px;
    z-index: 100;
    max-height: 400px;
    overflow-y: auto;
  }
  
  .dropdown-item {
    width: 100%;
    padding: 12px;
    background: none;
    border: none;
    text-align: left;
    font-size: 0.875rem;
    color: var(--b3-theme-on-background, #1f2937);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: background 0.2s ease;
  }
  
  .dropdown-item:hover {
    background: var(--b3-theme-surface, #f3f4f6);
  }
  
  .preset-icon {
    font-size: 1.2rem;
  }
  
  .preset-info {
    flex: 1;
  }
  
  .preset-name {
    font-weight: 600;
    margin-bottom: 2px;
  }
  
  .preset-desc {
    font-size: 0.75rem;
    color: var(--b3-label-color, #6b7280);
  }
  
  /* Mobile */
  @media (max-width: 768px) {
    .customization-toolbar {
      flex-direction: column;
      align-items: stretch;
    }
    
    .toolbar-left,
    .toolbar-right {
      width: 100%;
      justify-content: space-between;
    }
    
    .edit-hint {
      width: 100%;
      text-align: center;
      margin-top: 8px;
    }
  }
</style>
