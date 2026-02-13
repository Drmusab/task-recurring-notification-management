<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Props
	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

	// Notification settings
	let enableNotifications: boolean = true;
	let enableSound: boolean = true;
	let soundVolume: number = 70;
	let enableDesktopNotifications: boolean = true;
	let notificationPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right';
	let reminderLeadTime: number = 15;
	let persistNotifications: boolean = false;

	function handleChange() {
		dispatch('change', {
			enableNotifications,
			enableSound,
			soundVolume,
			enableDesktopNotifications,
			notificationPosition,
			reminderLeadTime,
			persistNotifications
		});
	}

	// Screen reader announcement
	let announcement = '';
	function announce(message: string) {
		announcement = message;
		setTimeout(() => (announcement = ''), 100);
	}

	const id = `notification-settings-${Math.random().toString(36).substr(2, 9)}`;
</script>

<div class="notification-settings {className}">
	<fieldset class="notification-settings__section">
		<legend class="notification-settings__legend">General Notifications</legend>

		<!-- Enable Notifications -->
		<div class="notification-settings__field">
			<label class="notification-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={enableNotifications}
					on:change={() => {
						handleChange();
						announce(enableNotifications ? 'Notifications enabled' : 'Notifications disabled');
					}}
					class="notification-settings__checkbox"
				/>
				<span>Enable notifications</span>
			</label>
		</div>

		{#if enableNotifications}
			<!-- Enable Sound -->
			<div class="notification-settings__field">
				<label class="notification-settings__checkbox-label">
					<input
						type="checkbox"
						bind:checked={enableSound}
						on:change={() => {
							handleChange();
							announce(enableSound ? 'Sound enabled' : 'Sound disabled');
						}}
						class="notification-settings__checkbox"
					/>
					<span>Enable sound</span>
				</label>
			</div>

			<!-- Sound Volume -->
			{#if enableSound}
				<div class="notification-settings__field">
					<label for="{id}-volume" class="notification-settings__label">
						Sound volume: {soundVolume}%
					</label>
					<input
						type="range"
						id="{id}-volume"
						class="notification-settings__slider"
						min="0"
						max="100"
						bind:value={soundVolume}
						on:change={handleChange}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={soundVolume}
					/>
				</div>
			{/if}

			<!-- Desktop Notifications -->
			<div class="notification-settings__field">
				<label class="notification-settings__checkbox-label">
					<input
						type="checkbox"
						bind:checked={enableDesktopNotifications}
						on:change={() => {
							handleChange();
							announce(enableDesktopNotifications ? 'Desktop notifications enabled' : 'Desktop notifications disabled');
						}}
						class="notification-settings__checkbox"
					/>
					<span>Enable desktop notifications</span>
				</label>
			</div>
		{/if}
	</fieldset>

	<fieldset class="notification-settings__section">
		<legend class="notification-settings__legend">Reminder Settings</legend>

		<!-- Lead Time -->
		<div class="notification-settings__field">
			<label for="{id}-lead" class="notification-settings__label">
				Default reminder lead time (minutes)
			</label>
			<input
				type="number"
				id="{id}-lead"
				class="notification-settings__input"
				min="1"
				max="1440"
				bind:value={reminderLeadTime}
				on:change={handleChange}
			/>
		</div>

		<!-- Persist Notifications -->
		<div class="notification-settings__field">
			<label class="notification-settings__checkbox-label">
				<input
					type="checkbox"
					bind:checked={persistNotifications}
					on:change={handleChange}
					class="notification-settings__checkbox"
				/>
				<span>Keep notifications until dismissed</span>
			</label>
		</div>
	</fieldset>

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.notification-settings {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.notification-settings__section {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 20px;
		margin: 0;
	}

	.notification-settings__legend {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
		padding: 0 8px;
	}

	.notification-settings__field {
		margin-top: 16px;
	}

	.notification-settings__label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal);
		margin-bottom: 8px;
	}

	.notification-settings__input {
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
	}

	.notification-settings__input:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.notification-settings__checkbox-label {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-normal);
	}

	.notification-settings__checkbox {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.notification-settings__checkbox:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.notification-settings__slider {
		width: 100%;
		min-height: 44px;
		cursor: pointer;
	}

	.notification-settings__slider:focus {
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
		.notification-settings__section,
		.notification-settings__input {
			border-width: 2px;
		}
	}
</style>
