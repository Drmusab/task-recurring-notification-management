/**
 * Performance Benchmark for Phase 1 Week 1 Optimizations
 * 
 * Tests:
 * - QueryCache hit rate and performance
 * - TaskIndexManager rebuild time
 * - Index-based query performance
 * 
 * Run with: npm run benchmark
 */

import { QueryCache } from '../src/backend/core/cache/QueryCache';
import { TaskIndexManager } from '../src/backend/core/storage/TaskIndexManager';
import type { Task } from '../src/backend/core/models/Task';

/**
 * Generate synthetic test tasks
 */
function generateTestTasks(count: number): Map<string, Task> {
  const tasks = new Map<string, Task>();
  const now = Date.now();
  const priorities = ['highest', 'high', 'medium', 'low', 'lowest', undefined] as const;
  const statuses = ['todo', 'done', 'cancelled'] as const;
  const tags = ['work', 'personal', 'urgent', 'later', 'project-a', 'project-b'];
  
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(now + (i * 24 * 60 * 60 * 1000)); // One per day
    const task: Task = {
      id: `task_${i}`,
      name: `Test Task ${i}`,
      dueAt: dueDate.toISOString(),
      enabled: Math.random() > 0.2, // 80% enabled
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length] as any,
      tags: [tags[i % tags.length], tags[(i + 1) % tags.length]],
      createdAt: new Date(now - i * 1000).toISOString(),
      updatedAt: new Date(now - i * 1000).toISOString(),
      linkedBlockId: `block_${i}`,
      version: 1,
    };
    tasks.set(task.id, task);
  }
  
  return tasks;
}

/**
 * Benchmark QueryCache
 */
async function benchmarkQueryCache() {
  console.log('\n=== QueryCache Benchmark ===\n');
  
  const cache = new QueryCache<string[]>(5000, 100);
  const queryExecutor = async () => {
    // Simulate expensive query (10ms)
    await new Promise(resolve => setTimeout(resolve, 10));
    return ['result1', 'result2', 'result3'];
  };
  
  // Test 1: Cache miss performance
  console.log('Test 1: Cache Miss Performance');
  const missStart = performance.now();
  await cache.execute('test-query-1', queryExecutor);
  const missDuration = performance.now() - missStart;
  console.log(`  Cache MISS: ${missDuration.toFixed(2)}ms`);
  
  // Test 2: Cache hit performance
  console.log('\nTest 2: Cache Hit Performance');
  const hitStart = performance.now();
  await cache.execute('test-query-1', queryExecutor);
  const hitDuration = performance.now() - hitStart;
  console.log(`  Cache HIT: ${hitDuration.toFixed(2)}ms`);
  console.log(`  Speedup: ${(missDuration / hitDuration).toFixed(1)}x faster`);
  
  // Test 3: Mixed workload (70% cache hit rate target)
  console.log('\nTest 3: Mixed Workload (1000 queries)');
  const queries = [];
  for (let i = 0; i < 1000; i++) {
    // 70% repeat queries, 30% unique
    const queryKey = Math.random() < 0.7 
      ? `query-${i % 100}` 
      : `query-unique-${i}`;
    queries.push(queryKey);
  }
  
  const mixedStart = performance.now();
  for (const queryKey of queries) {
    await cache.execute(queryKey, queryExecutor);
  }
  const mixedDuration = performance.now() - mixedStart;
  
  const stats = cache.getStats();
  console.log(`  Total time: ${mixedDuration.toFixed(0)}ms`);
  console.log(`  Avg per query: ${(mixedDuration / queries.length).toFixed(2)}ms`);
  console.log(`  Cache hit rate: ${stats.hitRate.toFixed(1)}%`);
  console.log(`  Cache size: ${stats.size}/${stats.maxSize}`);
  console.log(`  Evictions: ${stats.evictions}`);
  
  // Validate target
  if (stats.hitRate >= 70) {
    console.log('  ✅ Target cache hit rate achieved (≥70%)');
  } else {
    console.log('  ❌ Below target cache hit rate (<70%)');
  }
}

/**
 * Benchmark TaskIndexManager
 */
function benchmarkTaskIndexManager() {
  console.log('\n=== TaskIndexManager Benchmark ===\n');
  
  // Test 1: Index rebuild performance at different scales
  const testSizes = [1000, 5000, 10000];
  
  for (const size of testSizes) {
    console.log(`Test: Rebuild ${size} tasks`);
    const tasks = generateTestTasks(size);
    const indexManager = new TaskIndexManager();
    
    const rebuildStart = performance.now();
    indexManager.rebuildIndexes(tasks);
    const rebuildDuration = performance.now() - rebuildStart;
    
    const stats = indexManager.getStats();
    console.log(`  Rebuild time: ${rebuildDuration.toFixed(1)}ms`);
    console.log(`  Tasks indexed: ${stats.totalTasks}`);
    console.log(`  Unique tags: ${stats.uniqueTags}`);
    console.log(`  Unique priorities: ${stats.uniquePriorities}`);
    
    // Validate 10k task target (<500ms)
    if (size === 10000) {
      if (rebuildDuration < 500) {
        console.log(`  ✅ Target rebuild time achieved (<500ms for 10k tasks)`);
      } else {
        console.log(`  ❌ Above target rebuild time (${rebuildDuration.toFixed(1)}ms > 500ms)`);
      }
    }
    
    // Test 2: Query performance with indexes
    console.log(`\n  Query Performance (${size} tasks):`);
    
    // Tag query
    const tagStart = performance.now();
    const tagResults = indexManager.queryByTag('work');
    const tagDuration = performance.now() - tagStart;
    console.log(`    By tag 'work': ${tagDuration.toFixed(3)}ms (${tagResults.size} results)`);
    
    // Priority query
    const priorityStart = performance.now();
    const priorityResults = indexManager.queryByPriority('high');
    const priorityDuration = performance.now() - priorityStart;
    console.log(`    By priority 'high': ${priorityDuration.toFixed(3)}ms (${priorityResults.size} results)`);
    
    // Status query
    const statusStart = performance.now();
    const statusResults = indexManager.queryByStatus('todo');
    const statusDuration = performance.now() - statusStart;
    console.log(`    By status 'todo': ${statusDuration.toFixed(3)}ms (${statusResults.size} results)`);
    
    // Multi-tag query
    const multiTagStart = performance.now();
    const multiTagResults = indexManager.queryByTags(['work', 'urgent']);
    const multiTagDuration = performance.now() - multiTagStart;
    console.log(`    By tags ['work', 'urgent']: ${multiTagDuration.toFixed(3)}ms (${multiTagResults.size} results)`);
    
    // Validate query performance (<1ms for O(1) lookups)
    const avgQueryTime = (tagDuration + priorityDuration + statusDuration) / 3;
    if (avgQueryTime < 1.0) {
      console.log(`    ✅ O(1) query performance achieved (<1ms avg)`);
    } else {
      console.log(`    ⚠️ Query performance slower than expected (${avgQueryTime.toFixed(3)}ms avg)`);
    }
    
    console.log('');
  }
}

/**
 * Benchmark comparison: Linear search vs Indexed queries
 */
function benchmarkLinearVsIndexed() {
  console.log('\n=== Linear Search vs Indexed Query Comparison ===\n');
  
  const tasks = generateTestTasks(10000);
  const tasksArray = Array.from(tasks.values());
  
  // Linear search benchmark
  console.log('Linear Search (no indexes):');
  const linearStart = performance.now();
  const linearResults = tasksArray.filter(t => 
    t.tags?.includes('work') && t.status === 'todo' && t.priority === 'high'
  );
  const linearDuration = performance.now() - linearStart;
  console.log(`  Time: ${linearDuration.toFixed(2)}ms`);
  console.log(`  Results: ${linearResults.length}`);
  
  // Indexed search benchmark
  console.log('\nIndexed Query (with TaskIndexManager):');
  const indexManager = new TaskIndexManager();
  indexManager.rebuildIndexes(tasks);
  
  const indexedStart = performance.now();
  const taggedTasks = indexManager.queryByTag('work');
  const todoTasks = indexManager.queryByStatus('todo');
  const highPriTasks = indexManager.queryByPriority('high');
  
  // Intersect the sets
  const indexedResults = new Set<string>();
  for (const taskId of taggedTasks) {
    if (todoTasks.has(taskId) && highPriTasks.has(taskId)) {
      indexedResults.add(taskId);
    }
  }
  const indexedDuration = performance.now() - indexedStart;
  console.log(`  Time: ${indexedDuration.toFixed(2)}ms`);
  console.log(`  Results: ${indexedResults.size}`);
  
  // Comparison
  console.log('\nComparison:');
  const speedup = linearDuration / indexedDuration;
  console.log(`  Speedup: ${speedup.toFixed(1)}x faster with indexes`);
  console.log(`  Improvement: ${((1 - indexedDuration / linearDuration) * 100).toFixed(1)}% faster`);
  
  if (speedup >= 5) {
    console.log('  ✅ Significant performance improvement (≥5x speedup)');
  } else if (speedup >= 2) {
    console.log('  ⚠️ Moderate improvement (2-5x speedup)');
  } else {
    console.log('  ❌ Minimal improvement (<2x speedup)');
  }
}

/**
 * Run all benchmarks
 */
async function runBenchmarks() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Phase 1 Week 1 Performance Benchmark                    ║');
  console.log('║  QueryCache + TaskIndexManager                            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  await benchmarkQueryCache();
  benchmarkTaskIndexManager();
  benchmarkLinearVsIndexed();
  
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Benchmark Complete                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

// Export for use as module
export { runBenchmarks, benchmarkQueryCache, benchmarkTaskIndexManager, benchmarkLinearVsIndexed };
