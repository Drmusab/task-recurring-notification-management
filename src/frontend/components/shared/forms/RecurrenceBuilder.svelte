<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '../Button.svelte';

	// Recurrence types
	type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
	type WeekDay = 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA';

	interface RecurrenceRule {
		frequency: Frequency | null;
		interval: number;
		byDay?: WeekDay[];
		byMonthDay?: number;
		count?: number;
		until?: string;
	}

	// Props
	export let value: string = ''; // iCalendar RRULE string
	export let label: string = 'Recurrence';
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: string }>();

	// Parse iCalendar RRULE to parts
	function parseRRule(rrule: string): RecurrenceRule {
		const rule: RecurrenceRule = {
			frequency: null,
			interval: 1
		};

		if (!rrule) return rule;

		const parts = rrule.split(';');
		parts.forEach((part) => {
			const [key, val] = part.split('=');
			if (!val) return;
			
			switch (key) {
				case 'FREQ':
					rule.frequency = val as Frequency;
					break;
				case 'INTERVAL':
					rule.interval = parseInt(val, 10);
					break;
				case 'BYDAY':
					rule.byDay = val.split(',') as WeekDay[];
					break;
				case 'BYMONTHDAY':
					rule.byMonthDay = parseInt(val, 10);
					break;
				case 'COUNT':
					rule.count = parseInt(val, 10);
					break;
				case 'UNTIL':
					rule.until = val;
					break;
			}
		});

		return rule;
	}

	// Build iCalendar RRULE from parts
	function buildRRule(rule: RecurrenceRule): string {
		if (!rule.frequency) return '';

		const parts: string[] = [`FREQ=${rule.frequency}`];

		if (rule.interval && rule.interval > 1) {
			parts.push(`INTERVAL=${rule.interval}`);
		}

		if (rule.byDay && rule.byDay.length > 0) {
			parts.push(`BYDAY=${rule.byDay.join(',')}`);
		}

		if (rule.byMonthDay) {
			parts.push(`BYMONTHDAY=${rule.byMonthDay}`);
		}

		if (rule.count) {
			parts.push(`COUNT=${rule.count}`);
		}

		if (rule.until) {
			parts.push(`UNTIL=${rule.until}`);
		}

		return parts.join(';');
	}

	// Current rule state
	let currentRule: RecurrenceRule = parseRRule(value);

	// Watch for external value changes
	$: {
		if (value !== buildRRule(currentRule)) {
			currentRule = parseRRule(value);
		}
	}

	// Weekday options
	const weekdays: { value: WeekDay; label: string; short: string }[] = [
		{ value: 'SU', label: 'Sunday', short: 'S' },
		{ value: 'MO', label: 'Monday', short: 'M' },
		{ value: 'TU', label: 'Tuesday', short: 'T' },
		{ value: 'WE', label: 'Wednesday', short: 'W' },
		{ value: 'TH', label: 'Thursday', short: 'T' },
		{ value: 'FR', label: 'Friday', short: 'F' },
		{ value: 'SA', label: 'Saturday', short: 'S' }
	];

	// Handlers
	function handleFrequencyChange(freq: Frequency | null) {
		currentRule.frequency = freq;
		// Reset dependent fields
		if (freq !== 'WEEKLY') {
			currentRule.byDay = undefined;
		}
		if (freq !== 'MONTHLY') {
			currentRule.byMonthDay = undefined;
		}
		emitChange();
		announceSelection();
	}

	function handleIntervalChange(e: Event) {
		const input = e.target as HTMLInputElement;
		currentRule.interval = parseInt(input.value, 10) || 1;
		emitChange();
	}

	function toggleWeekday(day: WeekDay) {
		if (!currentRule.byDay) {
			currentRule.byDay = [];
		}

		const index = currentRule.byDay.indexOf(day);
		if (index >= 0) {
			currentRule.byDay = currentRule.byDay.filter((d) => d !== day);
		} else {
			currentRule.byDay = [...currentRule.byDay, day];
		}

		emitChange();
		announceSelection();
	}

	function handleMonthDayChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const val = parseInt(input.value, 10);
		currentRule.byMonthDay = val > 0 && val <= 31 ? val : undefined;
		emitChange();
	}

	function handleCountChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const val = parseInt(input.value, 10);
		currentRule.count = val > 0 ? val : undefined;
		currentRule.until = undefined; // Clear until if count is set
		emitChange();
	}

	function clearRecurrence() {
		currentRule = {
			frequency: null,
			interval: 1
		};
		emitChange();
		announceSelection();
	}

	function emitChange() {
		const rrule = buildRRule(currentRule);
		dispatch('change', rrule);
	}

	// Screen reader announcements
	let announcement = '';

	function announceSelection() {
		if (!currentRule.frequency) {
			announcement = 'Recurrence cleared';
		} else {
			const freqText =
				currentRule.frequency === 'DAILY'
					? 'daily'
					: currentRule.frequency === 'WEEKLY'
						? 'weekly'
						: currentRule.frequency === 'MONTHLY'
							? 'monthly'
							: 'yearly';
			const intervalText =
				currentRule.interval > 1 ? ` every ${currentRule.interval} ${freqText}` : freqText;
			announcement = `Recurrence set to ${intervalText}`;
		}
		setTimeout(() => (announcement = ''), 100);
	}

	// Generate unique IDs
	const id = `recurrence-builder-${Math.random().toString(36).substr(2, 9)}`;
	const freqId = `${id}-freq`;
	const intervalId = `${id}-interval`;

	// Check if a weekday is selected
	function isWeekdaySelected(day: WeekDay): boolean {
		return currentRule.byDay ? currentRule.byDay.includes(day) : false;
	}
</script>

<div class="recurrence-builder {className}">
	<div class="recurrence-builder__header">
		<h3 class="recurrence-builder__label">{label}</h3>
		{#if currentRule.frequency}
			<Button variant="ghost" size="small" on:click={clearRecurrence}>Clear</Button>
		{/if}
	</div>

	<!-- Frequency Selection -->
	<div class="recurrence-builder__section">
		<label for={freqId} class="recurrence-builder__section-label">Repeat</label>
		<div class="recurrence-builder__frequency" role="group" aria-labelledby={freqId}>
			<button
				type="button"
				class="recurrence-builder__freq-btn"
				class:recurrence-builder__freq-btn--active={!currentRule.frequency}
				on:click={() => handleFrequencyChange(null)}
				aria-pressed={!currentRule.frequency}
			>
				None
			</button>
			<button
				type="button"
				class="recurrence-builder__freq-btn"
				class:recurrence-builder__freq-btn--active={currentRule.frequency === 'DAILY'}
				on:click={() => handleFrequencyChange('DAILY')}
				aria-pressed={currentRule.frequency === 'DAILY'}
			>
				Daily
			</button>
			<button
				type="button"
				class="recurrence-builder__freq-btn"
				class:recurrence-builder__freq-btn--active={currentRule.frequency === 'WEEKLY'}
				on:click={() => handleFrequencyChange('WEEKLY')}
				aria-pressed={currentRule.frequency === 'WEEKLY'}
			>
				Weekly
			</button>
			<button
				type="button"
				class="recurrence-builder__freq-btn"
				class:recurrence-builder__freq-btn--active={currentRule.frequency === 'MONTHLY'}
				on:click={() => handleFrequencyChange('MONTHLY')}
				aria-pressed={currentRule.frequency === 'MONTHLY'}
			>
				Monthly
			</button>
			<button
				type="button"
				class="recurrence-builder__freq-btn"
				class:recurrence-builder__freq-btn--active={currentRule.frequency === 'YEARLY'}
				on:click={() => handleFrequencyChange('YEARLY')}
				aria-pressed={currentRule.frequency === 'YEARLY'}
			>
				Yearly
			</button>
		</div>
	</div>

	{#if currentRule.frequency}
		<!-- Interval -->
		<div class="recurrence-builder__section">
			<label for={intervalId} class="recurrence-builder__section-label">Every</label>
			<div class="recurrence-builder__interval">
				<input
					type="number"
					id={intervalId}
					class="recurrence-builder__interval-input"
					min="1"
					max="365"
					value={currentRule.interval}
					on:change={handleIntervalChange}
					aria-label="Interval"
				/>
				<span class="recurrence-builder__interval-unit">
					{currentRule.frequency === 'DAILY'
						? currentRule.interval === 1
							? 'day'
							: 'days'
						: currentRule.frequency === 'WEEKLY'
							? currentRule.interval === 1
								? 'week'
								: 'weeks'
							: currentRule.frequency === 'MONTHLY'
								? currentRule.interval === 1
									? 'month'
									: 'months'
								: currentRule.interval === 1
									? 'year'
									: 'years'}
				</span>
			</div>
		</div>

		<!-- Weekdays (for WEEKLY) -->
		{#if currentRule.frequency === 'WEEKLY'}
			<div class="recurrence-builder__section">
				<div class="recurrence-builder__section-label">Repeat on</div>
				<div class="recurrence-builder__weekdays" role="group" aria-label="Days of the week">
					{#each weekdays as day}
						<button
							type="button"
							class="recurrence-builder__weekday-btn"
							class:recurrence-builder__weekday-btn--active={isWeekdaySelected(day.value)}
							on:click={() => toggleWeekday(day.value)}
							aria-pressed={isWeekdaySelected(day.value)}
							aria-label={day.label}
							title={day.label}
						>
							{day.short}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Month day (for MONTHLY) -->
		{#if currentRule.frequency === 'MONTHLY'}
			<div class="recurrence-builder__section">
				<label for="{id}-monthday" class="recurrence-builder__section-label">Day of month</label>
				<input
					type="number"
					id="{id}-monthday"
					class="recurrence-builder__monthday-input"
					min="1"
					max="31"
					value={currentRule.byMonthDay ?? 1}
					on:change={handleMonthDayChange}
					aria-label="Day of month"
				/>
			</div>
		{/if}

		<!-- End condition -->
		<div class="recurrence-builder__section">
			<label for="{id}-count" class="recurrence-builder__section-label">Ends after (optional)</label>
			<div class="recurrence-builder__end-condition">
				<input
					type="number"
					id="{id}-count"
					class="recurrence-builder__count-input"
					min="1"
					max="999"
					value={currentRule.count ?? ''}
					on:change={handleCountChange}
					placeholder="Never"
					aria-label="Number of occurrences"
				/>
				<span class="recurrence-builder__count-label">occurrences</span>
			</div>
		</div>

		<!-- Preview -->
		<div class="recurrence-builder__preview" role="status" aria-live="polite">
			<div class="recurrence-builder__preview-label">Preview:</div>
			<div class="recurrence-builder__preview-text">
				{buildRRule(currentRule)}
			</div>
		</div>
	{/if}

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.recurrence-builder {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		background: var(--background-primary);
	}

	.recurrence-builder__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.recurrence-builder__label {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
	}

	.recurrence-builder__section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.recurrence-builder__section-label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal);
	}

	/* Frequency buttons */
	.recurrence-builder__frequency {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.recurrence-builder__freq-btn {
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

	.recurrence-builder__freq-btn:hover {
		background: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.recurrence-builder__freq-btn:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.recurrence-builder__freq-btn--active {
		background: var(--interactive-accent);
		border-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	/* Interval */
	.recurrence-builder__interval {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.recurrence-builder__interval-input {
		width: 80px;
		height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		text-align: center;
	}

	.recurrence-builder__interval-input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.recurrence-builder__interval-unit {
		font-size: 14px;
		color: var(--text-muted);
	}

	/* Weekdays */
	.recurrence-builder__weekdays {
		display: flex;
		gap: 6px;
	}

	.recurrence-builder__weekday-btn {
		width: 44px;
		height: 44px;
		padding: 0;
		border: 2px solid var(--background-modifier-border);
		border-radius: 50%;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.recurrence-builder__weekday-btn:hover {
		background: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.recurrence-builder__weekday-btn:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.recurrence-builder__weekday-btn--active {
		background: var(--interactive-accent);
		border-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	/* Month day */
	.recurrence-builder__monthday-input {
		width: 80px;
		height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		text-align: center;
	}

	.recurrence-builder__monthday-input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	/* End condition */
	.recurrence-builder__end-condition {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.recurrence-builder__count-input {
		width: 100px;
		height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
	}

	.recurrence-builder__count-input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.recurrence-builder__count-label {
		font-size: 14px;
		color: var(--text-muted);
	}

	/* Preview */
	.recurrence-builder__preview {
		padding: 12px;
		border: 1px dashed var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-secondary);
	}

	.recurrence-builder__preview-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--text-muted);
		margin-bottom: 4px;
	}

	.recurrence-builder__preview-text {
		font-family: var(--font-monospace);
		font-size: 13px;
		color: var(--text-normal);
		word-break: break-all;
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
		.recurrence-builder__freq-btn,
		.recurrence-builder__weekday-btn {
			border-width: 2px;
		}

		.recurrence-builder__freq-btn--active,
		.recurrence-builder__weekday-btn--active {
			border-width: 3px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.recurrence-builder__freq-btn,
		.recurrence-builder__weekday-btn {
			transition: none;
		}
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.recurrence-builder {
			padding: 12px;
		}

		.recurrence-builder__frequency {
			flex-direction: column;
		}

		.recurrence-builder__freq-btn {
			width: 100%;
		}

		.recurrence-builder__weekdays {
			justify-content: space-between;
		}
	}
</style>
