/**
 * Phase 1, Week 2 Benchmarks: Storage Optimization
 * 
 * Validates performance targets:
 * - BatchBlockSync: 90%+ API call reduction
 * - OptimizedJSON: 2-3x faster serialization
 * - ArchiveCompression: 70-80% compression ratio
 */

import { BatchBlockSync } from '../src/backend/core/storage/BatchBlockSync';
import { getOptimizedJSON } from '../src/backend/core/storage/OptimizedJSON';
import { getArchiveCompression } from '../src/backend/core/storage/ArchiveCompression';
import type { Task } from '../src/backend/core/models/Task';

// Mock SiYuan Block API for testing
class MockBlockAPI {
  private callCount = 0;

  async setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    this.callCount++;
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
  }
}

// Generate test tasks
function generateTestTasks(count: number): Map<string, Task> {
  const tasks = new Map<string, Task>();
  for (let i = 0; i < count; i++) {
    const task: Task = {
      id: `task-${i}`,
      name: `Test Task ${i}`,
      dueAt: new Date(2024, 0, 1 + i).toISOString(),
      enabled: i % 2 === 0,
      linkedBlockId: `block-${i}`,
      recurrence: {
        rrule: 'FREQ=DAILY;INTERVAL=1',
        baseOnToday: false,
        humanReadable: 'Daily',
      },
      tags: [`tag-${i % 10}`],
      priority: (i % 3 === 0 ? 'high' : 'normal') as any,
      recentCompletions: [],
      createdAt: new Date(2024, 0, 1).toISOString(),
      updatedAt: new Date(2024, 0, 1).toISOString(),
    };
    tasks.set(task.id, task);
  }
  return tasks;
}

// Benchmark 1: BatchBlockSync API Call Reduction
async function benchmarkBatchSync(): Promise<void> {
  console.log('\n=== Benchmark 1: BatchBlockSync API Call Reduction ===');
  
  const mockAPI = new MockBlockAPI();
  const updateCount = 1000;

  // Test without batching (baseline)
  console.log(`\n1. Baseline (no batching): ${updateCount} individual updates`);
  mockAPI.reset();
  const baselineStart = performance.now();
  
  for (let i = 0; i < updateCount; i++) {
    await mockAPI.setBlockAttrs(`block-${i}`, {
      'task-id': `task-${i}`,
      'task-due': new Date().toISOString(),
      'task-enabled': 'true',
    });
  }
  
  const baselineEnd = performance.now();
  const baselineTime = baselineEnd - baselineStart;
  const baselineCalls = mockAPI.getCallCount();
  
  console.log(`   Time: ${baselineTime.toFixed(2)}ms`);
  console.log(`   API Calls: ${baselineCalls}`);

  // Test with batching
  console.log(`\n2. With BatchBlockSync (500ms debounce, 100 max batch)`);
  mockAPI.reset();
  const batchSync = new BatchBlockSync(mockAPI, 500, 100);
  const batchStart = performance.now();
  
  for (let i = 0; i < updateCount; i++) {
    batchSync.queueUpdate(`block-${i}`, {
      'task-id': `task-${i}`,
      'task-due': new Date().toISOString(),
      'task-enabled': 'true',
    });
  }
  
  // Wait for flush
  await batchSync.flush();
  const batchEnd = performance.now();
  const batchTime = batchEnd - batchStart;
  const batchCalls = mockAPI.getCallCount();
  
  console.log(`   Time: ${batchTime.toFixed(2)}ms`);
  console.log(`   API Calls: ${batchCalls}`);
  
  const stats = batchSync.getStats();
  console.log(`\n3. Results:`);
  console.log(`   Total updates queued: ${stats.totalQueued}`);
  console.log(`   Total batches flushed: ${stats.batchesFlushed}`);
  console.log(`   Total API calls: ${stats.apiCalls}`);
  console.log(`   Total updates processed: ${stats.updatesProcessed}`);
  console.log(`   Average batch size: ${stats.avgBatchSize.toFixed(2)}`);
  console.log(`   API call reduction: ${stats.reductionPercent.toFixed(2)}%`);
  console.log(`   Time saved: ${(baselineTime - batchTime).toFixed(2)}ms (${((1 - batchTime / baselineTime) * 100).toFixed(1)}%)`);
  
  // Validate target
  const target = 90;
  const success = stats.reductionPercent >= target;
  console.log(`\n   ✓ Target: ${target}% reduction`);
  console.log(`   ${success ? '✓' : '✗'} Achieved: ${stats.reductionPercent.toFixed(2)}% ${success ? 'PASS' : 'FAIL'}`);
  
  await batchSync.destroy();
}

// Benchmark 2: OptimizedJSON Serialization
async function benchmarkOptimizedJSON(): Promise<void> {
  console.log('\n\n=== Benchmark 2: OptimizedJSON Serialization ===');
  
  const tasks = generateTestTasks(10000);
  console.log(`\nTest dataset: ${tasks.size} tasks`);

  // Test native JSON.stringify
  console.log(`\n1. Baseline (native JSON.stringify):`);
  const nativeStart = performance.now();
  const nativeJson = JSON.stringify(Array.from(tasks.values()));
  const nativeEnd = performance.now();
  const nativeTime = nativeEnd - nativeStart;
  const nativeSize = nativeJson.length;
  
  console.log(`   Time: ${nativeTime.toFixed(2)}ms`);
  console.log(`   Size: ${(nativeSize / 1024).toFixed(2)} KB`);

  // Test OptimizedJSON
  console.log(`\n2. OptimizedJSON (with null filtering):`);
  const optimizedJSON = getOptimizedJSON();
  const optimizedStart = performance.now();
  const optimizedJson = optimizedJSON.serialize(tasks, { 
    includeNulls: false, 
    pretty: false 
  });
  const optimizedEnd = performance.now();
  const optimizedTime = optimizedEnd - optimizedStart;
  const optimizedSize = optimizedJson.length;
  
  console.log(`   Time: ${optimizedTime.toFixed(2)}ms`);
  console.log(`   Size: ${(optimizedSize / 1024).toFixed(2)} KB`);

  // Test deserialization
  console.log(`\n3. Deserialization:`);
  const parseStart = performance.now();
  JSON.parse(nativeJson);
  const parseEnd = performance.now();
  const parseTime = parseEnd - parseStart;
  
  const optimizedParseStart = performance.now();
  optimizedJSON.deserialize(optimizedJson, false);
  const optimizedParseEnd = performance.now();
  const optimizedParseTime = optimizedParseEnd - optimizedParseStart;
  
  console.log(`   Native JSON.parse: ${parseTime.toFixed(2)}ms`);
  console.log(`   OptimizedJSON.deserialize: ${optimizedParseTime.toFixed(2)}ms`);

  // Test streaming deserialization
  console.log(`\n4. Streaming deserialization (batches of 1000):`);
  const streamStart = performance.now();
  let batchCount = 0;
  for await (const batch of optimizedJSON.streamDeserialize(optimizedJson, 1000)) {
    batchCount++;
  }
  const streamEnd = performance.now();
  const streamTime = streamEnd - streamStart;
  
  console.log(`   Time: ${streamTime.toFixed(2)}ms`);
  console.log(`   Batches: ${batchCount}`);

  console.log(`\n5. Results:`);
  const speedup = nativeTime / optimizedTime;
  console.log(`   Serialize speedup: ${speedup.toFixed(2)}x`);
  console.log(`   Size reduction: ${((1 - optimizedSize / nativeSize) * 100).toFixed(2)}%`);
  console.log(`   Deserialize speedup: ${(parseTime / optimizedParseTime).toFixed(2)}x`);
  
  // Validate target
  const targetSpeedup = 2.0;
  const success = speedup >= targetSpeedup;
  console.log(`\n   ✓ Target: ${targetSpeedup}x speedup`);
  console.log(`   ${success ? '✓' : '✗'} Achieved: ${speedup.toFixed(2)}x ${success ? 'PASS' : 'FAIL'}`);
}

// Benchmark 3: ArchiveCompression
async function benchmarkArchiveCompression(): Promise<void> {
  console.log('\n\n=== Benchmark 3: ArchiveCompression ===');
  
  // Generate realistic archive data (JSON with repetitive patterns)
  const tasks = generateTestTasks(5000);
  const jsonData = JSON.stringify(Array.from(tasks.values()));
  
  console.log(`\nTest dataset: ${tasks.size} tasks`);
  console.log(`Original size: ${(jsonData.length / 1024).toFixed(2)} KB`);

  const compression = getArchiveCompression();

  // Test compression
  console.log(`\n1. Compression:`);
  const compressStart = performance.now();
  const compressed = await compression.compress(jsonData);
  const compressEnd = performance.now();
  const compressTime = compressEnd - compressStart;
  
  const isCompressed = compression.isCompressed(compressed);
  const compressedSize = compressed.length;
  const ratio = compressedSize / jsonData.length;
  
  console.log(`   Time: ${compressTime.toFixed(2)}ms`);
  console.log(`   Compressed size: ${(compressedSize / 1024).toFixed(2)} KB`);
  console.log(`   Compression ratio: ${(ratio * 100).toFixed(2)}% of original`);
  console.log(`   Space saved: ${((1 - ratio) * 100).toFixed(2)}%`);
  console.log(`   Is compressed: ${isCompressed}`);

  // Test decompression
  console.log(`\n2. Decompression:`);
  const decompressStart = performance.now();
  const decompressed = await compression.decompress(compressed);
  const decompressEnd = performance.now();
  const decompressTime = decompressEnd - decompressStart;
  
  console.log(`   Time: ${decompressTime.toFixed(2)}ms`);
  console.log(`   Decompressed size: ${(decompressed.length / 1024).toFixed(2)} KB`);
  console.log(`   Data integrity: ${decompressed === jsonData ? 'PASS' : 'FAIL'}`);

  console.log(`\n3. Results:`);
  console.log(`   Compression throughput: ${(jsonData.length / 1024 / (compressTime / 1000)).toFixed(2)} KB/s`);
  console.log(`   Decompression throughput: ${(decompressed.length / 1024 / (decompressTime / 1000)).toFixed(2)} KB/s`);
  
  // Validate target
  const targetReduction = 70;
  const actualReduction = (1 - ratio) * 100;
  const success = actualReduction >= targetReduction;
  console.log(`\n   ✓ Target: ${targetReduction}% space reduction`);
  console.log(`   ${success ? '✓' : '✗'} Achieved: ${actualReduction.toFixed(2)}% ${success ? 'PASS' : 'FAIL'}`);
}

// Main benchmark runner
async function runBenchmarks(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      Phase 1, Week 2: Storage Optimization Benchmarks     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const totalStart = performance.now();
  
  try {
    await benchmarkBatchSync();
    await benchmarkOptimizedJSON();
    await benchmarkArchiveCompression();
    
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
  benchmarkBatchSync,
  benchmarkOptimizedJSON,
  benchmarkArchiveCompression,
};
