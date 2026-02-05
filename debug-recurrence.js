// Debug script to test recurrence calculator behavior
const base = new Date('2026-01-01T09:00:00Z');

console.log('Base date:', base.toISOString());

// Simulate monthly recurrence with day 31
let current = new Date(base);
for (let i = 0; i < 15; i++) {
  // Apply monthly: increment month, set day 31
  current.setMonth(current.getMonth() + 1);
  current.setDate(31);
  
  console.log(`Iteration ${i + 1}: ${current.toISOString().substring(0, 10)} - Day: ${current.getDate()}, Month: ${current.getMonth() + 1}`);
  
  // Check if day matches 31
  if (current.getDate() === 31) {
    console.log(`  ✓ Found day 31!`);
  } else {
    console.log(`  ✗ Day ${current.getDate()} !== 31 (rejected)`);
  }
}
