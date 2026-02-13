<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type Priority = 'critical' | 'high' | 'medium' | 'low' | null;

	interface PriorityData {
		priority: Priority;
		count: number;
		percentage: number;
	}

	interface Props {
		data?: PriorityData[];
		title?: string;
		className?: string;
	}

	const {
		data = [
			{ priority: 'critical', count: 12, percentage: 8 },
			{ priority: 'high', count: 34, percentage: 22 },
			{ priority: 'medium', count: 56, percentage: 36 },
			{ priority: 'low', count: 40, percentage: 26 },
			{ priority: null, count: 14, percentage: 8 }
		],
		title = 'Priority Distribution',
		className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let showTable = $state(false);
	let announcement = $state('');

	const priorityColors: Record<Priority | 'null', string> = {
		critical: 'var(--color-red)',
		high: 'var(--color-orange)',
		medium: 'var(--color-yellow)',
		low: 'var(--color-blue)',
		null: 'var(--text-muted)'
	};

	const priorityLabels: Record<Priority | 'null', string> = {
		critical: 'Critical',
		high: 'High',
		medium: 'Medium',
		low: 'Low',
		null: 'No Priority'
	};

	function getPriorityColor(priority: Priority): string {
		return priorityColors[priority || 'null'];
	}

	function getPriorityLabel(priority: Priority): string {
		return priorityLabels[priority || 'null'];
	}

	function handleSegmentClick(item: PriorityData) {
		announcement = `${getPriorityLabel(item.priority)}: ${item.count} tasks (${item.percentage}%)`;
		dispatch('segmentClick', item);
	}

	function toggleTable() {
		showTable = !showTable;
		announcement = showTable ? 'Data table shown' : 'Data table hidden';
	}

	const totalCount = $derived(data.reduce((sum, item) => sum + item.count, 0));

	// Calculate circle positions for pie chart (SVG coordinates)
	function calculatePieSegments(data: PriorityData[]): Array<{ path: string; color: string; label: string; item: PriorityData }> {
		let currentAngle = -90; // Start at top
		const segments: Array<{ path: string; color: string; label: string; item: PriorityData }> = [];

		for (const item of data) {
			const angle = (item.percentage / 100) * 360;
			const endAngle = currentAngle + angle;

			const startX = 100 + 80 * Math.cos((currentAngle * Math.PI) / 180);
			const startY = 100 + 80 * Math.sin((currentAngle * Math.PI) / 180);
			const endX = 100 + 80 * Math.cos((endAngle * Math.PI) / 180);
			const endY = 100 + 80 * Math.sin((endAngle * Math.PI) / 180);

			const largeArcFlag = angle > 180 ? 1 : 0;

			const path = `
				M 100 100
				L ${startX} ${startY}
				A 80 80 0 ${largeArcFlag} 1 ${endX} ${endY}
				Z
			`;

			segments.push({
				path,
				color: getPriorityColor(item.priority),
				label: getPriorityLabel(item.priority),
				item
			});

			currentAngle = endAngle;
		}

		return segments;
	}

	const pieSegments = $derived(calculatePieSegments(data));
</script>

<div class="priority-distribution {className}" role="region" aria-labelledby="chart-title">
	<div class="chart-header">
		<h3 id="chart-title">{title}</h3>
		
		<button
			class="toggle-table-button"
			on:click={toggleTable}
			aria-pressed={showTable}
			aria-label={showTable ? 'Hide data table' : 'Show data table'}
		>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect x="2" y="2" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"/>
				<line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" stroke-width="2"/>
				<line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="2"/>
			</svg>
		</button>
	</div>

	<div class="chart-content">
		<!-- Pie Chart -->
		<div class="pie-chart-container">
			<svg class="pie-chart" viewBox="0 0 200 200" role="img" aria-labelledby="chart-title">
				<title>Pie chart showing task priority distribution</title>
				{#each pieSegments as segment, index}
					<path
						d={segment.path}
						fill={segment.color}
						stroke="var(--background)"
						stroke-width="2"
						role="button"
						tabindex="0"
						aria-label="{segment.label}: {segment.item.count} tasks, {segment.item.percentage}%"
						class="pie-segment"
						on:click={() => handleSegmentClick(segment.item)}
						on:keydown={(e) => e.key === 'Enter' && handleSegmentClick(segment.item)}
					/>
				{/each}
			</svg>
		</div>

		<!-- Bar Chart Alternative -->
		<div class="bar-chart-container">
			<div class="priority-bars">
				{#each data as item}
					<button
						class="priority-bar-item"
						on:click={() => handleSegmentClick(item)}
						aria-label="{getPriorityLabel(item.priority)}: {item.count} tasks ({item.percentage}%)"
					>
						<div class="bar-label-section">
							<span class="bar-priority-label">{getPriorityLabel(item.priority)}</span>
							<span class="bar-count">{item.count}</span>
						</div>
						<div class="bar-container">
							<div
								class="bar-fill"
								style="width: {item.percentage}%; background: {getPriorityColor(item.priority)};"
							>
								<span class="bar-percentage">{item.percentage}%</span>
							</div>
						</div>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Legend -->
	<div class="chart-legend" role="list" aria-label="Priority legend">
		{#each data as item}
			<div class="legend-item" role="listitem">
				<span
					class="legend-color"
					style="background: {getPriorityColor(item.priority)};"
					aria-hidden="true"
				></span>
				<span class="legend-label">{getPriorityLabel(item.priority)}</span>
				<span class="legend-value">{item.count} ({item.percentage}%)</span>
			</div>
		{/each}
	</div>

	<!-- Accessible Data Table -->
	{#if showTable}
		<div class="data-table-container" role="region" aria-labelledby="table-title">
			<h4 id="table-title" class="sr-only">Priority distribution data table</h4>
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Priority</th>
						<th scope="col">Count</th>
						<th scope="col">Percentage</th>
					</tr>
				</thead>
				<tbody>
					{#each data as item}
						<tr>
							<th scope="row">
								<span class="table-priority-indicator" style="background: {getPriorityColor(item.priority)};"></span>
								{getPriorityLabel(item.priority)}
							</th>
							<td>{item.count}</td>
							<td>{item.percentage}%</td>
						</tr>
					{/each}
					<tr class="total-row">
						<th scope="row">Total</th>
						<td>{totalCount}</td>
						<td>100%</td>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Screen Reader Announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announcement}
	</div>
</div>

<style>
	.priority-distribution {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.chart-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-normal);
	}

	.toggle-table-button {
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem;
		background: var(--background);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.toggle-table-button:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
		border-color: var(--interactive-accent);
	}

	.toggle-table-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.toggle-table-button[aria-pressed="true"] {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}

	.chart-content {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 2rem;
		align-items: center;
	}

	.pie-chart-container {
		width: 200px;
		height: 200px;
	}

	.pie-chart {
		width: 100%;
		height: 100%;
	}

	.pie-segment {
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.pie-segment:hover {
		opacity: 0.8;
		filter: brightness(1.1);
	}

	.pie-segment:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.priority-bars {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.priority-bar-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		text-align: left;
		width: 100%;
	}

	.priority-bar-item:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.bar-label-section {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		margin-bottom: 0.25rem;
	}

	.bar-priority-label {
		font-weight: 500;
		color: var(--text-normal);
	}

	.bar-count {
		color: var(--text-muted);
	}

	.bar-container {
		height: 32px;
		background: var(--background-modifier-hover);
		border-radius: 4px;
		overflow: hidden;
		position: relative;
	}

	.bar-fill {
		height: 100%;
		display: flex;
		align-items: center;
		padding: 0 0.5rem;
		transition: width 0.3s ease;
		min-width: 44px;
	}

	.bar-percentage {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-on-accent);
		white-space: nowrap;
	}

	.chart-legend {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--background);
		border-radius: 6px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.legend-color {
		width: 16px;
		height: 16px;
		border-radius: 3px;
		flex-shrink: 0;
	}

	.legend-label {
		flex: 1;
		font-size: 0.875rem;
		color: var(--text-normal);
		font-weight: 500;
	}

	.legend-value {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.data-table-container {
		margin-top: 1rem;
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.data-table th,
	.data-table td {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--border-color);
	}

	.data-table thead th {
		background: var(--background-modifier-hover);
		font-weight: 600;
		color: var(--text-normal);
	}

	.data-table tbody tr:hover {
		background: var(--background-modifier-hover);
	}

	.table-priority-indicator {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		margin-right: 0.5rem;
		vertical-align: middle;
	}

	.total-row {
		font-weight: 600;
		border-top: 2px solid var(--border-color);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.priority-distribution,
		.toggle-table-button,
		.bar-container {
			border-width: 2px;
		}

		.pie-segment {
			stroke-width: 3;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.toggle-table-button,
		.pie-segment,
		.bar-fill {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.chart-content {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.pie-chart-container {
			margin: 0 auto;
		}
	}
</style>
