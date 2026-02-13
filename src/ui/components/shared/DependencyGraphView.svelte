<script lang="ts">
  import type { Task } from '@backend/core/models/Task';
  import { DependencyGraph, type GraphNode, type GraphEdge, type DependencyGraphOptions } from '@backend/core/dependencies/DependencyGraph';
  import { onMount } from 'svelte';

  export let tasks: Task[] = [];
  export let focusTaskId: string | undefined = undefined;
  export let includeCompleted: boolean = false;
  export let depthLimit: number = 3;
  export let height: string = '600px';
  export let onTaskClick: ((taskId: string) => void) | undefined = undefined;

  let container: HTMLDivElement;
  let graph = new DependencyGraph();
  let nodes: GraphNode[] = [];
  let edges: GraphEdge[] = [];
  let levels: Map<string, number> = new Map();
  let maxLevel = 0;
  let selectedTaskId: string | undefined = undefined;
  let hoveredTaskId: string | undefined = undefined;

  // Layout constants
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 80;
  const LEVEL_HEIGHT = 150;
  const HORIZONTAL_SPACING = 40;
  const VERTICAL_PADDING = 50;

  // Color scheme
  const COLORS = {
    node: {
      default: '#ffffff',
      completed: '#e8f5e9',
      blocked: '#ffebee',
      blocking: '#fff3e0',
      selected: '#e3f2fd',
      hovered: '#f5f5f5'
    },
    border: {
      default: '#bdbdbd',
      completed: '#66bb6a',
      blocked: '#ef5350',
      blocking: '#ffa726',
      selected: '#2196f3',
      hovered: '#9e9e9e',
      cycle: '#d32f2f'
    },
    edge: {
      default: '#9e9e9e',
      hover: '#2196f3',
      cycle: '#d32f2f'
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
      completed: '#388e3c',
      blocked: '#c62828'
    }
  };

  $: {
    if (tasks.length > 0) {
      rebuildGraph();
    }
  }

  $: svgHeight = calculateSvgHeight();

  function rebuildGraph() {
    graph.build(tasks);
    
    const options: DependencyGraphOptions = {
      includeCompleted,
      focusTaskId,
      depthLimit
    };

    const graphData = graph.getGraphData(options);
    nodes = graphData.nodes;
    edges = graphData.edges;
    levels = graphData.levels;
    
    maxLevel = 0;
    for (const level of levels.values()) {
      maxLevel = Math.max(maxLevel, level);
    }
  }

  function calculateSvgHeight(): number {
    return (maxLevel + 1) * LEVEL_HEIGHT + 2 * VERTICAL_PADDING;
  }

  function getNodePosition(node: GraphNode): { x: number; y: number } {
    const level = levels.get(node.id) ?? 0;
    const nodesAtLevel = nodes.filter(n => levels.get(n.id) === level);
    const indexInLevel = nodesAtLevel.findIndex(n => n.id === node.id);
    const totalWidth = nodesAtLevel.length * NODE_WIDTH + (nodesAtLevel.length - 1) * HORIZONTAL_SPACING;
    
    const startX = (container?.offsetWidth || 800) / 2 - totalWidth / 2;
    const x = startX + indexInLevel * (NODE_WIDTH + HORIZONTAL_SPACING);
    const y = VERTICAL_PADDING + level * LEVEL_HEIGHT;
    
    return { x, y };
  }

  function getEdgePath(edge: GraphEdge): string {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (!fromNode || !toNode) return '';
    
    const fromPos = getNodePosition(fromNode);
    const toPos = getNodePosition(toNode);
    
    const fromX = fromPos.x + NODE_WIDTH / 2;
    const fromY = fromPos.y + NODE_HEIGHT;
    const toX = toPos.x + NODE_WIDTH / 2;
    const toY = toPos.y;
    
    // Create curved edges
    const midY = (fromY + toY) / 2;
    return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
  }

  function getNodeFillColor(node: GraphNode): string {
    if (selectedTaskId === node.id) return COLORS.node.selected;
    if (hoveredTaskId === node.id) return COLORS.node.hovered;
    if (node.isCompleted) return COLORS.node.completed;
    if (node.isBlocked) return COLORS.node.blocked;
    if (node.isBlocking) return COLORS.node.blocking;
    return COLORS.node.default;
  }

  function getNodeBorderColor(node: GraphNode): string {
    if (selectedTaskId === node.id) return COLORS.border.selected;
    if (hoveredTaskId === node.id) return COLORS.border.hovered;
    if (node.isCompleted) return COLORS.border.completed;
    if (node.isBlocked) return COLORS.border.blocked;
    if (node.isBlocking) return COLORS.border.blocking;
    return COLORS.border.default;
  }

  function getEdgeColor(edge: GraphEdge): string {
    if (hoveredTaskId === edge.from || hoveredTaskId === edge.to) {
      return COLORS.edge.hover;
    }
    return COLORS.edge.default;
  }

  function handleNodeClick(nodeId: string) {
    selectedTaskId = selectedTaskId === nodeId ? undefined : nodeId;
    if (onTaskClick) {
      onTaskClick(nodeId);
    }
  }

  function handleNodeMouseEnter(nodeId: string) {
    hoveredTaskId = nodeId;
  }

  function handleNodeMouseLeave() {
    hoveredTaskId = undefined;
  }

  function getNodeStatusBadge(node: GraphNode): string {
    if (node.isCompleted) return '✓ Completed';
    if (node.isBlocked) return '⛔ Blocked';
    if (node.isBlocking) return '🚧 Blocking';
    return '';
  }

  function truncateText(text: string, maxLength: number = 28): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  onMount(() => {
    if (tasks.length > 0) {
      rebuildGraph();
    }
  });
</script>

<div class="dependency-graph-container" style="height: {height}">
  <div class="controls">
    <label>
      <input type="checkbox" bind:checked={includeCompleted} />
      Show completed tasks
    </label>
    
    <label>
      Depth limit:
      <input type="number" min="1" max="10" bind:value={depthLimit} />
    </label>

    {#if focusTaskId}
      <button class="btn-clear-focus" on:click={() => (focusTaskId = undefined)}>
        Clear focus
      </button>
    {/if}
  </div>

  <div class="graph-viewport" bind:this={container}>
    {#if nodes.length === 0}
      <div class="empty-state">
        <p>No dependencies to display</p>
        {#if !includeCompleted}
          <p class="hint">Try enabling "Show completed tasks"</p>
        {/if}
      </div>
    {:else}
      <svg width="100%" height={svgHeight}>
        <!-- Define arrow marker -->
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="5"
            orient="auto"
          >
            <polygon points="0 0, 10 5, 0 10" fill={COLORS.edge.default} />
          </marker>
          <marker
            id="arrowhead-hover"
            markerWidth="10"
            markerHeight="10"
            refX="5"
            refY="5"
            orient="auto"
          >
            <polygon points="0 0, 10 5, 0 10" fill={COLORS.edge.hover} />
          </marker>
        </defs>

        <!-- Render edges first (behind nodes) -->
        <g class="edges">
          {#each edges as edge (edge.from + '-' + edge.to)}
            <path
              d={getEdgePath(edge)}
              stroke={getEdgeColor(edge)}
              stroke-width="2"
              fill="none"
              marker-end={hoveredTaskId === edge.from || hoveredTaskId === edge.to 
                ? 'url(#arrowhead-hover)' 
                : 'url(#arrowhead)'}
              class="edge"
              class:edge-hover={hoveredTaskId === edge.from || hoveredTaskId === edge.to}
            />
          {/each}
        </g>

        <!-- Render nodes -->
        <g class="nodes">
          {#each nodes as node (node.id)}
            {@const pos = getNodePosition(node)}
            <g
              class="node"
              class:node-selected={selectedTaskId === node.id}
              class:node-hovered={hoveredTaskId === node.id}
              on:click={() => handleNodeClick(node.id)}
              on:keydown={(e) => e.key === 'Enter' && handleNodeClick(node.id)}
              on:mouseenter={() => handleNodeMouseEnter(node.id)}
              on:mouseleave={handleNodeMouseLeave}
              role="button"
              tabindex="0"
              aria-label={node.title}
            >
              <!-- Node box -->
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                fill={getNodeFillColor(node)}
                stroke={getNodeBorderColor(node)}
                stroke-width="2"
                rx="6"
                class="node-rect"
              />

              <!-- Node title -->
              <text
                x={pos.x + NODE_WIDTH / 2}
                y={pos.y + 25}
                text-anchor="middle"
                font-size="14"
                font-weight="600"
                fill={COLORS.text.primary}
                class="node-title"
              >
                {truncateText(node.title)}
              </text>

              <!-- Node status badge -->
              {#if getNodeStatusBadge(node)}
                <text
                  x={pos.x + NODE_WIDTH / 2}
                  y={pos.y + 50}
                  text-anchor="middle"
                  font-size="11"
                  fill={node.isCompleted ? COLORS.text.completed : COLORS.text.blocked}
                  class="node-status"
                >
                  {getNodeStatusBadge(node)}
                </text>
              {/if}

              <!-- Dependency count -->
              {#if node.hasDependencies}
                <text
                  x={pos.x + NODE_WIDTH / 2}
                  y={pos.y + 68}
                  text-anchor="middle"
                  font-size="10"
                  fill={COLORS.text.secondary}
                  class="node-meta"
                >
                  {graph.getIndex().getBlockers(node.id).length} dependencies
                </text>
              {/if}
            </g>
          {/each}
        </g>
      </svg>
    {/if}
  </div>

  <!-- Legend -->
  <div class="legend">
    <div class="legend-item">
      <div class="legend-box" style="background: {COLORS.node.default}; border-color: {COLORS.border.default}"></div>
      <span>Active</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: {COLORS.node.completed}; border-color: {COLORS.border.completed}"></div>
      <span>Completed</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: {COLORS.node.blocked}; border-color: {COLORS.border.blocked}"></div>
      <span>Blocked</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: {COLORS.node.blocking}; border-color: {COLORS.border.blocking}"></div>
      <span>Blocking</span>
    </div>
  </div>

  <!-- Selected task info panel -->
  {#if selectedTaskId}
    {#each nodes.filter(n => n.id === selectedTaskId) as selectedNode}
      {#each tasks.filter(t => t.id === selectedTaskId) as selectedTask}
        <div class="info-panel">
          <div class="info-header">
            <h3>{selectedNode.title}</h3>
            <button class="btn-close" on:click={() => (selectedTaskId = undefined)}>×</button>
          </div>
          
          <div class="info-content">
            <div class="info-section">
              <strong>Status:</strong>
              <span class:status-completed={selectedNode.isCompleted} class:status-blocked={selectedNode.isBlocked}>
                {selectedNode.status || 'todo'}
              </span>
            </div>

            {#if selectedTask.description}
              <div class="info-section">
                <strong>Description:</strong>
                <p>{selectedTask.description}</p>
              </div>
            {/if}

            {#each [graph.getIndex().getBlockers(selectedTaskId)] as blockers}
              {#if blockers.length > 0}
                <div class="info-section">
                  <strong>Dependencies ({blockers.length}):</strong>
                  <ul>
                    {#each blockers as blockerId}
                      {#each tasks.filter(t => t.id === blockerId) as blockerTask}
                        <li>
                          <button class="task-link" on:click={() => handleNodeClick(blockerId)}>
                            {blockerTask.name}
                          </button>
                        </li>
                      {/each}
                    {/each}
                  </ul>
                </div>
              {/if}
            {/each}

            {#each [graph.getIndex().getBlocked(selectedTaskId)] as blocked}
              {#if blocked.length > 0}
                <div class="info-section">
                  <strong>Blocking ({blocked.length}):</strong>
                  <ul>
                    {#each blocked as blockedId}
                      {#each tasks.filter(t => t.id === blockedId) as blockedTask}
                        <li>
                          <button class="task-link" on:click={() => handleNodeClick(blockedId)}>
                            {blockedTask.name}
                          </button>
                        </li>
                      {/each}
                    {/each}
                  </ul>
                </div>
              {/if}
            {/each}

            {#if selectedNode.isBlocked}
              {#each [graph.explainBlocked(selectedTaskId)] as explanation}
                <div class="info-section warning">
                  <strong>⛔ Blocked Explanation:</strong>
                  <p>This task is blocked by {explanation.blockers.length} incomplete task(s)</p>
                  {#if explanation.blockers.length > 0}
                    <p class="hint">Complete these tasks first:</p>
                    <ul>
                      {#each explanation.blockers as blockerId}
                        {#each tasks.filter(t => t.id === blockerId) as blockerTask}
                          <li>
                            <button class="task-link" on:click={() => handleNodeClick(blockerId)}>
                              {blockerTask.name}
                            </button>
                          </li>
                        {/each}
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    {/each}
  {/if}
</div>

<style>
  .dependency-graph-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1rem;
    background: #fafafa;
    position: relative;
  }

  .controls {
    display: flex;
    gap: 1.5rem;
    align-items: center;
    padding: 0.5rem;
    background: white;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 14px;
    color: #424242;
    cursor: pointer;
  }

  input[type="checkbox"] {
    cursor: pointer;
  }

  input[type="number"] {
    width: 60px;
    padding: 0.25rem;
    border: 1px solid #bdbdbd;
    border-radius: 4px;
  }

  .btn-clear-focus {
    padding: 0.25rem 0.75rem;
    background: #2196f3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .btn-clear-focus:hover {
    background: #1976d2;
  }

  .graph-viewport {
    flex: 1;
    overflow: auto;
    background: white;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    min-height: 400px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #9e9e9e;
    font-size: 16px;
  }

  .empty-state .hint {
    font-size: 13px;
    margin-top: 0.5rem;
    color: #bdbdbd;
  }

  .node {
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .node:hover .node-rect {
    filter: brightness(0.95);
  }

  .node-selected .node-rect {
    stroke-width: 3;
    filter: brightness(0.98);
  }

  .node-title {
    user-select: none;
  }

  .edge {
    transition: all 0.2s ease;
  }

  .edge-hover {
    stroke-width: 3;
  }

  .legend {
    display: flex;
    gap: 1.5rem;
    padding: 0.75rem;
    background: white;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 13px;
    color: #616161;
  }

  .legend-box {
    width: 24px;
    height: 24px;
    border: 2px solid;
    border-radius: 4px;
  }

  .info-panel {
    position: absolute;
    top: 4.5rem;
    right: 1rem;
    width: 320px;
    max-height: 500px;
    overflow-y: auto;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
  }

  .info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e0e0e0;
    background: #f5f5f5;
    border-radius: 8px 8px 0 0;
  }

  .info-header h3 {
    margin: 0;
    font-size: 16px;
    color: #212121;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 24px;
    color: #757575;
    cursor: pointer;
    padding: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-close:hover {
    color: #212121;
    background: #e0e0e0;
    border-radius: 50%;
  }

  .info-content {
    padding: 1rem;
  }

  .info-section {
    margin-bottom: 1rem;
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .info-section strong {
    display: block;
    margin-bottom: 0.5rem;
    color: #424242;
    font-size: 13px;
  }

  .info-section p {
    margin: 0;
    color: #616161;
    font-size: 13px;
    line-height: 1.5;
  }

  .info-section ul {
    margin: 0;
    padding-left: 1.25rem;
    color: #616161;
    font-size: 13px;
  }

  .info-section ul li {
    margin: 0.25rem 0;
    list-style: none;
  }

  .task-link {
    background: none;
    border: none;
    color: #2196f3;
    cursor: pointer;
    padding: 0;
    font-size: 13px;
    text-align: left;
  }

  .task-link:hover {
    text-decoration: underline;
  }

  .info-section.warning {
    background: #fff3e0;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #ffa726;
  }

  .info-section.warning p {
    color: #e65100;
  }

  .info-section .hint {
    font-size: 12px;
    color: #757575;
    margin-top: 0.5rem;
  }

  .status-completed {
    color: #388e3c;
    font-weight: 600;
  }

  .status-blocked {
    color: #c62828;
    font-weight: 600;
  }
</style>
