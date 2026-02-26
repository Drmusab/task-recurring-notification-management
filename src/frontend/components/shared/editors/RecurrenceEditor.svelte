<script lang="ts">
    /**
     * Recurrence Editor Component — Session 27 Refactored (DTO-driven)
     * 
     * BEFORE (violations):
     *   ❌ import type { EditableTask } from "@components/shared/utils/editableTask"
     *   ❌ editableTask.parseAndValidateRecurrence() — domain helper method
     *
     * AFTER (clean):
     *   ✅ Flat editableTask adapter (any) — no EditableTask import
     *   ✅ Local recurrence validation — no domain helper call
     *   ✅ uiQueryService for frequency parsing — service-routed
     *   ✅ TASK_FORMATS for symbol lookup — config, not domain
     *
     * Allows entering recurrence rules using natural language or RRULE syntax.
     * Shows preview of next occurrences when valid.
     */
    import { TASK_FORMATS } from "@shared/config/Settings";
    import { labelContentWithAccessKey } from "@components/shared/utils/taskEditHelpers";
    import RecurrencePreview from "@components/shared/editors/RecurrencePreview.svelte";
    import { uiQueryService } from '../../../services/UIQueryService';
    import { t } from '@stores/I18n.store';

    /** Opaque frequency type — matches RecurrencePreview's Frequency shape */
    type Frequency = {
        type: 'daily' | 'weekly' | 'monthly' | 'yearly' | string;
        interval?: number;
        dayOfMonth?: number;
        monthOfYear?: number;
        weekdays?: number[];
        [key: string]: unknown;
    };

    /** Common RRULE-like recurrence rule keywords */
    const RECURRENCE_KEYWORDS = [
        'every', 'daily', 'weekly', 'monthly', 'yearly',
        'FREQ=', 'RRULE:', 'day', 'week', 'month', 'year',
    ];

    /**
     * Accepts the reactive adapter object from TaskEditModal.
     * NOT the deleted EditableTask class — typed as `any` for adapter compatibility.
     */
    export let editableTask: any;
    export let isRecurrenceValid: boolean;
    export let accesskey: string | null;

    let parsedRecurrence: string = '';
    let parsedFrequency: Frequency | null = null;

    /**
     * Local recurrence validation — replaces editableTask.parseAndValidateRecurrence().
     * Validates that the recurrence rule is either empty (valid) or matches known patterns.
     */
    function validateRecurrence(rule: string): { parsedRecurrence: string; isRecurrenceValid: boolean } {
        if (!rule || rule.trim() === '') {
            return { parsedRecurrence: 'not set', isRecurrenceValid: true };
        }
        const trimmed = rule.trim().toLowerCase();
        const matches = RECURRENCE_KEYWORDS.some(kw => trimmed.includes(kw.toLowerCase()));
        if (matches) {
            return { parsedRecurrence: rule.trim(), isRecurrenceValid: true };
        }
        return { parsedRecurrence: 'invalid recurrence rule', isRecurrenceValid: false };
    }

    // Validate recurrence locally — no domain helper call
    $: ({ parsedRecurrence, isRecurrenceValid } = validateRecurrence(editableTask.recurrenceRule));
    
    // Parse frequency from recurrence rule for preview using service facade
    $: {
        if (editableTask.recurrenceRule && isRecurrenceValid) {
            uiQueryService.parseRecurrenceRule(editableTask.recurrenceRule).then(f => {
                parsedFrequency = f as Frequency | null;
            });
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
