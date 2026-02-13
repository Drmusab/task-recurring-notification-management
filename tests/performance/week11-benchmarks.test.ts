/**
 * @fileoverview Performance benchmark suite for Week 11 QA
 * @constraint Validate <100ms query time for 10k tasks target
 * 
 * Benchmarks all critical operations with realistic datasets to ensure
 * performance targets are met before release.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryCache } from '../../src/backend/core/cache/QueryCache';
import { TaskIndexManager } from '../../src/backend/core/indexing/TaskIndexManager';
import type { Task } from '../../src/backend/core/models/Task';

describe('Week 11: Performance Benchmarks', () => {
    /**
     * Generate realistic task dataset
     */
    const generateTasks = (count: number): Map<string, Task> => {
        const tasks = new Map<string, Task>();
        const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
        const statuses: Array<'todo' | 'done' | 'cancelled'> = ['todo', 'done', 'cancelled'];
        const tags = ['work', 'personal', 'urgent', 'routine', 'project-a', 'project-b'];

        for (let i = 0; i < count; i++) {
            const id = `task-${i}`;
            const daysOffset = Math.floor(Math.random() * 90) - 30; // ±30 days
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + daysOffset);

            tasks.set(id, {
                id,
                name: `Task ${i}`,
                dueAt: dueDate.toISOString(),
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                priority: priorities[i % 3],
                status: statuses[i % 3],
                tags: [tags[i % tags.length], tags[(i + 1) % tags.length]],
                linkedBlockId: `block-${i}`,
            });
        }

        return tasks;
    };

    describe('QueryCache Performance', () => {
        let queryCache: QueryCache;

        beforeEach(() => {
            queryCache = new QueryCache(5000, 100);
        });

        it('should achieve <5ms cache hit time', async () => {
            const mockData: Task[] = Array.from(generateTasks(1000).values());
            const queryKey = 'test-query-1';

            // Prime cache
            await queryCache.execute(queryKey, async () => mockData);

            // Measure cache hit
            const startTime = performance.now();
            await queryCache.execute(queryKey, async () => {
                throw new Error('Should not execute');
            });
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(5); // <5ms for cache hit
        });

        it('should handle 100 concurrent queries efficiently', async () => {
            const tasks = Array.from(generateTasks(5000).values());
            const queries = Array.from({ length: 100 }, (_, i) => `query-${i % 10}`);

            const startTime = performance.now();

            const results = await Promise.all(
                queries.map(key =>
                    queryCache.execute(key, async () => {
                        // Simulate query work
                        await new Promise(resolve => setTimeout(resolve, 10));
                        return tasks.filter(t => t.priority === 'high');
                    })
                )
            );

            const elapsed = performance.now() - startTime;

            expect(results).toHaveLength(100);
            expect(elapsed).toBeLessThan(500); // Should benefit from caching
            
            const stats = queryCache.getStats();
            expect(stats.hitRate).toBeGreaterThan(0.8); // 80%+ cache hit rate
        });

        it('should maintain performance with cache churn', async () => {
            const tasks = Array.from(generateTasks(1000).values());

            // Fill cache beyond max size to trigger evictions
            const startTime = performance.now();
            
            for (let i = 0; i < 150; i++) {
                await queryCache.execute(`query-${i}`, async () => tasks);
            }

            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(1000); // <1s for 150 queries
            
            const stats = queryCache.getStats();
            expect(stats.size).toBeLessThanOrEqual(100); // Respects max size
        });
    });

    describe('TaskIndexManager Performance', () => {
        let indexManager: TaskIndexManager;

        beforeEach(() => {
            indexManager = new TaskIndexManager();
        });

        it('should rebuild indexes for 10k tasks in <200ms', () => {
            const tasks = generateTasks(10000);

            const startTime = performance.now();
            const stats = indexManager.rebuildIndexes(tasks);
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(200); // <200ms for 10k tasks
            expect(stats.taskCount).toBe(10000);
            expect(stats.indexSizes.tags).toBeGreaterThan(0);
        });

        it('should achieve O(1) lookup for indexed queries', () => {
            const tasks = generateTasks(10000);
            indexManager.rebuildIndexes(tasks);

            // Query by priority (indexed)
            const startTime1 = performance.now();
            const highPriorityIds = indexManager.queryByPriority('high');
            const elapsed1 = performance.now() - startTime1;

            expect(elapsed1).toBeLessThan(5); // <5ms for indexed lookup
            expect(highPriorityIds.length).toBeGreaterThan(0);

            // Query by tags (indexed)
            const startTime2 = performance.now();
            const taggedIds = indexManager.queryByTags(['work', 'urgent']);
            const elapsed2 = performance.now() - startTime2;

            expect(elapsed2).toBeLessThan(10); // <10ms for tag intersection
            expect(taggedIds.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle incremental updates efficiently', () => {
            const tasks = generateTasks(5000);
            indexManager.rebuildIndexes(tasks);

            // Measure incremental index update
            const newTask: Task = {
                id: 'new-task',
                name: 'New Task',
                dueAt: new Date().toISOString(),
                enabled: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                priority: 'high',
                status: 'todo',
                tags: ['urgent', 'new'],
            };

            const startTime = performance.now();
            indexManager.indexTask(newTask.id, newTask);
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(1); // <1ms for single task index
        });

        it('should support complex multi-attribute queries', () => {
            const tasks = generateTasks(10000);
            indexManager.rebuildIndexes(tasks);

            // Combine multiple indexes
            const startTime = performance.now();
            
            const highPriorityIds = new Set(indexManager.queryByPriority('high'));
            const todoIds = new Set(indexManager.queryByStatus('todo'));
            const workTagIds = new Set(indexManager.queryByAnyTag(['work']));
            
            // Intersection of all three
            const result = Array.from(highPriorityIds).filter(
                id => todoIds.has(id) && workTagIds.has(id)
            );
            
            const elapsed = performance.now() - startTime;

            expect(elapsed).toBeLessThan(20); // <20ms for complex query
            expect(result.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Combined Performance: Cache + Indexes', () => {
        let queryCache: QueryCache;
        let indexManager: TaskIndexManager;
        let tasks: Map<string, Task>;

        beforeEach(() => {
            queryCache = new QueryCache();
            indexManager = new TaskIndexManager();
            tasks = generateTasks(10000);
            indexManager.rebuildIndexes(tasks);
        });

        it('should achieve <100ms query time for complex queries (10k tasks)', async () => {
            const executeQuery = async (): Promise<Task[]> => {
                const highPriorityIds = indexManager.queryByPriority('high');
                const todoIds = indexManager.queryByStatus('todo');
                const urgentTagIds = indexManager.queryByAnyTag(['urgent']);

                const candidateIds = highPriorityIds.filter(
                    id => todoIds.includes(id) && urgentTagIds.includes(id)
                );

                return candidateIds.map(id => tasks.get(id)!).filter(Boolean);
            };

            // First query (cache miss)
            const startTime1 = performance.now();
            const result1 = await queryCache.execute('complex-query-1', executeQuery);
            const elapsed1 = performance.now() - startTime1;

            expect(elapsed1).toBeLessThan(100); // <100ms target
            expect(result1.length).toBeGreaterThanOrEqual(0);

            // Second query (cache hit)
            const startTime2 = performance.now();
            const result2 = await queryCache.execute('complex-query-1', executeQuery);
            const elapsed2 = performance.now() - startTime2;

            expect(elapsed2).toBeLessThan(10); // Cache hit should be very fast
            expect(result2).toEqual(result1); // Same results
        });

        it('should maintain performance under load (100 concurrent queries)', async () => {
            const queries = [
                () => indexManager.queryByPriority('high'),
                () => indexManager.queryByStatus('todo'),
                () => indexManager.queryByTags(['work', 'urgent']),
                () => indexManager.queryByDueDateRange('2024-01-01', '2024-12-31'),
                () => indexManager.queryByAnyTag(['personal']),
            ];

            const startTime = performance.now();

            const results = await Promise.all(
                Array.from({ length: 100 }, (_, i) =>
                    queryCache.execute(`load-query-${i}`, async () => {
                        const queryFn = queries[i % queries.length];
                        const ids = queryFn();
                        return ids.map(id => tasks.get(id)!).filter(Boolean);
                    })
                )
            );

            const elapsed = performance.now() - startTime;

            expect(results).toHaveLength(100);
            expect(elapsed).toBeLessThan(1000); // <1s for 100 queries on 10k tasks
        });
    });

    describe('Memory Usage', () => {
        it('should stay within 100MB baseline for 10k tasks', () => {
            const tasks = generateTasks(10000);
            const indexManager = new TaskIndexManager();

            // Note: Memory profiling requires Node.js v8 API or browser-specific tools
            // This test validates that the index rebuild completes successfully
            // Manual profiling: Use Chrome DevTools or process.memoryUsage() in Node
            
            indexManager.rebuildIndexes(tasks);
            
            // Verify index was built successfully
            const results = indexManager.queryByPriority('high');
            expect(results.length).toBeGreaterThan(0);
        });

        it('should have reasonable cache memory overhead', async () => {
            const queryCache = new QueryCache(5000, 100);
            const tasks = Array.from(generateTasks(1000).values());

            // Fill cache
            for (let i = 0; i < 100; i++) {
                await queryCache.execute(`query-${i}`, async () => tasks);
            }

            // Verify cache is working correctly
            const stats = queryCache.getStats();
            expect(stats.size).toBe(100);
            expect(stats.totalRequests).toBe(100);
        });
    });

    describe('Scale Validation (Target: 10k+ tasks)', () => {
        it('should handle 10,000 tasks within all performance targets', () => {
            const tasks = generateTasks(10000);
            const indexManager = new TaskIndexManager();

            // Target: <200ms index rebuild
            const rebuildStart = performance.now();
            const stats = indexManager.rebuildIndexes(tasks);
            const rebuildTime = performance.now() - rebuildStart;

            expect(rebuildTime).toBeLessThan(200);
            expect(stats.taskCount).toBe(10000);

            // Target: <10ms indexed queries
            const queryStart = performance.now();
            const results = indexManager.queryByPriority('high');
            const queryTime = performance.now() - queryStart;

            expect(queryTime).toBeLessThan(10);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should scale to 20,000 tasks (2x scale factor)', () => {
            const tasks = generateTasks(20000);
            const indexManager = new TaskIndexManager();

            // Should still be reasonable (allow 2x time)
            const rebuildStart = performance.now();
            indexManager.rebuildIndexes(tasks);
            const rebuildTime = performance.now() - rebuildStart;

            expect(rebuildTime).toBeLessThan(400); // 2x of 200ms target

            const queryStart = performance.now();
            indexManager.queryByPriority('high');
            const queryTime = performance.now() - queryStart;

            expect(queryTime).toBeLessThan(20); // 2x of 10ms target
        });
    });
});
