<script lang="ts">
    /**
     * OptionsEditorModal Component
     * WCAG 2.1 AA Compliant
     * 
     * Modal content for editing task edit modal field visibility options
     * 
     * @accessibility
     * - Fieldset with legend for grouped checkboxes
     * - Proper label associations  
     * - Keyboard navigation (Enter/Space on checkboxes, Escape to close)
     * - 44x44px minimum touch targets for buttons
     * - ARIA live region for state changes
     * - High contrast mode support
     */
    
    import { onMount } from 'svelte';
    import { defaultEditModalShowSettings } from "@shared/config/EditModalShowSettings";
    import { settingsStore } from "@stores/Settings.store";
    import { t } from '@stores/I18n.store';

    export let onSave: () => void;
    export let onClose: () => void;

    // Create a reactive object for the options
    // Forced to use any here instead of EditModalShowSettings. Otherwise there is a compiler error at
    // <input type="checkbox" checked={options[fieldName]} /> below. This is solved in Svelte 5.
    let options: any = { ...defaultEditModalShowSettings, ...$settingsStore.isShownInEditModal };

    let firstCheckbox: HTMLInputElement | undefined;
    let announcementText = '';

    const onChange = (fieldName: string) => (event: Event) => {
        options[fieldName] = (event.target as HTMLInputElement).checked;
        const action = options[fieldName] ? 'enabled' : 'disabled';
        announcementText = `${formatFieldName(fieldName)} ${action}`;
    };

    const _onSave = () => {
        $settingsStore.isShownInEditModal = options;
        announcementText = 'Options saved';
        setTimeout(() => onSave(), 100); // Delay to allow announcement
    };

    const _onClose = () => {
        onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            _onClose();
        }
    };

    // Helper to format field names for display
    const formatFieldName = (fieldName: string): string => {
        return fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace('_', ' ');
    };

    const withLinesAfterFields = ['priority', 'start', 'after_this'];

    onMount(() => {
        // Focus first checkbox on mount
        if (firstCheckbox) {
            firstCheckbox.focus();
        }
    });
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="tasks-options-modal" role="dialog" aria-labelledby="options-modal-title">
    <h2 id="options-modal-title" class="tasks-options-modal-title">
        Edit Modal Field Settings
    </h2>
    <p class="tasks-options-modal-description">
        Choose which fields to show in the task edit modal
    </p>

    <fieldset class="tasks-options-modal-checkboxes">
        <legend class="sr-only">Field visibility options</legend>
        {#each Object.keys(options) as fieldName, index}
            <label class="tasks-options-modal-label">
                {#if index === 0}
                    <input
                        type="checkbox"
                        checked={options[fieldName]}
                        id={fieldName}
                        class="tasks-options-modal-checkbox"
                        on:change={onChange(fieldName)}
                        bind:this={firstCheckbox}
                    />
                {:else}
                    <input
                        type="checkbox"
                        checked={options[fieldName]}
                        id={fieldName}
                        class="tasks-options-modal-checkbox"
                        on:change={onChange(fieldName)}
                    />
                {/if}
                <span class="tasks-options-modal-label-text">{formatFieldName(fieldName)}</span>
            </label>

            {#if withLinesAfterFields.includes(fieldName)}
                <hr class="tasks-options-modal-divider" />
            {/if}
        {/each}
    </fieldset>

    <div class="tasks-options-modal-footer">
        <button
            type="button"
            class="tasks-options-modal-button tasks-options-modal-button--primary"
            on:click={_onSave}
        >
            {$t('forms.apply')}
        </button>
        <button
            type="button"
            class="tasks-options-modal-button tasks-options-modal-button--secondary"
            on:click={_onClose}
        >
            {$t('forms.cancel')}
        </button>
    </div>

    <!-- ARIA live region for announcements -->
    <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcementText}
    </div>
</div>

<style>
    .tasks-options-modal {
        padding: 1.5rem;
        max-width: 500px;
        margin: 0 auto;
    }

    .tasks-options-modal-title {
        margin: 0 0 0.5rem 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-normal, #333);
    }

    .tasks-options-modal-description {
        margin: 0 0 1.5rem 0;
        font-size: 0.875rem;
        color: var(--text-muted, #666);
    }

    .tasks-options-modal-checkboxes {
        border: none;
        padding: 0;
        margin: 0 0 1.5rem 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .tasks-options-modal-label {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
        /* WCAG 2.5.5 Target Size - Minimum 44x44px */
        min-height: 44px;
        padding: 0.5rem;
        border-radius: 6px;
        transition: background-color 0.2s ease;
    }

    .tasks-options-modal-label:hover {
        background-color: var(--background-modifier-hover, #f5f5f5);
    }

    .tasks-options-modal-checkbox {
        /* WCAG 2.5.5 Target Size */
        min-width: 20px;
        min-height: 20px;
        margin: 0;
        cursor: pointer;
    }

    /* WCAG 2.4.7 Focus Visible */
    .tasks-options-modal-checkbox:focus-visible {
        outline: 2px solid var(--interactive-accent, #1976d2);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
    }

    .tasks-options-modal-label-text {
        font-size: 0.9375rem;
        color: var(--text-normal, #333);
        user-select: none;
    }

    .tasks-options-modal-divider {
        border: none;
        border-top: 1px solid var(--background-modifier-border, #e0e0e0);
        margin: 0.5rem 0;
    }

    .tasks-options-modal-footer {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
        padding-top: 1rem;
        border-top: 1px solid var(--background-modifier-border, #e0e0e0);
    }

    .tasks-options-modal-button {
        /* WCAG 2.5.5 Target Size - Minimum 44x44px */
        min-height: 44px;
        min-width: 100px;
        padding: 0.625rem 1.25rem;
        border: 1px solid transparent;
        border-radius: 6px;
        font-family: inherit;
        font-size: 0.9375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .tasks-options-modal-button--primary {
        background: var(--interactive-accent, #1976d2);
        color: #ffffff;
        border-color: var(--interactive-accent, #1976d2);
    }

    .tasks-options-modal-button--primary:hover {
        background: var(--interactive-accent-hover, #1565c0);
        border-color: var(--interactive-accent-hover, #1565c0);
    }

    .tasks-options-modal-button--secondary {
        background: var(--background-primary, #fff);
        color: var(--text-normal, #333);
        border-color: var(--background-modifier-border, #ccc);
    }

    .tasks-options-modal-button--secondary:hover {
        background: var(--background-modifier-hover, #f5f5f5);
        border-color: var(--interactive-accent, #1976d2);
    }

    /* WCAG 2.4.7 Focus Visible */
    .tasks-options-modal-button:focus-visible {
        outline: 2px solid var(--interactive-accent, #1976d2);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.2);
    }

    /* WCAG 1.4.11 Non-text Contrast - High contrast mode */
    @media (prefers-contrast: high) {
        .tasks-options-modal-checkbox,
        .tasks-options-modal-button {
            border-width: 2px;
        }

        .tasks-options-modal-divider {
            border-top-width: 2px;
        }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .tasks-options-modal-label,
        .tasks-options-modal-button {
            transition: none;
        }
    }

    /* Screen reader only */
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
    }
</style>
