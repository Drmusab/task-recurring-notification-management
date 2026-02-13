<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface ReminderSettingsData {
		enableReminders: boolean;
		defaultLeadTime: number;
		enableSound: boolean;
		soundVolume: number;
		enableDesktopNotifications: boolean;
		enableBrowserNotifications: boolean;
		reminderRepeat: boolean;
		repeatInterval: number;
		quietHoursEnabled: boolean;
		quietHoursStart: string;
		quietHoursEnd: string;
		snoozeDefault: number;
	}

	interface Props {
		className?: string;
	}

	const { className = '' }: Props = $props();

	const dispatch = createEventDispatcher();

	let settings = $state<ReminderSettingsData>({
		enableReminders: true,
		defaultLeadTime: 15,
		enableSound: true,
		soundVolume: 70,
		enableDesktopNotifications: true,
		enableBrowserNotifications: false,
		reminderRepeat: false,
		repeatInterval: 5,
		quietHoursEnabled: false,
		quietHoursStart: '22:00',
		quietHoursEnd: '08:00',
		snoozeDefault: 10
	});

	let announcement = $state('');

	function handleChange() {
		announcement = 'Reminder settings updated';
		dispatch('change', settings);
	}

	function testNotification() {
		announcement = 'Test notification sent';
		dispatch('test');
	}
</script>

<div class="reminder-settings {className}">
	<h3>Reminder Settings</h3>

	<!-- General Reminder Settings -->
	<fieldset class="settings-fieldset">
		<legend>General</legend>

		<div class="setting-item">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={settings.enableReminders}
					on:change={handleChange}
				/>
				<span>Enable reminders</span>
			</label>
			<p class="setting-description">Receive notifications for upcoming tasks</p>
		</div>

		<div class="setting-item">
			<label for="default-lead-time">Default reminder lead time</label>
			<div class="input-with-unit">
				<input
					type="number"
					id="default-lead-time"
					min="1"
					max="1440"
					bind:value={settings.defaultLeadTime}
					on:change={handleChange}
					disabled={!settings.enableReminders}
				/>
				<span class="unit">minutes before</span>
			</div>
			<p class="setting-description">How early to remind you before tasks are due</p>
		</div>

		<div class="setting-item">
			<label for="snooze-default">Default snooze duration</label>
			<div class="input-with-unit">
				<input
					type="number"
					id="snooze-default"
					min="1"
					max="60"
					bind:value={settings.snoozeDefault}
					on:change={handleChange}
					disabled={!settings.enableReminders}
				/>
				<span class="unit">minutes</span>
			</div>
			<p class="setting-description">Default duration when snoozing a reminder</p>
		</div>
	</fieldset>

	<!-- Notification Settings -->
	<fieldset class="settings-fieldset">
		<legend>Notifications</legend>

		<div class="setting-item">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={settings.enableSound}
					on:change={handleChange}
					disabled={!settings.enableReminders}
				/>
				<span>Enable sound</span>
			</label>
		</div>

		{#if settings.enableSound && settings.enableReminders}
			<div class="setting-item indented">
				<label for="sound-volume">Sound volume</label>
				<div class="slider-with-value">
					<input
						type="range"
						id="sound-volume"
						min="0"
						max="100"
						bind:value={settings.soundVolume}
						on:input={handleChange}
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={settings.soundVolume}
						aria-label="Sound volume percentage"
					/>
					<span class="slider-value">{settings.soundVolume}%</span>
				</div>
			</div>
		{/if}

		<div class="setting-item">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={settings.enableDesktopNotifications}
					on:change={handleChange}
					disabled={!settings.enableReminders}
				/>
				<span>Enable desktop notifications</span>
			</label>
			<p class="setting-description">Show system notifications (requires permission)</p>
		</div>

		<div class="setting-item">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={settings.enableBrowserNotifications}
					on:change={handleChange}
					disabled={!settings.enableReminders}
				/>
				<span>Enable browser notifications</span>
			</label>
			<p class="setting-description">Show in-browser notification panel</p>
		</div>

		<div class="setting-item">
			<button
				class="test-notification-button"
				on:click={testNotification}
				disabled={!settings.enableReminders}
			>
				Test Notification
			</button>
		</div>
	</fieldset>

	<!-- Repeat Settings -->
	<fieldset class="settings-fieldset">
		<legend>Repeat</legend>

		<div class="setting-item">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={settings.reminderRepeat}
					on:change={handleChange}
					disabled={!settings.enableReminders}
				/>
				<span>Repeat reminders until dismissed</span>
			</label>
			<p class="setting-description">Continue showing reminders at intervals</p>
		</div>

		{#if settings.reminderRepeat && settings.enableReminders}
			<div class="setting-item indented">
				<label for="repeat-interval">Repeat interval</label>
				<div class="input-with-unit">
					<input
						type="number"
						id="repeat-interval"
						min="1"
						max="60"
						bind:value={settings.repeatInterval}
						on:change={handleChange}
					/>
					<span class="unit">minutes</span>
				</div>
			</div>
		{/if}
	</fieldset>

	<!-- Quiet Hours -->
	<fieldset class="settings-fieldset">
		<legend>Quiet Hours</legend>

		<div class="setting-item">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={settings.quietHoursEnabled}
					on:change={handleChange}
					disabled={!settings.enableReminders}
				/>
				<span>Enable quiet hours</span>
			</label>
			<p class="setting-description">Mute reminders during specific hours</p>
		</div>

		{#if settings.quietHoursEnabled && settings.enableReminders}
			<div class="setting-item indented">
				<label for="quiet-hours-start">Start time</label>
				<input
					type="time"
					id="quiet-hours-start"
					bind:value={settings.quietHoursStart}
					on:change={handleChange}
				/>
			</div>

			<div class="setting-item indented">
				<label for="quiet-hours-end">End time</label>
				<input
					type="time"
					id="quiet-hours-end"
					bind:value={settings.quietHoursEnd}
					on:change={handleChange}
				/>
			</div>
		{/if}
	</fieldset>

	<!-- Screen Reader Announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announcement}
	</div>
</div>

<style>
	.reminder-settings {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		background: var(--background);
	}

	.reminder-settings h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-normal);
	}

	.settings-fieldset {
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 1.5rem;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.settings-fieldset legend {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-normal);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 0 0.5rem;
	}

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.setting-item.indented {
		margin-left: 2rem;
	}

	.setting-item label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-normal);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
	}

	.checkbox-label input[type="checkbox"] {
		min-width: 20px;
		min-height: 20px;
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"]:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.setting-description {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.input-with-unit {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.input-with-unit input[type="number"] {
		width: 100px;
		min-height: 44px;
		padding: 0.5rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-normal);
		font-size: 0.875rem;
	}

	.input-with-unit input[type="number"]:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.unit {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	input[type="time"] {
		min-width: 120px;
		min-height: 44px;
		padding: 0.5rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-normal);
		font-size: 0.875rem;
	}

	input[type="time"]:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.slider-with-value {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
	}

	input[type="range"] {
		flex: 1;
		min-width: 100px;
		min-height: 44px;
		cursor: pointer;
	}

	input[type="range"]:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.slider-value {
		min-width: 50px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-normal);
		text-align: right;
	}

	.test-notification-button {
		min-height: 44px;
		padding: 0.5rem 1rem;
		background: var(--interactive-accent);
		border: none;
		border-radius: 6px;
		color: var(--text-on-accent);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		align-self: flex-start;
	}

	.test-notification-button:hover {
		background: var(--interactive-accent-hover);
	}

	.test-notification-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.test-notification-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
		.settings-fieldset,
		input[type="number"],
		input[type="time"],
		.test-notification-button {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.test-notification-button {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.reminder-settings {
			padding: 1rem;
		}

		.setting-item.indented {
			margin-left: 1rem;
		}

		.slider-with-value {
			flex-direction: column;
			align-items: flex-start;
		}

		.input-with-unit {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
