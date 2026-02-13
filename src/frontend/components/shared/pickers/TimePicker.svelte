<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let value: string | undefined = undefined; // HH:MM format (24-hour)
	export let label: string = 'Time';
	export let required: boolean = false;
	export let invalid: boolean = false;
	export let errorMessage: string = '';
	export let use24Hour: boolean = false; // If true, use 24-hour format
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: string }>();

	// Generate unique IDs
	const id = `time-picker-${Math.random().toString(36).substr(2, 9)}`;
	const errorId = `${id}-error`;
	const hintId = `${id}-hint`;

	// Parse value into components
	let hour: number | undefined;
	let minute: number | undefined;
	let period: 'AM' | 'PM' = 'AM';

	$: {
		if (value && value.includes(':')) {
			const parts = value.split(':');
			const h = Number(parts[0]);
			const m = Number(parts[1]);
			
			if (!isNaN(h) && !isNaN(m)) {
				if (!use24Hour) {
					hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
					period = h >= 12 ? 'PM' : 'AM';
				} else {
					hour = h;
				}
				minute = m;
			}
		}
	}

	// Format time for display
	function formatTime(): string | undefined {
		if (hour === undefined || minute === undefined) return undefined;

		let h = hour;
		if (!use24Hour) {
			// Convert 12-hour to 24-hour
			if (period === 'PM' && hour !== 12) h = hour + 12;
			if (period === 'AM' && hour === 12) h = 0;
		}

		return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
	}

	function handleHourChange(e: Event) {
		const input = e.target as HTMLInputElement;
		hour = input.value ? Number(input.value) : undefined;
		emitChange();
	}

	function handleMinuteChange(e: Event) {
		const input = e.target as HTMLInputElement;
		minute = input.value ? Number(input.value) : undefined;
		emitChange();
	}

	function handlePeriodChange(newPeriod: 'AM' | 'PM') {
		period = newPeriod;
		emitChange();
		announceSelection();
	}

	function emitChange() {
		const formatted = formatTime();
		if (formatted) {
			dispatch('change', formatted);
		}
	}

	// Screen reader announcements
	let announcement = '';

	function announceSelection() {
		if (hour !== undefined && minute !== undefined) {
			const timeStr = use24Hour
				? `${hour}:${String(minute).padStart(2, '0')}`
				: `${hour}:${String(minute).padStart(2, '0')} ${period}`;
			announcement = `Time selected: ${timeStr}`;
			setTimeout(() => (announcement = ''), 100);
		}
	}

	// Increment/decrement handlers
	function incrementHour() {
		const maxHour = use24Hour ? 23 : 12;
		const minHour = use24Hour ? 0 : 1;
		if (hour === undefined) {
			hour = minHour;
		} else {
			hour = hour >= maxHour ? minHour : hour + 1;
		}
		emitChange();
		announceSelection();
	}

	function decrementHour() {
		const maxHour = use24Hour ? 23 : 12;
		const minHour = use24Hour ? 0 : 1;
		if (hour === undefined) {
			hour = maxHour;
		} else {
			hour = hour <= minHour ? maxHour : hour - 1;
		}
		emitChange();
		announceSelection();
	}

	function incrementMinute() {
		if (minute === undefined) {
			minute = 0;
		} else {
			minute = minute >= 59 ? 0 : minute + 1;
		}
		emitChange();
		announceSelection();
	}

	function decrementMinute() {
		if (minute === undefined) {
			minute = 59;
		} else {
			minute = minute <= 0 ? 59 : minute - 1;
		}
		emitChange();
		announceSelection();
	}
</script>

<div class="time-picker {className}">
	<label for={id} class="time-picker__label">
		{label}
		{#if required}
			<span class="time-picker__required" aria-label="required">*</span>
		{/if}
	</label>

	<div class="time-picker__controls">
		<!-- Hour Input -->
		<div class="time-picker__field">
			<label for="{id}-hour" class="sr-only">Hour</label>
			<input
				type="number"
				id="{id}-hour"
				class="time-picker__input"
				min={use24Hour ? 0 : 1}
				max={use24Hour ? 23 : 12}
				value={hour ?? ''}
				on:change={handleHourChange}
				placeholder="HH"
				aria-label="Hour"
				aria-required={required}
				aria-invalid={invalid}
				aria-describedby="{hintId} {invalid ? errorId : ''}"
			/>
			<div class="time-picker__stepper">
				<button
					type="button"
					class="time-picker__stepper-btn"
					on:click={incrementHour}
					aria-label="Increase hour"
					tabindex="-1"
				>
					▲
				</button>
				<button
					type="button"
					class="time-picker__stepper-btn"
					on:click={decrementHour}
					aria-label="Decrease hour"
					tabindex="-1"
				>
					▼
				</button>
			</div>
		</div>

		<span class="time-picker__separator">:</span>

		<!-- Minute Input -->
		<div class="time-picker__field">
			<label for="{id}-minute" class="sr-only">Minute</label>
			<input
				type="number"
				id="{id}-minute"
				class="time-picker__input"
				min="0"
				max="59"
				value={minute !== undefined ? String(minute).padStart(2, '0') : ''}
				on:change={handleMinuteChange}
				placeholder="MM"
				aria-label="Minute"
				aria-required={required}
				aria-invalid={invalid}
				aria-describedby="{hintId} {invalid ? errorId : ''}"
			/>
			<div class="time-picker__stepper">
				<button
					type="button"
					class="time-picker__stepper-btn"
					on:click={incrementMinute}
					aria-label="Increase minute"
					tabindex="-1"
				>
					▲
				</button>
				<button
					type="button"
					class="time-picker__stepper-btn"
					on:click={decrementMinute}
					aria-label="Decrease minute"
					tabindex="-1"
				>
					▼
				</button>
			</div>
		</div>

		<!-- AM/PM Toggle (12-hour mode only) -->
		{#if !use24Hour}
			<div class="time-picker__period" role="group" aria-label="Time period">
				<button
					type="button"
					class="time-picker__period-btn"
					class:time-picker__period-btn--active={period === 'AM'}
					on:click={() => handlePeriodChange('AM')}
					aria-pressed={period === 'AM'}
					aria-label="AM"
				>
					AM
				</button>
				<button
					type="button"
					class="time-picker__period-btn"
					class:time-picker__period-btn--active={period === 'PM'}
					on:click={() => handlePeriodChange('PM')}
					aria-pressed={period === 'PM'}
					aria-label="PM"
				>
					PM
				</button>
			</div>
		{/if}
	</div>

	<!-- Hint Text -->
	<div id={hintId} class="time-picker__hint sr-only">
		Use arrow keys to adjust time, or type directly
	</div>

	<!-- Error message -->
	{#if invalid && errorMessage}
		<div id={errorId} class="time-picker__error" role="alert">
			{errorMessage}
		</div>
	{/if}

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.time-picker {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.time-picker__label {
		font-weight: 500;
		font-size: 14px;
		color: var(--text-normal);
	}

	.time-picker__required {
		color: var(--text-error);
		margin-left: 4px;
	}

	.time-picker__controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.time-picker__field {
		position: relative;
		display: flex;
		align-items: center;
	}

	.time-picker__input {
		width: 60px;
		height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		font-size: 16px;
		text-align: center;
		background: var(--background-primary);
		color: var(--text-normal);
	}

	.time-picker__input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.time-picker__input[aria-invalid='true'] {
		border-color: var(--text-error);
	}

	.time-picker__separator {
		font-size: 20px;
		font-weight: bold;
		color: var(--text-normal);
	}

	.time-picker__stepper {
		display: flex;
		flex-direction: column;
		margin-left: 4px;
		gap: 2px;
	}

	.time-picker__stepper-btn {
		width: 24px;
		height: 20px;
		padding: 0;
		border: 1px solid var(--background-modifier-border);
		border-radius: 3px;
		background: var(--background-secondary);
		color: var(--text-muted);
		font-size: 10px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.time-picker__stepper-btn:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.time-picker__stepper-btn:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.time-picker__period {
		display: flex;
		gap: 4px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 2px;
		background: var(--background-secondary);
	}

	.time-picker__period-btn {
		min-width: 44px;
		min-height: 40px;
		padding: 8px 12px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--text-muted);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.time-picker__period-btn--active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.time-picker__period-btn:hover:not(.time-picker__period-btn--active) {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.time-picker__period-btn:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.time-picker__hint {
		font-size: 12px;
		color: var(--text-muted);
	}

	.time-picker__error {
		font-size: 12px;
		color: var(--text-error);
		margin-top: 4px;
	}

	/* Screen reader only class */
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
		.time-picker__input,
		.time-picker__stepper-btn,
		.time-picker__period {
			border-width: 2px;
		}

		.time-picker__period-btn--active {
			border: 2px solid var(--text-on-accent);
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.time-picker__period-btn {
			transition: none;
		}
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.time-picker__input {
			width: 56px;
		}

		.time-picker__period-btn {
			min-width: 40px;
		}
	}
</style>
