<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '../shared/Button.svelte';

	interface Notification {
		id: string;
		type: 'info' | 'success' | 'warning' | 'error';
		title: string;
		message: string;
		timestamp: Date;
		dismissible: boolean;
		actionLabel?: string;
		actionCallback?: () => void;
	}

	interface Props {
		notifications?: Notification[];
		maxVisible?: number;
		position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
		className?: string;
	}

	const {
		notifications = [],
		maxVisible = 5,
		position = 'top-right',
		className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let announcement = $state('');

	const visibleNotifications = $derived(notifications.slice(0, maxVisible));

	const iconPaths: Record<Notification['type'], string> = {
		info: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
		success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
		error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
	};

	const typeColors: Record<Notification['type'], string> = {
		info: 'var(--color-blue)',
		success: 'var(--color-green)',
		warning: 'var(--color-orange)',
		error: 'var(--color-red)'
	};

	function handleDismiss(notification: Notification) {
		announcement = `${notification.title} dismissed`;
		dispatch('dismiss', notification);
	}

	function handleAction(notification: Notification) {
		announcement = `Action taken for ${notification.title}`;
		if (notification.actionCallback) {
			notification.actionCallback();
		}
		dispatch('action', notification);
	}

	function getTimeAgo(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	}
</script>

<div
	class="notification-panel {className} position-{position}"
	role="region"
	aria-label="Notifications"
	aria-live="polite"
	aria-atomic="false"
>
	{#each visibleNotifications as notification (notification.id)}
		<div
			class="notification notification-{notification.type}"
			role="alert"
			aria-labelledby="notification-title-{notification.id}"
			style="border-left-color: {typeColors[notification.type]};"
		>
			<div class="notification-icon" aria-hidden="true" style="color: {typeColors[notification.type]};">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d={iconPaths[notification.type]} />
				</svg>
			</div>

			<div class="notification-content">
				<div class="notification-header">
					<h4 id="notification-title-{notification.id}" class="notification-title">
						{notification.title}
					</h4>
					<span class="notification-time" aria-label="Time: {getTimeAgo(notification.timestamp)}">
						{getTimeAgo(notification.timestamp)}
					</span>
				</div>

				<p class="notification-message">{notification.message}</p>

				{#if notification.actionLabel || notification.dismissible}
					<div class="notification-actions">
						{#if notification.actionLabel}
							<button
								class="notification-action-button"
								on:click={() => handleAction(notification)}
							>
								{notification.actionLabel}
							</button>
						{/if}
						
						{#if notification.dismissible}
							<button
								class="notification-dismiss-button"
								on:click={() => handleDismiss(notification)}
								aria-label="Dismiss notification"
							>
								<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
									<path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								</svg>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/each}

	{#if notifications.length === 0}
		<div class="empty-state" role="status">
			<p>No new notifications</p>
		</div>
	{/if}

	<!-- Screen Reader Announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announcement}
	</div>
</div>

<style>
	.notification-panel {
		position: fixed;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: 400px;
		width: 100%;
		padding: 1rem;
		pointer-events: none;
	}

	.notification-panel > * {
		pointer-events: auto;
	}

	.position-top-right {
		top: 1rem;
		right: 1rem;
	}

	.position-top-left {
		top: 1rem;
		left: 1rem;
	}

	.position-bottom-right {
		bottom: 1rem;
		right: 1rem;
	}

	.position-bottom-left {
		bottom: 1rem;
		left: 1rem;
	}

	.notification {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--background);
		border: 1px solid var(--border-color);
		border-left-width: 4px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateX(400px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.notification-icon {
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.notification-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.notification-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.notification-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-normal);
	}

	.notification-time {
		font-size: 0.75rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.notification-message {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.notification-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.25rem;
	}

	.notification-action-button {
		min-height: 32px;
		padding: 0.25rem 0.75rem;
		background: var(--interactive-accent);
		border: none;
		border-radius: 4px;
		color: var(--text-on-accent);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.notification-action-button:hover {
		background: var(--interactive-accent-hover);
	}

	.notification-action-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.notification-dismiss-button {
		min-width: 32px;
		min-height: 32px;
		padding: 0.25rem;
		background: transparent;
		border: none;
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
		margin-left: auto;
		transition: all 0.2s ease;
	}

	.notification-dismiss-button:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.notification-dismiss-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.empty-state {
		padding: 1rem;
		text-align: center;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.empty-state p {
		margin: 0;
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
		.notification {
			border-width: 2px;
			border-left-width: 4px;
		}

		.notification-action-button,
		.notification-dismiss-button {
			border: 2px solid currentColor;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.notification {
			animation: none;
		}

		.notification-action-button,
		.notification-dismiss-button {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.notification-panel {
			max-width: 100%;
			left: 0 !important;
			right: 0 !important;
			padding: 0.5rem;
		}

		.position-top-right,
		.position-top-left {
			top: 0.5rem;
		}

		.position-bottom-right,
		.position-bottom-left {
			bottom: 0.5rem;
		}
	}
</style>
