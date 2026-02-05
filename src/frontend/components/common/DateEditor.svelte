<script lang="ts">
    import { doAutocomplete } from "@shared/utils/dateTime/DateAbbreviations";
    import { parseTypedDateForDisplayUsingFutureDate } from "@shared/utils/dateTime/DateTools";
    import { labelContentWithAccessKey } from "@components/common/EditTaskHelpers";
    import { t, getTranslation } from '@stores/i18nStore';

    export let id: 'start' | 'scheduled' | 'due' | 'done' | 'created' | 'cancelled';
    export let dateSymbol: string;
    export let date: string;
    export let isDateValid: boolean;
    export let forwardOnly: boolean;
    export let accesskey: string | null;

    // Use this for testing purposes only
    export let parsedDate: string = '';

    let pickedDate = '';

    // Map date field IDs to translation keys
    const dateLabels: Record<string, string> = {
        start: 'dates.startDate',
        scheduled: 'dates.scheduledDate', 
        due: 'dates.dueDate',
        done: 'dates.doneDate',
        created: 'dates.createdDate',
        cancelled: 'dates.cancelledDate'
    };

    $: labelText = getTranslation(dateLabels[id] || id);

    $: {
        date = doAutocomplete(date);
        parsedDate = parseTypedDateForDisplayUsingFutureDate(id, date, forwardOnly);
        isDateValid = !parsedDate.includes('invalid');
        if (isDateValid) {
            pickedDate = parsedDate;
        }
    }

    function onDatePicked(e: Event) {
        if (e.target === null) {
            return;
        }
        date = pickedDate;
    }

    // 'weekend' abbreviation omitted due to lack of space.
    $: datePlaceholder = $t('dates.placeholder');
</script>

<label for={id}>{@html labelContentWithAccessKey(labelText, accesskey)}</label>
<!-- svelte-ignore a11y-accesskey -->
<input
    bind:value={date}
    {id}
    type="text"
    class:tasks-modal-error={!isDateValid}
    class="tasks-modal-date-input"
    placeholder={datePlaceholder}
    {accesskey}
/>

{#if isDateValid}
    <div class="tasks-modal-parsed-date">
        {dateSymbol}<input
            class="tasks-modal-date-editor-picker"
            type="date"
            bind:value={pickedDate}
            id="date-editor-picker"
            on:input={onDatePicked}
            tabindex="-1"
        />
    </div>
{:else}
    <code class="tasks-modal-parsed-date">{dateSymbol} {@html parsedDate}</code>
{/if}

<style>
</style>
