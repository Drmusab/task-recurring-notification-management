<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../Icon.svelte';

	// Priority levels
	type Priority = 'low' | 'medium' | 'high' | 'critical' | null;

	interface PriorityOption {
		value: Priority;
		label: string;
		icon: string;
		color: string;
		description: string;
	}

	const priorities: PriorityOption[] = [
		{
			value: null,
			label: 'None',
			icon: 'circle',
			color: 'var(--text-muted)',
			description: 'No priority set'
		},
		{
			value: 'low',
			label: 'Low',
			icon: 'arrow-down',
			color: 'var(--color-blue)',
			description: 'Low priority task'
		},
		{
			value: 'medium',
			label: 'Medium',
			icon: 'minus',
			color: 'var(--color-yellow)',
			description: 'Medium priority task'
		},
		{
			value: 'high',
			label: 'High',
			icon: 'arrow-up',
			color: 'var(--color-orange)',
			description: 'High priority task'
		},
		{
			value: 'critical',
			label: 'Critical',
			icon: 'alert-triangle',
			color: 'var(--color-red)',
			description: 'Critical priority task'
		}
	];

	// Props
	export let value: Priority = null;
	export let label: string = 'Priority';
	export let required: boolean = false;
	export let disabled: boolean = false;
	export let mode: 'dropdown' | 'radio' | 'buttons' = 'dropdown';
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: Priority }>();

	// Generate unique IDs
	const id = `priority-selector-${Math.random().toString(36).substr(2, 9)}`;
	const groupId = `${id}-group`;

	// Handle selection
	function handleSelect(priority: Priority) {
		if (!disabled) {
			value = priority;
			dispatch('change', priority);
			announceSelection(priority);
		}
	}

	function handleDropdownChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const selectedValue = select.value === '' ? null : (select.value as Priority);
		handleSelect(selectedValue);
	}

	// Screen reader announcements
	let announcement = '';

	function announceSelection(priority: Priority) {
		const option = priorities.find((p) => p.value === priority);
		if (option) {
			announcement = `Priority selected: ${option.label}. ${option.description}`;
		} else {
			announcement = 'Priority cleared';
		}
		setTimeout(() => (announcement = ''), 100);
	}

	// Get selected option
	$: selectedOption = priorities.find((p) => p.value === value) || priorities[0];

	// First radio button ref for focus management
	let firstRadioElement: HTMLInputElement | undefined;
</script>

<div class="priority-selector {className}">
	<div class="priority-selector__label-wrapper">
		<label for={mode === 'dropdown' ? id : undefined} class="priority-selector__label">
			{label}
			{#if required}
				<span class="priority-selector__required" aria-label="required">*</span>
			{/if}
		</label>
	</div>

	{#if mode === 'dropdown'}
		<!-- Dropdown Mode -->
		<select
			{id}
			class="priority-selector__dropdown"
			value={value ?? ''}
			on:change={handleDropdownChange}
			{disabled}
			aria-required={required}
		>
			{#each priorities as priority}
				<option value={priority.value ?? ''}>{priority.label}</option>
			{/each}
		</select>
	{:else if mode === 'radio'}
		<!-- Radio Button Mode -->
		<fieldset class="priority-selector__fieldset" {disabled}>
			<legend class="sr-only">{label}</legend>
			<div class="priority-selector__radio-group" role="radiogroup" aria-labelledby={groupId}>
				{#each priorities as priority, index}
					{#if index === 0}
						<label class="priority-selector__radio-option">
							<input
								type="radio"
								name={id}
								value={priority.value ?? ''}
								checked={value === priority.value}
								on:change={() => handleSelect(priority.value)}
								{disabled}
								class="priority-selector__radio-input"
								bind:this={firstRadioElement}
							/>
							<span class="priority-selector__radio-label">
								<Icon category="status" name={priority.icon} size={16} />
								<span class="priority-selector__radio-text">
									{priority.label}
								</span>
							</span>
							<span class="priority-selector__radio-description sr-only">
								{priority.description}
							</span>
						</label>
					{:else}
						<label class="priority-selector__radio-option">
							<input
								type="radio"
								name={id}
								value={priority.value ?? ''}
								checked={value === priority.value}
								on:change={() => handleSelect(priority.value)}
								{disabled}
								class="priority-selector__radio-input"
							/>
							<span class="priority-selector__radio-label">
								<Icon category="status" name={priority.icon} size={16} />
								<span class="priority-selector__radio-text">
									{priority.label}
								</span>
							</span>
							<span class="priority-selector__radio-description sr-only">
								{priority.description}
							</span>
						</label>
					{/if}
				{/each}
			</div>
		</fieldset>
	{:else}
		<!-- Button Mode -->
		<div class="priority-selector__buttons" role="group" aria-labelledby={groupId}>
			<span id={groupId} class="sr-only">{label}</span>
			{#each priorities as priority}
				<button
					type="button"
					class="priority-selector__button"
					class:priority-selector__button--active={value === priority.value}
					on:click={() => handleSelect(priority.value)}
					{disabled}
					aria-pressed={value === priority.value}
					aria-label="{priority.label} priority"
					title={priority.description}
					style="--priority-color: {priority.color}"
				>
					<Icon category="status" name={priority.icon} size={16} />
					<span class="priority-selector__button-text">{priority.label}</span>
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
	.priority-selector {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.priority-selector__label-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.priority-selector__label {
		font-weight: 500;
		font-size: 14px;
		color: var(--text-normal);
	}

	.priority-selector__required {
		color: var(--text-error);
		margin-left: 4px;
	}

	/* Dropdown Mode */
	.priority-selector__dropdown {
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

	.priority-selector__dropdown:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.priority-selector__dropdown:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Radio Mode */
	.priority-selector__fieldset {
		border: none;
		padding: 0;
		margin: 0;
	}

	.priority-selector__fieldset:disabled {
		opacity: 0.5;
	}

	.priority-selector__radio-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.priority-selector__radio-option {
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

	.priority-selector__radio-option:hover {
		background: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.priority-selector__radio-input {
		width: 20px;
		height: 20px;
		margin: 0;
		margin-right: 12px;
		cursor: pointer;
	}

	.priority-selector__radio-input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.priority-selector__radio-label {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}

	.priority-selector__radio-text {
		font-size: 14px;
		color: var(--text-normal);
	}

	/* Button Mode */
	.priority-selector__buttons {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.priority-selector__button {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 80px;
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

	.priority-selector__button:hover:not(:disabled) {
		background: var(--background-modifier-hover);
		border-color: var(--priority-color);
	}

	.priority-selector__button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.priority-selector__button--active {
		background: var(--priority-color);
		border-color: var(--priority-color);
		color: var(--text-on-accent);
	}

	.priority-selector__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.priority-selector__button-text {
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
		.priority-selector__dropdown,
		.priority-selector__radio-option,
		.priority-selector__button {
			border-width: 2px;
		}

		.priority-selector__button--active {
			border-width: 3px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.priority-selector__radio-option,
		.priority-selector__button {
			transition: none;
		}
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.priority-selector__buttons {
			flex-direction: column;
		}

		.priority-selector__button {
			width: 100%;
		}
	}
</style>
