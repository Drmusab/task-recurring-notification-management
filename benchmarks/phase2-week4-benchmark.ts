/**
 * Phase 2, Week 4 Benchmarks: Urgency & Smart Sorting
 * 
 * Validates performance targets:
 * - Urgency calculation: <1ms per task
 * - Multi-field sorting: <50ms for 1000 tasks
 * - Urgency-based filtering: <100ms for 10k tasks
 */

import { calculateUrgencyWithBreakdown } from '../src/backend/core/urgency/UrgencyScoreCalculator';
import { QueryEngine } from '../src/backend/core/query/QueryEngine';
import { QueryParser } from '../src/backend/core/query/QueryParser';
import type { Task } from '../src/backend/core/models/Task';

// Mock task index
class MockTaskIndex {
  constructor(private tasks: Task[]) {}
  
  getAllTasks(): Task[] {
    return this.tasks;
  }
}

// Generate test tasks with varying urgency
function generateTestTasks(count: number): Task[] {
  const tasks: Task[] = [];
  const now = new Date('2024-02-13T12:00:00Z');
  
  for (let i = 0; i < count; i++) {
    const daysOffset = (i % 30) - 15; // Range from -15 to +15 days
    const dueDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    
    const task: Task = {
      id: `task-${i}`,
      name: `Task ${i}`,
      dueAt: dueDate.toISOString(),
      enabled: true,
      priority: ['low', 'normal', 'medium', 'high'][i % 4] as any,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      recurrence: {
        rrule: 'FREQ=DAILY;INTERVAL=1',
        baseOnToday: false,
        humanReadable: 'Daily',
      },
      recentCompletions: [],
      scheduledAt: i % 3 === 0 ? dueDate.toISOString() : undefined,
      startAt: i % 5 === 0 ? new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() : undefined,
    };
    
    tasks.push(task);
  }
  
  return tasks;
}

// Benchmark 1: Urgency Calculation Performance
async function benchmarkUrgencyCalculation(): Promise<void> {
  console.log('\n=== Benchmark 1: Urgency Calculation Performance ===');
  
  const tasks = generateTestTasks(10000);
  console.log(`\nTest dataset: ${tasks.length} tasks`);

  // Warm-up
  for (let i = 0; i < 100; i++) {
    calculateUrgencyWithBreakdown(tasks[i], { now: new Date() });
  }

  // Benchmark individual calculation
  console.log(`\n1. Individual Urgency Calculation:`);
  const singleStart = performance.now();
  let totalScore = 0;
  
  for (const task of tasks) {
    const result = calculateUrgencyWithBreakdown(task, { now: new Date() });
    totalScore += result.score;
  }
  
  const singleEnd = performance.now();
  const singleTime = singleEnd - singleStart;
  const avgTimePerTask = singleTime / tasks.length;
  
  console.log(`   Total time: ${singleTime.toFixed(2)}ms`);
  console.log(`   Average time per task: ${avgTimePerTask.toFixed(4)}ms`);
  console.log(`   Throughput: ${(tasks.length / (singleTime / 1000)).toFixed(0)} tasks/second`);
  console.log(`   Total urgency score: ${totalScore.toFixed(2)} (sanity check)`);
  
  // Validate target
  const target = 1.0; // <1ms per task
  const success = avgTimePerTask < target;
  console.log(`\n   ✓ Target: <${target}ms per task`);
  console.log(`   ${success ? '✓' : '✗'} Achieved: ${avgTimePerTask.toFixed(4)}ms ${success ? 'PASS' : 'FAIL'}`);
  
  // Benchmark with breakdown
  console.log(`\n2. Urgency Calculation with Breakdown:`);
  const breakdownStart = performance.now();
  const breakdowns = [];
  
  for (const task of tasks.slice(0, 1000)) {
    const result = calculateUrgencyWithBreakdown(task, { now: new Date() });
    breakdowns.push(result.breakdown);
  }
  
  const breakdownEnd = performance.now();
  const breakdownTime = breakdownEnd - breakdownStart;
  const avgBreakdownTime = breakdownTime / 1000;
  
  console.log(`   Total time (1000 tasks): ${breakdownTime.toFixed(2)}ms`);
  console.log(`   Average time per task: ${avgBreakdownTime.toFixed(4)}ms`);
  console.log(`   Overhead vs simple calc: ${((avgBreakdownTime - avgTimePerTask) / avgTimePerTask * 100).toFixed(1)}%`);
}

// Benchmark 2: Multi-Field Sorting Performance
async function benchmarkMultiFieldSorting(): Promise<void> {
  console.log('\n\n=== Benchmark 2: Multi-Field Sorting Performance ===');
  
  const tasks = generateTestTasks(1000);
  console.log(`\nTest dataset: ${tasks.length} tasks`);
  
  const taskIndex = new MockTaskIndex(tasks);
  const queryEngine = new QueryEngine(taskIndex);
  const parser = new QueryParser();

  // Test 1: Single field sort (baseline)
  console.log(`\n1. Baseline (single field sort by priority):`);
  const singleStart = performance.now();
  const singleAst = parser.parse('sort by priority');
  const singleResult = queryEngine.execute(singleAst);
  const singleEnd = performance.now();
  const singleTime = singleEnd - singleStart;
  
  console.log(`   Time: ${singleTime.toFixed(2)}ms`);
  console.log(`   Sorted tasks: ${singleResult.tasks.length}`);

  // Test 2: Two-field sort
  console.log(`\n2. Two-field sort (priority, due):`);
  const twoFieldStart = performance.now();
  const twoFieldAst = parser.parse('sort by priority, due');
  const twoFieldResult = queryEngine.execute(twoFieldAst);
  const twoFieldEnd = performance.now();
  const twoFieldTime = twoFieldEnd - twoFieldStart;
  
  console.log(`   Time: ${twoFieldTime.toFixed(2)}ms`);
  console.log(`   Overhead vs single field: ${((twoFieldTime - singleTime) / singleTime * 100).toFixed(1)}%`);

  // Test 3: Three-field sort with urgency
  console.log(`\n3. Three-field sort (urgency, priority, due):`);
  const threeFieldStart = performance.now();
  const threeFieldAst = parser.parse('sort by urgency, priority, due');
  const threeFieldResult = queryEngine.execute(threeFieldAst);
  const threeFieldEnd = performance.now();
  const threeFieldTime = threeFieldEnd - threeFieldStart;
  
  console.log(`   Time: ${threeFieldTime.toFixed(2)}ms`);
  console.log(`   Overhead vs single field: ${((threeFieldTime - singleTime) / singleTime * 100).toFixed(1)}%`);
  
  // Test 4: Complex sort with reverse
  console.log(`\n4. Complex sort (urgency reverse, priority, due reverse):`);
  const complexStart = performance.now();
  const complexAst = parser.parse('sort by urgency reverse, priority, due reverse');
  const complexResult = queryEngine.execute(complexAst);
  const complexEnd = performance.now();
  const complexTime = complexEnd - complexStart;
  
  console.log(`   Time: ${complexTime.toFixed(2)}ms`);
  console.log(`   Overhead vs single field: ${((complexTime - singleTime) / singleTime * 100).toFixed(1)}%`);

  // Validate target
  console.log(`\n5. Results:`);
  const target = 50; // <50ms for 1000 tasks
  const success = threeFieldTime < target;
  console.log(`   Target: <${target}ms for 1000 tasks`);
  console.log(`   ${success ? '✓' : '✗'} Achieved: ${threeFieldTime.toFixed(2)}ms ${success ? 'PASS' : 'FAIL'}`);
  
  // Verify sort correctness
  console.log(`\n6. Sort Correctness:`);
  const firstTask = threeFieldResult.tasks[0];
  const lastTask = threeFieldResult.tasks[threeFieldResult.tasks.length - 1];
  console.log(`   First task: id=${firstTask.id}, priority=${firstTask.priority}, due=${firstTask.dueAt}`);
  console.log(`   Last task: id=${lastTask.id}, priority=${lastTask.priority}, due=${lastTask.dueAt}`);
}

// Benchmark 3: Urgency-Based Filtering
async function benchmarkUrgencyFiltering(): Promise<void> {
  console.log('\n\n=== Benchmark 3: Urgency-Based Filtering ===');
  
  const tasks = generateTestTasks(10000);
  console.log(`\nTest dataset: ${tasks.length} tasks`);
  
  const taskIndex = new MockTaskIndex(tasks);
  const queryEngine = new QueryEngine(taskIndex);
  const parser = new QueryParser();

  // Test 1: Filter by urgency threshold
  console.log(`\n1. Filter: urgency above 10:`);
  const filterStart = performance.now();
  const filterAst = parser.parse('urgency above 10');
  const filterResult = queryEngine.execute(filterAst);
  const filterEnd = performance.now();
  const filterTime = filterEnd - filterStart;
  
  console.log(`   Time: ${filterTime.toFixed(2)}ms`);
  console.log(`   Matching tasks: ${filterResult.tasks.length} (${(filterResult.tasks.length / tasks.length * 100).toFixed(1)}%)`);
  console.log(`   Throughput: ${(tasks.length / (filterTime / 1000)).toFixed(0)} tasks/second`);

  // Test 2: Filter + Sort by urgency
  console.log(`\n2. Filter + Sort (urgency above 5, sort by urgency reverse):`);
  const filterSortStart = performance.now();
  const filterSortAst = parser.parse(`
    urgency above 5
    sort by urgency reverse
  `);
  const filterSortResult = queryEngine.execute(filterSortAst);
  const filterSortEnd = performance.now();
  const filterSortTime = filterSortEnd - filterSortStart;
  
  console.log(`   Time: ${filterSortTime.toFixed(2)}ms`);
  console.log(`   Matching tasks: ${filterSortResult.tasks.length}`);
  console.log(`   Highest urgency task: ${filterSortResult.tasks[0]?.id || 'none'}`);

  // Test 3: Complex query with urgency
  console.log(`\n3. Complex query (urgency above 8 AND high priority, sort by urgency, due):`);
  const complexStart = performance.now();
  const complexAst = parser.parse(`
    urgency above 8
    priority is high
    sort by urgency reverse, due
  `);
  const complexResult = queryEngine.execute(complexAst);
  const complexEnd = performance.now();
  const complexTime = complexEnd - complexStart;
  
  console.log(`   Time: ${complexTime.toFixed(2)}ms`);
  console.log(`   Matching tasks: ${complexResult.tasks.length}`);

  // Validate target
  console.log(`\n4. Results:`);
  const target = 100; // <100ms for 10k tasks
  const success = filterTime < target;
  console.log(`   Target: <${target}ms for 10k tasks`);
  console.log(`   ${success ? '✓' : '✗'} Achieved: ${filterTime.toFixed(2)}ms ${success ? 'PASS' : 'FAIL'}`);
}

// Benchmark 4: Urgency Breakdown Analysis
async function benchmarkUrgencyBreakdown(): Promise<void> {
  console.log('\n\n=== Benchmark 4: Urgency Breakdown Analysis ===');
  
  const tasks = generateTestTasks(1000);
  console.log(`\nTest dataset: ${tasks.length} tasks`);
  
  // Analyze urgency score distribution
  const now = new Date('2024-02-13T12:00:00Z');
  const urgencyScores: number[] = [];
  const breakdowns: any[] = [];
  
  for (const task of tasks) {
    const result = calculateUrgencyWithBreakdown(task, { now });
    urgencyScores.push(result.score);
    breakdowns.push(result.breakdown);
  }
  
  // Calculate statistics
  const sorted = [...urgencyScores].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = urgencyScores.reduce((a, b) => a + b, 0) / urgencyScores.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  
  console.log(`\n1. Urgency Score Distribution:`);
  console.log(`   Min: ${min.toFixed(2)}`);
  console.log(`   Max: ${max.toFixed(2)}`);
  console.log(`   Mean: ${mean.toFixed(2)}`);
  console.log(`   Median: ${median.toFixed(2)}`);
  
  // Breakdown contribution analysis
  const avgContributions = {
    priority: 0,
    dueDate: 0,
    overdue: 0,
    scheduled: 0,
    start: 0,
  };
  
  for (const breakdown of breakdowns) {
    avgContributions.priority += breakdown.priorityContribution;
    avgContributions.dueDate += breakdown.dueDateContribution;
    avgContributions.overdue += breakdown.overdueContribution;
    avgContributions.scheduled += breakdown.scheduledContribution;
    avgContributions.start += breakdown.startContribution;
  }
  
  const count = breakdowns.length;
  console.log(`\n2. Average Contribution by Factor:`);
  console.log(`   Priority: ${(avgContributions.priority / count).toFixed(2)}`);
  console.log(`   Due Date: ${(avgContributions.dueDate / count).toFixed(2)}`);
  console.log(`   Overdue: ${(avgContributions.overdue / count).toFixed(2)}`);
  console.log(`   Scheduled: ${(avgContributions.scheduled / count).toFixed(2)}`);
  console.log(`   Start Date: ${(avgContributions.start / count).toFixed(2)}`);
  
  // Distribution analysis
  const ranges = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const score of urgencyScores) {
    if (score >= 15) ranges.critical++;
    else if (score >= 10) ranges.high++;
    else if (score >= 5) ranges.medium++;
    else ranges.low++;
  }
  
  console.log(`\n3. Urgency Level Distribution:`);
  console.log(`   Low (<5): ${ranges.low} (${(ranges.low / count * 100).toFixed(1)}%)`);
  console.log(`   Medium (5-10): ${ranges.medium} (${(ranges.medium / count * 100).toFixed(1)}%)`);
  console.log(`   High (10-15): ${ranges.high} (${(ranges.high / count * 100).toFixed(1)}%)`);
  console.log(`   Critical (>15): ${ranges.critical} (${(ranges.critical / count * 100).toFixed(1)}%)`);
}

// Main benchmark runner
async function runBenchmarks(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      Phase 2, Week 4: Urgency & Smart Sorting Benchmarks   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const totalStart = performance.now();
  
  try {
    await benchmarkUrgencyCalculation();
    await benchmarkMultiFieldSorting();
    await benchmarkUrgencyFiltering();
    await benchmarkUrgencyBreakdown();
    
    const totalEnd = performance.now();
    const totalTime = totalEnd - totalStart;
    
    console.log('\n\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Benchmark Summary                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nTotal benchmark time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log('\nAll benchmarks completed successfully! ✓');
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    throw error;
  }
}

// Export for use in test environments
export {
  runBenchmarks,
  benchmarkUrgencyCalculation,
  benchmarkMultiFieldSorting,
  benchmarkUrgencyFiltering,
  benchmarkUrgencyBreakdown,
};
