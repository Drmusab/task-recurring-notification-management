<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../shared/Icon.svelte';
	import Button from '../shared/Button.svelte';

	interface Props {
		className?: string;
	}

	const { className = '' }: Props = $props();

	const dispatch = createEventDispatcher();

	// Sample analytics data (would come from store in real implementation)
	let stats = $state({
		total: 156,
		completed: 89,
		inProgress: 34,
		overdue: 12,
		dueToday: 21,
		completionRate: 57,
		avgCompletionTime: 2.3,
		activeStreak: 7
	});

	let selectedPeriod = $state<'day' | 'week' | 'month' | 'year'>('week');
	let announcement = $state('');

	function handlePeriodChange(period: 'day' | 'week' | 'month' | 'year') {
		selectedPeriod = period;
		announcement = `Viewing ${period}ly analytics`;
		dispatch('periodChange', period);
	}

	function handleRefresh() {
		announcement = 'Analytics data refreshed';
		dispatch('refresh');
	}

	function handleExport() {
		announcement = 'Exporting analytics data';
		dispatch('export');
	}
</script>

<div class="task-analytics {className}" role="region" aria-label="Task Analytics Dashboard">
	<!-- Header -->
	<div class="analytics-header">
		<h2 id="analytics-title">Task Analytics</h2>
		
		<div class="header-actions">
			<Button
				variant="ghost"
				size="small"
				on:click={handleRefresh}
				ariaLabel="Refresh analytics data"
			>
				<Icon category="navigation" name="refresh" size={16} />
				Refresh
			</Button>
			
			<Button
				variant="ghost"
				size="small"
				on:click={handleExport}
				ariaLabel="Export analytics data"
			>
				<Icon category="navigation" name="download" size={16} />
				Export
			</Button>
		</div>
	</div>

	<!-- Period Selector -->
	<div class="period-selector" role="toolbar" aria-label="Select time period">
		<span class="period-label" id="period-label">Time Period:</span>
		<div class="period-buttons" role="group" aria-labelledby="period-label">
			<button
				class="period-button"
				class:active={selectedPeriod === 'day'}
				on:click={() => handlePeriodChange('day')}
				aria-pressed={selectedPeriod === 'day'}
			>
				Day
			</button>
			<button
				class="period-button"
				class:active={selectedPeriod === 'week'}
				on:click={() => handlePeriodChange('week')}
				aria-pressed={selectedPeriod === 'week'}
			>
				Week
			</button>
			<button
				class="period-button"
				class:active={selectedPeriod === 'month'}
				on:click={() => handlePeriodChange('month')}
				aria-pressed={selectedPeriod === 'month'}
			>
				Month
			</button>
			<button
				class="period-button"
				class:active={selectedPeriod === 'year'}
				on:click={() => handlePeriodChange('year')}
				aria-pressed={selectedPeriod === 'year'}
			>
				Year
			</button>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="stats-grid" role="list" aria-label="Analytics statistics">
		<div class="stat-card" role="listitem">
			<div class="stat-icon total">
				<Icon category="features" name="list" size={24} />
			</div>
			<div class="stat-content">
				<div class="stat-value" aria-label="Total tasks">{stats.total}</div>
				<div class="stat-label">Total Tasks</div>
			</div>
		</div>

		<div class="stat-card" role="listitem">
			<div class="stat-icon completed">
				<Icon category="status" name="check" size={24} />
			</div>
			<div class="stat-content">
				<div class="stat-value" aria-label="Completed tasks">{stats.completed}</div>
				<div class="stat-label">Completed</div>
			</div>
		</div>

		<div class="stat-card" role="listitem">
			<div class="stat-icon in-progress">
				<Icon category="features" name="clock" size={24} />
			</div>
			<div class="stat-content">
				<div class="stat-value" aria-label="In progress tasks">{stats.inProgress}</div>
				<div class="stat-label">In Progress</div>
			</div>
		</div>

		<div class="stat-card" role="listitem">
			<div class="stat-icon overdue">
				<Icon category="status" name="warning" size={24} />
			</div>
			<div class="stat-content">
				<div class="stat-value" aria-label="Overdue tasks">{stats.overdue}</div>
				<div class="stat-label">Overdue</div>
			</div>
		</div>

		<div class="stat-card" role="listitem">
			<div class="stat-icon due-today">
				<Icon category="features" name="calendar" size={24} />
			</div>
			<div class="stat-content">
				<div class="stat-value" aria-label="Due today">{stats.dueToday}</div>
				<div class="stat-label">Due Today</div>
			</div>
		</div>

		<div class="stat-card" role="listitem">
			<div class="stat-icon completion-rate">
				<Icon category="status" name="check" size={24} />
			</div>
			<div class="stat-content">
				<div class="stat-value" aria-label="Completion rate">{stats.completionRate}%</div>
				<div class="stat-label">Completion Rate</div>
			</div>
		</div>

		<div class="stat-card" role="listitem">
			<div class="stat-icon avg-time">
				<Icon category="features" name="clock" size={24} />
			</div>
			<div class="stat-content">
				<div class="stat-value" aria-label="Average completion time">{stats.avgCompletionTime} days</div>
				<div class="stat-label">Avg. Completion</div>
			</div>
		</div>

		<div class="stat-card" role="listitem">
			<div class="stat-icon streak">
				<Icon category="features" name="fire" size={24} />
			</div>
			<div class="stat-content">
				<div class="stat-value" aria-label="Active streak">{stats.activeStreak} days</div>
				<div class="stat-label">Active Streak</div>
			</div>
		</div>
	</div>

	<!-- Screen Reader Announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announcement}
	</div>
</div>

<style>
	.task-analytics {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		background: var(--background);
		border-radius: 8px;
	}

	.analytics-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.analytics-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-normal);
	}

	.header-actions {
		display: flex;
		gap: 0.5rem;
	}

	.period-selector {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.period-label {
		font-weight: 500;
		color: var(--text-normal);
		font-size: 0.875rem;
	}

	.period-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.period-button {
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem 1rem;
		background: var(--background-secondary);
		border: 2px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-normal);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.period-button:hover {
		background: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.period-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.period-button.active {
		background: var(--interactive-accent);
		border-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.stat-card:hover {
		border-color: var(--interactive-accent);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.stat-icon.total {
		background: rgba(100, 100, 255, 0.1);
		color: var(--color-blue);
	}

	.stat-icon.completed {
		background: rgba(0, 200, 100, 0.1);
		color: var(--color-green);
	}

	.stat-icon.in-progress {
		background: rgba(255, 200, 0, 0.1);
		color: var(--color-yellow);
	}

	.stat-icon.overdue {
		background: rgba(255, 100, 100, 0.1);
		color: var(--color-red);
	}

	.stat-icon.due-today {
		background: rgba(255, 165, 0, 0.1);
		color: var(--color-orange);
	}

	.stat-icon.completion-rate {
		background: rgba(100, 200, 255, 0.1);
		color: var(--color-cyan);
	}

	.stat-icon.avg-time {
		background: rgba(200, 150, 255, 0.1);
		color: var(--color-purple);
	}

	.stat-icon.streak {
		background: rgba(255, 100, 50, 0.1);
		color: var(--color-orange);
	}

	.stat-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-normal);
		line-height: 1;
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
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
		.period-button,
		.stat-card {
			border-width: 2px;
		}

		.stat-icon {
			border: 2px solid currentColor;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.period-button,
		.stat-card {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.task-analytics {
			padding: 1rem;
		}

		.analytics-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.period-buttons {
			width: 100%;
		}

		.period-button {
			flex: 1;
		}
	}
</style>
