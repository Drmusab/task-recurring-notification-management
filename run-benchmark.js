/**
 * Simple benchmark runner for Phase 1 Week 1
 * Validates QueryCache and TaskIndexManager performance
 */

import { runBenchmarks } from './benchmarks/phase1-week1-benchmark';

console.log('Starting Phase 1, Week 1 Performance Benchmarks...\n');

runBenchmarks()
  .then(() => {
    console.log('\n✅ All benchmarks completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  });
