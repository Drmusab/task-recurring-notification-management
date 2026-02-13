<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface DayActivity {
		date: Date;
		count: number;
		level: 0 | 1 | 2 | 3 | 4; // 0 = none, 4 = most active
	}

	interface Props {
		data?: DayActivity[];
		title?: string;
		className?: string;
		startDate?: Date;
	}

	const {
		data = [],
		title = 'Activity Heatmap',
		className = '',
		startDate = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let showTable = $state(false);
	let hoveredDay = $state<DayActivity | null>(null);
	let announcement = $state('');

	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	// Generate calendar grid (12 weeks)
	const calendarWeeks = $derived(() => {
		const weeks: DayActivity[][] = [];
		const current = new Date(startDate);
		
		// Start from Sunday of the week containing startDate
		current.setDate(current.getDate() - current.getDay());

		for (let week = 0; week < 12; week++) {
			const weekDays: DayActivity[] = [];
			for (let day = 0; day < 7; day++) {
				const dateStr = current.toISOString().split('T')[0];
				const dayData = data.find(d => d.date.toISOString().split('T')[0] === dateStr);
				
				weekDays.push(
					dayData || {
						date: new Date(current),
						count: 0,
						level: 0
					}
				);
				
				current.setDate(current.getDate() + 1);
			}
			weeks.push(weekDays);
		}
		
		return weeks;
	});

	// Get months to display
	const monthHeaders = $derived(() => {
		const months: Array<{ name: string; weekIndex: number }> = [];
		let lastMonth = -1;

		calendarWeeks().forEach((week, weekIndex) => {
			const firstDay = week[0];
			const month = firstDay.date.getMonth();
			
			if (month !== lastMonth) {
				months.push({
					name: monthNames[month],
					weekIndex
				});
				lastMonth = month;
			}
		});

		return months;
	});

	function getLevelColor(level: 0 | 1 | 2 | 3 | 4): string {
		const colors = [
			'var(--background-modifier-hover)', // level 0
			'rgba(100, 200, 255, 0.3)', // level 1
			'rgba(100, 200, 255, 0.5)', // level 2
			'rgba(100, 200, 255, 0.7)', // level 3
			'rgba(100, 200, 255, 1)' // level 4
		];
		return colors[level];
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function handleDayClick(day: DayActivity) {
		announcement = `${formatDate(day.date)}: ${day.count} tasks completed`;
		dispatch('dayClick', day);
	}

	function handleDayHover(day: DayActivity | null) {
		hoveredDay = day;
	}

	function toggleTable() {
		showTable = !showTable;
		announcement = showTable ? 'Data table shown' : 'Data table hidden';
	}
</script>

<div class="heatmap-view {className}" role="region" aria-labelledby="heatmap-title">
	<div class="heatmap-header">
		<h3 id="heatmap-title">{title}</h3>

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

	<!-- Heatmap Grid -->
	<div class="heatmap-container" role="img" aria-label="Activity heatmap showing task completion over time">
		<!-- Month Headers -->
		<div class="month-headers" role="presentation">
			{#each monthHeaders() as month}
				<span class="month-label" style="grid-column: {month.weekIndex + 2};">
					{month.name}
				</span>
			{/each}
		</div>

		<!-- Weekday Labels -->
		<div class="weekday-labels" role="presentation">
			{#each weekdayNames as day, index}
				<span class="weekday-label" style="grid-row: {index + 2};">
					{day}
				</span>
			{/each}
		</div>

		<!-- Heatmap Grid -->
		<div class="heatmap-grid" role="grid" aria-label="Activity calendar grid">
			{#each calendarWeeks() as week, weekIndex}
				<div class="heatmap-week" role="row" style="grid-column: {weekIndex + 2};">
					{#each week as day, dayIndex}
						<button
							class="heatmap-day"
							style="background: {getLevelColor(day.level)};"
							role="gridcell"
							aria-label="{formatDate(day.date)}: {day.count} tasks completed"
							on:click={() => handleDayClick(day)}
							on:mouseenter={() => handleDayHover(day)}
							on:mouseleave={() => handleDayHover(null)}
							on:focus={() => handleDayHover(day)}
							on:blur={() => handleDayHover(null)}
						>
							<span class="sr-only">{formatDate(day.date)}: {day.count} tasks</span>
						</button>
					{/each}
				</div>
			{/each}
		</div>

		<!-- Tooltip -->
		{#if hoveredDay}
			<div class="heatmap-tooltip" role="tooltip" aria-live="polite">
				<div class="tooltip-date">{formatDate(hoveredDay.date)}</div>
				<div class="tooltip-count">
					{hoveredDay.count} {hoveredDay.count === 1 ? 'task' : 'tasks'} completed
				</div>
			</div>
		{/if}
	</div>

	<!-- Legend -->
	<div class="heatmap-legend" role="list" aria-label="Activity level legend">
		<span class="legend-label">Less</span>
		<div
			class="legend-square"
			style="background: {getLevelColor(0)};"
			role="listitem"
			aria-label="Level 0"
		></div>
		<div
			class="legend-square"
			style="background: {getLevelColor(1)};"
			role="listitem"
			aria-label="Level 1"
		></div>
		<div
			class="legend-square"
			style="background: {getLevelColor(2)};"
			role="listitem"
			aria-label="Level 2"
		></div>
		<div
			class="legend-square"
			style="background: {getLevelColor(3)};"
			role="listitem"
			aria-label="Level 3"
		></div>
		<div
			class="legend-square"
			style="background: {getLevelColor(4)};"
			role="listitem"
			aria-label="Level 4"
		></div>
		<span class="legend-label">More</span>
	</div>

	<!-- Accessible Data Table -->
	{#if showTable}
		<div class="data-table-container" role="region" aria-labelledby="table-title">
			<h4 id="table-title" class="sr-only">Activity heatmap data table</h4>
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Date</th>
						<th scope="col">Tasks Completed</th>
						<th scope="col">Activity Level</th>
					</tr>
				</thead>
				<tbody>
					{#each data.filter(d => d.count > 0).sort((a, b) => b.date.getTime() - a.date.getTime()) as day}
						<tr>
							<th scope="row">{formatDate(day.date)}</th>
							<td>{day.count}</td>
							<td>
								<div class="table-activity-indicator">
									<div
										class="table-activity-square"
										style="background: {getLevelColor(day.level)};"
										aria-hidden="true"
									></div>
									<span>Level {day.level}</span>
								</div>
							</td>
						</tr>
					{/each}
					{#if data.filter(d => d.count > 0).length === 0}
						<tr>
							<td colspan="3" class="no-data">No activity recorded</td>
						</tr>
					{/if}
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
	.heatmap-view {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.heatmap-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.heatmap-header h3 {
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

	.heatmap-container {
		position: relative;
		display: grid;
		grid-template-columns: 50px repeat(12, 14px);
		grid-template-rows: 20px repeat(7, 14px);
		gap: 3px;
		padding: 1rem;
	}

	.month-headers {
		display: contents;
	}

	.month-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		grid-row: 1;
	}

	.weekday-labels {
		display: contents;
	}

	.weekday-label {
		font-size: 0.625rem;
		color: var(--text-muted);
		grid-column: 1;
		display: flex;
		align-items: center;
	}

	.heatmap-grid {
		display: contents;
	}

	.heatmap-week {
		display: contents;
	}

	.heatmap-day {
		width: 14px;
		height: 14px;
		border: 1px solid var(--border-color);
		border-radius: 2px;
		cursor: pointer;
		padding: 0;
		transition: all 0.2s ease;
	}

	.heatmap-day:hover {
		border-color: var(--interactive-accent);
		transform: scale(1.2);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		z-index: 1;
	}

	.heatmap-day:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		transform: scale(1.2);
		z-index: 1;
	}

	.heatmap-tooltip {
		position: fixed;
		background: var(--background);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		pointer-events: none;
		z-index: 1000;
		transform: translate(-50%, -110%);
		left: 50%;
		top: 0;
	}

	.tooltip-date {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-normal);
		margin-bottom: 0.125rem;
	}

	.tooltip-count {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.heatmap-legend {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		justify-content: flex-end;
		padding: 0.5rem 1rem;
	}

	.legend-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0 0.25rem;
	}

	.legend-square {
		width: 14px;
		height: 14px;
		border: 1px solid var(--border-color);
		border-radius: 2px;
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

	.table-activity-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.table-activity-square {
		width: 14px;
		height: 14px;
		border: 1px solid var(--border-color);
		border-radius: 2px;
	}

	.no-data {
		text-align: center;
		color: var(--text-muted);
		font-style: italic;
		padding: 2rem;
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
		.heatmap-view,
		.toggle-table-button,
		.heatmap-day,
		.legend-square {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.toggle-table-button,
		.heatmap-day {
			transition: none;
		}

		.heatmap-day:hover,
		.heatmap-day:focus {
			transform: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.heatmap-container {
			grid-template-columns: 40px repeat(12, 12px);
			grid-template-rows: 18px repeat(7, 12px);
			gap: 2px;
		}

		.heatmap-day,
		.legend-square {
			width: 12px;
			height: 12px;
		}

		.month-label,
		.weekday-label {
			font-size: 0.625rem;
		}
	}
</style>
