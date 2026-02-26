<script lang="ts">
    /**
     * Dependency Editor Component — Session 27 Refactored (DTO-driven)
     * 
     * BEFORE (violations):
     *   ❌ import { StatusRegistry } from '@shared/constants/statuses/StatusRegistry'
     *   ❌ StatusRegistry.getInstance().bySymbol() — domain singleton access
     *
     * AFTER (clean):
     *   ✅ TaskDTO from services/DTOs — no domain import
     *   ✅ Static status symbol lookup — no StatusRegistry
     *   ✅ Local editableTask array mutation — persistence via parent onSubmit
     *   ✅ No direct TaskService calls (parent routes through UITaskMutationService)
     */
    import { computePosition, flip, offset, shift, size } from '@floating-ui/dom';
    import type { TaskDTO } from '../../services/DTOs';
    type Task = TaskDTO;
    import { labelContentWithAccessKey } from "@components/shared/utils/taskEditHelpers";
    import { t } from '@stores/I18n.store';

    /**
     * Local dependency search helper — replaces missing dependencyHelpers module.
     * Filters allTasks by description match, excluding the current task and existing dependencies.
     */
    function searchForCandidateTasksForDependency(
        query: string,
        allTasks: Task[],
        currentTask: Task,
        blockedBy: Task[],
        blocking: Task[],
    ): Task[] {
        const lowerQuery = query.toLowerCase();
        const excludeIds = new Set([
            currentTask.id,
            ...blockedBy.map(t => t.id),
            ...blocking.map(t => t.id),
        ]);
        return allTasks.filter(t =>
            !excludeIds.has(t.id) &&
            (t.name?.toLowerCase().includes(lowerQuery) || !query)
        ).slice(0, 20);
    }

    /**
     * Local description helper — replaces missing dependencyHelpers module.
     * Returns a display-safe task description for dependency search results.
     */
    function descriptionAdjustedForDependencySearch(task: Task): string {
        const name = task.name || '';
        // Truncate long descriptions for display
        return name.length > 80 ? name.substring(0, 80) + '...' : name;
    }

    export let task: Task;
    /**
     * Reactive adapter object from TaskEditModal — NOT the deleted EditableTask class.
     * Typed as any for adapter compatibility (has blockedBy/blocking arrays via getter/setter).
     */
    export let editableTask: any;
    export let allTasks: Task[];
    export let _onDescriptionKeyDown: (e: KeyboardEvent) => void;
    export let id: string;
    export let type: 'blocking' | 'blockedBy';
    export let labelText: string;
    export let accesskey: string | null;
    export let placeholder: string = 'Type to search...';

    let search: string = '';
    let searchResults: Task[] | null = null;
    let searchIndex: number | null = 0;
    let inputWidth: number;
    let inputFocused = false;
    let showDropdown = false;

    let input: HTMLElement;
    let dropdown: HTMLElement;

    /**
     * Get status symbol from task DTO — static lookup, no StatusRegistry.
     * Uses statusSymbol field if present, falls back to status-based inference.
     */
    function getStatusSymbol(task: Task): string {
        if ((task as any).statusSymbol) return (task as any).statusSymbol;
        switch (task.status) {
            case 'done': return 'x';
            case 'cancelled': return '-';
            case 'doing': return '/';
            default: return ' ';
        }
    }

    function addTask(task: Task) {
        editableTask[type] = [...editableTask[type], task];
        search = '';
        inputFocused = false;
    }

    function removeTask(task: Task) {
        editableTask[type] = editableTask[type].filter((item: any) => item !== task);
    }

    function taskKeydown(e: KeyboardEvent) {
        if (searchResults === null) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (!!searchIndex && searchIndex > 0) {
                    searchIndex -= 1;
                } else {
                    searchIndex = searchResults.length - 1;
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (!!searchIndex && searchIndex < searchResults.length - 1) {
                    searchIndex += 1;
                } else {
                    searchIndex = 0;
                }
                break;
            case 'Enter':
                if (e.isComposing) return;

                if (searchIndex !== null && searchResults && searchResults[searchIndex]) {
                    e.preventDefault();
                    const selectedTask = searchResults[searchIndex];
                    if (selectedTask) {
                        addTask(selectedTask);
                    }
                    searchIndex = null;
                    inputFocused = false;
                } else {
                    _onDescriptionKeyDown(e);
                }
                break;
            default:
                searchIndex = 0;
                break;
        }
        searchIndex && dropdown?.getElementsByTagName('li')[searchIndex]?.scrollIntoView({ block: 'nearest' });
    }

    function generateSearchResults(search: string) {
        if (!search && !showDropdown) return [];

        showDropdown = false;
        return searchForCandidateTasksForDependency(
            search,
            allTasks,
            task,
            editableTask.blockedBy,
            editableTask.blocking,
        );
    }

    function onFocused() {
        inputFocused = true;
        showDropdown = true;
    }

    function positionDropdown(input: HTMLElement, dropdown: HTMLElement) {
        if (!input || !dropdown) return;

        computePosition(input, dropdown, {
            middleware: [
                offset(6),
                shift(),
                flip(),
                size({
                    apply() {
                        dropdown && Object.assign(dropdown.style, { width: `${inputWidth}px` });
                    },
                }),
            ],
        }).then(({ x, y }) => {
            dropdown.style.left = `${x}px`;
            dropdown.style.top = `${y}px`;
        });
    }

    function displayPath(path: string) {
        return path === task.path ? '' : path;
    }

    function descriptionTooltipText(task: Task) {
        return descriptionAdjustedForDependencySearch(task);
    }

    function showDescriptionTooltip(element: HTMLElement, text: string) {
        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip', 'pop-up');
        tooltip.innerText = text;
        // Mount inside SiYuan container (Phase 4 §4.5 compliant)
        const container = element.closest('.dock__panel') || element.closest('.layout__center') || element.closest('#layouts') || element.parentElement!;
        container.appendChild(tooltip);

        computePosition(element, tooltip, {
            placement: 'top',
            middleware: [offset(-18), shift()],
        }).then(({ x, y }) => {
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        });

        element.addEventListener('mouseleave', () => tooltip.remove());
    }

    $: {
        positionDropdown(input, dropdown);
    }

    $: {
        searchResults = inputFocused ? generateSearchResults(search) : null;
    }
</script>

<label for={type}>{@html labelContentWithAccessKey(labelText, accesskey)}</label>
<!-- svelte-ignore a11y-accesskey -->
<span bind:clientWidth={inputWidth}>
    <input
        bind:this={input}
        bind:value={search}
        on:keydown={(e) => taskKeydown(e)}
        on:focus={onFocused}
        on:blur={() => (inputFocused = false)}
        {accesskey}
        {id}
        class="tasks-modal-dependency-input"
        type="text"
        {placeholder}
    />
</span>
{#if searchResults && searchResults.length !== 0}
    <ul class="task-dependency-dropdown" role="listbox" bind:this={dropdown} on:mouseleave={() => (searchIndex = null)}>
        {#each searchResults as searchTask, index}
            {@const filepath = displayPath(searchTask.path || '')}
            <li
                role="option"
                tabindex="0"
                aria-selected={search !== null && index === searchIndex}
                on:mousedown={() => addTask(searchTask)}
                on:click={() => addTask(searchTask)}
                on:keydown={(e) => e.key === 'Enter' && addTask(searchTask)}
                class:selected={search !== null && index === searchIndex}
                on:mouseenter={() => (searchIndex = index)}
            >
                <div
                    role="button"
                    tabindex="-1"
                    class={filepath ? 'dependency-name-shared' : 'dependency-name'}
                    on:mouseenter={(e) => showDescriptionTooltip(e.currentTarget, descriptionTooltipText(searchTask))}
                >
                    [{getStatusSymbol(searchTask)}] {descriptionAdjustedForDependencySearch(searchTask)}
                </div>
                {#if filepath}
                    <div
                        role="tooltip"
                        tabindex="-1"
                        class="dependency-path"
                        on:mouseenter={(e) => showDescriptionTooltip(e.currentTarget, filepath)}
                    >
                        {filepath}
                    </div>
                {/if}
            </li>
        {/each}
    </ul>
{/if}
{#if editableTask[type].length !== 0}
    <div class="task-dependencies-container results-dependency">
        {#each editableTask[type] as task}
            <div
                role="listitem"
                tabindex="-1"
                class="task-dependency"
                on:mouseenter={(e) => showDescriptionTooltip(e.currentTarget, descriptionTooltipText(task))}
            >
                <span class="task-dependency-name"
                    >[{getStatusSymbol(task)}] {descriptionAdjustedForDependencySearch(task)}</span
                >

                <button on:click={() => removeTask(task)} type="button" class="task-dependency-delete" aria-label={$t('dependencies.remove')}>
                    <svg
                        style="display: block; margin: auto;"
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="lucide lucide-x"
                        aria-hidden="true"
                    >
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                </button>
            </div>
        {/each}
    </div>
{/if}
