<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

	// Display settings
	let theme: 'auto' | 'light' | 'dark' = 'auto';
	let fontSize: number = 14;
	let compactMode: boolean = false;
	let showTaskCount: boolean = true;
	let showCompletionPercentage: boolean = true;
	let highlightOverdue: boolean = true;
	let highlightToday: boolean = true;

	function handleChange() {
		dispatch('change', {
			theme,
			fontSize,
			compactMode,
			showTaskCount,
			showCompletionPercentage,
			highlightOverdue,
			highlightToday
		});
	}

	// Screen reader announcement
	let announcement = '';
	function announce(message: string) {
		announcement = message;
		setTimeout(() => (announcement = ''), 100);
	}

	const id = `display-settings-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="display-settings {className}">
	<fieldset class="display-settings__section">
		<legend class="display-settings__legend">Appearance</legend>

		<!-- Theme -->
		<div class="display-settings__field">
			<label for="{id}-theme" class="display-settings__label">Theme</label>
			<select
				id="{id}-theme"
				class="display-settings__select"
				bind:value={theme}
				on:change={() => {
					handleChange();
					announce(`Theme set to ${theme}`);
				}}
			>
				<option value="auto">Auto (match system)</option>
				<option value="light">Light</option>
				<option value="dark">Dark</option>
			</select>
		</div>

		<!-- Font Size -->
		<div class="display-settings__field">
			<label for="{id}-font" class="display-settings__label">
				Font size: {fontSize}px
			</label>
			<input
				type="range"
				id="{id}-font"
				class="display-settings__slider"
				min="12"
				max="20"
				bind:value={fontSize}
				on:change={handleChange}
				aria-valuemin="12"
				aria-valuemax="20"
				aria-valuenow={fontSize}
			/>
		</div>

		<!-- Compact Mode -->
		<div class="display-settings__field">
			<label class="display-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={compactMode}
					on:change={() => {
						handleChange();
						announce(compactMode ? 'Compact mode enabled' : 'Compact mode disabled');
					}}
					class="display-settings__checkbox"
				/>
				<span>Compact mode (reduced spacing)</span>
			</label>
		</div>
	</fieldset>

	<fieldset class="display-settings__section">
		<legend class="display-settings__legend">Task Display Options</legend>

		<!-- Show Task Count -->
		<div class="display-settings__field">
			<label class="display-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={showTaskCount}
					on:change={handleChange}
					class="display-settings__checkbox"
				/>
				<span>Show task count</span>
			</label>
		</div>

		<!-- Show Completion Percentage -->
		<div class="display-settings__field">
			<label class="display-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={showCompletionPercentage}
					on:change={handleChange}
					class="display-settings__checkbox"
				/>
				<span>Show completion percentage</span>
			</label>
		</div>

		<!-- Highlight Overdue -->
		<div class="display-settings__field">
			<label class="display-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={highlightOverdue}
					on:change={handleChange}
					class="display-settings__checkbox"
				/>
				<span>Highlight overdue tasks</span>
			</label>
		</div>

		<!-- Highlight Today -->
		<div class="display-settings__field">
			<label class="display-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={highlightToday}
					on:change={handleChange}
					class="display-settings__checkbox"
				/>
				<span>Highlight tasks due today</span>
			</label>
		</div>
	</fieldset>

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.display-settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.display-settings__section {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 20px;
		margin: 0;
	}

	.display-settings__legend {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
		padding: 0 8px;
	}

	.display-settings__field {
		margin-top: 16px;
	}

	.display-settings__label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal);
		margin-bottom: 8px;
	}

	.display-settings__select {
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
	}

	.display-settings__select:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.display-settings__checkbox-label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-normal);
	}

	.display-settings__checkbox {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.display-settings__checkbox:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.display-settings__slider {
		width: 100%;
		min-height: 44px;
		cursor: pointer;
	}

	.display-settings__slider:focus {
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
		.display-settings__section,
		.display-settings__select {
			border-width: 2px;
		}
	}
</style>
