<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

	// Keyboard shortcut settings
	let shortcuts: Record<string, string> = {
		'create-task': 'Ctrl+N',
		'search': 'Ctrl+F',
		'toggle-complete': 'Ctrl+Enter',
		'edit-task': 'Enter',
		'delete-task': 'Delete',
		'filter':  'Ctrl+/',
		'calendar': 'Ctrl+K',
		'today': 'Ctrl+T'
	};

	function handleChange() {
		dispatch('change', { shortcuts });
	}

	// Screen reader announcement
	let announcement = '';
	function announce(message: string) {
		announcement = message;
		setTimeout(() => (announcement = ''), 100);
	}

	const id = `keyboard-settings-${Math.random().toString(36).substr(2, 9)}`;

	const shortcutLabels: Record<string, string> = {
		'create-task': 'Create new task',
		'search': 'Search tasks',
		'toggle-complete': 'Toggle task complete',
		'edit-task': 'Edit task',
		'delete-task': 'Delete task',
		'filter': 'Open filter menu',
		'calendar': 'Open calendar view',
		'today': 'Jump to today'
	};
</script>

<div class="keyboard-settings {className}">
	<fieldset class="keyboard-settings__section">
		<legend class="keyboard-settings__legend">Keyboard Shortcuts</legend>

		<div class="keyboard-settings__list">
			{#each Object.entries(shortcuts) as [key, value], index}
				<div class="keyboard-settings__item">
					<label for="{id}-{key}" class="keyboard-settings__label">
						{shortcutLabels[key] || key}
					</label>
					<input
						type="text"
						id="{id}-{key}"
						class="keyboard-settings__input"
						bind:value={shortcuts[key]}
						on:change={() => {
							handleChange();
							announce(`Shortcut for ${shortcutLabels[key]} set to ${shortcuts[key]}`);
						}}
						readonly
						placeholder="Click to record"
					/>
				</div>
			{/each}
		</div>

		<div class="keyboard-settings__help" role="note">
			<p><strong>Note:</strong> Click on an input field and press the desired key combination.</p>
			<p>Supported modifiers: Ctrl, Alt, Shift, Meta (Cmd on Mac)</p>
		</div>
	</fieldset>

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.keyboard-settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.keyboard-settings__section {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 20px;
		margin: 0;
	}

	.keyboard-settings__legend {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
		padding: 0 8px;
	}

	.keyboard-settings__list {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: 16px;
	}

	.keyboard-settings__item {
		display: flex;
		align-items: center;
		gap: 16px;
		justify-content: space-between;
	}

	.keyboard-settings__label {
		flex: 1;
		font-size: 14px;
		color: var(--text-normal);
	}

	.keyboard-settings__input {
		width: 180px;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		font-family: var(--font-monospace);
		text-align: center;
	}

	.keyboard-settings__input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.keyboard-settings__help {
		margin-top: 24px;
		padding: 16px;
		background: var(--background-secondary);
		border-radius: 4px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.keyboard-settings__help p {
		margin: 8px 0;
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
		.keyboard-settings__section,
		.keyboard-settings__input {
			border-width: 2px;
		}
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.keyboard-settings__item {
			flex-direction: column;
			align-items: flex-start;
		}

		.keyboard-settings__input {
			width: 100%;
		}
	}
</style>
