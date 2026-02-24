<script lang="ts">
    /**
     * Status Editor Component
     * 
     * Allows selecting task status from dropdown.
     * Updates completion/cancellation dates automatically based on status.
     */
    import { Status } from "@shared/constants/statuses/Status";
    import type { Task } from "@backend/core/models/Task";
    import type { EditableTask } from "@components/shared/utils/editableTask";
    import { labelContentWithAccessKey } from "@components/shared/utils/taskEditHelpers";
    import { t } from '@stores/I18n.store';

    export let task: Task;
    export let editableTask: EditableTask;
    export let statusOptions: Status[];
    export let accesskey: string | null;

    let statusSymbol = task.status ? editableTask.status?.symbol || ' ' : ' ';

    /**
     * Handle status change and auto-update related date fields
     */
    function handleStatusChange() {
        const selectedStatus = statusOptions.find((s) => s.symbol === statusSymbol);
        if (!selectedStatus) return;
        
        editableTask.status = selectedStatus;

        // Auto-fill dates based on status transition
        const today = new Date().toISOString().split('T')[0] || '';

        if (selectedStatus.isCompleted()) {
            // Set done date if empty, clear cancelled date
            if (!editableTask.doneDate) {
                editableTask.doneDate = today;
            }
            editableTask.cancelledDate = '';
        } else if (selectedStatus.isCancelled()) {
            // Set cancelled date if empty, clear done date
            if (!editableTask.cancelledDate) {
                editableTask.cancelledDate = today;
            }
            editableTask.doneDate = '';
        } else {
            // Clear both completion dates for active statuses
            editableTask.doneDate = '';
            editableTask.cancelledDate = '';
        }
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
