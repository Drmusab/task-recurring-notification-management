<script lang="ts">
    import { TASK_FORMATS } from "@shared/config/Settings";
    import { t, getTranslation } from '@stores/i18n.store';

    export let priority: string;
    export let withAccessKeys: boolean;

    $: accesskey = (key: string) => (withAccessKeys ? key : null);

    const { prioritySymbols } = TASK_FORMATS.tasksPluginEmoji.taskSerializer.symbols;

    // Priority options with translation keys
    const priorityOptions: {
        value: typeof priority;
        labelKey: string;
        symbol: string;
        accessKey: string;
        accessKeyIndex: number;
    }[] = [
        {
            value: 'lowest',
            labelKey: 'priority.lowest',
            symbol: prioritySymbols.Lowest,
            accessKey: 'o',
            accessKeyIndex: 1,
        },
        {
            value: 'low',
            labelKey: 'priority.low',
            symbol: prioritySymbols.Low,
            accessKey: 'l',
            accessKeyIndex: 0,
        },
        {
            value: 'none',
            labelKey: 'priority.normal',
            symbol: prioritySymbols.None,
            accessKey: 'n',
            accessKeyIndex: 0,
        },
        {
            value: 'medium',
            labelKey: 'priority.medium',
            symbol: prioritySymbols.Medium,
            accessKey: 'm',
            accessKeyIndex: 0,
        },
        {
            value: 'high',
            labelKey: 'priority.high',
            symbol: prioritySymbols.High,
            accessKey: 'h',
            accessKeyIndex: 0,
        },
        {
            value: 'highest',
            labelKey: 'priority.highest',
            symbol: prioritySymbols.Highest,
            accessKey: 'i',
            accessKeyIndex: 1,
        },
    ];
</script>

<label for="priority-{priority}" id="priority">{$t('priority.label')}</label>
{#each priorityOptions as { value, labelKey, symbol, accessKey, accessKeyIndex }}
    {@const label = getTranslation(labelKey)}
    <div class="task-modal-priority-option-container">
        <!-- svelte-ignore a11y-accesskey -->
        <input type="radio" id="priority-{value}" {value} bind:group={priority} accesskey={accesskey(accessKey)} />
        <label for="priority-{value}">
            {#if withAccessKeys}
                <span>{label.substring(0, accessKeyIndex)}</span><span class="accesskey"
                    >{label.substring(accessKeyIndex, accessKeyIndex + 1)}</span
                ><span>{label.substring(accessKeyIndex + 1)}</span>
            {:else}
                <span>{label}</span>
            {/if}
            {#if symbol && symbol.charCodeAt(0) >= 0x100}
                <span>{symbol}</span>
            {/if}
        </label>
    </div>
{/each}
