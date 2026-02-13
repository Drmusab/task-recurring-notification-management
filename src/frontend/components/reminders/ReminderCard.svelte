<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '../shared/Button.svelte';

	interface Reminder {
		id: string;
		taskId: string;
		taskTitle: string;
		dueDate: Date;
		reminderTime: Date;
		isActive: boolean;
		isSnoozed: boolean;
		snoozeUntil?: Date;
	}

	interface Props {
		reminder: Reminder;
		className?: string;
	}

	const { reminder, className = '' }: Props = $props();

	const dispatch = createEventDispatcher();

	let showSnoozeOptions = $state(false);

	const snoozeDurations = [
		{ label: '5 minutes', value: 5 },
		{ label: '15 minutes', value: 15 },
		{ label: '30 minutes', value: 30 },
		{ label: '1 hour', value: 60 },
		{ label: '2 hours', value: 120 },
		{ label: '1 day', value: 1440 }
	];

	function formatTime(date: Date): string {
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getTimeUntil(date: Date): string {
		const now = new Date();
		const diff = date.getTime() - now.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (diff < 0) return 'Overdue';
		if (minutes < 1) return 'Now';
		if (minutes < 60) return `${minutes}m`;
		if (hours < 24) return `${hours}h`;
		return `${days}d`;
	}

	function handleDismiss() {
		dispatch('dismiss', reminder);
	}

	function handleSnooze(duration: number) {
		dispatch('snooze', { reminder, duration });
		showSnoozeOptions = false;
	}

	function handleViewTask() {
		dispatch('viewTask', reminder);
	}

	function toggleSnoozeOptions() {
		showSnoozeOptions = !showSnoozeOptions;
	}
</script>

<div
	class="reminder-card {className}"
	class:snoozed={reminder.isSnoozed}
	class:inactive={!reminder.isActive}
	role="listitem"
>
	<div class="card-header">
		<div class="task-info">
			<button class="task-title-button" on:click={handleViewTask}>
				{reminder.taskTitle}
			</button>
			<div class="task-meta">
				<span class="reminder-time" aria-label="Reminder time">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
						<path d="M7 4v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					{formatTime(reminder.reminderTime)}
				</span>
				<span class="due-date" aria-label="Due date">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<rect x="2" y="3" width="10" height="9" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/>
						<line x1="2" y1="6" x2="12" y2="6" stroke="currentColor" stroke-width="1.5"/>
						<line x1="4" y1="1" x2="4" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						<line x1="10" y1="1" x2="10" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					{formatDate(reminder.dueDate)}
				</span>
				{#if reminder.isSnoozed && reminder.snoozeUntil}
					<span class="snoozed-until" aria-label="Snoozed until">
						Snoozed until {formatTime(reminder.snoozeUntil)}
					</span>
				{/if}
			</div>
		</div>

		<div class="time-badge" aria-label="Time until due">
			{getTimeUntil(reminder.reminderTime)}
		</div>
	</div>

	{#if reminder.isActive}
		<div class="card-actions">
			<Button variant="secondary" size="small" on:click={handleDismiss}>
				Dismiss
			</Button>

			<div class="snooze-container">
				<button
					class="snooze-button"
					on:click={toggleSnoozeOptions}
					aria-label="Snooze options"
					aria-expanded={showSnoozeOptions}
				>
					Snooze
				</button>

				{#if showSnoozeOptions}
					<div class="snooze-menu" role="menu" aria-label="Snooze duration options">
						{#each snoozeDurations as duration}
							<button
								class="snooze-option"
								role="menuitem"
								on:click={() => handleSnooze(duration.value)}
							>
								{duration.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<Button variant="primary" size="small" on:click={handleViewTask}>
				View Task
			</Button>
		</div>
	{:else}
		<div class="card-actions">
			<Button variant="ghost" size="small" on:click={handleViewTask}>
				View Task
			</Button>
		</div>
	{/if}
</div>

<style>
	.reminder-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: var(--background-secondary);
		border: 2px solid var(--interactive-accent);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.reminder-card.snoozed {
		opacity: 0.7;
		border-color: var(--text-muted);
	}

	.reminder-card.inactive {
		opacity: 0.5;
		border-color: var(--border-color);
	}

	.reminder-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.task-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	.task-title-button {
		background: transparent;
		border: none;
		padding: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-normal);
		text-align: left;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	.task-title-button:hover {
		color: var(--interactive-accent);
	}

	.task-title-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.task-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.reminder-time,
	.due-date,
	.snoozed-until {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.snoozed-until {
		color: var(--color-orange);
		font-weight: 500;
	}

	.time-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 700;
		flex-shrink: 0;
	}

	.card-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.snooze-container {
		position: relative;
	}

	.snooze-button {
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem 1rem;
		background: var(--background-modifier-hover);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-normal);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.snooze-button:hover {
		background: var(--background-secondary);
		border-color: var(--interactive-accent);
	}

	.snooze-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.snooze-menu {
		position: absolute;
		bottom: 100%;
		left: 0;
		margin-bottom: 0.5rem;
		background: var(--background);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 100;
		min-width: 150px;
		overflow: hidden;
	}

	.snooze-option {
		width: 100%;
		min-height: 44px;
		padding: 0.75rem 1rem;
		background: transparent;
		border: none;
		text-align: left;
		font-size: 0.875rem;
		color: var(--text-normal);
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.snooze-option:hover {
		background: var(--background-modifier-hover);
	}

	.snooze-option:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: -2px;
		background: var(--background-modifier-hover);
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.reminder-card {
			border-width: 3px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.reminder-card,
		.task-title-button,
		.snooze-option {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.card-header {
			flex-direction: column;
		}

		.time-badge {
			align-self: flex-start;
		}

		.card-actions {
			flex-direction: column;
		}
	}
</style>
