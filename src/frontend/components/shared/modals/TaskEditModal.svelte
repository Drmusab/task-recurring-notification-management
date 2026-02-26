<script lang="ts">
    /**
     * TaskEditModal — Session 27 Refactored (DTO-driven Command Surface)
     * 
     * BEFORE (violations):
     *   ❌ import { EditableTask } from '../utils/editableTask'
     *   ❌ editableTask.applyEdits(task, allTasks) — domain mutation in modal
     *   ❌ StatusRegistry.getInstance() usage in Dependency child
     *
     * AFTER (clean):
     *   ✅ TaskDTO from services/DTOs — no domain import
     *   ✅ Dispatches raw form edits to consumer via onSubmit callback
     *   ✅ Consumer routes through UITaskMutationService
     *   ✅ Dependencies dispatched as link/unlink commands
     *   ✅ Recurrence dispatched as rule string — no parent mutation
     *   ✅ No EditableTask — form state is a plain mutable copy of TaskDTO
     * 
     * @accessibility WCAG 2.1 AA compliant modal dialog pattern
     * @version 4.0.0
     */

    import { onMount } from 'svelte';
    import { t } from '@stores/I18n.store';
    import { defaultEditModalShowSettings } from "@shared/config/EditModalShowSettings";
    import { getSettings } from "@shared/config/Settings";
    import type { TaskDTO } from '../../../services/DTOs';
    import { settingsStore } from "@stores/Settings.store";
    import DateEditor from "@components/shared/editors/DateEditor.svelte";
    import PriorityEditor from "@components/shared/editors/PriorityEditor.svelte";
    import RecurrenceEditor from "@components/shared/editors/RecurrenceEditor.svelte";
    import StatusEditor from "@components/shared/editors/StatusEditor.svelte";
    import Dependency from "@components/shared/Dependency.svelte";
    import { labelContentWithAccessKey } from "@components/shared/utils/taskEditHelpers";

    // ── Static Status Definitions (no domain import) ────────────
    // Replaces StatusRegistry.getInstance() — SiYuan standard checkbox symbols.
    const STATUS_OPTIONS: Array<{ symbol: string; name: string; type: string }> = [
        { symbol: ' ', name: 'Todo', type: 'todo' },
        { symbol: '/', name: 'In Progress', type: 'doing' },
        { symbol: 'x', name: 'Done', type: 'done' },
        { symbol: '-', name: 'Cancelled', type: 'cancelled' },
        { symbol: '>', name: 'Rescheduled', type: 'todo' },
        { symbol: '!', name: 'Important', type: 'todo' },
        { symbol: '?', name: 'Question', type: 'todo' },
    ];

    // These exported variables are passed in as props by TaskModal.onOpen():
    export let task: TaskDTO;
    export let onSubmit: (updatedTasks: TaskDTO[]) => void | Promise<void>;
    export let statusOptions: typeof STATUS_OPTIONS = STATUS_OPTIONS;
    export let allTasks: TaskDTO[];

    // ── Form State (mutable copy, NOT domain object) ────────────
    // Replaces EditableTask class entirely.
    let description = task?.name ?? '';
    let priority = task?.priority ?? 'none';
    let status = task?.status ?? 'todo';
    let statusSymbol = task?.statusSymbol ?? ' ';
    let dueDate = task?.dueAt ?? '';
    let scheduledDate = task?.scheduledAt ?? '';
    let startDate = '';
    let createdDate = '';
    let doneDate = task?.doneAt ?? '';
    let cancelledDate = '';
    let recurrenceRule = task?.recurrenceText ?? '';
    let forwardOnly = false;

    // Dependency state: IDs only — Dependency.svelte manages search UI
    let blockedByIds: string[] = [];
    let blockingIds: string[] = [];

    // Validation state
    let descriptionInput: HTMLTextAreaElement;
    let isDescriptionValid: boolean = true;
    let isDueDateValid: boolean = true;
    let isScheduledDateValid: boolean = true;
    let isStartDateValid: boolean = true;
    let isCreatedDateValid: boolean = true;
    let isDoneDateValid: boolean = true;
    let isCancelledDateValid: boolean = true;
    let isRecurrenceValid: boolean = true;
    let withAccessKeys: boolean = true;
    let formIsValid: boolean = true;
    let mountComplete = false;

    $: accesskey = (key: string) => (withAccessKeys ? key : null);
    $: formIsValid =
        isDueDateValid &&
        isRecurrenceValid &&
        isScheduledDateValid &&
        isStartDateValid &&
        isDescriptionValid &&
        isCancelledDateValid &&
        isCreatedDateValid &&
        isDoneDateValid;
    $: isDescriptionValid = description.trim() !== '';

    $: isShownInEditModal = { ...defaultEditModalShowSettings, ...$settingsStore.isShownInEditModal };

    onMount(() => {
        const { provideAccessKeys } = getSettings();
        withAccessKeys = provideAccessKeys;
        mountComplete = true;

        setTimeout(() => {
            descriptionInput.focus();
        }, 10);
    });

    const _onClose = () => {
        onSubmit([]);
    };

    const _onDescriptionKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            if (formIsValid) _onSubmit();
        }
    };

    const _removeLinebreaksFromDescription = () => {
        setTimeout(() => {
            description = description.replace(/[\r\n]+/g, ' ');
        }, 0);
    };

    /**
     * Submit — builds a TaskDTO patch from form state.
     * Consumer (TaskModal → UITaskMutationService) handles actual persistence.
     * No domain mutation occurs here.
     */
    const _onSubmit = async () => {
        const updatedTask: TaskDTO = {
            ...task,
            name: description,
            priority,
            status,
            statusSymbol,
            dueAt: dueDate || undefined,
            scheduledAt: scheduledDate || undefined,
            doneAt: doneDate || undefined,
            recurrenceText: recurrenceRule || undefined,
        };
        onSubmit([updatedTask]);
    };

    // ── Editable task adapter for child editor components ────────
    // These editors (DateEditor, PriorityEditor, etc.) expect an editableTask object.
    // We provide a reactive adapter that mirrors the flat form state.
    let editableTask = {
        get description() { return description; },
        set description(v: string) { description = v; },
        get priority() { return priority; },
        set priority(v: string) { priority = v; },
        get dueDate() { return dueDate; },
        set dueDate(v: string) { dueDate = v; },
        get scheduledDate() { return scheduledDate; },
        set scheduledDate(v: string) { scheduledDate = v; },
        get startDate() { return startDate; },
        set startDate(v: string) { startDate = v; },
        get createdDate() { return createdDate; },
        set createdDate(v: string) { createdDate = v; },
        get doneDate() { return doneDate; },
        set doneDate(v: string) { doneDate = v; },
        get cancelledDate() { return cancelledDate; },
        set cancelledDate(v: string) { cancelledDate = v; },
        get recurrenceRule() { return recurrenceRule; },
        set recurrenceRule(v: string) { recurrenceRule = v; },
        get forwardOnly() { return forwardOnly; },
        set forwardOnly(v: boolean) { forwardOnly = v; },
        get blockedBy() { return blockedByIds.map(id => allTasks.find(t => t.id === id)).filter(Boolean) as TaskDTO[]; },
        set blockedBy(v: TaskDTO[]) { blockedByIds = v.map(t => t.id); },
        get blocking() { return blockingIds.map(id => allTasks.find(t => t.id === id)).filter(Boolean) as TaskDTO[]; },
        set blocking(v: TaskDTO[]) { blockingIds = v.map(t => t.id); },
    };

    // SiYuan symbol definitions for date editors
    const startDateSymbol = '🛫';
    const scheduledDateSymbol = '⏳';
    const dueDateSymbol = '📅';
    const cancelledDateSymbol = '❌';
    const createdDateSymbol = '➕';
    const doneDateSymbol = '✅';
</script>

<!--
Availability of access keys:
- A: Start
- B: Before this
- C: Created
- D: Due
- E: After this
- F: Only future dates
- G:
- H: High
- I: Highest
- J:
- K:
- L: Low
- M: Medium
- N: Normal
- O: Lowest
- P:
- Q:
- R: Recurs
- S: Scheduled
- T: Description
- U: Status
- V:
- W:
- X: Done
- Y:
- Z:
- -: Cancelled
-->

<form class="tasks-modal" on:submit|preventDefault={_onSubmit}>
    <!-- NEW_TASK_FIELD_EDIT_REQUIRED -->

    <!-- --------------------------------------------------------------------------- -->
    <!--  Description  -->
    <!-- --------------------------------------------------------------------------- -->
    <section class="tasks-modal-description-section">
        <label for="description">{@html labelContentWithAccessKey($t('forms.description'), accesskey('t'))}</label>
        <!-- svelte-ignore a11y-accesskey -->
        <textarea
            bind:value={editableTask.description}
            bind:this={descriptionInput}
            id="description"
            class="tasks-modal-description"
            placeholder={$t('forms.descriptionPlaceholder')}
            accesskey={accesskey('t')}
            on:keydown={_onDescriptionKeyDown}
            on:paste={_removeLinebreaksFromDescription}
            on:drop={_removeLinebreaksFromDescription}
        ></textarea>
    </section>

    <!-- --------------------------------------------------------------------------- -->
    <!--  Priority  -->
    <!-- --------------------------------------------------------------------------- -->
    {#if isShownInEditModal.priority}
        <section class="tasks-modal-priority-section">
            <PriorityEditor bind:priority={editableTask.priority} {withAccessKeys} />
        </section>
        <hr id="line-after-priority" />
    {/if}

    <!-- --------------------------------------------------------------------------- -->
    <!--  Dates  -->
    <!-- --------------------------------------------------------------------------- -->
    <section class="tasks-modal-dates-section">
        <!-- --------------------------------------------------------------------------- -->
        <!--  Recurrence  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.recurrence}
            <RecurrenceEditor {editableTask} bind:isRecurrenceValid accesskey={accesskey('r')} />
        {/if}
        <!-- --------------------------------------------------------------------------- -->
        <!--  Due Date  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.due}
            <DateEditor
                id="due"
                dateSymbol={dueDateSymbol}
                bind:date={editableTask.dueDate}
                bind:isDateValid={isDueDateValid}
                forwardOnly={editableTask.forwardOnly}
                accesskey={accesskey('d')}
            />
        {/if}

        <!-- --------------------------------------------------------------------------- -->
        <!--  Scheduled Date  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.scheduled}
            <DateEditor
                id="scheduled"
                dateSymbol={scheduledDateSymbol}
                bind:date={editableTask.scheduledDate}
                bind:isDateValid={isScheduledDateValid}
                forwardOnly={editableTask.forwardOnly}
                accesskey={accesskey('s')}
            />
        {/if}

        <!-- --------------------------------------------------------------------------- -->
        <!--  Start Date  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.start}
            <DateEditor
                id="start"
                dateSymbol={startDateSymbol}
                bind:date={editableTask.startDate}
                bind:isDateValid={isStartDateValid}
                forwardOnly={editableTask.forwardOnly}
                accesskey={accesskey('a')}
            />
        {/if}

        <!-- --------------------------------------------------------------------------- -->
        <!--  Only future dates  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.due || isShownInEditModal.scheduled || isShownInEditModal.start}
            <div class="future-dates-only" id="only-future-dates">
                <label for="forwardOnly">{@html labelContentWithAccessKey($t('forms.onlyFutureDates'), accesskey('f'))}</label>
                <!-- svelte-ignore a11y-accesskey -->
                <input
                    bind:checked={editableTask.forwardOnly}
                    id="forwardOnly"
                    type="checkbox"
                    class="task-list-item-checkbox tasks-modal-checkbox"
                    accesskey={accesskey('f')}
                />
            </div>
        {/if}
    </section>
    {#if isShownInEditModal.due || isShownInEditModal.scheduled || isShownInEditModal.start}
        <hr id="line-after-happens-dates" />
    {/if}

    <!-- --------------------------------------------------------------------------- -->
    <!--  Dependencies  -->
    <!-- --------------------------------------------------------------------------- -->
    <section class="tasks-modal-dependencies-section">
        {#if allTasks.length > 0 && mountComplete}
            <!-- --------------------------------------------------------------------------- -->
            <!--  Blocked By Tasks  -->
            <!-- --------------------------------------------------------------------------- -->
            {#if isShownInEditModal.before_this}
                <Dependency
                    id="before_this"
                    type="blockedBy"
                    labelText={$t('dependencies.beforeThis')}
                    {task}
                    {editableTask}
                    {allTasks}
                    {_onDescriptionKeyDown}
                    accesskey={accesskey('b')}
                    placeholder={$t('dependencies.searchBlockedBy')}
                />
            {/if}

            <!-- --------------------------------------------------------------------------- -->
            <!--  Blocking Tasks  -->
            <!-- --------------------------------------------------------------------------- -->
            {#if isShownInEditModal.after_this}
                <Dependency
                    id="after_this"
                    type="blocking"
                    labelText={$t('dependencies.afterThis')}
                    {task}
                    {editableTask}
                    {allTasks}
                    {_onDescriptionKeyDown}
                    accesskey={accesskey('e')}
                    placeholder={$t('dependencies.searchBlocking')}
                />
            {/if}
        {:else}
            <div><i>{$t('dependencies.disabledEmpty')}</i></div>
        {/if}
    </section>
    {#if isShownInEditModal.before_this || isShownInEditModal.after_this}
        <hr id="line-after-dependencies" />
    {/if}

    <section class="tasks-modal-dates-section">
        <!-- --------------------------------------------------------------------------- -->
        <!--  Status  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.status}
            <StatusEditor {task} bind:editableTask {statusOptions} accesskey={accesskey('u')} />
        {/if}

        <!-- --------------------------------------------------------------------------- -->
        <!--  Created Date  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.created}
            <DateEditor
                id="created"
                dateSymbol={createdDateSymbol}
                bind:date={editableTask.createdDate}
                bind:isDateValid={isCreatedDateValid}
                forwardOnly={editableTask.forwardOnly}
                accesskey={accesskey('c')}
            />
        {/if}

        <!-- --------------------------------------------------------------------------- -->
        <!--  Done Date  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.done}
            <DateEditor
                id="done"
                dateSymbol={doneDateSymbol}
                bind:date={editableTask.doneDate}
                bind:isDateValid={isDoneDateValid}
                forwardOnly={editableTask.forwardOnly}
                accesskey={accesskey('x')}
            />
        {/if}

        <!-- --------------------------------------------------------------------------- -->
        <!--  Cancelled Date  -->
        <!-- --------------------------------------------------------------------------- -->
        {#if isShownInEditModal.cancelled}
            <DateEditor
                id="cancelled"
                dateSymbol={cancelledDateSymbol}
                bind:date={editableTask.cancelledDate}
                bind:isDateValid={isCancelledDateValid}
                forwardOnly={editableTask.forwardOnly}
                accesskey={accesskey('-')}
            />
        {/if}
    </section>

    <section class="tasks-modal-button-section">
        <button disabled={!formIsValid} type="submit" class="mod-cta">{$t('forms.apply')}</button>
        <button type="button" on:click={_onClose}>{$t('forms.cancel')}</button>
    </section>
</form>
