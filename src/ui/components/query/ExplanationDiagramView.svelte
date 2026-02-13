<script lang="ts">
  import { onMount } from "svelte";
  import mermaid from "mermaid";
  import { ExplanationDiagramGenerator } from "@backend/core/query/ExplanationDiagramGenerator";
  import type { QueryAST } from "@backend/core/query/QueryParser";
  import type { Explanation } from "@backend/core/query/QueryExplainer";
  import type { DiagramOptions, DiagramResult } from "@backend/core/query/ExplanationDiagramGenerator";

  // Initialize Mermaid on mount
  onMount(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "var(--font-ui-medium)",
    });
  });

  // Render Mermaid diagram to SVG
  async function renderMermaidDiagram(syntax: string): Promise<string> {
    try {
      const id = `mermaid-diagram-${Date.now()}`;
      const { svg } = await mermaid.render(id, syntax);
      return svg;
    } catch (error) {
      console.error("Mermaid rendering error:", error);
      return `<pre class="mermaid-error">${error instanceof Error ? error.message : "Rendering failed"}</pre>`;
    }
  }

  // Props
  export let query: QueryAST | null = null;
  export let explanation: Explanation | null = null;

  // State
  const generator = new ExplanationDiagramGenerator();
  let diagramType: DiagramOptions["type"] = "flowchart";
  let showStats: boolean = true;
  let viewMode: "rendered" | "syntax" = "rendered"; // NEW: Toggle between rendered SVG and syntax
  let currentDiagram: DiagramResult | null = null;
  let renderError: string | null = null;
  let renderedSvg: string = ""; // NEW: Rendered SVG output

  // Reactive diagram generation
  $: {
    if (query && explanation) {
      try {
        renderError = null;
        
        switch (diagramType) {
          case "flowchart":
            currentDiagram = generator.generateFlowchart(query, explanation, { 
              type: "flowchart", 
              showStats 
            });
            break;
          case "tree":
            currentDiagram = generator.generateBooleanTree(query, { type: "tree" });
            break;
          case "sankey":
            currentDiagram = generator.generateTaskFlow(explanation, { type: "sankey" });
            break;
        }
        
        // Auto-render diagram if in rendered mode
        if (currentDiagram && viewMode === "rendered") {
          renderMermaidDiagram(currentDiagram.mermaidSyntax).then(svg => {
            renderedSvg = svg;
          });
        }
      } catch (error) {
        renderError = error instanceof Error ? error.message : "Unknown error";
        currentDiagram = null;
      }
    } else {
      currentDiagram = null;
    }
  }

  // Re-render when view mode changes
  $: if (currentDiagram && viewMode === "rendered") {
    renderMermaidDiagram(currentDiagram.mermaidSyntax).then(svg => {
      renderedSvg = svg;
    });
  }

  // Get recommended diagram type
  $: recommendedType = query && explanation 
    ? ExplanationDiagramGenerator.getRecommendedDiagramType(query, explanation)
    : "flowchart";

  function copyMermaidSyntax() {
    if (currentDiagram) {
      navigator.clipboard.writeText(currentDiagram.mermaidSyntax);
      // Could add toast notification here
    }
  }

  function downloadMermaidSyntax() {
    if (currentDiagram) {
      const blob = new Blob([currentDiagram.mermaidSyntax], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "query-diagram.mmd";
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function getComplexityLabel(complexity: number): string {
    if (complexity <= 1) return "Very Simple";
    if (complexity <= 2) return "Simple";
    if (complexity <= 3) return "Moderate";
    if (complexity <= 4) return "Complex";
    return "Very Complex";
  }

  function getComplexityColor(complexity: number): string {
    if (complexity <= 2) return "#10B981";
    if (complexity <= 3) return "#F59E0B";
    return "#EF4444";
  }

  async function exportDiagramAsPng() {
    if (!renderedSvg) return;

    try {
      // Create canvas from SVG
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // Parse SVG to get dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(renderedSvg, "image/svg+xml");
      const svgElement = svgDoc.documentElement;
      
      const width = parseInt(svgElement.getAttribute("width") || "800");
      const height = parseInt(svgElement.getAttribute("height") || "600");
      
      canvas.width = width;
      canvas.height = height;

      // Convert SVG to data URL
      const svgBlob = new Blob([renderedSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        
        // Export as PNG
        canvas.toBlob((blob) => {
          if (!blob) return;
          
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = "query-diagram.png";
          a.click();
          
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
        });
      };
      
      img.src = url;
    } catch (error) {
      console.error("PNG export failed:", error);
      alert("Failed to export PNG. Please try copying the syntax instead.");
    }
  }
</script>

<div class="explanation-diagram-view">
  <!-- Header -->
  <div class="diagram-header">
    <h3>📊 Query Visualization</h3>

    <div class="header-controls">
      <!-- Diagram Type Selector -->
      <div class="diagram-type-selector">
        <button 
          class="type-btn" 
          class:active={diagramType === "flowchart"}
          class:recommended={recommendedType === "flowchart"}
          on:click={() => diagramType = "flowchart"}
          title="Flowchart shows filter execution flow"
        >
          🔄 Flowchart
        </button>

        <button 
          class="type-btn" 
          class:active={diagramType === "tree"}
          class:recommended={recommendedType === "tree"}
          on:click={() => diagramType = "tree"}
          title="Tree shows boolean logic structure"
        >
          🌳 Boolean Tree
        </button>

        <button 
          class="type-btn" 
          class:active={diagramType === "sankey"}
          class:recommended={recommendedType === "sankey"}
          on:click={() => diagramType = "sankey"}
          title="Sankey shows task flow through filters"
        >
          📈 Task Flow
        </button>
      </div>

      <!-- Options -->
      {#if diagramType === "flowchart"}
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={showStats} />
          Show statistics
        </label>
      {/if}

      <!-- View Mode Toggle -->
      <div class="view-mode-toggle">
        <button 
          class="toggle-btn" 
          class:active={viewMode === "rendered"}
          on:click={() => viewMode = "rendered"}
          title="Show rendered diagram"
        >
          🖼️ Rendered
        </button>
        <button 
          class="toggle-btn" 
          class:active={viewMode === "syntax"}
          on:click={() => viewMode = "syntax"}
          title="Show Mermaid syntax"
        >
          📝 Syntax
        </button>
      </div>
    </div>
  </div>

  {#if !query || !explanation}
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <h4>No Diagram Available</h4>
      <p>Execute a query to visualize its filter logic and task flow</p>
    </div>
  {:else if renderError}
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <h4>Diagram Rendering Error</h4>
      <p>{renderError}</p>
    </div>
  {:else if currentDiagram}
    <!-- Diagram Info -->
    <div class="diagram-info">
      <div class="info-item">
        <span class="info-label">Title:</span>
        <span class="info-value">{currentDiagram.title}</span>
      </div>

      <div class="info-item">
        <span class="info-label">Complexity:</span>
        <span 
          class="complexity-badge"
          style="background-color: {getComplexityColor(currentDiagram.complexity)}20; color: {getComplexityColor(currentDiagram.complexity)}"
        >
          {getComplexityLabel(currentDiagram.complexity)} ({currentDiagram.complexity}/5)
        </span>
      </div>

      {#if currentDiagram.warnings.length > 0}
        <div class="info-item warnings">
          <span class="info-label">Warnings:</span>
          <ul class="warning-list">
            {#each currentDiagram.warnings as warning}
              <li>{warning}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>

    <!-- Mermaid Diagram -->
    <div class="diagram-container">
      {#if viewMode === "rendered"}
        <div class="mermaid-rendered">
          {@html renderedSvg}
        </div>
      {:else}
        <div class="mermaid-syntax">
          <pre><code>{currentDiagram.mermaidSyntax}</code></pre>
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="diagram-actions">
      <button class="action-btn" on:click={copyMermaidSyntax}>
        📋 Copy Syntax
      </button>

      <button class="action-btn" on:click={downloadMermaidSyntax}>
        💾 Download .mmd
      </button>

      <button 
        class="action-btn" 
        on:click={() => exportDiagramAsPng()}
        disabled={viewMode !== "rendered"}
        title={viewMode !== "rendered" ? "Switch to rendered view to export PNG" : "Export diagram as PNG"}
      >
        🖼️ Export PNG
      </button>
    </div>

    <!-- Syntax View (Collapsible, only in rendered mode) -->
    {#if viewMode === "rendered"}
      <details class="syntax-details">
        <summary>View Mermaid Syntax</summary>
        <pre class="syntax-code"><code>{currentDiagram.mermaidSyntax}</code></pre>
      </details>
    {/if}
  {/if}
</div>

<style>
  .explanation-diagram-view {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .diagram-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #E5E7EB;
  }

  .diagram-header h3 {
    margin: 0;
    color: #111827;
    font-size: 1.25rem;
  }

  .header-controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .view-mode-toggle {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem;
    background: #F3F4F6;
    border-radius: 6px;
  }

  .toggle-btn {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6B7280;
    transition: all 0.2s;
  }

  .toggle-btn:hover {
    background: #ffffff;
    color: #374151;
  }

  .toggle-btn.active {
    background: #ffffff;
    color: var(--interactive-accent);
    border-color: var(--interactive-accent);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .diagram-type-selector {
    display: flex;
    gap: 0.5rem;
    padding: 0.25rem;
    background: #F3F4F6;
    border-radius: 8px;
  }

  .type-btn {
    position: relative;
    padding: 0.5rem 1rem;
    border: 2px solid transparent;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    color: #6B7280;
    transition: all 0.2s;
  }

  .type-btn:hover {
    background: white;
    color: #374151;
  }

  .type-btn.active {
    background: white;
    color: #3B82F6;
    border-color: #3B82F6;
  }

  .type-btn.recommended::after {
    content: "⭐";
    position: absolute;
    top: -8px;
    right: -8px;
    font-size: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .checkbox-label input {
    cursor: pointer;
  }

  .empty-state,
  .error-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #6B7280;
  }

  .empty-icon,
  .error-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h4,
  .error-state h4 {
    margin: 0.5rem 0;
    color: #374151;
  }

  .empty-state p,
  .error-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .error-state {
    color: #DC2626;
  }

  .error-state h4 {
    color: #DC2626;
  }

  .diagram-info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: #F9FAFB;
    border-radius: 6px;
  }

  .info-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .info-item.warnings {
    flex-direction: column;
  }

  .info-label {
    font-weight: 600;
    color: #6B7280;
    min-width: 6rem;
  }

  .info-value {
    color: #111827;
  }

  .complexity-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .warning-list {
    margin: 0.25rem 0 0 0;
    padding-left: 1.5rem;
    color: #D97706;
  }

  .warning-list li {
    margin: 0.25rem 0;
  }

  .diagram-container {
    min-height: 300px;
    max-height: 600px;
    overflow: auto;
    border: 2px solid #E5E7EB;
    border-radius: 8px;
    padding: 1.5rem;
    background: #F9FAFB;
  }

  .mermaid-rendered {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  }

  .mermaid-rendered :global(svg) {
    max-width: 100%;
    height: auto;
  }

  .mermaid-syntax {
    background: #1F2937;
    color: #F9FAFB;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
  }

  .mermaid-syntax pre {
    margin: 0;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .mermaid-syntax code {
    color: #10B981;
  }

  .mermaid-error {
    color: #EF4444;
    background: #FEE2E2;
    padding: 1rem;
    border-radius: 6px;
  }

  .diagram-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #D1D5DB;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    background: #F3F4F6;
    border-color: #9CA3AF;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .syntax-details {
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    overflow: hidden;
  }

  .syntax-details summary {
    padding: 0.75rem 1rem;
    background: #F9FAFB;
    cursor: pointer;
    font-weight: 600;
    color: #374151;
    user-select: none;
  }

  .syntax-details summary:hover {
    background: #F3F4F6;
  }

  .syntax-code {
    margin: 0.5rem 0 0 0;
    padding: 1rem;
    background: #1F2937;
    color: #10B981;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    overflow-x: auto;
    white-space: pre;
  }
</style>
