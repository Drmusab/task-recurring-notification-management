/**
 * Unit tests for debounce utilities
 * 
 * Tests rate-limiting functions: debounce(), debounceAsync(), and throttle()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, debounceAsync, throttle } from '@frontend/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay function execution until after wait time', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn('test');
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockFn).toHaveBeenCalledWith('test');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    debouncedFn('first');
    vi.advanceTimersByTime(200);
    debouncedFn('second');
    vi.advanceTimersByTime(200);
    debouncedFn('third');

    // None should have been called yet
    expect(mockFn).not.toHaveBeenCalled();

    // After final 300ms
    vi.advanceTimersByTime(300);
    expect(mockFn).toHaveBeenCalledWith('third');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should handle rapid calls and only execute once', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    // Simulate rapid typing
    for (let i = 0; i < 10; i++) {
      debouncedFn(`input-${i}`);
      vi.advanceTimersByTime(50); // Less than wait time
    }

    // Should not have been called during rapid inputs
    expect(mockFn).not.toHaveBeenCalled();

    // Wait full debounce time after last call
    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledWith('input-9');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should preserve function arguments', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('arg1', 'arg2', 'arg3');
    vi.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  it('should allow multiple independent debounced functions', () => {
    const mockFn1 = vi.fn();
    const mockFn2 = vi.fn();
    const debouncedFn1 = debounce(mockFn1, 100);
    const debouncedFn2 = debounce(mockFn2, 200);

    debouncedFn1('fn1');
    debouncedFn2('fn2');

    vi.advanceTimersByTime(100);
    expect(mockFn1).toHaveBeenCalledWith('fn1');
    expect(mockFn2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(mockFn2).toHaveBeenCalledWith('fn2');
  });
});

describe('debounceAsync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay async function execution until after wait time', async () => {
    const mockAsyncFn = vi.fn(async (value: string) => `result: ${value}`);
    const debouncedFn = debounceAsync(mockAsyncFn, 300);

    const promise = debouncedFn('test');
    expect(mockAsyncFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    expect(mockAsyncFn).toHaveBeenCalledWith('test');
    await expect(promise).resolves.toBe('result: test');
  });

  it('should cancel previous pending promise on new call', async () => {
    const mockAsyncFn = vi.fn(async (value: string) => `result: ${value}`);
    const debouncedFn = debounceAsync(mockAsyncFn, 200);

    const promise1 = debouncedFn('first').catch((e: Error) => e.message);
    vi.advanceTimersByTime(100);
    
    const promise2 = debouncedFn('second');
    vi.advanceTimersByTime(200);
    await vi.runAllTimersAsync();

    // First promise should be rejected
    expect(await promise1).toBe('Debounced call cancelled');
    
    // Second promise should resolve
    await expect(promise2).resolves.toBe('result: second');
    
    // Function should only be called once
    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
    expect(mockAsyncFn).toHaveBeenCalledWith('second');
  });

  it('should handle multiple rapid calls correctly', async () => {
    const mockAsyncFn = vi.fn(async (value: string) => `result: ${value}`);
    const debouncedFn = debounceAsync(mockAsyncFn, 100);

    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(debouncedFn(`call-${i}`).catch((e: Error) => e.message));
      vi.advanceTimersByTime(50);
    }

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    // First 4 should be cancelled, last should succeed
    for (let i = 0; i < 4; i++) {
      expect(await promises[i]).toBe('Debounced call cancelled');
    }
    await expect(promises[4]).resolves.toBe('result: call-4');

    // Function should only execute once
    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
  });

  it('should propagate errors from async function', async () => {
    const mockAsyncFn = vi.fn(async () => {
      throw new Error('Async error');
    });
    const debouncedFn = debounceAsync(mockAsyncFn, 100);

    const promise = debouncedFn('test').catch((e: Error) => e.message);
    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    expect(await promise).toBe('Async error');
  });

  it('should preserve function arguments in async calls', async () => {
    const mockAsyncFn = vi.fn(async (a: string, b: number, c: boolean) => ({ a, b, c }));
    const debouncedFn = debounceAsync(mockAsyncFn, 100);

    const promise = debouncedFn('test', 42, true);
    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ a: 'test', b: 42, c: true });
  });

  it('should handle zero wait time', async () => {
    const mockAsyncFn = vi.fn(async (value: string) => `result: ${value}`);
    const debouncedFn = debounceAsync(mockAsyncFn, 0);

    const promise = debouncedFn('test');
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('result: test');
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute immediately on first call', () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 300);

    throttledFn('first');
    expect(mockFn).toHaveBeenCalledWith('first');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should throttle subsequent calls within wait period', () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 300);

    throttledFn('first');
    expect(mockFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttledFn('second');
    expect(mockFn).toHaveBeenCalledTimes(1); // Still only first call

    vi.advanceTimersByTime(100);
    throttledFn('third');
    expect(mockFn).toHaveBeenCalledTimes(1); // Still only first call
  });

  it('should execute again after wait period', () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 300);

    throttledFn('first');
    expect(mockFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);
    throttledFn('second');
    
    vi.advanceTimersByTime(1); // Advance slightly to trigger timeout
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith('second');
  });

  it('should handle rapid repeated calls', () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 100);

    // First call executes immediately
    throttledFn('call-0');
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Make multiple calls within throttle window
    throttledFn('call-1');
    throttledFn('call-2');
    throttledFn('call-3');

    // Should still be only 1 call (initial)
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Wait for throttle to expire and process queued call
    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('call-3');
  });

  it('should preserve function arguments', () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 100);

    throttledFn('arg1', 'arg2', 'arg3');
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });

  it('should handle zero wait time', () => {
    const mockFn = vi.fn();
    const throttledFn = throttle(mockFn, 0);

    throttledFn('first');
    expect(mockFn).toHaveBeenCalledTimes(1);

    throttledFn('second');
    vi.advanceTimersByTime(1);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should allow multiple independent throttled functions', () => {
    const mockFn1 = vi.fn();
    const mockFn2 = vi.fn();
    const throttledFn1 = throttle(mockFn1, 100);
    const throttledFn2 = throttle(mockFn2, 200);

    throttledFn1('fn1-first');
    throttledFn2('fn2-first');
    expect(mockFn1).toHaveBeenCalledTimes(1);
    expect(mockFn2).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttledFn1('fn1-second');
    throttledFn2('fn2-second');

    vi.advanceTimersByTime(1);
    expect(mockFn1).toHaveBeenCalledTimes(2);
    expect(mockFn2).toHaveBeenCalledTimes(1); // Still throttled

    vi.advanceTimersByTime(100);
    expect(mockFn2).toHaveBeenCalledTimes(2);
  });
});
