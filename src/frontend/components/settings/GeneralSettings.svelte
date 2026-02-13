<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

	// General settings
	let defaultView: 'list' | 'calendar' | 'dashboard' = 'list';
	let showWelcomeScreen: boolean = true;
	let enableAutoSave: boolean = true;
	let autoSaveInterval: number = 30;
	let dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' = 'YYYY-MM-DD';
	let timeFormat: '12h' | '24h' = '24h';
	let firstDayOfWeek: number = 0; // 0 = Sunday

	function handleChange() {
		dispatch('change', {
			defaultView,
			showWelcomeScreen,
			enableAutoSave,
			autoSaveInterval,
			dateFormat,
			timeFormat,
			firstDayOfWeek
		});
	}

	// Screen reader announcement
	let announcement = '';
	function announce(message: string) {
		announcement = message;
		setTimeout(() => (announcement = ''), 100);
	}

	// Generate unique IDs
	const id = `general-settings-${Math.random().toString(36).substr(2, 9)}`;

	const weekdayOptions = [
		{ value: 0, label: 'Sunday' },
		{ value: 1, label: 'Monday' },
		{ value: 6, label: 'Saturday' }
	];
</script>

<div class="general-settings {className}">
	<fieldset class="general-settings__section">
		<legend class="general-settings__legend">View & Interface</legend>

		<!-- Default View -->
		<div class="general-settings__field">
			<label for="{id}-default-view" class="general-settings__label">Default view</label>
			<select
				id="{id}-default-view"
				class="general-settings__select"
				bind:value={defaultView}
				on:change={() => {
					handleChange();
					announce(`Default view set to ${defaultView}`);
				}}
			>
				<option value="list">List View</option>
				<option value="calendar">Calendar View</option>
				<option value="dashboard">Dashboard</option>
			</select>
		</div>

		<!-- Show Welcome Screen -->
		<div class="general-settings__field">
			<label class="general-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={showWelcomeScreen}
					on:change={() => {
						handleChange();
						announce(showWelcomeScreen ? 'Welcome screen enabled' : 'Welcome screen disabled');
					}}
					class="general-settings__checkbox"
				/>
				<span>Show welcome screen on startup</span>
			</label>
		</div>
	</fieldset>

	<fieldset class="general-settings__section">
		<legend class="general-settings__legend">Auto-save</legend>

		<!-- Enable Auto-save -->
		<div class="general-settings__field">
			<label class="general-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={enableAutoSave}
					on:change={() => {
						handleChange();
						announce(enableAutoSave ? 'Auto-save enabled' : 'Auto-save disabled');
					}}
					class="general-settings__checkbox"
				/>
				<span>Enable auto-save</span>
			</label>
		</div>

		<!-- Auto-save Interval -->
		{#if enableAutoSave}
			<div class="general-settings__field">
				<label for="{id}-autosave" class="general-settings__label">
					Auto-save interval (seconds)
				</label>
				<input
					type="number"
					id="{id}-autosave"
					class="general-settings__input"
					min="10"
					max="300"
					bind:value={autoSaveInterval}
					on:change={handleChange}
				/>
			</div>
		{/if}
	</fieldset>

	<fieldset class="general-settings__section">
		<legend class="general-settings__legend">Date & Time</legend>

		<!-- Date Format -->
		<div class="general-settings__field">
			<label for="{id}-date-format" class="general-settings__label">Date format</label>
			<select
				id="{id}-date-format"
				class="general-settings__select"
				bind:value={dateFormat}
				on:change={() => {
					handleChange();
					announce(`Date format set to ${dateFormat}`);
				}}
			>
				<option value="YYYY-MM-DD">YYYY-MM-DD</option>
				<option value="MM/DD/YYYY">MM/DD/YYYY</option>
				<option value="DD/MM/YYYY">DD/MM/YYYY</option>
			</select>
		</div>

		<!-- Time Format -->
		<div class="general-settings__field">
			<label for="{id}-time-format" class="general-settings__label">Time format</label>
			<select
				id="{id}-time-format"
				class="general-settings__select"
				bind:value={timeFormat}
				on:change={() => {
					handleChange();
					announce(`Time format set to ${timeFormat === '12h' ? '12-hour' : '24-hour'}`);
				}}
			>
				<option value="12h">12-hour (AM/PM)</option>
				<option value="24h">24-hour</option>
			</select>
		</div>

		<!-- First Day of Week -->
		<div class="general-settings__field">
			<label for="{id}-first-day" class="general-settings__label">First day of week</label>
			<select
				id="{id}-first-day"
				class="general-settings__select"
				bind:value={firstDayOfWeek}
				on:change={() => {
					handleChange();
					const day = weekdayOptions.find((d) => d.value === firstDayOfWeek);
					announce(`First day of week set to ${day?.label}`);
				}}
			>
				{#each weekdayOptions as day}
					<option value={day.value}>{day.label}</option>
				{/each}
			</select>
		</div>
	</fieldset>

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.general-settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.general-settings__section {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 20px;
		margin: 0;
	}

	.general-settings__legend {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
		padding: 0 8px;
	}

	.general-settings__field {
		margin-top: 16px;
	}

	.general-settings__label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal);
		margin-bottom: 8px;
	}

	.general-settings__select,
	.general-settings__input {
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
	}

	.general-settings__select:focus,
	.general-settings__input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.general-settings__checkbox-label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-normal);
	}

	.general-settings__checkbox {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.general-settings__checkbox:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	/* Screen reader only */
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

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.general-settings__section,
		.general-settings__select,
		.general-settings__input {
			border-width: 2px;
		}
	}
</style>
