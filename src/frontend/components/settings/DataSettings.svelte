<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '../Button.svelte';

	// Props
	export let className: string = '';

	const dispatch = createEventDispatcher<{  
		export: void;
		import: void;
		backup: void;
		restore: void;
		clear: void;
	}>();

	// Data settings
	let autoBackup: boolean = true;
	let backupFrequency: 'daily' | 'weekly' | 'monthly' = 'weekly';
	let cloudSync: boolean = false;
	let syncInterval: number = 30;

	// Screen reader announcement
	let announcement = '';
	function announce(message: string) {
		announcement = message;
		setTimeout(() => (announcement = ''), 100);
	}

	function handleExport() {
		dispatch('export');
		announce('Export started');
	}

	function handleImport() {
		dispatch('import');
		announce('Import dialog opened');
	}

	function handleBackup() {
		dispatch('backup');
		announce('Backup created');
	}

	function handleRestore() {
		if (confirm('Restore data from backup? This will overwrite current data.')) {
			dispatch('restore');
			announce('Data restored from backup');
		}
	}

	function handleClear() {
		if (confirm('Clear all data? This cannot be undone.')) {
			dispatch('clear');
			announce('All data cleared');
		}
	}

	const id = `data-settings-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="data-settings {className}">
	<fieldset class="data-settings__section">
		<legend class="data-settings__legend">Import & Export</legend>

		<div class="data-settings__buttons">
			<Button variant="secondary" on:click={handleExport}>Export Data</Button>
			<Button variant="secondary" on:click={handleImport}>Import Data</Button>
		</div>

		<p class="data-settings__description">
			Export your tasks to JSON format, or import tasks from a file.
		</p>
	</fieldset>

	<fieldset class="data-settings__section">
		<legend class="data-settings__legend">Backup & Restore</legend>

		<!-- Auto Backup -->
		<div class="data-settings__field">
			<label class="data-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={autoBackup}
					class="data-settings__checkbox"
				/>
				<span>Enable automatic backups</span>
			</label>
		</div>

		{#if autoBackup}
			<!-- Backup Frequency -->
			<div class="data-settings__field">
				<label for="{id}-frequency" class="data-settings__label">Backup frequency</label>
				<select
					id="{id}-frequency"
					class="data-settings__select"
					bind:value={backupFrequency}
				>
					<option value="daily">Daily</option>
					<option value="weekly">Weekly</option>
					<option value="monthly">Monthly</option>
				</select>
			</div>
		{/if}

		<div class="data-settings__buttons">
			<Button variant="secondary" on:click={handleBackup}>Create Backup</Button>
			<Button variant="secondary" on:click={handleRestore}>Restore Backup</Button>
		</div>
	</fieldset>

	<fieldset class="data-settings__section data-settings__section--danger">
		<legend class="data-settings__legend">Danger Zone</legend>

		<p class="data-settings__description">
			⚠️ Warning: These actions cannot be undone.
		</p>

		<Button variant="danger" on:click={handleClear}>Clear All Data</Button>
	</fieldset>

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.data-settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.data-settings__section {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 20px;
		margin: 0;
	}

	.data-settings__section--danger {
		border-color: var(--color-red);
		background: rgba(255, 0, 0, 0.05);
	}

	.data-settings__legend {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
		padding: 0 8px;
	}

	.data-settings__field {
		margin-top: 16px;
	}

	.data-settings__label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal);
		margin-bottom: 8px;
	}

	.data-settings__select {
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
	}

	.data-settings__select:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.data-settings__checkbox-label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-normal);
	}

	.data-settings__checkbox {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.data-settings__checkbox:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.data-settings__buttons {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: 16px;
	}

	.data-settings__description {
		margin-top: 12px;
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
		.data-settings__section,
		.data-settings__select {
			border-width: 2px;
		}
	}
</style>
