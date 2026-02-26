/**
 * debounceUtils — Runtime-Safe Debounce for Backend Services
 *
 * Provides debounce/throttle primitives for backend use ONLY.
 * Replaces hand-rolled setTimeout/clearTimeout patterns scattered
 * across the backend with a single, tested implementation.
 *
 * CRITICAL RULES:
 *   ❌ MUST NOT wrap Scheduler.tick()
 *   ❌ MUST NOT wrap RecurrenceEngine.generate()
 *   ❌ MUST NOT wrap ReminderService.fire()
 *   ❌ MUST NOT wrap ReminderDispatcher.fire()
 *
 * ALLOWED uses:
 *   ✅ Storage persistence (batch writes)
 *   ✅ Block attribute sync (coalesce rapid mutations)
 *   ✅ Event emission coalescing (non-scheduler events)
 *   ✅ Settings save (rate-limit user changes)
 *
 * Prevents:
 *   - Execution lag from debounced scheduler
 *   - Missed due events from throttled tick
 *   - Delayed reminders from debounced fire
 *
 * PURE FUNCTIONS (factories) — the returned closures hold minimal state.
 *
 * FORBIDDEN:
 *   ❌ mutate model
 *   ❌ access storage directly
 *   ❌ fire event
 *   ❌ call integration
 *   ❌ parse markdown
 *   ❌ access DOM
 */

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** A debounced function with cancel/flush support */
export interface DebouncedFn<T extends (...args: any[]) => any> {
  /** Call the debounced function */
  (...args: Parameters<T>): void;
  /** Cancel any pending invocation */
  cancel(): void;
  /** Immediately invoke the pending call (if any) */
  flush(): void;
  /** Whether there is a pending invocation */
  readonly isPending: boolean;
}

/** A throttled function with cancel support */
export interface ThrottledFn<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel(): void;
  readonly isPending: boolean;
}

// ──────────────────────────────────────────────────────────────
// Debounce (trailing edge)
// ──────────────────────────────────────────────────────────────

/**
 * Create a trailing-edge debounced function.
 *
 * The function is invoked AFTER `waitMs` of silence.
 * Supports cancel() and flush() for lifecycle cleanup.
 *
 * @param fn    Function to debounce
 * @param waitMs  Debounce delay in milliseconds
 * @returns Debounced function with cancel/flush
 */
export function createDebounce<T extends (...args: any[]) => any>(
  fn: T,
  waitMs: number,
): DebouncedFn<T> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    pendingArgs = args;
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      const args = pendingArgs;
      pendingArgs = null;
      if (args) fn(...args);
    }, waitMs);
  }) as DebouncedFn<T>;

  debounced.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    pendingArgs = null;
  };

  debounced.flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = null;
      fn(...args);
    }
  };

  Object.defineProperty(debounced, "isPending", {
    get: () => timerId !== null,
    enumerable: true,
  });

  return debounced;
}

// ──────────────────────────────────────────────────────────────
// Throttle (leading edge)
// ──────────────────────────────────────────────────────────────

/**
 * Create a leading-edge throttle.
 *
 * Invokes immediately on first call, then ignores subsequent
 * calls within the `intervalMs` window.
 *
 * @param fn    Function to throttle
 * @param intervalMs  Minimum interval in milliseconds
 * @returns Throttled function
 */
export function createThrottle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number,
): ThrottledFn<T> {
  let lastCallTime = 0;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const throttled = ((...args: Parameters<T>) => {
    const now = Date.now();
    const elapsed = now - lastCallTime;

    if (elapsed >= intervalMs) {
      lastCallTime = now;
      fn(...args);
    } else if (timerId === null) {
      // Schedule trailing call
      timerId = setTimeout(() => {
        lastCallTime = Date.now();
        timerId = null;
        fn(...args);
      }, intervalMs - elapsed);
    }
  }) as ThrottledFn<T>;

  throttled.cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  Object.defineProperty(throttled, "isPending", {
    get: () => timerId !== null,
    enumerable: true,
  });

  return throttled;
}

// ──────────────────────────────────────────────────────────────
// Async Debounce
// ──────────────────────────────────────────────────────────────

/**
 * Create a debounced async function.
 *
 * Returns a Promise that resolves with the result of the last call.
 * Prior pending calls are rejected with an AbortError.
 *
 * @param fn    Async function to debounce
 * @param waitMs  Debounce delay in milliseconds
 */
export function createAsyncDebounce<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  waitMs: number,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let rejectPending: ((reason: Error) => void) | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Reject any previous pending call
    if (rejectPending) {
      rejectPending(new Error("Debounced: superseded by newer call"));
      rejectPending = null;
    }
    if (timerId !== null) clearTimeout(timerId);

    return new Promise<ReturnType<T>>((resolve, reject) => {
      rejectPending = reject;
      timerId = setTimeout(async () => {
        timerId = null;
        rejectPending = null;
        try {
          const result = await fn(...args);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }, waitMs);
    });
  };
}
