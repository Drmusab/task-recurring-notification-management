<script lang="ts">
  /**
   * ErrorBoundary Component for Svelte 5
   * 
   * Catches errors in child components and displays a fallback UI.
   * While Svelte 5 doesn't have built-in error boundaries like React,
   * this component provides a graceful degradation strategy.
   * 
   * Note: For full error boundary support, wrap components that might throw
   * and handle errors at the component level with try-catch.
   */
  
  export let fallback: string = 'Something went wrong';
  export let onErrorCallback: ((error: Error) => void) | undefined = undefined;
  export let showDetails: boolean = true;
  export let allowRetry: boolean = true;
  
  let hasError = false;
  let errorMessage = '';
  let errorStack = '';
  let showStackTrace = false;
  
  // Store original error handler
  let originalErrorHandler: ((event: ErrorEvent) => void) | null = null;
  
  // Set up global error handler for this boundary
  if (typeof window !== 'undefined') {
    originalErrorHandler = window.onerror as any;
    window.addEventListener('error', handleError);
  }
  
  function handleError(event: ErrorEvent) {
    console.error('[ErrorBoundary] Caught error:', event.error);
    
    hasError = true;
    errorMessage = event.error?.message || event.message || 'Unknown error';
    errorStack = event.error?.stack || '';
    
    // Call custom error callback if provided
    if (onErrorCallback) {
      try {
        onErrorCallback(event.error);
      } catch (callbackError) {
        console.error('[ErrorBoundary] Error in error callback:', callbackError);
      }
    }
    
    // Prevent default error handling
    event.preventDefault();
  }
  
  function retry() {
    hasError = false;
    errorMessage = '';
    errorStack = '';
    showStackTrace = false;
  }
  
  function reload() {
    window.location.reload();
  }
  
  // Cleanup on component destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('error', handleError);
    }
  });
</script>

{#if hasError}
  <div class="error-boundary" role="alert" aria-live="assertive">
    <div class="error-boundary__icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    </div>
    
    <div class="error-boundary__content">
      <h3 class="error-boundary__title">{fallback}</h3>
      
      {#if showDetails}
        <p class="error-boundary__message">{errorMessage}</p>
        
        {#if errorStack}
          <details class="error-boundary__details">
            <summary>
              <button 
                type="button"
                class="error-boundary__toggle"
                onclick={() => showStackTrace = !showStackTrace}
              >
                {showStackTrace ? 'Hide' : 'Show'} technical details
              </button>
            </summary>
            {#if showStackTrace}
              <pre class="error-boundary__stack"><code>{errorStack}</code></pre>
            {/if}
          </details>
        {/if}
      {/if}
      
      <div class="error-boundary__actions">
        {#if allowRetry}
          <button 
            type="button"
            class="error-boundary__button error-boundary__button--primary"
            onclick={retry}
          >
            Try Again
          </button>
        {/if}
        
        <button 
          type="button"
          class="error-boundary__button error-boundary__button--secondary"
          onclick={reload}
        >
          Reload Page
        </button>
      </div>
    </div>
  </div>
{:else}
  <slot />
{/if}

<style>
  .error-boundary {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    padding: 2rem;
    background: var(--b3-theme-surface, #ffffff);
    border: 1px solid var(--b3-theme-error, #ef4444);
    border-radius: 8px;
    text-align: center;
  }
  
  .error-boundary__icon {
    color: var(--b3-theme-error, #ef4444);
    margin-bottom: 1rem;
  }
  
  .error-boundary__content {
    max-width: 600px;
  }
  
  .error-boundary__title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--b3-theme-on-surface, #1f2937);
    margin: 0 0 0.5rem;
  }
  
  .error-boundary__message {
    color: var(--b3-theme-on-surface-secondary, #6b7280);
    margin: 0 0 1rem;
    font-size: 0.875rem;
  }
  
  .error-boundary__details {
    margin: 1rem 0;
    text-align: left;
  }
  
  .error-boundary__toggle {
    background: none;
    border: none;
    color: var(--b3-theme-primary, #3b82f6);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.5rem 0;
    text-decoration: underline;
  }
  
  .error-boundary__toggle:hover {
    color: var(--b3-theme-primary-light, #60a5fa);
  }
  
  .error-boundary__stack {
    background: var(--b3-theme-surface-variant, #f3f4f6);
    border: 1px solid var(--b3-theme-outline, #d1d5db);
    border-radius: 4px;
    padding: 1rem;
    overflow-x: auto;
    font-size: 0.75rem;
    line-height: 1.4;
    margin-top: 0.5rem;
    max-height: 300px;
  }
  
  .error-boundary__stack code {
    color: var(--b3-theme-error, #ef4444);
  }
  
  .error-boundary__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 1.5rem;
  }
  
  .error-boundary__button {
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .error-boundary__button--primary {
    background: var(--b3-theme-primary, #3b82f6);
    color: var(--b3-theme-on-primary, #ffffff);
  }
  
  .error-boundary__button--primary:hover {
    background: var(--b3-theme-primary-hover, #2563eb);
  }
  
  .error-boundary__button--secondary {
    background: transparent;
    color: var(--b3-theme-on-surface, #1f2937);
    border: 1px solid var(--b3-theme-outline, #d1d5db);
  }
  
  .error-boundary__button--secondary:hover {
    background: var(--b3-theme-surface-variant, #f3f4f6);
  }
</style>
