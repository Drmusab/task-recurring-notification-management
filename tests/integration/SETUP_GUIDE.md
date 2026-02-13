# SiYuan Integration Testing Setup Guide

Complete guide for setting up and running SiYuan kernel integration tests.

---

## 🎯 Overview

Integration tests validate the Cache system against a **real SiYuan instance**, testing:
- WebSocket connections (`ws://127.0.0.1:6806/ws`)
- Block attribute persistence (`custom-task-*` attributes)
- SQL queries for task blocks
- Real-time event handling
- End-to-end cache workflows

**Status**: ⏳ Ready to run (requires SiYuan)

---

## 📋 Step-by-Step Setup

### Step 1: Start SiYuan

**Download SiYuan** (if not installed):
- Official site: https://b3log.org/siyuan/en/
- GitHub: https://github.com/siyuan-note/siyuan/releases

**Launch SiYuan**:
- **Windows**: Run `SiYuan.exe`
- **macOS**: Open `SiYuan.app`
- **Linux**: Execute `./SiYuan.AppImage`

**Verify Running**:
- SiYuan should open in browser/app window
- Default URL: `http://127.0.0.1:6806`

---

### Step 2: Create Test Notebook

**IMPORTANT**: Use a dedicated test notebook, not production data!

1. In SiYuan, click **"New Notebook"**
2. Name it: `Integration Tests` or `Test`
3. Create at least one document inside the notebook
4. Recommended: Add some sample content (optional)

**Why?** Integration tests will create/modify blocks. Using a test notebook ensures your production notes are safe.

---

### Step 3: Verify SiYuan Connection

Run the connection check script:

```bash
npm run test:check-siyuan
```

**Expected Output** (when SiYuan is running):
```
🔍 Checking SiYuan kernel connection...

✅ SiYuan is running
   Version: 3.0.0
   URL: http://127.0.0.1:6806

📚 Found 3 notebook(s):
   1. Integration Tests (20240109123456-abcdefg)
   2. Work Notes (20240108000000-xyz123)
   3. Personal (20240107000000-abc789)

📄 Total documents: 42

🔌 Testing WebSocket connection...
✅ WebSocket connection successful

✨ SiYuan is ready for integration tests!

Run tests with: npm run test:integration
```

**If SiYuan is NOT running**, you'll see:
```
❌ SiYuan is NOT running or not accessible

Please ensure:
  1. SiYuan application is running
  2. SiYuan is listening on port 6806
  3. No firewall is blocking localhost connections
```

---

### Step 4: Run Integration Tests

Once SiYuan is running and verified:

```bash
npm run test:integration
```

**This will**:
1. Connect to SiYuan kernel
2. Create test blocks with `custom-task-*` attributes
3. Test WebSocket real-time updates
4. Execute SQL queries
5. Validate end-to-end workflows
6. **Automatically clean up** all test blocks

**Test Duration**: ~5-10 seconds (14 tests)

---

## 📊 Test Results

### Sample Output

```
✓ Connected to SiYuan 3.0.0
✓ Using test notebook: Integration Tests (20240109123456-abcdefg)
✓ Using test document: 20240109123457-hijklmn

SiYuan Cache Integration Tests
  1. SiYuan Kernel Connection
    ✓ should ping SiYuan kernel successfully (45ms)
    ✓ should get SiYuan version (32ms)
    ✓ should list available notebooks (28ms)

  2. Block Attribute Operations
    ✓ should write and read block attributes (156ms)
    ✓ should update existing block attributes (142ms)

  3. SQL Query Operations
    ✓ should query blocks with custom-task-id attribute (187ms)
    ✓ should query task blocks in specific document (165ms)
    ✓ should execute complex SQL queries (89ms)

  4. WebSocket Connection
    ✓ should connect to SiYuan WebSocket (234ms)
    ✓ should receive WebSocket messages for block updates (3012ms)

  5. End-to-End Cache Workflow
    ✓ should perform complete task lifecycle (456ms)
    ✓ should handle multiple task blocks in document (892ms)

  6. Performance & Stress Tests
    ✓ should handle rapid attribute updates (1234ms)
    ✓ should query large result sets efficiently (189ms)

Cleaning up 12 test blocks...

✅ 14 passed | Total: 14 | Duration: 8.45s
```

---

## 🛠️ Configuration

### Custom Port

If SiYuan runs on a different port, update the test file:

**File**: `tests/integration/cache-integration.test.ts`

```typescript
const SIYUAN_URL = 'http://127.0.0.1:6806'; // Change port here
```

### Test Timeout

For slower systems, increase timeout:

```typescript
const TEST_TIMEOUT = 20000; // Increase to 20 seconds
```

---

## ⚠️ Important Notes

### Data Safety

- ✅ **Test blocks are automatically deleted** after tests
- ✅ Tests create blocks with `test-` prefix in IDs
- ⚠️ **Always use a dedicated test notebook**
- ⚠️ **Do NOT run against production notebooks**

### Manual Cleanup (if needed)

If tests fail and leave orphaned blocks:

**Option 1: Delete in SiYuan UI**
1. Search for blocks with `custom-task-id` starting with `test-`
2. Delete manually

**Option 2: SQL Query** (advanced)
```sql
-- View test blocks
SELECT * FROM blocks WHERE id IN (
    SELECT block_id FROM attributes 
    WHERE name = 'custom-task-id' AND value LIKE 'test-%'
)
```

---

## 🐛 Troubleshooting

### "SiYuan is not running"

**Cause**: SiYuan application is not started

**Solution**:
1. Launch SiYuan application
2. Wait for it to fully start (~5 seconds)
3. Verify you can access http://127.0.0.1:6806 in browser
4. Re-run: `npm run test:check-siyuan`

---

### "No notebooks found"

**Cause**: SiYuan has no notebooks created

**Solution**:
1. Open SiYuan
2. Click **"New Notebook"**
3. Name it "Test" or "Integration Tests"
4. Create at least one document inside
5. Re-run tests

---

### WebSocket connection timeout

**Possible Causes**:
- Firewall blocking `ws://` connections
- SiYuan WebSocket disabled (rare)
- Antivirus blocking local WebSocket

**Solution**:
```bash
# Test WebSocket manually
npm install -g wscat
wscat -c ws://127.0.0.1:6806/ws
```

If connection works, WebSocket tests should pass.

---

### Tests timeout on slow systems

**Cause**: System is slow or SiYuan is under heavy load

**Solution**: Increase test timeout in `cache-integration.test.ts`

```typescript
const TEST_TIMEOUT = 20000; // 20 seconds
```

---

### Port 6806 in use

**Cause**: Another application is using port 6806

**Solution**:
1. Find process using port:
   ```powershell
   netstat -ano | findstr :6806
   ```
2. Kill the process or change SiYuan port in settings
3. Update `SIYUAN_URL` in test files

---

## 📈 What's Tested

### API Endpoints

| Endpoint | Test Coverage |
|----------|---------------|
| `/api/system/version` | Kernel connection |
| `/api/notebook/lsNotebooks` | Notebook discovery |
| `/api/attr/setBlockAttrs` | Write attributes |
| `/api/attr/getBlockAttrs` | Read attributes |
| `/api/block/insertBlock` | Create blocks |
| `/api/block/deleteBlock` | Cleanup |
| `/api/query/sql` | Task queries |
| `ws://127.0.0.1:6806/ws` | Real-time updates |

### Block Attributes

Tests verify these `custom-task-*` attributes work correctly:

- `custom-task-id` - UUID
- `custom-task-name` - Task name
- `custom-task-status` - `todo` | `done` | `cancelled`
- `custom-task-enabled` - `true` | `false`
- `custom-task-due` - ISO 8601 date
- `custom-task-completed-at` - ISO 8601 timestamp
- `custom-task-recurrence-rrule` - RFC 5545 RRule

---

## 🚀 Quick Start (TL;DR)

```bash
# 1. Start SiYuan application

# 2. Check connection
npm run test:check-siyuan

# 3. Run integration tests
npm run test:integration

# 4. (Optional) Run with UI
npm run test:integration -- --ui
```

---

## 📚 Related Documentation

- [Integration Tests README](./README.md) - Detailed test documentation
- [Cache Implementation](../../PHASE2_CACHE_IMPLEMENTATION.md) - Cache architecture
- [API Mapping](../../../API_MAPPING_OBSIDIAN_TO_SIYUAN.md) - SiYuan API reference
- [Performance Benchmarks](../../PERFORMANCE_BENCHMARK_RESULTS.md) - Benchmark results

---

## ✅ Validation Checklist

Before running integration tests, verify:

- [ ] SiYuan is running
- [ ] Can access http://127.0.0.1:6806
- [ ] At least one notebook exists
- [ ] At least one document exists in a notebook
- [ ] Using a dedicated test notebook (not production)
- [ ] `npm run test:check-siyuan` passes
- [ ] WebSocket connection test passes

Once all items are checked, run:

```bash
npm run test:integration
```

---

**Last Updated**: February 13, 2026  
**SiYuan Compatibility**: v2.x, v3.x  
**Test Framework**: Vitest + ws (WebSocket)
