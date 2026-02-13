<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
	type TaskPriority = 'critical' | 'high' | 'medium' | 'low' | null;

	interface Task {
		id: string;
		title: string;
		status: TaskStatus;
		priority: TaskPriority;
		tags: string[];
		dueDate?: string;
		createdDate: string;
		completedDate?: string;
	}

	interface Props {
		tasks: Task[];
		isLoading?: boolean;
		error?: string;
		className?: string;
	}

	const {
		tasks = [],
		isLoading = false,
		error = '',
		className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher();

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		
		return date.toLocaleDateString('en-US', { 
			month: 'short', 
			day: 'numeric', 
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
		});
	}

	function getPriorityLabel(priority: TaskPriority): string {
		if (!priority) return 'None';
		return priority.charAt(0).toUpperCase() + priority.slice(1);
	}

	function getPriorityColor(priority: TaskPriority): string {
		switch (priority) {
			case 'critical': return 'var(--color-red)';
			case 'high': return 'var(--color-orange)';
			case 'medium': return 'var(--color-yellow)';
			case 'low': return 'var(--color-blue)';
			default: return 'var(--text-muted)';
		}
	}

	function getStatusLabel(status: TaskStatus): string {
		return status.split('-').map(word => 
			word.charAt(0).toUpperCase() + word.slice(1)
		).join(' ');
	}

	function handleTaskClick(task: Task) {
		dispatch('taskClick', task);
	}

	function handleExport() {
		dispatch('export', tasks);
	}
</script>

<div class="query-preview {className}" role="region" aria-labelledby="preview-title">
	<div class="preview-header">
		<h3 id="preview-title">
			Query Results
			{#if !isLoading && !error}
				<span class="result-count">({tasks.length} {tasks.length === 1 ? 'task' : 'tasks'})</span>
			{/if}
		</h3>

		{#if tasks.length > 0 && !isLoading}
			<button class="export-button" on:click={handleExport} aria-label="Export {tasks.length} tasks">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M8 12V4m0 8l-3-3m3 3l3-3M2 12v2h12v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				Export
			</button>
		{/if}
	</div>

	<div class="preview-content">
		{#if isLoading}
			<div class="loading-state" role="status">
				<div class="spinner" aria-label="Loading results"></div>
				<p>Loading results...</p>
			</div>
		{:else if error}
			<div class="error-state" role="alert">
				<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="24" cy="24" r="20" stroke="var(--color-red)" stroke-width="2"/>
					<path d="M24 16v12M24 32v2" stroke="var(--color-red)" stroke-width="2" stroke-linecap="round"/>
				</svg>
				<p class="error-message">{error}</p>
			</div>
		{:else if tasks.length === 0}
			<div class="empty-state" role="status">
				<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="32" cy="32" r="28" stroke="var(--text-muted)" stroke-width="2" opacity="0.3"/>
					<path d="M20 32h24M32 20v24" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
				</svg>
				<p>No tasks match this query</p>
				<p class="empty-hint">Try adjusting your filter rules</p>
			</div>
		{:else}
			<div class="tasks-list" role="list" aria-label="Query results">
				{#each tasks as task (task.id)}
					<div role="listitem">
						<button
							class="task-card"
							on:click={() => handleTaskClick(task)}
							aria-label="Open task: {task.title}, Status: {getStatusLabel(task.status)}, Priority: {getPriorityLabel(task.priority)}"
						>
						<div class="task-header">
							<h4 class="task-title">{task.title}</h4>
							<span 
								class="priority-badge" 
								style="color: {getPriorityColor(task.priority)}"
								aria-label="Priority: {getPriorityLabel(task.priority)}"
							>
								{getPriorityLabel(task.priority)}
							</span>
						</div>

						<div class="task-meta">
							<span class="status-badge status-{task.status}">
								{getStatusLabel(task.status)}
							</span>

							{#if task.tags.length > 0}
								<div class="task-tags" aria-label="Tags: {task.tags.join(', ')}">
									{#each task.tags.slice(0, 3) as tag}
										<span class="tag">{tag}</span>
									{/each}
									{#if task.tags.length > 3}
										<span class="tag-overflow">+{task.tags.length - 3}</span>
									{/if}
								</div>
							{/if}
						</div>

						<div class="task-footer">
							{#if task.dueDate}
								<span class="date-info">
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
										<rect x="2" y="3" width="8" height="7" rx="1" stroke="currentColor" stroke-width="1"/>
										<path d="M4 1v2M8 1v2M2 5h8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
									</svg>
									Due: {formatDate(task.dueDate)}
								</span>
							{/if}

							<span class="date-info">
								<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
									<circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1"/>
									<path d="M6 3v3l2 2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
								</svg>
								Created: {formatDate(task.createdDate)}
							</span>
						</div>
					</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.query-preview {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border-color);
	}

	.preview-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-normal);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.result-count {
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--text-muted);
	}

	.export-button {
		min-width: 44px;
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
		gap: 0.5rem;
		transition: all 0.2s ease;
	}

	.export-button:hover {
		background: var(--interactive-accent-hover);
	}

	.export-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.preview-content {
		min-height: 300px;
		display: flex;
		flex-direction: column;
	}

	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		text-align: center;
		gap: 1rem;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 3px solid var(--background-modifier-border);
		border-top-color: var(--interactive-accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-state p,
	.error-state p,
	.empty-state p {
		margin: 0;
		color: var(--text-muted);
	}

	.error-message {
		color: var(--color-red) !important;
		font-weight: 500;
	}

	.empty-hint {
		font-size: 0.875rem;
		opacity: 0.7;
	}

	.tasks-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.task-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--background);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 44px;
	}

	.task-card:hover {
		border-color: var(--interactive-accent);
		background: var(--background-modifier-hover);
	}

	.task-card:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px var(--interactive-accent-hover);
	}

	.task-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.task-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-normal);
		flex: 1;
	}

	.priority-badge {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		background: currentColor;
		color: white;
		opacity: 0.9;
		flex-shrink: 0;
	}

	.task-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.status-badge {
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.status-pending {
		background: rgba(150, 150, 150, 0.2);
	}

	.status-in-progress {
		background: rgba(66, 133, 244, 0.2);
		color: var(--color-blue);
	}

	.status-completed {
		background: rgba(52, 168, 83, 0.2);
		color: var(--color-green);
	}

	.status-cancelled {
		background: rgba(255, 82, 82, 0.2);
		color: var(--color-red);
	}

	.task-tags {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tag {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-radius: 4px;
		opacity: 0.8;
	}

	.tag-overflow {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-weight: 500;
	}

	.task-footer {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.date-info {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.date-info svg {
		flex-shrink: 0;
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.query-preview,
		.task-card,
		.export-button {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.task-card,
		.export-button {
			transition: none;
		}

		.spinner {
			animation: none;
			border-top-color: var(--background-modifier-border);
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.query-preview {
			padding: 1rem;
		}

		.preview-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.task-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
