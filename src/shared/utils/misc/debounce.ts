/**
 * Debounce utility for delaying function execution
 * 
 * Returns a debounced version of the provided function that delays 
 * invoking func until after wait milliseconds have elapsed since 
 * the last time the debounced function was invoked.
 */

/**
 * Creates a debounced function that delays invoking func until after 
 * wait milliseconds have elapsed since the last time it was invoked.
 * 
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}
