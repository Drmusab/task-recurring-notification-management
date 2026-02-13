<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import ReminderCard from './ReminderCard.svelte';

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
		reminders?: Reminder[];
		title?: string;
		emptyMessage?: string;
		className?: string;
	}

	const {
		reminders = [],
		title = 'Reminders',
		emptyMessage = 'No active reminders',
		className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let announcement = $state('');

	// Separate reminders into categories
	const activeReminders = $derived(
		reminders.filter(r => r.isActive && !r.isSnoozed)
	);

	const snoozedReminders = $derived(
		reminders.filter(r => r.isActive && r.isSnoozed)
	);

	const pastReminders = $derived(
		reminders.filter(r => !r.isActive)
	);

	function handleDismiss(reminder: Reminder) {
		announcement = `Reminder for ${reminder.taskTitle} dismissed`;
		dispatch('dismiss', reminder);
	}

	function handleSnooze(event: CustomEvent<{ reminder: Reminder; duration: number }>) {
		const { reminder, duration } = event.detail;
		announcement = `Reminder for ${reminder.taskTitle} snoozed for ${duration} minutes`;
		dispatch('snooze', event.detail);
	}

	function handleViewTask(reminder: Reminder) {
		announcement = `Opening task: ${reminder.taskTitle}`;
		dispatch('viewTask', reminder);
	}

	function handleClearAll() {
		announcement = `Cleared ${pastReminders.length} past reminders`;
		dispatch('clearAll');
	}
</script>

<div class="reminder-list {className}" role="region" aria-labelledby="reminder-list-title">
	<div class="list-header">
		<h3 id="reminder-list-title">{title}</h3>
		{#if pastReminders.length > 0}
			<button
				class="clear-all-button"
				on:click={handleClearAll}
				aria-label="Clear all past reminders"
			>
				Clear All
			</button>
		{/if}
	</div>

	{#if activeReminders.length === 0 && snoozedReminders.length === 0 && pastReminders.length === 0}
		<div class="empty-state" role="status">
			<div class="empty-icon" aria-hidden="true">
				<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" fill="none"/>
					<path d="M24 16v8l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				</svg>
			</div>
			<p class="empty-message">{emptyMessage}</p>
		</div>
	{:else}
		<!-- Active Reminders -->
		{#if activeReminders.length > 0}
			<section class="reminder-section" aria-labelledby="active-reminders-heading">
				<h4 id="active-reminders-heading" class="section-heading">
					Active ({activeReminders.length})
				</h4>
				<div class="reminder-cards" role="list">
					{#each activeReminders as reminder (reminder.id)}
						<ReminderCard
							{reminder}
							on:dismiss={() => handleDismiss(reminder)}
							on:snooze={handleSnooze}
							on:viewTask={() => handleViewTask(reminder)}
						/>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Snoozed Reminders -->
		{#if snoozedReminders.length > 0}
			<section class="reminder-section" aria-labelledby="snoozed-reminders-heading">
				<h4 id="snoozed-reminders-heading" class="section-heading">
					Snoozed ({snoozedReminders.length})
				</h4>
				<div class="reminder-cards" role="list">
					{#each snoozedReminders as reminder (reminder.id)}
						<ReminderCard
							{reminder}
							on:dismiss={() => handleDismiss(reminder)}
							on:snooze={handleSnooze}
							on:viewTask={() => handleViewTask(reminder)}
						/>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Past Reminders -->
		{#if pastReminders.length > 0}
			<section class="reminder-section" aria-labelledby="past-reminders-heading">
				<h4 id="past-reminders-heading" class="section-heading">
					Past ({pastReminders.length})
				</h4>
				<div class="reminder-cards" role="list">
					{#each pastReminders as reminder (reminder.id)}
						<ReminderCard
							{reminder}
							on:dismiss={() => handleDismiss(reminder)}
							on:viewTask={() => handleViewTask(reminder)}
						/>
					{/each}
				</div>
			</section>
		{/if}
	{/if}

	<!-- Screen Reader Announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announcement}
	</div>
</div>

<style>
	.reminder-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		background: var(--background);
		border-radius: 8px;
	}

	.list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.list-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-normal);
	}

	.clear-all-button {
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

	.clear-all-button:hover {
		background: var(--background-secondary);
		border-color: var(--interactive-accent);
	}

	.clear-all-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		text-align: center;
	}

	.empty-icon {
		color: var(--text-muted);
		opacity: 0.5;
		margin-bottom: 1rem;
	}

	.empty-message {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.reminder-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-heading {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.reminder-cards {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
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
		.clear-all-button {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.clear-all-button {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.reminder-list {
			padding: 1rem;
		}

		.list-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}
	}
</style>
