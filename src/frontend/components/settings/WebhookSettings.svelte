<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import {
		webhookStore,
		webhooksEnabled,
		webhookEndpoints,
		activeEndpointCount,
		availableEventTypes,
		DEFAULT_RETRY_POLICY,
		WEBHOOK_EVENT_LABELS,
	} from '../../stores/Webhook.store';
	import type {
		WebhookEndpoint,
		WebhookEventType,
		WebhookTestResult,
		WebhookRetryPolicy,
		CreateEndpointParams,
	} from '../../stores/Webhook.store';

	export let className: string = '';

	const dispatch = createEventDispatcher<{ change: Record<string, unknown> }>();

	// ── State ────────────────────────────────────────────────
	let state: typeof $webhookStore = $webhookStore;
	$: state = $webhookStore;

	// Form state for adding new endpoint
	let newEndpointName = '';
	let newEndpointUrl = '';
	let newEndpointSecret = '';
	let newEndpointEvents: WebhookEventType[] = [];
	let showNewForm = false;

	// Edit state
	let editingEndpointId: string | null = null;
	let editName = '';
	let editUrl = '';
	let editSecret = '';
	let editEvents: WebhookEventType[] = [];

	// View state
	let showDeliveryLog = false;
	let showQueue = false;
	let showAdvanced = false;

	// Global settings form
	let allowLocalhost = state.settings.allowLocalhost;
	let rateLimitPerMinute = state.settings.rateLimitPerMinute;
	let includeDescription = state.settings.includeDescription;
	let allowedDomainsText = (state.settings.allowedDomains ?? []).join('\n');
	let retryMaxRetries = state.settings.defaultRetryPolicy.maxRetries;
	let retryStrategy = state.settings.defaultRetryPolicy.strategy;
	let retryBaseDelayMs = state.settings.defaultRetryPolicy.baseDelayMs;

	// Apply reactivity for settings sync
	$: {
		allowLocalhost = state.settings.allowLocalhost;
		rateLimitPerMinute = state.settings.rateLimitPerMinute;
		includeDescription = state.settings.includeDescription;
		allowedDomainsText = (state.settings.allowedDomains ?? []).join('\n');
		retryMaxRetries = state.settings.defaultRetryPolicy.maxRetries;
		retryStrategy = state.settings.defaultRetryPolicy.strategy;
		retryBaseDelayMs = state.settings.defaultRetryPolicy.baseDelayMs;
	}

	// Refresh interval
	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		refreshInterval = setInterval(() => {
			webhookStore.refreshFromManager();
		}, 10_000);
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	});

	// ── Unique IDs ───────────────────────────────────────────
	const uid = `wh-settings-${Math.random().toString(36).substr(2, 9)}`;

	// ── Accessibility ────────────────────────────────────────
	let announcement = '';
	function announce(message: string) {
		announcement = message;
		setTimeout(() => (announcement = ''), 100);
	}

	// ── Handlers ─────────────────────────────────────────────

	async function handleToggleEnabled() {
		await webhookStore.setEnabled(!state.settings.enabled);
		announce(state.settings.enabled ? 'Webhooks enabled' : 'Webhooks disabled');
		dispatch('change', { enabled: state.settings.enabled });
	}

	async function handleAddEndpoint() {
		if (!newEndpointName.trim() || !newEndpointUrl.trim()) return;

		const params: CreateEndpointParams = {
			name: newEndpointName.trim(),
			url: newEndpointUrl.trim(),
			secret: newEndpointSecret.trim() || undefined,
			events: newEndpointEvents.length > 0 ? newEndpointEvents : undefined,
		};

		const result = await webhookStore.addEndpoint(params);
		if (result) {
			newEndpointName = '';
			newEndpointUrl = '';
			newEndpointSecret = '';
			newEndpointEvents = [];
			showNewForm = false;
			announce(`Endpoint "${result.name}" added`);
		}
	}

	async function handleRemoveEndpoint(id: string, name: string) {
		if (!confirm(`Remove webhook endpoint "${name}"? This cannot be undone.`)) return;
		await webhookStore.removeEndpoint(id);
		announce(`Endpoint "${name}" removed`);
	}

	async function handleToggleEndpoint(id: string) {
		await webhookStore.toggleEndpoint(id);
		announce('Endpoint toggled');
	}

	async function handleTestEndpoint(id: string, name: string) {
		announce(`Testing "${name}"...`);
		const result = await webhookStore.testEndpoint(id);
		if (result?.success) {
			announce(`Test ping to "${name}" succeeded`);
		} else {
			announce(`Test ping to "${name}" failed: ${result?.error ?? 'Unknown error'}`);
		}
	}

	function startEditing(endpoint: WebhookEndpoint) {
		editingEndpointId = endpoint.id;
		editName = endpoint.name;
		editUrl = endpoint.url;
		editSecret = endpoint.secret;
		editEvents = [...endpoint.events];
	}

	async function saveEditing() {
		if (!editingEndpointId) return;
		await webhookStore.updateEndpoint(editingEndpointId, {
			name: editName.trim(),
			url: editUrl.trim(),
			secret: editSecret.trim(),
			events: editEvents,
		});
		editingEndpointId = null;
		announce('Endpoint updated');
	}

	function cancelEditing() {
		editingEndpointId = null;
	}

	async function handleSaveGlobalSettings() {
		const allowedDomains = allowedDomainsText
			.split('\n')
			.map((d) => d.trim())
			.filter(Boolean);

		await webhookStore.updateSettings({
			allowLocalhost,
			rateLimitPerMinute,
			includeDescription,
			allowedDomains,
			defaultRetryPolicy: {
				maxRetries: retryMaxRetries,
				strategy: retryStrategy,
				baseDelayMs: retryBaseDelayMs,
				maxDelayMs: 300_000,
			},
		});
		announce('Settings saved');
	}

	async function handleFlushQueue() {
		const delivered = await webhookStore.flushQueue();
		announce(`Flushed queue: ${delivered} delivered`);
	}

	function handleClearLog() {
		webhookStore.clearDeliveryLog();
		announce('Delivery log cleared');
	}

	function handlePruneQueue() {
		const pruned = webhookStore.pruneQueue();
		announce(`Pruned ${pruned} abandoned deliveries`);
	}

	function toggleEventSelection(event: WebhookEventType, list: WebhookEventType[]): WebhookEventType[] {
		if (list.includes(event)) {
			return list.filter((e) => e !== event);
		}
		return [...list, event];
	}

	function formatTimestamp(iso: string | null): string {
		if (!iso) return 'Never';
		try {
			return new Date(iso).toLocaleString();
		} catch {
			return iso;
		}
	}

	function getStatusIcon(success: boolean): string {
		return success ? '✓' : '✗';
	}

	function getStatusClass(status: string): string {
		switch (status) {
			case 'delivered': return 'status--success';
			case 'failed': case 'abandoned': return 'status--error';
			case 'pending': return 'status--pending';
			case 'rate_limited': return 'status--warning';
			default: return '';
		}
	}
</script>

<div class="webhook-settings {className}">
	<!-- ═══ Global Toggle ═══ -->
	<fieldset class="webhook-settings__section">
		<legend class="webhook-settings__legend">Webhook System</legend>

		<div class="webhook-settings__field">
			<label class="webhook-settings__checkbox-label">
				<input
					type="checkbox"
					checked={state.settings.enabled}
					on:change={handleToggleEnabled}
					class="webhook-settings__checkbox"
				/>
				<span>Enable webhook system</span>
			</label>
			<p class="webhook-settings__hint">
				When enabled, task events will be sent to configured webhook endpoints (e.g. n8n, Zapier).
			</p>
		</div>

		{#if state.status}
			<div class="webhook-settings__status-bar">
				<span class="webhook-settings__status-item">
					Endpoints: <strong>{state.status.endpointCount}</strong>
					({state.status.activeEndpointCount} active)
				</span>
				<span class="webhook-settings__status-item">
					Queue: <strong>{state.status.queueSize}</strong>
					({state.status.pendingDeliveries} pending)
				</span>
				<span class="webhook-settings__status-item">
					Delivered: <strong>{state.status.deliveryStats.delivered}</strong> /
					Failed: <strong>{state.status.deliveryStats.failed}</strong>
				</span>
			</div>
		{/if}
	</fieldset>

	{#if state.settings.enabled}
		<!-- ═══ Endpoints List ═══ -->
		<fieldset class="webhook-settings__section">
			<legend class="webhook-settings__legend">Webhook Endpoints</legend>

			{#if state.settings.endpoints.length === 0}
				<p class="webhook-settings__empty">No endpoints configured. Add one to start sending events.</p>
			{/if}

			{#each state.settings.endpoints as endpoint (endpoint.id)}
				<div class="webhook-settings__endpoint" class:endpoint--disabled={!endpoint.enabled}>
					{#if editingEndpointId === endpoint.id}
						<!-- Edit Mode -->
						<div class="webhook-settings__endpoint-edit">
							<div class="webhook-settings__field">
								<label for="{uid}-edit-name" class="webhook-settings__label">Name</label>
								<input
									id="{uid}-edit-name"
									type="text"
									class="webhook-settings__input"
									bind:value={editName}
								/>
							</div>
							<div class="webhook-settings__field">
								<label for="{uid}-edit-url" class="webhook-settings__label">URL</label>
								<input
									id="{uid}-edit-url"
									type="url"
									class="webhook-settings__input"
									bind:value={editUrl}
									placeholder="https://n8n.example.com/webhook/..."
								/>
							</div>
							<div class="webhook-settings__field">
								<label for="{uid}-edit-secret" class="webhook-settings__label">Secret (HMAC-SHA256)</label>
								<input
									id="{uid}-edit-secret"
									type="password"
									class="webhook-settings__input"
									bind:value={editSecret}
									placeholder="Leave empty for unsigned"
								/>
							</div>
							<div class="webhook-settings__field">
								<span class="webhook-settings__label">Event Types (empty = all)</span>
								<div class="webhook-settings__event-grid">
									{#each availableEventTypes as evt}
										<label class="webhook-settings__event-chip">
											<input
												type="checkbox"
												checked={editEvents.includes(evt.value)}
												on:change={() => (editEvents = toggleEventSelection(evt.value, editEvents))}
											/>
											<span>{evt.label}</span>
										</label>
									{/each}
								</div>
							</div>
							<div class="webhook-settings__actions">
								<button class="webhook-settings__btn webhook-settings__btn--primary" on:click={saveEditing}>
									Save
								</button>
								<button class="webhook-settings__btn" on:click={cancelEditing}>Cancel</button>
							</div>
						</div>
					{:else}
						<!-- View Mode -->
						<div class="webhook-settings__endpoint-header">
							<div class="webhook-settings__endpoint-info">
								<span class="webhook-settings__endpoint-name">{endpoint.name}</span>
								<span class="webhook-settings__endpoint-url" title={endpoint.url}>
									{endpoint.url.length > 60 ? endpoint.url.slice(0, 60) + '...' : endpoint.url}
								</span>
								{#if endpoint.events.length > 0}
									<span class="webhook-settings__endpoint-events">
										{endpoint.events.map((e) => WEBHOOK_EVENT_LABELS[e] ?? e).join(', ')}
									</span>
								{:else}
									<span class="webhook-settings__endpoint-events">All events</span>
								{/if}
								<span class="webhook-settings__endpoint-meta">
									{endpoint.secret ? '🔒 Signed' : '🔓 Unsigned'} ·
									Last success: {formatTimestamp(endpoint.lastSuccessAt)} ·
									Failures: {endpoint.consecutiveFailures}
								</span>
							</div>
							<div class="webhook-settings__endpoint-actions">
								<button
									class="webhook-settings__btn webhook-settings__btn--sm"
									on:click={() => handleToggleEndpoint(endpoint.id)}
									title={endpoint.enabled ? 'Disable' : 'Enable'}
								>
									{endpoint.enabled ? 'Disable' : 'Enable'}
								</button>
								<button
									class="webhook-settings__btn webhook-settings__btn--sm"
									on:click={() => handleTestEndpoint(endpoint.id, endpoint.name)}
									title="Send test ping"
								>
									Test
								</button>
								<button
									class="webhook-settings__btn webhook-settings__btn--sm"
									on:click={() => startEditing(endpoint)}
									title="Edit endpoint"
								>
									Edit
								</button>
								<button
									class="webhook-settings__btn webhook-settings__btn--sm webhook-settings__btn--danger"
									on:click={() => handleRemoveEndpoint(endpoint.id, endpoint.name)}
									title="Remove endpoint"
								>
									Remove
								</button>
							</div>
						</div>

						<!-- Test Result -->
						{#if state.testResults[endpoint.id]}
							{@const result = /** @type {import('@infrastructure/webhooks/webhook-types').WebhookTestResult} */ (state.testResults[endpoint.id])}
							{#if result}
							<div class="webhook-settings__test-result" class:test-result--success={result.success} class:test-result--error={!result.success}>
								<span>{getStatusIcon(result.success)} {result.success ? 'Success' : 'Failed'}</span>
								{#if result.statusCode}
									<span>HTTP {result.statusCode}</span>
								{/if}
								<span>{result.durationMs}ms</span>
								{#if result.error}
									<span class="webhook-settings__test-error">{result.error}</span>
								{/if}
							</div>
							{/if}
						{/if}
					{/if}
				</div>
			{/each}

			<!-- Add Endpoint -->
			{#if showNewForm}
				<div class="webhook-settings__new-endpoint">
					<h4>Add New Endpoint</h4>
					<div class="webhook-settings__field">
						<label for="{uid}-new-name" class="webhook-settings__label">Name</label>
						<input
							id="{uid}-new-name"
							type="text"
							class="webhook-settings__input"
							bind:value={newEndpointName}
							placeholder="My n8n Workflow"
						/>
					</div>
					<div class="webhook-settings__field">
						<label for="{uid}-new-url" class="webhook-settings__label">Webhook URL</label>
						<input
							id="{uid}-new-url"
							type="url"
							class="webhook-settings__input"
							bind:value={newEndpointUrl}
							placeholder="https://n8n.example.com/webhook/abc123"
						/>
					</div>
					<div class="webhook-settings__field">
						<label for="{uid}-new-secret" class="webhook-settings__label">Secret (optional)</label>
						<input
							id="{uid}-new-secret"
							type="password"
							class="webhook-settings__input"
							bind:value={newEndpointSecret}
							placeholder="Shared HMAC-SHA256 secret"
						/>
					</div>
					<div class="webhook-settings__field">
						<span class="webhook-settings__label">Event Types (empty = all events)</span>
						<div class="webhook-settings__event-grid">
							{#each availableEventTypes as evt}
								<label class="webhook-settings__event-chip">
									<input
										type="checkbox"
										checked={newEndpointEvents.includes(evt.value)}
										on:change={() => (newEndpointEvents = toggleEventSelection(evt.value, newEndpointEvents))}
									/>
									<span>{evt.label}</span>
								</label>
							{/each}
						</div>
					</div>
					<div class="webhook-settings__actions">
						<button
							class="webhook-settings__btn webhook-settings__btn--primary"
							on:click={handleAddEndpoint}
							disabled={!newEndpointName.trim() || !newEndpointUrl.trim()}
						>
							Add Endpoint
						</button>
						<button class="webhook-settings__btn" on:click={() => (showNewForm = false)}>Cancel</button>
					</div>
				</div>
			{:else}
				<button class="webhook-settings__btn webhook-settings__btn--outline" on:click={() => (showNewForm = true)}>
					+ Add Endpoint
				</button>
			{/if}
		</fieldset>

		<!-- ═══ Advanced Settings ═══ -->
		<fieldset class="webhook-settings__section">
			<legend class="webhook-settings__legend">
				<button
					class="webhook-settings__collapse-toggle"
					on:click={() => (showAdvanced = !showAdvanced)}
					aria-expanded={showAdvanced}
				>
					{showAdvanced ? '▼' : '▶'} Advanced Settings
				</button>
			</legend>

			{#if showAdvanced}
				<!-- Security -->
				<div class="webhook-settings__subsection">
					<h4>Security</h4>
					<div class="webhook-settings__field">
						<label class="webhook-settings__checkbox-label">
							<input type="checkbox" bind:checked={allowLocalhost} class="webhook-settings__checkbox" />
							<span>Allow localhost URLs (development only)</span>
						</label>
					</div>
					<div class="webhook-settings__field">
						<label for="{uid}-domains" class="webhook-settings__label">
							Allowed domains (one per line, empty = allow all)
						</label>
						<textarea
							id="{uid}-domains"
							class="webhook-settings__textarea"
							bind:value={allowedDomainsText}
							placeholder="n8n.example.com&#10;*.mycompany.com"
							rows="4"
						></textarea>
					</div>
					<div class="webhook-settings__field">
						<label for="{uid}-rate-limit" class="webhook-settings__label">
							Rate limit (events per minute, 0 = unlimited)
						</label>
						<input
							id="{uid}-rate-limit"
							type="number"
							class="webhook-settings__input"
							bind:value={rateLimitPerMinute}
							min="0"
							max="1000"
						/>
					</div>
				</div>

				<!-- Payload -->
				<div class="webhook-settings__subsection">
					<h4>Payload</h4>
					<div class="webhook-settings__field">
						<label class="webhook-settings__checkbox-label">
							<input type="checkbox" bind:checked={includeDescription} class="webhook-settings__checkbox" />
							<span>Include task description in webhook payloads</span>
						</label>
					</div>
				</div>

				<!-- Retry Policy -->
				<div class="webhook-settings__subsection">
					<h4>Default Retry Policy</h4>
					<div class="webhook-settings__field">
						<label for="{uid}-max-retries" class="webhook-settings__label">Max retries</label>
						<input
							id="{uid}-max-retries"
							type="number"
							class="webhook-settings__input"
							bind:value={retryMaxRetries}
							min="0"
							max="20"
						/>
					</div>
					<div class="webhook-settings__field">
						<label for="{uid}-retry-strategy" class="webhook-settings__label">Backoff strategy</label>
						<select
							id="{uid}-retry-strategy"
							class="webhook-settings__select"
							bind:value={retryStrategy}
						>
							<option value="exponential">Exponential (recommended)</option>
							<option value="linear">Linear</option>
							<option value="fixed">Fixed</option>
						</select>
					</div>
					<div class="webhook-settings__field">
						<label for="{uid}-base-delay" class="webhook-settings__label">Base delay (ms)</label>
						<input
							id="{uid}-base-delay"
							type="number"
							class="webhook-settings__input"
							bind:value={retryBaseDelayMs}
							min="500"
							max="60000"
							step="500"
						/>
					</div>
				</div>

				<div class="webhook-settings__actions">
					<button class="webhook-settings__btn webhook-settings__btn--primary" on:click={handleSaveGlobalSettings}>
						Save Settings
					</button>
				</div>
			{/if}
		</fieldset>

		<!-- ═══ Delivery Log ═══ -->
		<fieldset class="webhook-settings__section">
			<legend class="webhook-settings__legend">
				<button
					class="webhook-settings__collapse-toggle"
					on:click={() => (showDeliveryLog = !showDeliveryLog)}
					aria-expanded={showDeliveryLog}
				>
					{showDeliveryLog ? '▼' : '▶'} Delivery Log ({state.deliveryLog.length} entries)
				</button>
			</legend>

			{#if showDeliveryLog}
				<div class="webhook-settings__log-actions">
					<button class="webhook-settings__btn webhook-settings__btn--sm" on:click={handleFlushQueue}>
						Flush Queue
					</button>
					<button class="webhook-settings__btn webhook-settings__btn--sm" on:click={handlePruneQueue}>
						Prune Abandoned
					</button>
					<button class="webhook-settings__btn webhook-settings__btn--sm webhook-settings__btn--danger" on:click={handleClearLog}>
						Clear Log
					</button>
				</div>

				{#if state.deliveryLog.length === 0}
					<p class="webhook-settings__empty">No delivery log entries yet.</p>
				{:else}
					<div class="webhook-settings__log-table-wrapper">
						<table class="webhook-settings__log-table">
							<thead>
								<tr>
									<th>Time</th>
									<th>Event</th>
									<th>Endpoint</th>
									<th>Status</th>
									<th>Code</th>
									<th>Attempts</th>
									<th>Duration</th>
								</tr>
							</thead>
							<tbody>
								{#each [...state.deliveryLog].reverse() as entry (entry.id)}
									<tr class={getStatusClass(entry.status)}>
										<td title={entry.timestamp}>{formatTimestamp(entry.timestamp)}</td>
										<td>{WEBHOOK_EVENT_LABELS[entry.event] ?? entry.event}</td>
										<td>{entry.endpointName}</td>
										<td><span class="webhook-settings__status-badge">{entry.status}</span></td>
										<td>{entry.statusCode ?? '—'}</td>
										<td>{entry.attempts}</td>
										<td>{entry.durationMs}ms</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}
		</fieldset>

		<!-- ═══ Queue Snapshot ═══ -->
		<fieldset class="webhook-settings__section">
			<legend class="webhook-settings__legend">
				<button
					class="webhook-settings__collapse-toggle"
					on:click={() => (showQueue = !showQueue)}
					aria-expanded={showQueue}
				>
					{showQueue ? '▼' : '▶'} Queue ({state.queueSnapshot.length} items)
				</button>
			</legend>

			{#if showQueue}
				{#if state.queueSnapshot.length === 0}
					<p class="webhook-settings__empty">Queue is empty.</p>
				{:else}
					<div class="webhook-settings__log-table-wrapper">
						<table class="webhook-settings__log-table">
							<thead>
								<tr>
									<th>Event</th>
									<th>URL</th>
									<th>Status</th>
									<th>Attempts</th>
									<th>Next Retry</th>
									<th>Error</th>
								</tr>
							</thead>
							<tbody>
								{#each state.queueSnapshot as item (item.id)}
									<tr class={getStatusClass(item.status)}>
										<td>{WEBHOOK_EVENT_LABELS[item.payload.event] ?? item.payload.event}</td>
										<td title={item.url}>{item.url.length > 40 ? item.url.slice(0, 40) + '...' : item.url}</td>
										<td><span class="webhook-settings__status-badge">{item.status}</span></td>
										<td>{item.attempts}</td>
										<td>{formatTimestamp(item.nextRetryAt)}</td>
										<td>{item.lastError ?? '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}
		</fieldset>
	{/if}

	<!-- Error Banner -->
	{#if state.lastError}
		<div class="webhook-settings__error-banner" role="alert">
			<strong>Error:</strong> {state.lastError}
		</div>
	{/if}

	<!-- Screen reader announcements -->
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</div>
</div>

<style>
	.webhook-settings {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.webhook-settings__section {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 20px;
		margin: 0;
	}

	.webhook-settings__legend {
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
		padding: 0 8px;
	}

	.webhook-settings__field {
		margin-top: 12px;
	}

	.webhook-settings__label {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal);
		margin-bottom: 6px;
	}

	.webhook-settings__input,
	.webhook-settings__select,
	.webhook-settings__textarea {
		width: 100%;
		min-height: 38px;
		padding: 8px 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		box-sizing: border-box;
	}

	.webhook-settings__textarea {
		resize: vertical;
		font-family: monospace;
	}

	.webhook-settings__input:focus,
	.webhook-settings__select:focus,
	.webhook-settings__textarea:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.webhook-settings__checkbox-label {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 38px;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-normal);
	}

	.webhook-settings__checkbox {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	.webhook-settings__hint {
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	.webhook-settings__status-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin-top: 12px;
		padding: 10px 14px;
		background: var(--background-secondary);
		border-radius: 6px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.webhook-settings__status-item strong {
		color: var(--text-normal);
	}

	/* ── Endpoints ── */

	.webhook-settings__endpoint {
		padding: 14px;
		margin-top: 12px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-secondary);
	}

	.endpoint--disabled {
		opacity: 0.65;
	}

	.webhook-settings__endpoint-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}

	.webhook-settings__endpoint-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}

	.webhook-settings__endpoint-name {
		font-weight: 600;
		font-size: 14px;
		color: var(--text-normal);
	}

	.webhook-settings__endpoint-url {
		font-size: 12px;
		color: var(--text-muted);
		font-family: monospace;
		word-break: break-all;
	}

	.webhook-settings__endpoint-events {
		font-size: 12px;
		color: var(--text-faint);
	}

	.webhook-settings__endpoint-meta {
		font-size: 11px;
		color: var(--text-faint);
		margin-top: 2px;
	}

	.webhook-settings__endpoint-actions {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	/* ── Event Grid ── */

	.webhook-settings__event-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 6px;
	}

	.webhook-settings__event-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 16px;
		font-size: 12px;
		cursor: pointer;
		background: var(--background-primary);
		color: var(--text-normal);
		transition: border-color 0.15s;
	}

	.webhook-settings__event-chip:hover {
		border-color: var(--interactive-accent);
	}

	.webhook-settings__event-chip input {
		width: 14px;
		height: 14px;
	}

	/* ── Buttons ── */

	.webhook-settings__btn {
		padding: 6px 14px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 13px;
		cursor: pointer;
		transition: background 0.15s;
	}

	.webhook-settings__btn:hover {
		background: var(--background-secondary);
	}

	.webhook-settings__btn--primary {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}

	.webhook-settings__btn--primary:hover {
		opacity: 0.9;
	}

	.webhook-settings__btn--danger {
		color: var(--text-error);
		border-color: var(--text-error);
	}

	.webhook-settings__btn--danger:hover {
		background: var(--text-error);
		color: white;
	}

	.webhook-settings__btn--outline {
		border-style: dashed;
		width: 100%;
		margin-top: 12px;
	}

	.webhook-settings__btn--sm {
		padding: 3px 10px;
		font-size: 12px;
	}

	.webhook-settings__btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.webhook-settings__actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}

	/* ── Collapse Toggle ── */

	.webhook-settings__collapse-toggle {
		all: unset;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-normal);
	}

	/* ── Subsections ── */

	.webhook-settings__subsection {
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid var(--background-modifier-border);
	}

	.webhook-settings__subsection h4 {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-muted);
		margin: 0 0 8px;
	}

	/* ── New Endpoint Form ── */

	.webhook-settings__new-endpoint {
		margin-top: 16px;
		padding: 14px;
		border: 1px dashed var(--interactive-accent);
		border-radius: 6px;
		background: var(--background-secondary);
	}

	.webhook-settings__new-endpoint h4 {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-normal);
	}

	/* ── Test Result ── */

	.webhook-settings__test-result {
		display: flex;
		gap: 12px;
		margin-top: 8px;
		padding: 6px 10px;
		border-radius: 4px;
		font-size: 12px;
	}

	.test-result--success {
		background: rgba(0, 200, 0, 0.1);
		color: var(--text-normal);
	}

	.test-result--error {
		background: rgba(200, 0, 0, 0.1);
		color: var(--text-error);
	}

	.webhook-settings__test-error {
		opacity: 0.8;
	}

	/* ── Log Table ── */

	.webhook-settings__log-actions {
		display: flex;
		gap: 6px;
		margin-bottom: 12px;
	}

	.webhook-settings__log-table-wrapper {
		overflow-x: auto;
		max-height: 400px;
		overflow-y: auto;
	}

	.webhook-settings__log-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	.webhook-settings__log-table th,
	.webhook-settings__log-table td {
		padding: 6px 8px;
		text-align: left;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.webhook-settings__log-table th {
		font-weight: 600;
		color: var(--text-muted);
		background: var(--background-secondary);
		position: sticky;
		top: 0;
	}

	.webhook-settings__status-badge {
		display: inline-block;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 500;
	}

	.status--success .webhook-settings__status-badge {
		background: rgba(0, 200, 0, 0.15);
		color: #0c0;
	}

	.status--error .webhook-settings__status-badge {
		background: rgba(200, 0, 0, 0.15);
		color: var(--text-error);
	}

	.status--pending .webhook-settings__status-badge {
		background: rgba(200, 200, 0, 0.15);
		color: orange;
	}

	.status--warning .webhook-settings__status-badge {
		background: rgba(255, 165, 0, 0.15);
		color: orange;
	}

	/* ── Error Banner ── */

	.webhook-settings__error-banner {
		padding: 10px 14px;
		background: rgba(200, 0, 0, 0.1);
		border: 1px solid var(--text-error);
		border-radius: 6px;
		color: var(--text-error);
		font-size: 13px;
	}

	/* ── Empty State ── */

	.webhook-settings__empty {
		color: var(--text-muted);
		font-size: 13px;
		text-align: center;
		padding: 20px;
	}

	/* ── Screen Reader Only ── */

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

	/* ── Responsive ── */

	@media (max-width: 600px) {
		.webhook-settings__endpoint-header {
			flex-direction: column;
		}
		.webhook-settings__endpoint-actions {
			flex-wrap: wrap;
		}
	}

	@media (prefers-contrast: high) {
		.webhook-settings__section,
		.webhook-settings__input,
		.webhook-settings__select,
		.webhook-settings__textarea {
			border-width: 2px;
		}
	}
</style>
