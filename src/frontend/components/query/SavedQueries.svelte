<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface SavedQuery {
		id: string;
		name: string;
		description?: string;
		rulesCount: number;
		lastUsed?: string;
		createdDate: string;
		isFavorite: boolean;
	}

	interface Props {
		queries: SavedQuery[];
		className?: string;
	}

	const {
		queries = [],
		className = ''
	}: Props = $props();

	const dispatch = createEventDispatcher();

	let announcement = $state('');

	const favoriteQueries = $derived(queries.filter(q => q.isFavorite));
	const recentQueries = $derived(
		queries
			.filter(q => q.lastUsed)
			.sort((a, b) => new Date(b.lastUsed!).getTime() - new Date(a.lastUsed!).getTime())
			.slice(0, 5)
	);
	const allQueries = $derived(
		queries.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
	);

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${days} days ago`;
		if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
		
		return date.toLocaleDateString('en-US', { 
			month: 'short', 
			day: 'numeric', 
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
		});
	}

	function handleLoadQuery(query: SavedQuery) {
		dispatch('load', query);
		announcement = `Query "${query.name}" loaded`;
	}

	function handleEditQuery(query: SavedQuery) {
		dispatch('edit', query);
		announcement = `Editing query "${query.name}"`;
	}

	function handleDeleteQuery(query: SavedQuery) {
		dispatch('delete', query);
		announcement = `Query "${query.name}" deleted`;
	}

	function handleToggleFavorite(query: SavedQuery) {
		dispatch('toggleFavorite', query);
		announcement = query.isFavorite 
			? `Removed "${query.name}" from favorites` 
			: `Added "${query.name}" to favorites`;
	}

	function handleCreateNew() {
		dispatch('createNew');
		announcement = 'Creating new query';
	}
</script>

<div class="saved-queries {className}" role="region" aria-labelledby="saved-queries-title">
	<div class="queries-header">
		<h3 id="saved-queries-title">Saved Queries</h3>
		<button class="create-new-button" on:click={handleCreateNew}>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M8 4v8M4 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
			New Query
		</button>
	</div>

	<div class="queries-content">
		{#if queries.length === 0}
			<div class="empty-state" role="status">
				<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect x="12" y="20" width="40" height="32" rx="4" stroke="var(--text-muted)" stroke-width="2" opacity="0.3"/>
					<path d="M20 28h24M20 36h16M20 44h20" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
				</svg>
				<p>No saved queries yet</p>
				<p class="empty-hint">Create and save queries to reuse them later</p>
			</div>
		{:else}
			<!-- Favorites Section -->
			{#if favoriteQueries.length > 0}
				<section class="query-section" aria-labelledby="favorites-heading">
					<h4 id="favorites-heading" class="section-heading">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M8 2l2 5h5l-4 3.5L12 16l-4-3-4 3 1-5.5L1 7h5l2-5z" fill="var(--color-yellow)" stroke="var(--color-yellow)" stroke-width="1"/>
						</svg>
						Favorites
					</h4>
					<div class="query-list" role="list">
						{#each favoriteQueries as query (query.id)}
							<div class="query-card" role="listitem">
								<div class="query-info">
									<button
										class="query-name-button"
										on:click={() => handleLoadQuery(query)}
										aria-label="Load query: {query.name}"
									>
										{query.name}
									</button>
									{#if query.description}
										<p class="query-description">{query.description}</p>
									{/if}
									<div class="query-meta">
										<span class="meta-item">
											<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
												<rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1"/>
												<path d="M4 4h4M4 6h3M4 8h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
											</svg>
											{query.rulesCount} {query.rulesCount === 1 ? 'rule' : 'rules'}
										</span>
										{#if query.lastUsed}
											<span class="meta-item">Last used: {formatDate(query.lastUsed)}</span>
										{/if}
									</div>
								</div>

								<div class="query-actions">
									<button
										class="action-button favorite-button active"
										on:click={() => handleToggleFavorite(query)}
										aria-label="Remove from favorites"
										title="Remove from favorites"
									>
										<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M10 3l2 5h5l-4 3.5L14 17l-4-3-4 3 1-5.5L3 8h5l2-5z" fill="var(--color-yellow)" stroke="var(--color-yellow)" stroke-width="1.5"/>
										</svg>
									</button>
									<button
										class="action-button"
										on:click={() => handleEditQuery(query)}
										aria-label="Edit query: {query.name}"
										title="Edit"
									>
										<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M3 14v3h3l9-9-3-3-9 9zM14 4l2-2 3 3-2 2-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</button>
									<button
										class="action-button delete-button"
										on:click={() => handleDeleteQuery(query)}
										aria-label="Delete query: {query.name}"
										title="Delete"
									>
										<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M3 5h14M8 5V3h4v2M6 5v10a2 2 0 002 2h4a2 2 0 002-2V5H6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Recent Section -->
			{#if recentQueries.length > 0}
				<section class="query-section" aria-labelledby="recent-heading">
					<h4 id="recent-heading" class="section-heading">
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
							<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
							<path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
						</svg>
						Recently Used
					</h4>
					<div class="query-list" role="list">
						{#each recentQueries as query (query.id)}
							<div class="query-card" role="listitem">
								<div class="query-info">
									<button
										class="query-name-button"
										on:click={() => handleLoadQuery(query)}
										aria-label="Load query: {query.name}"
									>
										{query.name}
									</button>
									{#if query.description}
										<p class="query-description">{query.description}</p>
									{/if}
									<div class="query-meta">
										<span class="meta-item">
											<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
												<rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1"/>
												<path d="M4 4h4M4 6h3M4 8h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
											</svg>
											{query.rulesCount} {query.rulesCount === 1 ? 'rule' : 'rules'}
										</span>
										{#if query.lastUsed}
											<span class="meta-item">Last used: {formatDate(query.lastUsed)}</span>
										{/if}
									</div>
								</div>

								<div class="query-actions">
									<button
										class="action-button favorite-button"
										class:active={query.isFavorite}
										on:click={() => handleToggleFavorite(query)}
										aria-label={query.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
										title={query.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
									>
										<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M10 3l2 5h5l-4 3.5L14 17l-4-3-4 3 1-5.5L3 8h5l2-5z" fill={query.isFavorite ? 'var(--color-yellow)' : 'none'} stroke="currentColor" stroke-width="1.5"/>
										</svg>
									</button>
									<button
										class="action-button"
										on:click={() => handleEditQuery(query)}
										aria-label="Edit query: {query.name}"
										title="Edit"
									>
										<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M3 14v3h3l9-9-3-3-9 9zM14 4l2-2 3 3-2 2-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</button>
									<button
										class="action-button delete-button"
										on:click={() => handleDeleteQuery(query)}
										aria-label="Delete query: {query.name}"
										title="Delete"
									>
										<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M3 5h14M8 5V3h4v2M6 5v10a2 2 0 002 2h4a2 2 0 002-2V5H6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- All Queries Section -->
			<section class="query-section" aria-labelledby="all-heading">
				<h4 id="all-heading" class="section-heading">
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
					All Queries
				</h4>
				<div class="query-list" role="list">
					{#each allQueries as query (query.id)}
						<div class="query-card" role="listitem">
							<div class="query-info">
								<button
									class="query-name-button"
									on:click={() => handleLoadQuery(query)}
									aria-label="Load query: {query.name}"
								>
									{query.name}
								</button>
								{#if query.description}
									<p class="query-description">{query.description}</p>
								{/if}
								<div class="query-meta">
									<span class="meta-item">
										<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
											<rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1"/>
											<path d="M4 4h4M4 6h3M4 8h4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
										</svg>
										{query.rulesCount} {query.rulesCount === 1 ? 'rule' : 'rules'}
									</span>
									<span class="meta-item">Created: {formatDate(query.createdDate)}</span>
								</div>
							</div>

							<div class="query-actions">
								<button
									class="action-button favorite-button"
									class:active={query.isFavorite}
									on:click={() => handleToggleFavorite(query)}
									aria-label={query.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
									title={query.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
								>
									<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M10 3l2 5h5l-4 3.5L14 17l-4-3-4 3 1-5.5L3 8h5l2-5z" fill={query.isFavorite ? 'var(--color-yellow)' : 'none'} stroke="currentColor" stroke-width="1.5"/>
									</svg>
								</button>
								<button
									class="action-button"
									on:click={() => handleEditQuery(query)}
									aria-label="Edit query: {query.name}"
									title="Edit"
								>
									<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M3 14v3h3l9-9-3-3-9 9zM14 4l2-2 3 3-2 2-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								</button>
								<button
									class="action-button delete-button"
									on:click={() => handleDeleteQuery(query)}
									aria-label="Delete query: {query.name}"
									title="Delete"
								>
									<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
										<path d="M3 5h14M8 5V3h4v2M6 5v10a2 2 0 002 2h4a2 2 0 002-2V5H6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
									</svg>
								</button>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>

	<!-- Screen Reader Announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{announcement}
	</div>
</div>

<style>
	.saved-queries {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		background: var(--background-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
	}

	.queries-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.queries-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-normal);
	}

	.create-new-button {
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

	.create-new-button:hover {
		background: var(--interactive-accent-hover);
	}

	.create-new-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.queries-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		text-align: center;
		gap: 1rem;
	}

	.empty-state p {
		margin: 0;
		color: var(--text-muted);
	}

	.empty-hint {
		font-size: 0.875rem;
		opacity: 0.7;
	}

	.query-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section-heading {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border-color);
	}

	.query-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.query-card {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem;
		background: var(--background);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.query-card:hover {
		border-color: var(--interactive-accent);
		background: var(--background-modifier-hover);
	}

	.query-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.query-name-button {
		min-height: 44px;
		padding: 0.5rem;
		margin: -0.5rem;
		background: transparent;
		border: none;
		color: var(--text-normal);
		font-size: 1rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s ease;
		align-self: flex-start;
	}

	.query-name-button:hover {
		color: var(--interactive-accent);
		background: var(--background-modifier-hover);
	}

	.query-name-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.query-description {
		margin: 0;
		font-size: 0.875rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.query-meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.meta-item svg {
		flex-shrink: 0;
	}

	.query-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.action-button {
		min-width: 44px;
		min-height: 44px;
		padding: 0.5rem;
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-button:hover {
		background: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
		color: var(--text-normal);
	}

	.action-button:focus {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.favorite-button.active,
	.favorite-button.active:hover {
		color: var(--color-yellow);
		border-color: var(--color-yellow);
	}

	.delete-button:hover {
		background: var(--color-red);
		border-color: var(--color-red);
		color: white;
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
		.saved-queries,
		.create-new-button,
		.query-card,
		.action-button {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.create-new-button,
		.query-card,
		.query-name-button,
		.action-button {
			transition: none;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.saved-queries {
			padding: 1rem;
		}

		.queries-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.query-card {
			flex-direction: column;
		}

		.query-actions {
			align-self: flex-end;
		}
	}
</style>
