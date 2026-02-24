<script lang="ts">
    /**
     * Recurrence Editor Component
     * 
     * Allows entering recurrence rules using natural language or RRULE syntax.
     * Shows preview of next occurrences when valid.
     */
    import { TASK_FORMATS } from "@shared/config/Settings";
    import type { EditableTask } from "@components/shared/utils/editableTask";
    import { labelContentWithAccessKey } from "@components/shared/utils/taskEditHelpers";
    import RecurrencePreview from "@components/shared/editors/RecurrencePreview.svelte";
    import { parseRecurrenceRule } from '@domain/index';
    import type { Frequency } from '@domain/index';
    import { t } from '@stores/I18n.store';

    export let editableTask: EditableTask;
    export let isRecurrenceValid: boolean;
    export let accesskey: string | null;

    let parsedRecurrence: string;
    let parsedFrequency: Frequency | null = null;

    // Parse and validate recurrence using EditableTask helper
    $: ({ parsedRecurrence, isRecurrenceValid } = editableTask.parseAndValidateRecurrence());
    
    // Parse frequency from recurrence rule for preview using domain parser
    $: {
        if (editableTask.recurrenceRule && isRecurrenceValid) {
            parsedFrequency = parseRecurrenceRule(editableTask.recurrenceRule);
        } else {
            parsedFrequency = null;
        }
    }

    const { recurrenceSymbol } = TASK_FORMATS.tasksPluginEmoji.taskSerializer.symbols;
</script>

<label for="recurrence">{@html labelContentWithAccessKey($t('recurrence.label'), accesskey)}</label>
<!-- svelte-ignore a11y-accesskey -->
<input
    bind:value={editableTask.recurrenceRule}
    id="recurrence"
    type="text"
    class:tasks-modal-error={!isRecurrenceValid}
    class="tasks-modal-date-input"
    placeholder={$t('recurrence.placeholder')}
    {accesskey}
/>
<code class="tasks-modal-parsed-date">{recurrenceSymbol} {@html parsedRecurrence}</code>

<!-- Recurrence Preview -->
{#if isRecurrenceValid && parsedFrequency}
    <RecurrencePreview 
        frequency={parsedFrequency} 
        startDate={editableTask.dueDate || editableTask.scheduledDate || new Date().toISOString()} 
        previewCount={5}
    />
{/if}
