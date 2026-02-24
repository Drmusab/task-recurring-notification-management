/**
 * Unit tests for useCancellableAsync utilities
 * 
 * Tests composable hooks for cancellable async operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store destroy callbacks for testing
let destroyCallbacks: Array<() => void> = [];

// Mock svelte lifecycle before importing the module
vi.mock('svelte', () => ({
  onDestroy: vi.fn((callback: () => void) => {
    destroyCallbacks.push(callback);
  })
}));

import { useCancellableAsync, useCancellableAsyncWithId } from '../../../src/frontend/utils/useCancellableAsync';

describe('useCancellableAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    destroyCallbacks = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    destroyCallbacks = [];
  });

  it('should execute async function with AbortSignal', async () => {
    const mockAsyncFn = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return 'success';
    });

    const { execute } = useCancellableAsync(mockAsyncFn);
    const result = await execute();

    expect(result).toBe('success');
    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
  });

  it('should return null when operation is cancelled', async () => {
    let resolveAsync: () => void;
    const asyncPromise = new Promise<void>(resolve => { resolveAsync = resolve; });
    
    const mockAsyncFn = vi.fn(async (signal: AbortSignal) => {
      await asyncPromise;
      if (signal.aborted) {
        const error = new Error('AbortError');
        error.name = 'AbortError';
        throw error;
      }
      return 'success';
    });

    const { execute, cancel } = useCancellableAsync(mockAsyncFn);
    
    const promise = execute();
    cancel(); // Cancel immediately
    resolveAsync!(); // Resolve the async operation
    
    const result = await promise;
    expect(result).toBeNull();
  });

  it('should cancel previous execution when new one starts', async () => {
    let execution1Resolved = false;
    let execution2Started = false;
    
    const mockAsyncFn = vi.fn(async (signal: AbortSignal) => {
      if (!execution2Started) {
        execution1Resolved = true;
      }
      return signal.aborted ? null : 'success';
    });

    const { execute } = useCancellableAsync(mockAsyncFn);
    
    const promise1 = execute();
    execution2Started = true;
    const promise2 = execute(); // Should cancel first
    
    const [result1, result2] = await Promise.all([promise1, promise2]);
    
    expect(result1).toBeNull(); // First cancelled
    expect(result2).toBe('success'); // Second succeeded
  });

  it('should handle AbortError gracefully', async () => {
    const mockAsyncFn = vi.fn(async (signal: AbortSignal) => {      
      if (signal.aborted) {
        const error = new Error('Operation aborted');
        error.name = 'AbortError';
        throw error;
      }
      
      return 'success';
    });

    const { execute, cancel } = useCancellableAsync(mockAsyncFn);
    
    const promise = execute();
    cancel();
    
    const result = await promise;
    expect(result).toBeNull(); // Should return null instead of throwing
  });

  it('should propagate non-abort errors', async () => {
    const mockAsyncFn = vi.fn(async (signal: AbortSignal) => {
      throw new Error('Network error');
    });

    const { execute } = useCancellableAsync(mockAsyncFn);
    
    await expect(execute()).rejects.toThrow('Network error');
  });

  it('should call onDestroy cleanup', () => {
    const mockAsyncFn = vi.fn(async (signal: AbortSignal) => 'success');
    
    useCancellableAsync(mockAsyncFn);
    
    expect(destroyCallbacks.length).toBeGreaterThan(0);
  });

  it('should allow manual cancel after execution completes', async () => {
    const mockAsyncFn = vi.fn(async (signal: AbortSignal) => 'success');

    const { execute, cancel } = useCancellableAsync(mockAsyncFn);
    
    await execute();
    cancel(); // Should not throw
    
    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
  });
});

describe('useCancellableAsyncWithId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    destroyCallbacks = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    destroyCallbacks = [];
  });

  it('should execute async function and return result with request ID', async () => {
    const mockAsyncFn = vi.fn(async (query: string) => {
      return `result: ${query}`;
    });

    const { execute } = useCancellableAsyncWithId(mockAsyncFn);
    const { result, requestId } = await execute('test');

    expect(result).toBe('result: test');
    expect(requestId).toBe(1);
    expect(mockAsyncFn).toHaveBeenCalledWith('test');
  });

  it('should increment request ID on each execution', async () => {
    const mockAsyncFn = vi.fn(async (value: string) => value);

    const { execute } = useCancellableAsyncWithId(mockAsyncFn);
    
    const result1 = await execute('first');
    const result2 = await execute('second');
    const result3 = await execute('third');

    expect(result1.requestId).toBe(1);
    expect(result2.requestId).toBe(2);
    expect(result3.requestId).toBe(3);
  });

  it('should identify latest request correctly', async () => {
    const mockAsyncFn = vi.fn(async (value: string) => value);

    const { execute, isLatest } = useCancellableAsyncWithId(mockAsyncFn);
    
    const result1 = await execute('first');
    expect(isLatest(result1.requestId)).toBe(true);
    
    const result2 = await execute('second');
    expect(isLatest(result1.requestId)).toBe(false); // No longer latest
    expect(isLatest(result2.requestId)).toBe(true);
    
    const result3 = await execute('third');
    expect(isLatest(result1.requestId)).toBe(false);
    expect(isLatest(result2.requestId)).toBe(false);
    expect(isLatest(result3.requestId)).toBe(true);
  });

  it('should handle multiple arguments', async () => {
    const mockAsyncFn = vi.fn(async (a: string, b: number, c: boolean) => {
      return { a, b, c };
    });

    const { execute } = useCancellableAsyncWithId(mockAsyncFn);
    const { result } = await execute('test', 42, true);

    expect(result).toEqual({ a: 'test', b: 42, c: true });
    expect(mockAsyncFn).toHaveBeenCalledWith('test', 42, true);
  });

  it('should invalidate old requests when cancel is called', async () => {
    const mockAsyncFn = vi.fn(async (value: string) => value);

    const { execute, isLatest, cancel } = useCancellableAsyncWithId(mockAsyncFn);
    
    const result1 = await execute('first');
    const result2 = await execute('second');
    
    expect(isLatest(result2.requestId)).toBe(true);
    
    cancel(); // Increment request ID
    
    expect(isLatest(result1.requestId)).toBe(false);
    expect(isLatest(result2.requestId)).toBe(false);
  });

  it('should call onDestroy cleanup', () => {
    const mockAsyncFn = vi.fn(async (value: string) => value);
    
    useCancellableAsyncWithId(mockAsyncFn);
    
    expect(destroyCallbacks.length).toBeGreaterThan(0);
  });

  it('should invalidate all requests on component destroy', async () => {
    const mockAsyncFn = vi.fn(async (value: string) => value);

    const { execute, isLatest } = useCancellableAsyncWithId(mockAsyncFn);
    
    const result1 = await execute('first');
    const result2 = await execute('second');
    
    expect(isLatest(result2.requestId)).toBe(true);
    
    // Simulate component destroy
    destroyCallbacks.forEach(cb => cb());
    
    expect(isLatest(result1.requestId)).toBe(false);
    expect(isLatest(result2.requestId)).toBe(false);
  });

  it('should propagate errors from async function', async () => {
    const mockAsyncFn = vi.fn(async (query: string) => {
      throw new Error(`Query failed: ${query}`);
    });

    const { execute } = useCancellableAsyncWithId(mockAsyncFn);
    
    await expect(execute('test')).rejects.toThrow('Query failed: test');
  });
});
