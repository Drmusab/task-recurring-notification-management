<script lang="ts">
  /**
   * Recurrence Preview Component
   * 
   * Shows the next N occurrences of a recurring task.
   * Helps users verify their recurrence rule is correct.
   */
  
  import type { Frequency } from '@backend/core/models/Frequency';
  import moment from 'moment';
  import { t, getTranslation } from '@stores/i18nStore';
  
  export let frequency: Frequency | null = null;
  export let startDate: string | null = null;
  export let previewCount: number = 5;
  
  $: nextOccurrences = frequency ? calculateNextOccurrences(frequency, startDate, previewCount) : [];
  
  /**
   * Calculate next N occurrences based on frequency
   */
  function calculateNextOccurrences(freq: Frequency, start: string | null, count: number): string[] {
    if (!freq || freq.type === 'once') return [];
    
    const results: string[] = [];
    const baseDate = start ? moment(start) : moment();
    let current = baseDate.clone();
    
    for (let i = 0; i < count; i++) {
      switch (freq.type) {
        case 'daily':
          current.add(freq.interval || 1, 'days');
          break;
          
        case 'weekly':
          current.add((freq.interval || 1) * 7, 'days');
          break;
          
        case 'monthly':
          current.add(freq.interval || 1, 'months');
          if (freq.dayOfMonth) {
            current.date(freq.dayOfMonth);
          }
          break;
          
        case 'yearly':
          current.add(freq.interval || 1, 'years');
          if (freq.month !== undefined) {
            current.month(freq.month);
          }
          if (freq.dayOfMonth) {
            current.date(freq.dayOfMonth);
          }
          break;
          
        case 'custom':
          // For custom rrule, we'd need an rrule parser
          // For now, just show a message
          results.push(getTranslation('recurrence.customPreviewNotAvailable'));
          return results;
          
        default:
          return results;
      }
      
      results.push(current.format('ddd, MMM D, YYYY'));
    }
    
    return results;
  }
  
  /**
   * Get human-readable frequency description
   */
  function getFrequencyDescription(freq: Frequency): string {
    if (!freq) return getTranslation('recurrence.noRecurrence');
    
    const interval = freq.interval || 1;
    const suffix = interval > 1 ? `every ${interval}` : '';
    
    switch (freq.type) {
      case 'daily':
        return interval > 1 
          ? getTranslation('recurrence.everyNDays').replace('{n}', String(interval)) 
          : getTranslation('recurrence.daily');
      case 'weekly':
        return interval > 1 
          ? getTranslation('recurrence.everyNWeeks').replace('{n}', String(interval)) 
          : getTranslation('recurrence.weekly');
      case 'monthly':
        return interval > 1 
          ? getTranslation('recurrence.everyNMonths').replace('{n}', String(interval)) 
          : getTranslation('recurrence.monthly');
      case 'yearly':
        return interval > 1 
          ? getTranslation('recurrence.everyNYears').replace('{n}', String(interval)) 
          : getTranslation('recurrence.yearly');
      case 'custom':
        return `${getTranslation('recurrence.custom')}: ${freq.rrule || getTranslation('recurrence.noRuleDefined')}`;
      case 'once':
        return getTranslation('recurrence.oneTime');
      default:
        return getTranslation('recurrence.unknown');
    }
  }
</script>

{#if frequency && frequency.type !== 'once'}
  <div class="recurrence-preview">
    <div class="preview-header">
      <span class="preview-icon">🔁</span>
      <span class="preview-title">{$t('recurrence.nextOccurrences').replace('{count}', String(previewCount))}</span>
      <span class="preview-pattern">{getFrequencyDescription(frequency)}</span>
    </div>
    
    {#if nextOccurrences.length > 0}
      <ol class="occurrences-list">
        {#each nextOccurrences as occurrence, index}
          <li class="occurrence-item">
            <span class="occurrence-number">{index + 1}.</span>
            <span class="occurrence-date">{occurrence}</span>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="no-preview">{$t('recurrence.unableToCalculate')}</p>
    {/if}
  </div>
{/if}

<style>
  .recurrence-preview {
    margin-top: 0.75em;
    padding: 1em;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    border-left: 3px solid var(--interactive-accent);
  }
  
  .preview-header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 0.75em;
    font-weight: 500;
  }
  
  .preview-icon {
    font-size: 1.1em;
  }
  
  .preview-title {
    color: var(--text-normal);
  }
  
  .preview-pattern {
    margin-left: auto;
    font-size: 0.9em;
    color: var(--text-muted);
    font-style: italic;
  }
  
  .occurrences-list {
    margin: 0;
    padding-left: 0;
    list-style: none;
  }
  
  .occurrence-item {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.4em 0;
    border-bottom: 1px solid var(--background-modifier-border-hover);
  }
  
  .occurrence-item:last-child {
    border-bottom: none;
  }
  
  .occurrence-number {
    color: var(--text-muted);
    font-size: 0.9em;
    min-width: 25px;
  }
  
  .occurrence-date {
    color: var(--text-accent);
    font-weight: 500;
  }
  
  .no-preview {
    color: var(--text-muted);
    font-style: italic;
    margin: 0;
  }
</style>
