<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../Icon.svelte';

	// Status types
	type TaskStatus = 'todo' | 'in-progress' | 'waiting' | 'done' | 'cancelled' | null;

	interface StatusOption {
		value: TaskStatus;
		label: string;
		icon: string;
		color: string;
		description: string;
	}

	const statuses: StatusOption[] = [
		{
			value: null,
			label: 'None',
			icon: 'circle',
			color: 'var(--text-muted)',
			description: 'No status set'
		},
		{
			value: 'todo',
			label: 'To Do',
			icon: 'circle',
			color: 'var(--color-blue)',
			description: 'Task not started'
		},
		{
			value: 'in-progress',
			label: 'In Progress',
			icon: 'loader',
			color: 'var(--color-yellow)',
			description: 'Task in progress'
		},
		{
			value: 'waiting',
			label: 'Waiting',
			icon: 'clock',
			color: 'var(--color-purple)',
			description: 'Waiting on dependencies'
		},
		{
			value: 'done',
			label: 'Done',
			icon: 'check-circle',
			color: 'var(--color-green)',
			description: 'Task completed'
		},
		{
			value: 'cancelled',
			label: 'Cancelled',
			icon: 'x-circle',
			color: 'var(--color-red)',
			description: 'Task cancelled'
		}
	];

	// Props
	export let value: TaskStatus = null;
	export let label: string = 'Status';
	export let required: boolean = false;
	export let disabled: boolean = false;
	export let mode: 'dropdown' | 'radio' | 'buttons' = 'dropdown';
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: TaskStatus }>();

	// Generate unique IDs
	const id = `status-selector-${Math.random().toString(36).substr(2, 9)}`;
	const groupId = `${id}-group`;

	// Handle selection
	function handleSelect(status: TaskStatus) {
		if (!disabled) {
			value = status;
			dispatch('change', status);
			announceSelection(status);
		}
	}

	function handleDropdownChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const selectedValue = select.value === '' ? null : (select.value as TaskStatus);
		handleSelect(selectedValue);
	}

	// Screen reader announcements
	let announcement = '';

	function announceSelection(status: TaskStatus) {
		const option = statuses.find((s) => s.value === status);
		if (option) {
			announcement = `Status selected: ${option.label}. ${option.description}`;
		} else {
			announcement = 'Status cleared';
		}
		setTimeout(() => (announcement = ''), 100);
	}

	// Get selected option
	$: selectedOption = statuses.find((s) => s.value === value) || statuses[0];

	// First radio button ref for focus management
	let firstRadioElement: HTMLInputElement | undefined;
</script>

<div class="status-selector {className}">
	<div class="status-selector__label-wrapper">
		<label for={mode === 'dropdown' ? id : undefined} class="status-selector__label">
			{label}
			{#if required}
				<span class="status-selector__required" aria-label="required">*</span>
			{/if}
		</label>
	</div>

	{#if mode === 'dropdown'}
		<!-- Dropdown Mode -->
		<select
			{id}
			class="status-selector__dropdown"
			value={value ?? ''}
			on:change={handleDropdownChange}
			{disabled}
			aria-required={required}
		>
			{#each statuses as status}
				<option value={status.value ?? ''}>{status.label}</option>
			{/each}
		</select>
	{:else if mode === 'radio'}
		<!-- Radio Button Mode -->
		<fieldset class="status-selector__fieldset" {disabled}>
			<legend class="sr-only">{label}</legend>
			<div class="status-selector__radio-group" role="radiogroup" aria-labelledby={groupId}>
				{#each statuses as status, index}
					{#if index === 0}
						<label class="status-selector__radio-option">
							<input
								type="radio"
								name={id}
								value={status.value ?? ''}
								checked={value === status.value}
								on:change={() => handleSelect(status.value)}
								{disabled}
								class="status-selector__radio-input"
								bind:this={firstRadioElement}
							/>
							<span class="status-selector__radio-label">
								<Icon category="status" name={status.icon} size={16} />
								<span class="status-selector__radio-text">
									{status.label}
								</span>
							</span>
							<span class="status-selector__radio-description sr-only">
								{status.description}
							</span>
						</label>
					{:else}
						<label class="status-selector__radio-option">
							<input
								type="radio"
								name={id}
								value={status.value ?? ''}
								checked={value === status.value}
								on:change={() => handleSelect(status.value)}
								{disabled}
								class="status-selector__radio-input"
							/>
							<span class="status-selector__radio-label">
								<Icon category="status" name={status.icon} size={16} />
								<span class="status-selector__radio-text">
									{status.label}
								</span>
							</span>
							<span class="status-selector__radio-description sr-only">
								{status.description}
							</span>
						</label>
					{/if}
				{/each}
			</div>
		</fieldset>
	{:else}
		<!-- Button Mode -->
		<div class="status-selector__buttons" role="group" aria-labelledby={groupId}>
			<span id={groupId} class="sr-only">{label}</span>
			{#each statuses as status}
				<button
					type="button"
					class="status-selector__button"
					class:status-selector__button--active={value === status.value}
					on:click={() => handleSelect(status.value)}
					{disabled}
					aria-pressed={value === status.value}
					aria-label="{status.label} status"
					title={status.description}
					style="--status-color: {status.color}"
				>
					<Icon category="status" name={status.icon} size={16} />
					<span class="status-selector__button-text">{status.label}</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.status-selector {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.status-selector__label-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-selector__label {
		font-weight: 500;
		font-size: 14px;
		color: var(--text-normal);
	}

	.status-selector__required {
		color: var(--text-error);
		margin-left: 4px;
	}

	/* Dropdown Mode */
	.status-selector__dropdown {
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		cursor: pointer;
	}

	.status-selector__dropdown:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.status-selector__dropdown:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Radio Mode */
	.status-selector__fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}

	.status-selector__fieldset:disabled {
		opacity: 0.5;
	}

	.status-selector__radio-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.status-selector__radio-option {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.status-selector__radio-option:hover {
		background: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.status-selector__radio-input {
		width: 20px;
		height: 20px;
		margin: 0;
		margin-right: 12px;
		cursor: pointer;
	}

	.status-selector__radio-input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.status-selector__radio-label {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}

	.status-selector__radio-text {
		font-size: 14px;
		color: var(--text-normal);
	}

	/* Button Mode */
	.status-selector__buttons {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.status-selector__button {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 100px;
		min-height: 44px;
		padding: 10px 16px;
		border: 2px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.status-selector__button:hover:not(:disabled) {
		background: var(--background-modifier-hover);
		border-color: var(--status-color);
	}

	.status-selector__button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.status-selector__button--active {
		background: var(--status-color);
		border-color: var(--status-color);
		color: var(--text-on-accent);
	}

	.status-selector__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.status-selector__button-text {
		white-space: nowrap;
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
		.status-selector__dropdown,
		.status-selector__radio-option,
		.status-selector__button {
			border-width: 2px;
		}

		.status-selector__button--active {
			border-width: 3px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.status-selector__radio-option,
		.status-selector__button {
			transition: none;
		}
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.status-selector__buttons {
			flex-direction: column;
		}

		.status-selector__button {
			width: 100%;
		}
	}
</style>
