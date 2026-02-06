<script lang="ts">
    import type { TasksDate } from "@shared/utils/dateTime/tasks-date";
    import type { Status } from "@shared/types/Status";
    import type { Task } from "@shared/utils/task/Task";
    import type { EditableTask } from "@components/common/EditableTask";
    import { labelContentWithAccessKey } from "@components/common/EditTaskHelpers";
    import { t } from '@stores/i18n.store';

    export let task: Task;
    export let editableTask: EditableTask;
    export let statusOptions: Status[];
    export let accesskey: string | null;

    let statusSymbol = task.status.symbol;

    function setStatusRelatedDate(currentValue: string, isInStatus: boolean, editedValue: TasksDate) {
        const dateFieldIsEmpty = currentValue === '';

        if (isInStatus && dateFieldIsEmpty) {
            // the date field is empty and the status was set (set the date from the task with the applied status)
            return editedValue.formatAsDate();
        }

        if (!isInStatus && !dateFieldIsEmpty) {
            // the date field is not empty but another status was set (clean the date field)
            return '';
        }

        return currentValue;
    }

    const _onStatusChange = () => {
        // Use statusSymbol to find the status to save to editableTask.status
        const selectedStatus: Status | undefined = statusOptions.find((s) => s.symbol === statusSymbol);
        if (selectedStatus) {
            editableTask.status = selectedStatus;
        } else {
            // Status not found — this shouldn't happen but is recoverable
            return;
        }

        // Obtain a temporary task with the new status applied, to see what would
        // happen to the done date:
        const taskWithEditedStatusApplied = task.handleNewStatus(selectedStatus).pop();

        if (taskWithEditedStatusApplied) {
            editableTask.doneDate = setStatusRelatedDate(
                editableTask.doneDate,
                selectedStatus.isCompleted(),
                taskWithEditedStatusApplied.done,
            );

            editableTask.cancelledDate = setStatusRelatedDate(
                editableTask.cancelledDate,
                selectedStatus.isCancelled(),
                taskWithEditedStatusApplied.cancelled,
            );
        }
    };
</script>

<label for="status" id="status">{@html labelContentWithAccessKey($t('status.label'), accesskey)}</label>
<!-- svelte-ignore a11y-accesskey -->
<select
    bind:value={statusSymbol}
    on:change={_onStatusChange}
    id="status-type"
    class="status-editor-status-selector"
    {accesskey}
>
    {#each statusOptions as status}
        <option value={status.symbol}>{status.name} [{status.symbol}]</option>
    {/each}
</select>
