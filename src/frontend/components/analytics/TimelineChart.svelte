<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface TimelineTask {
		id: string;
		title: string;
		startDate: Date;
		endDate: Date;
		progress: number;
		color: string;
	}

	interface Props {
		tasks?: TimelineTask[];
		title?: string;
		className?: string;
	}

	const {
		tasks = [
			{
				id: '1',
				title: 'Project Alpha',
				startDate: new Date(2024, 0, 1),
				endDate: new Date(2024, 0, 15),
				progress: 75,
				color: 'var(--color-blue)'
			},
			{
				id: '2',
				title: 'Project Beta',
				startDate: new Date(2024, 0, 10),
				endDate: new Date(2024, 0, 25),
				progress: 45,
				color: 'var(--color-orange)'
			},
			{
				id: '3',
				title: 'Project Gamma',
				startDate: new Date(2024, 0, 20),
				endDate: new Date(2024, 1, 5),
				progress: 20,
				color: 'var(--color-green)'
			}
		],
		title = 'Task Timeline',
		className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let showTable = $state(false);
	let announcement = $state('');

	const today = new Date();

	// Calculate date range
	const earliestStart = $derived(
		tasks.length > 0
			? new Date(Math.min(...tasks.map(t => t.startDate.getTime())))
			: new Date()
	);

	const latestEnd = $derived(
		tasks.length > 0
			? new Date(Math.max(...tasks.map(t => t.endDate.getTime())))
			: new Date()
	);

	const totalDays = $derived(
		Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24))
	);

	function getTaskPosition(task: TimelineTask): { left: number; width: number } {
		const startOffset = Math.ceil(
			(task.startDate.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24)
		);
		const taskDuration = Math.ceil(
			(task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)
		);

		const left = (startOffset / totalDays) * 100;
		const width = (taskDuration / totalDays) * 100;

		return { left, width };
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getDaysBetween(start: Date, end: Date): number {
		return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
	}

	function handleTaskClick(task: TimelineTask) {
		announcement = `${task.title}: ${formatDate(task.startDate)} to ${formatDate(task.endDate)}, ${task.progress}% complete`;
		dispatch('taskClick', task);
	}

	function toggleTable() {
		showTable = !showTable;
		announcement = showTable ? 'Data table shown' : 'Data table hidden';
	}
</script>

<div class="timeline-chart {className}" role="region" aria-labelledby="timeline-title">
	<div class="chart-header">
		<h3 id="timeline-title">{title}</h3>

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

	<!-- Timeline Visualization -->
	<div class="timeline-container" role="list" aria-label="Task timeline">
		<div class="timeline-header">
			<div class="timeline-dates" role="presentation">
				<span class="timeline-date-label">{formatDate(earliestStart)}</span>
				<span class="timeline-date-label">{formatDate(latestEnd)}</span>
			</div>
		</div>

		<div class="timeline-tasks">
			{#each tasks as task, index (task.id)}
				{@const position = getTaskPosition(task)}
				<div class="timeline-task-row" role="listitem">
					<div class="task-label">
						<span class="task-title">{task.title}</span>
						<span class="task-dates">
							{formatDate(task.startDate)} - {formatDate(task.endDate)}
						</span>
					</div>
					
					<div class="timeline-bar-container">
						<button
							class="timeline-bar"
							style="left: {position.left}%; width: {position.width}%; background: {task.color};"
							on:click={() => handleTaskClick(task)}
							aria-label="{task.title}: {formatDate(task.startDate)} to {formatDate(task.endDate)}, {task.progress}% complete"
						>
							<div
								class="bar-progress"
								style="width: {task.progress}%; background: {task.color};"
								aria-hidden="true"
							></div>
							<span class="bar-progress-label">{task.progress}%</span>
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Today Marker -->
		{#if today >= earliestStart && today <= latestEnd}
			{@const todayPosition =
				((today.getTime() - earliestStart.getTime()) / (latestEnd.getTime() - earliestStart.getTime())) * 100}
			<div
				class="today-marker"
				style="left: {todayPosition}%;"
				role="presentation"
				aria-hidden="true"
			>
				<div class="today-line"></div>
				<span class="today-label">Today</span>
			</div>
		{/if}
	</div>

	<!-- Accessible Data Table -->
	{#if showTable}
		<div class="data-table-container" role="region" aria-labelledby="table-title">
			<h4 id="table-title" class="sr-only">Task timeline data table</h4>
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Task</th>
						<th scope="col">Start Date</th>
						<th scope="col">End Date</th>
						<th scope="col">Duration</th>
						<th scope="col">Progress</th>
					</tr>
				</thead>
				<tbody>
					{#each tasks as task}
						<tr>
							<th scope="row">
								<span
									class="table-color-indicator"
									style="background: {task.color};"
									aria-hidden="true"
								></span>
								{task.title}
							</th>
							<td>{formatDate(task.startDate)}</td>
							<td>{formatDate(task.endDate)}</td>
							<td>{getDaysBetween(task.startDate, task.endDate)} days</td>
							<td>
								<div class="table-progress-bar">
									<div
										class="table-progress-fill"
										style="width: {task.progress}%; background: {task.color};"
									></div>
									<span class="table-progress-text">{task.progress}%</span>
								</div>
							</td>
						</tr>
					{/each}
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
	.timeline-chart {
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

	.timeline-container {
		position: relative;
		padding: 1rem 0;
	}

	.timeline-header {
		margin-bottom: 1rem;
	}

	.timeline-dates {
		display: flex;
		justify-content: space-between;
		padding: 0 200px 0 0;
	}

	.timeline-date-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.timeline-tasks {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.timeline-task-row {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 1rem;
		align-items: center;
	}

	.task-label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.task-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-normal);
	}

	.task-dates {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.timeline-bar-container {
		position: relative;
		height: 44px;
		background: var(--background-modifier-hover);
		border-radius: 6px;
	}

	.timeline-bar {
		position: absolute;
		height: 100%;
		border-radius: 6px;
		opacity: 0.7;
		cursor: pointer;
		border: 2px solid transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		overflow: hidden;
	}

	.timeline-bar:hover {
		opacity: 1;
		border-color: var(--interactive-accent);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.timeline-bar:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		opacity: 1;
	}

	.bar-progress {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		filter: brightness(1.2);
		border-radius: 4px;
	}

	.bar-progress-label {
		position: relative;
		z-index: 1;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-on-accent);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.today-marker {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		pointer-events: none;
		z-index: 10;
	}

	.today-line {
		width: 2px;
		height: 100%;
		background: var(--color-red);
		box-shadow: 0 0 4px rgba(255, 0, 0, 0.5);
	}

	.today-label {
		position: absolute;
		top: -1.5rem;
		left: 50%;
		transform: translateX(-50%);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-red);
		background: var(--background);
		padding: 0.125rem 0.5rem;
		border-radius: 3px;
		white-space: nowrap;
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

	.table-color-indicator {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		margin-right: 0.5rem;
		vertical-align: middle;
	}

	.table-progress-bar {
		position: relative;
		height: 24px;
		background: var(--background-modifier-hover);
		border-radius: 4px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.table-progress-fill {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		opacity: 0.7;
	}

	.table-progress-text {
		position: relative;
		z-index: 1;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-normal);
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
		.timeline-chart,
		.toggle-table-button,
		.timeline-bar-container,
		.timeline-bar {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.toggle-table-button,
		.timeline-bar {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.timeline-task-row {
			grid-template-columns: 1fr;
			gap: 0.5rem;
		}

		.timeline-dates {
			padding-right: 0;
		}
	}
</style>
