<script lang="ts">
  /**
   * Tags and Category Editor
   * 
   * Allows users to:
   * - Add/remove tags for task organization
   * - Set task category for grouping
   */
  import { t } from '@stores/i18nStore';
  
  export let tags: string[] = [];
  export let category: string = '';
  export let onChange: (tags: string[], category: string) => void;
  
  let newTag = '';
  let showTagInput = false;
  
  /**
   * Add new tag
   */
  function addTag() {
    const trimmed = newTag.trim().replace(/^#/, ''); // Remove leading # if present
    
    if (!trimmed) return;
    
    if (tags.includes(trimmed)) {
      alert('Tag already exists');
      return;
    }
    
    tags = [...tags, trimmed];
    onChange(tags, category);
    
    newTag = '';
    showTagInput = false;
  }
  
  /**
   * Remove tag
   */
  function removeTag(tag: string) {
    tags = tags.filter(t => t !== tag);
    onChange(tags, category);
  }
  
  /**
   * Update category
   */
  function updateCategory(event: Event) {
    const target = event.target as HTMLInputElement;
    category = target.value;
    onChange(tags, category);
  }
  
  /**
   * Handle tag input keydown
   */
  function handleTagKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    } else if (event.key === 'Escape') {
      showTagInput = false;
      newTag = '';
    }
  }
</script>

<section class="tasks-modal-tags-section">
  <div class="tags-category-row">
    <!-- Tags -->
    <div class="tags-column">
      <label for="tags-container">{$t('tags.label')}</label>
      <div class="tags-container" id="tags-container">
        {#each tags as tag}
          <div class="tag-item">
            <span class="tag-text">#{tag}</span>
            <button class="tag-remove" on:click={() => removeTag(tag)} title={$t('tags.remove')}>
              ×
            </button>
          </div>
        {/each}
        
        {#if showTagInput}
          <input
            type="text"
            bind:value={newTag}
            on:keydown={handleTagKeydown}
            on:blur={() => { if (!newTag.trim()) showTagInput = false; }}
            placeholder={$t('tags.placeholder')}
            class="tag-input"
            aria-label={$t('tags.newTagAria')}
          />
        {:else}
          <button class="add-tag-btn" on:click={() => showTagInput = true}>
            {$t('tags.add')}
          </button>
        {/if}
      </div>
    </div>
    
    <!-- Category -->
    <div class="category-column">
      <label for="task-category">{$t('tags.categoryLabel')}</label>
      <input
        id="task-category"
        type="text"
        bind:value={category}
        on:input={updateCategory}
        placeholder={$t('tags.categoryPlaceholder')}
        class="category-input"
      />
    </div>
  </div>
</section>

<style>
  .tasks-modal-tags-section {
    margin-top: 1em;
    padding: 1em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
  }
  
  .tags-category-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.5em;
  }
  
  .tags-column label,
  .category-column label {
    display: block;
    margin-bottom: 0.5em;
    font-weight: 500;
  }
  
  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
    align-items: center;
  }
  
  .tag-item {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    padding: 0.3em 0.6em;
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    border-radius: 12px;
    font-size: 0.9em;
  }
  
  .tag-text {
    color: var(--text-accent);
  }
  
  .tag-remove {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1.2em;
    line-height: 1;
    padding: 0;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .tag-remove:hover {
    color: var(--text-error);
  }
  
  .tag-input {
    padding: 0.3em 0.6em;
    border: 1px solid var(--interactive-accent);
    border-radius: 12px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 0.9em;
    min-width: 120px;
  }
  
  .tag-input:focus {
    outline: none;
    border-color: var(--interactive-accent-hover);
  }
  
  .add-tag-btn {
    padding: 0.3em 0.8em;
    background: transparent;
    border: 1px dashed var(--background-modifier-border);
    border-radius: 12px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.9em;
  }
  
  .add-tag-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--text-accent);
  }
  
  .category-input {
    width: 100%;
    padding: 0.5em;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
  }
  
  .category-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  
  @media (max-width: 768px) {
    .tags-category-row {
      grid-template-columns: 1fr;
    }
  }
</style>
