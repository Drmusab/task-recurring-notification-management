<script lang="ts">
    /**
     * Status Editor Component — Session 27 Refactored (DTO-driven)
     * 
     * BEFORE: Imported Status class with isCompleted()/isCancelled() methods
     * AFTER: Accepts plain status option objects, uses static type check
     * 
     * No domain imports. No EditableTask dependency.
     */
    import type { TaskDTO } from '../../../services/DTOs';
    import { labelContentWithAccessKey } from "@components/shared/utils/taskEditHelpers";
    import { t } from '@stores/I18n.store';

    /** Plain status option — no Status class methods */
    interface StatusOption {
        symbol: string;
        name: string;
        type?: string;
    }

    export let task: TaskDTO;
    export let editableTask: any;
    export let statusOptions: StatusOption[];
    export let accesskey: string | null;

    let statusSymbol = task?.statusSymbol || ' ';

    /**
     * Handle status change and auto-update related date fields.
     * Uses static type detection instead of domain Status methods.
     */
    function handleStatusChange() {
        const selected = statusOptions.find((s) => s.symbol === statusSymbol);
        if (!selected) return;

        if (editableTask.status !== undefined) {
            editableTask.status = selected;
        }

        // Auto-fill dates based on status transition (static type check)
        const today = new Date().toISOString().split('T')[0] || '';
        const statusType = selected.type ?? inferStatusType(selected.symbol);

        if (statusType === 'done' || statusType === 'DONE') {
            if (!editableTask.doneDate) editableTask.doneDate = today;
            editableTask.cancelledDate = '';
        } else if (statusType === 'cancelled' || statusType === 'CANCELLED') {
            if (!editableTask.cancelledDate) editableTask.cancelledDate = today;
            editableTask.doneDate = '';
        } else {
            editableTask.doneDate = '';
            editableTask.cancelledDate = '';
        }
    }

    /** Infer status type from symbol (fallback if type not provided) */
    function inferStatusType(symbol: string): string {
        if (symbol === 'x') return 'done';
        if (symbol === '-') return 'cancelled';
        return 'todo';
    }
</script>

<label for="status" id="status">{@html labelContentWithAccessKey($t('status.label'), accesskey)}</label>
<!-- svelte-ignore a11y-accesskey -->
<select
    bind:value={statusSymbol}
    on:change={handleStatusChange}
    id="status-type"
    class="status-editor-status-selector"
    {accesskey}
>
    {#each statusOptions as status}
        <option value={status.symbol}>{status.name} [{status.symbol}]</option>
    {/each}
</select>
