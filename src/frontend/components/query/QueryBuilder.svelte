<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type FilterOperator = 'equals' | 'not-equals' | 'contains' | 'not-contains' | 'greater-than' | 'less-than' | 'is-empty' | 'is-not-empty';
	type FilterField = 'title' | 'status' | 'priority' | 'tags' | 'due-date' | 'created-date' | 'completed-date';

	interface FilterRule {
		id: string;
		field: FilterField;
		operator: FilterOperator;
		value: string;
	}

	interface Query {
		rules: FilterRule[];
		matchType: 'all' | 'any';
	}

	interface Props {
		initialQuery?: Query;
		className?: string;
	}

	const {
		initialQuery = { rules: [], matchType: 'all' },
		className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let query = $state<Query>(initialQuery);
	let announcement = $state('');

	const fieldOptions: Array<{ value: FilterField; label: string }> = [
		{ value: 'title', label: 'Title' },
		{ value: 'status', label: 'Status' },
		{ value: 'priority', label: 'Priority' },
		{ value: 'tags', label: 'Tags' },
		{ value: 'due-date', label: 'Due Date' },
		{ value: 'created-date', label: 'Created Date' },
		{ value: 'completed-date', label: 'Completed Date' }
	];

	const operatorOptions: Array<{ value: FilterOperator; label: string }> = [
		{ value: 'equals', label: 'Equals' },
		{ value: 'not-equals', label: 'Not Equals' },
		{ value: 'contains', label: 'Contains' },
		{ value: 'not-contains', label: 'Not Contains' },
		{ value: 'greater-than', label: 'Greater Than' },
		{ value: 'less-than', label: 'Less Than' },
		{ value: 'is-empty', label: 'Is Empty' },
		{ value: 'is-not-empty', label: 'Is Not Empty' }
	];

	function addRule() {
		const newRule: FilterRule = {
			id: `rule-${Date.now()}`,
			field: 'title',
			operator: 'contains',
			value: ''
		};
		query.rules.push(newRule);
		announcement = `Filter rule added. ${query.rules.length} rules total.`;
		handleQueryChange();
	}

	function removeRule(ruleId: string) {
		query.rules = query.rules.filter(r => r.id !== ruleId);
		announcement = `Filter rule removed. ${query.rules.length} rules remaining.`;
		handleQueryChange();
	}

	function updateRule(ruleId: string, updates: Partial<FilterRule>) {
		const rule = query.rules.find(r => r.id === ruleId);
		if (rule) {
			Object.assign(rule, updates);
			handleQueryChange();
		}
	}

	function handleMatchTypeChange() {
		announcement = `Match type changed to "${query.matchType}"`;
		handleQueryChange();
	}

	function handleQueryChange() {
		dispatch('change', query);
	}

	function clearQuery() {
		query.rules = [];
		announcement = 'All query rules cleared';
		handleQueryChange();
	}

	function needsValueInput(operator: FilterOperator): boolean {
		return !['is-empty', 'is-not-empty'].includes(operator);
	}
</script>

<div class="query-builder {className}" role="region" aria-labelledby="query-builder-title">
	<div class="builder-header">
		<h3 id="query-builder-title">Query Builder</h3>
		<button class="clear-button" on:click={clearQuery} disabled={query.rules.length === 0}>
			Clear All
		</button>
	</div>

	<!-- Match Type Selector -->
	<div class="match-type-selector" role="group" aria-labelledby="match-type-label">
		<span id="match-type-label" class="match-type-label">Show tasks that match:</span>
		<div class="match-type-buttons">
			<button
				class="match-type-button"
				class:active={query.matchType === 'all'}
				on:click={() => {
					query.matchType = 'all';
					handleMatchTypeChange();
				}}
				aria-pressed={query.matchType === 'all'}
			>
				All rules
			</button>
			<button
				class="match-type-button"
				class:active={query.matchType === 'any'}
				on:click={() => {
					query.matchType = 'any';
					handleMatchTypeChange();
				}}
				aria-pressed={query.matchType === 'any'}
			>
				Any rule
			</button>
		</div>
	</div>

	<!-- Rules List -->
	<div class="rules-list" role="list" aria-label="Query rules">
		{#each query.rules as rule (rule.id)}
			<div class="rule-row" role="listitem">
				<div class="rule-controls">
					<div class="rule-field">
						<label for="field-{rule.id}" class="sr-only">Field</label>
						<select
							id="field-{rule.id}"
							bind:value={rule.field}
							on:change={() => updateRule(rule.id, { field: rule.field })}
						>
							{#each fieldOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					<div class="rule-operator">
						<label for="operator-{rule.id}" class="sr-only">Operator</label>
						<select
							id="operator-{rule.id}"
							bind:value={rule.operator}
							on:change={() => updateRule(rule.id, { operator: rule.operator })}
						>
							{#each operatorOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					{#if needsValueInput(rule.operator)}
						<div class="rule-value">
							<label for="value-{rule.id}" class="sr-only">Value</label>
							<input
								type="text"
								id="value-{rule.id}"
								bind:value={rule.value}
								on:input={() => updateRule(rule.id, { value: rule.value })}
								placeholder="Enter value..."
							/>
						</div>
					{/if}
				</div>

				<button
					class="remove-rule-button"
					on:click={() => removeRule(rule.id)}
					aria-label="Remove rule for {fieldOptions.find(f => f.value === rule.field)?.label}"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
					</svg>
				</button>
			</div>
		{/each}

		{#if query.rules.length === 0}
			<div class="empty-state" role="status">
				<p>No filter rules added yet</p>
			</div>
		{/if}
	</div>

	<!-- Add Rule Button -->
	<button class="add-rule-button" on:click={addRule}>
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M8 4v8M4 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
		</svg>
		Add Rule
	</button>

	<!-- Screen Reader Announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announcement}
	</div>
</div>

<style>
	.query-builder {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.builder-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.builder-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-normal);
	}

	.clear-button {
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

	.clear-button:hover:not(:disabled) {
		background: var(--background);
		border-color: var(--color-red);
		color: var(--color-red);
	}

	.clear-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.clear-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.match-type-selector {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.match-type-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-normal);
	}

	.match-type-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.match-type-button {
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem 1rem;
		background: var(--background);
		border: 2px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-normal);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.match-type-button:hover {
		border-color: var(--interactive-accent);
	}

	.match-type-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.match-type-button.active {
		background: var(--interactive-accent);
		border-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.rules-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 100px;
	}

	.rule-row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		padding: 1rem;
		background: var(--background);
		border: 1px solid var(--border-color);
		border-radius: 6px;
	}

	.rule-controls {
		display: flex;
		gap: 0.5rem;
		flex: 1;
		flex-wrap: wrap;
	}

	.rule-field,
	.rule-operator {
		flex: 1;
		min-width: 150px;
	}

	.rule-value {
		flex: 2;
		min-width: 200px;
	}

	select,
	input[type="text"] {
		width: 100%;
		min-height: 44px;
		padding: 0.5rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-normal);
		font-size: 0.875rem;
	}

	select:focus,
	input[type="text"]:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.remove-rule-button {
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.remove-rule-button:hover {
		background: var(--color-red);
		border-color: var(--color-red);
		color: white;
	}

	.remove-rule-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
	}

	.empty-state p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.add-rule-button {
		min-height: 44px;
		padding: 0.5rem 1rem;
		background: var(--interactive-accent);
		border: none;
		border-radius: 6px;
		color: var(--text-on-accent);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition: all 0.2s ease;
		align-self: flex-start;
	}

	.add-rule-button:hover {
		background: var(--interactive-accent-hover);
	}

	.add-rule-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
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
		.query-builder,
		.match-type-button,
		.rule-row,
		select,
		input[type="text"],
		.remove-rule-button,
		.add-rule-button {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.clear-button,
		.match-type-button,
		.remove-rule-button,
		.add-rule-button {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.query-builder {
			padding: 1rem;
		}

		.builder-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.rule-controls {
			flex-direction: column;
		}

		.rule-field,
		.rule-operator,
		.rule-value {
			min-width: 100%;
		}

		.rule-row {
			flex-direction: column;
		}
	}
</style>
