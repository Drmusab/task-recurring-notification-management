<script lang="ts">
    import { TASK_FORMATS } from "@shared/config/Settings";
    import type { EditableTask } from "@components/common/EditableTask";
    import { labelContentWithAccessKey } from "@components/common/EditTaskHelpers";
    import RecurrencePreview from "@components/common/RecurrencePreview.svelte";
    import type { Frequency } from '@backend/core/models/Frequency';
    import { t } from '@stores/i18n.store';

    export let editableTask: EditableTask;
    export let isRecurrenceValid: boolean;
    export let accesskey: string | null;

    let parsedRecurrence: string;
    let parsedFrequency: Frequency | null = null;

    $: ({ parsedRecurrence, isRecurrenceValid } = editableTask.parseAndValidateRecurrence());
    
    // Extract frequency from recurrence rule for preview
    $: {
        if (editableTask.recurrenceRule && isRecurrenceValid) {
            try {
                parsedFrequency = parseRecurrenceToFrequency(editableTask.recurrenceRule);
            } catch {
                parsedFrequency = null;
            }
        } else {
            parsedFrequency = null;
        }
    }

    const { recurrenceSymbol } = TASK_FORMATS.tasksPluginEmoji.taskSerializer.symbols;
    
    /**
     * Parse recurrence rule text to Frequency object
     * This is a simplified parser - matches common patterns
     */
    function parseRecurrenceToFrequency(rule: string): Frequency | null {
        const ruleLower = rule.toLowerCase().trim();
        
        if (ruleLower.includes('every day') || ruleLower === 'daily') {
            return { type: 'daily', interval: 1 };
        }
        
        if (ruleLower.includes('every week') || ruleLower === 'weekly') {
            return { type: 'weekly', interval: 1, daysOfWeek: [new Date().getDay()] };
        }
        
        if (ruleLower.includes('every month') || ruleLower === 'monthly') {
            return { type: 'monthly', interval: 1, dayOfMonth: new Date().getDate() };
        }
        
        if (ruleLower.includes('every year') || ruleLower === 'yearly') {
            return { type: 'yearly', interval: 1, month: new Date().getMonth(), dayOfMonth: new Date().getDate() };
        }
        
        // Check for interval patterns like "every 2 days"
        const intervalMatch = ruleLower.match(/every\s+(\d+)\s+(day|week|month|year)s?/);
        if (intervalMatch) {
            const interval = parseInt(intervalMatch[1]);
            const unit = intervalMatch[2];
            
            switch (unit) {
                case 'day':
                    return { type: 'daily', interval };
                case 'week':
                    return { type: 'weekly', interval, daysOfWeek: [new Date().getDay()] };
                case 'month':
                    return { type: 'monthly', interval, dayOfMonth: new Date().getDate() };
                case 'year':
                    return { type: 'yearly', interval, month: new Date().getMonth(), dayOfMonth: new Date().getDate() };
            }
        }
        
        // If we can't parse it, mark as custom
        if (ruleLower.length > 0) {
            return { type: 'custom', rrule: rule };
        }
        
        return null;
    }
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
{#if isRecurrenceValid && parsedFrequency && parsedFrequency.type !== 'once'}
    <RecurrencePreview 
        frequency={parsedFrequency} 
        startDate={editableTask.dueDate || editableTask.scheduledDate || new Date().toISOString()} 
        previewCount={5}
    />
{/if}
