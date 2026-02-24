/**
 * Debounce Utility
 * 
 * Delays the execution of a function until after a specified wait time has elapsed
 * since the last time it was invoked. Useful for rate-limiting rapid calls like
 * search input changes or resize events.
 * 
 * @example
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching for:', query);
 * }, 300);
 * 
 * // Will only execute once after user stops typing for 300ms
 * debouncedSearch('hello');
 * debouncedSearch('hello world');
 * debouncedSearch('hello world!');
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Creates a debounced async function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * Returns a Promise that resolves with the result of the last invocation.
 * 
 * @param func - The async function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the async function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: ((value: any) => void) | null = null;
  let pendingReject: ((error: any) => void) | null = null;
  
  return function executedFunction(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      if (timeout !== null) {
        clearTimeout(timeout);
        // Reject previous pending promise
        if (pendingReject) {
          pendingReject(new Error('Debounced call cancelled'));
        }
      }
      
      pendingResolve = resolve;
      pendingReject = reject;
      
      timeout = setTimeout(async () => {
        timeout = null;
        try {
          const result = await func(...args);
          if (pendingResolve) {
            pendingResolve(result);
          }
        } catch (error) {
          if (pendingReject) {
            pendingReject(error);
          }
        } finally {
          pendingResolve = null;
          pendingReject = null;
        }
      }, wait);
    });
  };
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 * Unlike debounce, throttle guarantees execution at regular intervals.
 * 
 * @param func - The function to throttle
 * @param wait - The number of milliseconds to throttle invocations to
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastRan: number | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        if (Date.now() - (lastRan || 0) >= wait) {
          func(...args);
          lastRan = Date.now();
        }
      }, Math.max(wait - (Date.now() - lastRan), 0));
    }
  };
}
