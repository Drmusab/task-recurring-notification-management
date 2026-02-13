<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

	// Advanced settings
	let enableDebugMode: boolean = false;
	let enableBetaFeatures: boolean = false;
	let maxTasksPerPage: number = 50;
	let cacheSize: number = 100;
	let enablePerformanceMonitoring: boolean = false;
	let logLevel: 'error' | 'warn' | 'info' | 'debug' = 'error';

	function handleChange() {
		dispatch('change', {
			enableDebugMode,
			enableBetaFeatures,
			maxTasksPerPage,
			cacheSize,
			enablePerformanceMonitoring,
			logLevel
		});
	}

	// Screen reader announcement
	let announcement = '';
	function announce(message: string) {
		announcement = message;
		setTimeout(() => (announcement = ''), 100);
	}

	const id = `advanced-settings-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="advanced-settings {className}">
	<fieldset class="advanced-settings__section">
		<legend class="advanced-settings__legend">Developer Options</legend>

		<!-- Debug Mode -->
		<div class="advanced-settings__field">
			<label class="advanced-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={enableDebugMode}
					on:change={() => {
						handleChange();
						announce(enableDebugMode ? 'Debug mode enabled' : 'Debug mode disabled');
					}}
					class="advanced-settings__checkbox"
				/>
				<span>Enable debug mode</span>
			</label>
		</div>

		<!-- Log Level -->
		{#if enableDebugMode}
			<div class="advanced-settings__field">
				<label for="{id}-log-level" class="advanced-settings__label">Log level</label>
				<select
					id="{id}-log-level"
					class="advanced-settings__select"
					bind:value={logLevel}
					on:change={handleChange}
				>
					<option value="error">Error only</option>
					<option value="warn">Warnings</option>
					<option value="info">Info</option>
					<option value="debug">Debug (verbose)</option>
				</select>
			</div>
		{/if}

		<!-- Beta Features -->
		<div class="advanced-settings__field">
			<label class="advanced-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={enableBetaFeatures}
					on:change={() => {
						handleChange();
						announce(enableBetaFeatures ? 'Beta features enabled' : 'Beta features disabled');
					}}
					class="advanced-settings__checkbox"
				/>
				<span>Enable beta features</span>
			</label>
		</div>
	</fieldset>

	<fieldset class="advanced-settings__section">
		<legend class="advanced-settings__legend">Performance</legend>

		<!-- Max Tasks Per Page -->
		<div class="advanced-settings__field">
			<label for="{id}-max-tasks" class="advanced-settings__label">
				Maximum tasks per page
			</label>
			<input
				type="number"
				id="{id}-max-tasks"
				class="advanced-settings__input"
				min="10"
				max="500"
				bind:value={maxTasksPerPage}
				on:change={handleChange}
			/>
		</div>

		<!-- Cache Size -->
		<div class="advanced-settings__field">
			<label for="{id}-cache-size" class="advanced-settings__label">
				Cache size (MB)
			</label>
			<input
				type="number"
				id="{id}-cache-size"
				class="advanced-settings__input"
				min="10"
				max="1000"
				bind:value={cacheSize}
				on:change={handleChange}
			/>
		</div>

		<!-- Performance Monitoring -->
		<div class="advanced-settings__field">
			<label class="advanced-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={enablePerformanceMonitoring}
					on:change={handleChange}
					class="advanced-settings__checkbox"
				/>
				<span>Enable performance monitoring</span>
			</label>
		</div>
	</fieldset>

	<div class="advanced-settings__warning" role="note">
		⚠️ <strong>Warning:</strong> These settings are for advanced users only. Incorrect configuration may impact plugin performance or stability.
	</div>

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.advanced-settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.advanced-settings__section {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 20px;
		margin: 0;
	}

	.advanced-settings__legend {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
		padding: 0 8px;
	}

	.advanced-settings__field {
		margin-top: 16px;
	}

	.advanced-settings__label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal);
		margin-bottom: 8px;
	}

	.advanced-settings__select,
	.advanced-settings__input {
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
	}

	.advanced-settings__select:focus,
	.advanced-settings__input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.advanced-settings__checkbox-label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-normal);
	}

	.advanced-settings__checkbox {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.advanced-settings__checkbox:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.advanced-settings__warning {
		padding: 16px;
		background: rgba(255, 165, 0, 0.1);
		border: 1px solid var(--color-orange);
		border-radius: 4px;
		font-size: 13px;
		color: var(--text-muted);
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
		.advanced-settings__section,
		.advanced-settings__select,
		.advanced-settings__input {
			border-width: 2px;
		}
	}
</style>
