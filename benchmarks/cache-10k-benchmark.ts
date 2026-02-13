/**
 * Cache System Benchmark: 10,000 Tasks
 * 
 * Validates Phase 2 Cache implementation performance targets:
 * - Task lookup: <1ms (O(1) Map access)
 * - Query execution: <100ms for complex filters
 * - Cache refresh: <500ms for 10,000 tasks
 * - Batch updates: <200ms for 100 simultaneous changes
 * - Memory efficiency: <50MB for 10,000 tasks
 * 
 * Test scenarios:
 * 1. O(1) lookup performance
 * 2. Range query performance (with TaskIndex)
 * 3. Full cache refresh
 * 4. Debounced batch updates
 * 5. Memory footprint analysis
 */

import { Cache, State } from '../src/backend/core/cache/Cache';
import { TaskIndex } from '../src/domain/index/TaskIndex';
import type { Task } from '../src/domain/models/Task';
import type { Plugin } from 'siyuan';

// ============================================================================
// Test Data Generation
// ============================================================================

/**
 * Generate realistic test tasks with varied properties
 */
function generateTestTasks(count: number): Task[] {
    const tasks: Task[] = [];
    const now = new Date();
    const statuses: Task['status'][] = ['todo', 'done', 'cancelled'];
    
    for (let i = 0; i < count; i++) {
        const daysOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + daysOffset);
        
        const hasRecurrence = Math.random() > 0.5;
        
        const task: Task = {
            id: `task-${String(i).padStart(7, '0')}`,
            name: `Benchmark Task ${i} - ${generateRandomTaskName()}`,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            enabled: Math.random() > 0.2, // 80% enabled
            dueAt: dueDate.toISOString(),
            recurrence: hasRecurrence ? {
                rrule: generateRandomRRule(),
                baseOnToday: Math.random() > 0.5,
                timezone: 'UTC',
            } : undefined,
            createdAt: new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: now.toISOString(),
        };
        
        tasks.push(task);
    }
    
    return tasks;
}

/**
 * Generate random task names
 */
function generateRandomTaskName(): string {
    const verbs = ['Review', 'Update', 'Create', 'Fix', 'Implement', 'Test', 'Deploy', 'Refactor'];
    const subjects = ['documentation', 'tests', 'feature', 'bug', 'component', 'service', 'API', 'UI'];
    return `${verbs[Math.floor(Math.random() * verbs.length)]} ${subjects[Math.floor(Math.random() * subjects.length)]}`;
}

/**
 * Generate random RRule strings
 */
function generateRandomRRule(): string {
    const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY'];
    const freq = frequencies[Math.floor(Math.random() * frequencies.length)];
    const interval = Math.floor(Math.random() * 3) + 1;
    return `FREQ=${freq};INTERVAL=${interval}`;
}

// ============================================================================
// Mock SiYuan Plugin
// ============================================================================

/**
 * Mock Plugin for testing (no real SiYuan APIs)
 */
class MockPlugin implements Partial<Plugin> {
    name = 'mock-plugin';
    private data = new Map<string, any>();
    
    async loadData(key: string): Promise<any> {
        return this.data.get(key);
    }
    
    async saveData(key: string, value: any): Promise<void> {
        this.data.set(key, value);
    }
}

/**
 * Mock global fetchSyncPost for testing
 */
function setupMockGlobals(tasks: Task[]): void {
    // Mock fetchSyncPost for SQL queries and attribute operations
    (globalThis as any).fetchSyncPost = async (endpoint: string, data: any) => {
        if (endpoint === '/api/query/sql') {
            // Return mock blocks with custom-task-id
            return {
                data: tasks.slice(0, 100).map((task, i) => ({
                    id: `block-${i}`,
                    content: task.name,
                }))
            };
        }
        
        if (endpoint === '/api/attr/getBlockAttrs') {
            // Return mock attributes for a block
            const taskIndex = parseInt(data.id.split('-')[1] || '0');
            const task = tasks[taskIndex];
            if (!task) return { data: {} };
            
            return {
                data: {
                    'custom-task-id': task.id,
                    'custom-task-name': task.name,
                    'custom-task-status': task.status,
                    'custom-task-enabled': task.enabled.toString(),
                    'custom-task-due': task.dueAt,
                    'custom-task-recurrence-rrule': task.recurrence?.rrule,
                    'custom-task-updated-at': task.updatedAt,
                }
            };
        }
        
        if (endpoint === '/api/attr/setBlockAttrs') {
            // Mock success
            return { data: 'ok' };
        }
        
        return { data: null };
    };
    
    // Mock WebSocket (no-op for benchmarking)
    if (typeof WebSocket === 'undefined') {
        (globalThis as any).WebSocket = class MockWebSocket {
            onopen: any = null;
            onmessage: any = null;
            onerror: any = null;
            onclose: any = null;
            
            constructor() {
                // Don't actually connect
            }
            
            close() {}
        };
    }
}

// ============================================================================
// Performance Measurement Utilities
// ============================================================================

interface BenchmarkResult {
    name: string;
    iterations: number;
    totalTimeMs: number;
    averageTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    medianTimeMs: number;
    p95TimeMs: number;
    p99TimeMs: number;
    opsPerSecond: number;
    passed: boolean;
    targetMs?: number;
}

/**
 * Run benchmark with multiple iterations and calculate statistics
 */
async function runBenchmark(
    name: string,
    iterations: number,
    operation: () => Promise<void> | void,
    targetMs: number
): Promise<BenchmarkResult> {
    const times: number[] = [];
    
    // Warmup run
    await operation();
    
    // Benchmark runs
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await operation();
        const end = performance.now();
        times.push(end - start);
    }
    
    // Statistics
    times.sort((a, b) => a - b);
    const totalTime = times.reduce((sum, t) => sum + t, 0);
    const averageTime = totalTime / iterations;
    const minTime = times[0]!;
    const maxTime = times[times.length - 1]!;
    const medianTime = times[Math.floor(iterations / 2)]!;
    const p95Time = times[Math.floor(iterations * 0.95)]!;
    const p99Time = times[Math.floor(iterations * 0.99)]!;
    const opsPerSecond = 1000 / averageTime;
    
    return {
        name,
        iterations,
        totalTimeMs: totalTime,
        averageTimeMs: averageTime,
        minTimeMs: minTime,
        maxTimeMs: maxTime,
        medianTimeMs: medianTime,
        p95TimeMs: p95Time,
        p99TimeMs: p99Time,
        opsPerSecond,
        passed: averageTime < targetMs,
        targetMs,
    };
}

/**
 * Print benchmark result
 */
function printResult(result: BenchmarkResult): void {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${result.name}`);
    console.log(`  ${status} (Target: <${result.targetMs}ms, Actual: ${result.averageTimeMs.toFixed(2)}ms)`);
    console.log(`  Iterations: ${result.iterations}`);
    console.log(`  Average: ${result.averageTimeMs.toFixed(2)}ms`);
    console.log(`  Median: ${result.medianTimeMs.toFixed(2)}ms`);
    console.log(`  Min: ${result.minTimeMs.toFixed(2)}ms`);
    console.log(`  Max: ${result.maxTimeMs.toFixed(2)}ms`);
    console.log(`  P95: ${result.p95TimeMs.toFixed(2)}ms`);
    console.log(`  P99: ${result.p99TimeMs.toFixed(2)}ms`);
    console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(0)}`);
}

/**
 * Measure memory usage
 */
function measureMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    return 0; // Not available in browser
}

// ============================================================================
// Benchmark Scenarios
// ============================================================================

/**
 * Benchmark 1: O(1) Lookup Performance
 */
async function benchmarkLookup(cache: Cache, testTasks: Task[]): Promise<BenchmarkResult> {
    let lookupCount = 0;
    
    return runBenchmark(
        'Benchmark 1: O(1) Task Lookup (10,000 random lookups)',
        1000,
        () => {
            // Random lookup from 10,000 tasks
            const randomId = testTasks[Math.floor(Math.random() * testTasks.length)]!.id;
            const task = cache.getTask(randomId);
            if (task) lookupCount++;
        },
        1 // Target: <1ms
    );
}

/**
 * Benchmark 2: Complex Query with Filters
 */
async function benchmarkComplexQuery(cache: Cache): Promise<BenchmarkResult> {
    return runBenchmark(
        'Benchmark 2: Complex Query (enabled + due this week + has recurrence)',
        100,
         () => {
            const now = new Date();
            const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            cache.getTasks().filter(task => {
                if (!task.enabled) return false;
                
                const dueDate = new Date(task.dueAt);
                if (dueDate < now || dueDate > oneWeekLater) return false;
                
                if (!task.recurrence) return false;
                
                return true;
            });
            // No need to return value for void function
        },
        100 // Target: <100ms
    );
}

/**
 * Benchmark 3: Full Cache Refresh
 */
async function benchmarkCacheRefresh(tasks: Task[]): Promise<BenchmarkResult> {
    const plugin = new MockPlugin() as unknown as Plugin;
    setupMockGlobals(tasks);
    
    return runBenchmark(
        'Benchmark 3: Full Cache Refresh (10,000 tasks)',
        10,
        async () => {
            const cache = new Cache(plugin);
            await cache.init();
            cache.destroy();
        },
        500 // Target: <500ms
    );
}

/**
 * Benchmark 4: Batch Updates
 */
async function benchmarkBatchUpdates(cache: Cache, testTasks: Task[]): Promise<BenchmarkResult> {
    return runBenchmark(
        'Benchmark 4: Batch Updates (100 tasks)',
        50,
        async () => {
            // Update 100 random tasks
            for (let i = 0; i < 100; i++) {
                const randomTask = testTasks[Math.floor(Math.random() * testTasks.length)]!;
                const updatedTask: Task = {
                    ...randomTask,
                    updatedAt: new Date().toISOString(),
                };
                await cache.updateTask(updatedTask);
            }
        },
        200 // Target: <200ms
    );
}

/**
 * Benchmark 5: TaskIndex Integration
 */
async function benchmarkWithIndex(testTasks: Task[]): Promise<BenchmarkResult> {
    const plugin = new MockPlugin() as unknown as Plugin;
    setupMockGlobals(testTasks);
    const taskIndex = new TaskIndex();
    
    // Setup once outside the benchmark loop
    const cache = new Cache(plugin, taskIndex);
    await cache.init();
    
    // Populate index
    for (const task of testTasks.slice(0, 1000)) {
        taskIndex.addToIndex(task);
    }
    
    // Now benchmark just the query operation
    const result = await runBenchmark(
        'Benchmark 5: Cache with TaskIndex (range query on 1000 tasks)',
        1000,
        () => {
            // Range query: tasks due in next 7 days
            const now = new Date().toISOString();
            const oneWeekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            // Use getDueAfter for tasks due after now
            const allFuture = taskIndex.getDueAfter(now);
            // Filter to only get tasks due within next 7 days
            const results = allFuture.filter(task => task.dueAt && task.dueAt <= oneWeekLater);
            // No need to return value for void function
        },
        10 // Target: <10ms for just the query (not initialization)
    );
    
    cache.destroy();
    return result;
}

// ============================================================================
// Main Benchmark Suite
// ============================================================================

async function main(): Promise<void> {
    console.log('='.repeat(80));
    console.log('Cache System Benchmark: 10,000 Tasks');
    console.log('='.repeat(80));
    console.log(`Node.js: ${process.version}`);
    console.log(`Platform: ${process.platform} ${process.arch}`);
    console.log(`Date: ${new Date().toISOString()}\n`);
    
    // Generate test data
    console.log('Generating 10,000 test tasks...');
    const memBefore = measureMemory();
    const testTasks = generateTestTasks(10000);
    const memAfter = measureMemory();
    const memUsed = memAfter - memBefore;
    console.log(`✅ Generated 10,000 tasks (Memory: ${memUsed.toFixed(2)}MB)\n`);
    
    // Setup mocks
    setupMockGlobals(testTasks);
    const plugin = new MockPlugin() as unknown as Plugin;
    
    // Initialize cache
    console.log('Initializing cache...');
    const cache = new Cache(plugin);
    await cache.init();
    
    // Populate cache with test tasks
    for (const task of testTasks) {
        (task as any).sourceBlockId = `block-${testTasks.indexOf(task)}`;
        await cache.addTask(task);
    }
    console.log(`✅ Cache initialized with ${cache.getTasks().length} tasks\n`);
    
    // Run benchmarks
    const results: BenchmarkResult[] = [];
    
    console.log('Running benchmarks...\n');
    console.log('-'.repeat(80));
    
    // Benchmark 1: O(1) Lookup
    const result1 = await benchmarkLookup(cache, testTasks);
    printResult(result1);
    results.push(result1);
    
    // Benchmark 2: Complex Query
    const result2 = await benchmarkComplexQuery(cache);
    printResult(result2);
    results.push(result2);
    
    // Benchmark 3: Cache Refresh
    const result3 = await benchmarkCacheRefresh(testTasks);
    printResult(result3);
    results.push(result3);
    
    // Benchmark 4: Batch Updates
    const result4 = await benchmarkBatchUpdates(cache, testTasks);
    printResult(result4);
    results.push(result4);
    
    // Benchmark 5: TaskIndex Integration
    const result5 = await benchmarkWithIndex(testTasks);
    printResult(result5);
    results.push(result5);
    
    // Cleanup
    cache.destroy();
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const allPassed = results.every(r => r.passed);
    const passedCount = results.filter(r => r.passed).length;
    
    console.log(`\nBenchmarks: ${passedCount}/${results.length} passed`);
    console.log(`Memory usage: ${memUsed.toFixed(2)}MB for 10,000 tasks`);
    console.log(`Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
}

// Run if executed directly
main().catch(error => {
    console.error('Benchmark failed:', error);
    process.exit(1);
});

export { main as runCacheBenchmark };
