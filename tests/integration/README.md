# SiYuan Cache Integration Tests

Comprehensive integration tests for the SiYuan Cache system with real SiYuan kernel API.

## 📋 Prerequisites

### 1. **SiYuan Running**
- SiYuan must be running on `localhost:6806`
- Default installation: Start SiYuan application
- Custom port: Update `SIYUAN_URL` in test files

### 2. **Test Notebook**
- At least one notebook must exist in SiYuan
- Tests will use the first available notebook
- **WARNING**: Do not run tests against production notebooks!
- Recommended: Create a dedicated "Test" notebook

### 3. **Test Document**
- At least one document should exist in the test notebook
- Tests will create/modify blocks in this document
- All test blocks are cleaned up automatically after tests

### 4. **Dependencies**
```bash
npm install
```

---

## 🚀 Running Tests

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Specific Test Suite
```bash
npx vitest tests/integration/cache-integration.test.ts
```

### Watch Mode (Auto-rerun on changes)
```bash
npx vitest tests/integration --watch
```

### With UI Dashboard
```bash
npx vitest tests/integration --ui
```

---

## 📊 Test Coverage

### Test Categories

#### 1. **SiYuan Kernel Connection** (3 tests)
- ✅ Ping SiYuan kernel
- ✅ Get SiYuan version
- ✅ List available notebooks

#### 2. **Block Attribute Operations** (2 tests)
- ✅ Write and read block attributes
- ✅ Update existing block attributes

#### 3. **SQL Query Operations** (3 tests)
- ✅ Query blocks with `custom-task-id` attribute
- ✅ Query task blocks in specific document
- ✅ Execute complex SQL queries

#### 4. **WebSocket Connection** (2 tests)
- ✅ Connect to SiYuan WebSocket (`ws://127.0.0.1:6806/ws`)
- ✅ Receive WebSocket messages for block updates

#### 5. **End-to-End Cache Workflow** (2 tests)
- ✅ Complete task lifecycle (create → update → query)
- ✅ Handle multiple task blocks in document

#### 6. **Performance & Stress Tests** (2 tests)
- ✅ Rapid attribute updates (20 updates)
- ✅ Large result set queries (1000 blocks)

**Total Tests**: 14

---

## 🔧 Configuration

### Custom SiYuan URL

Edit test file to use custom port:

```typescript
const SIYUAN_URL = 'http://127.0.0.1:6806'; // Change port here
```

### Test Timeout

Adjust timeout for slow systems:

```typescript
const TEST_TIMEOUT = 10000; // 10 seconds (default)
```

---

## 📝 Test Output Example

```
✓ Connected to SiYuan 3.0.0
✓ Using test notebook: Test (20240109123456-abcdefg)
✓ Using test document: 20240109123457-hijklmn

SiYuan Cache Integration Tests
  1. SiYuan Kernel Connection
    ✓ should ping SiYuan kernel successfully (45ms)
    ✓ should get SiYuan version (32ms)
        SiYuan version: 3.0.0
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
        ✓ Received WebSocket message: transactions

  5. End-to-End Cache Workflow
    ✓ should perform complete task lifecycle (456ms)
        1. Created block: 20240213123456-xyz
        2. Set task attributes
        3. Verified attributes
        4. Updated to completed
        5. Verified status update
        6. Task found via SQL query
        ✓ Complete lifecycle test passed
    ✓ should handle multiple task blocks in document (892ms)
        Created 5 test tasks
        ✓ All 5 tasks found in document query

  6. Performance & Stress Tests
    ✓ should handle rapid attribute updates (1234ms)
        Average update time: 45.67ms
    ✓ should query large result sets efficiently (189ms)
        Query time (1000 blocks): 167.23ms

Cleaning up 12 test blocks...

Test Files  1 passed (1)
     Tests  14 passed (14)
  Start at  14:30:00
  Duration  8.45s
```

---

## 🧪 What Gets Tested

### SiYuan API Endpoints

| Endpoint | Method | Test Coverage |
|----------|--------|---------------|
| `/api/system/version` | POST | Kernel connection, version check |
| `/api/notebook/lsNotebooks` | POST | Notebook discovery |
| `/api/attr/setBlockAttrs` | POST | Write task attributes |
| `/api/attr/getBlockAttrs` | POST | Read task attributes |
| `/api/block/insertBlock` | POST | Create test blocks |
| `/api/block/deleteBlock` | POST | Cleanup test data |
| `/api/query/sql` | POST | Task queries, batch operations |
| `ws://127.0.0.1:6806/ws` | WebSocket | Real-time updates |

### Block Attributes Schema

Tests verify the following `custom-task-*` attributes:

- `custom-task-id` - Unique task identifier
- `custom-task-name` - Task name/title
- `custom-task-status` - `todo` | `done` | `cancelled`
- `custom-task-enabled` - `true` | `false`
- `custom-task-due` - ISO 8601 date string
- `custom-task-completed-at` - ISO 8601 timestamp
- `custom-task-recurrence-rrule` - RFC 5545 RRule

---

## ⚠️ Safety & Cleanup

### Automatic Cleanup
- All test blocks are tracked in `testBlockIds[]`
- `afterAll()` hook deletes all test blocks
- Failed tests may leave orphaned blocks (rare)

### Manual Cleanup
If tests fail and leave test blocks:

```sql
-- Find test blocks
SELECT * FROM blocks WHERE id IN (
    SELECT block_id FROM attributes 
    WHERE name = 'custom-task-id' 
    AND value LIKE 'test-%'
)

-- Delete via SQL (use with caution!)
-- Better: Delete manually in SiYuan UI
```

### Best Practices
1. ✅ Use dedicated test notebook
2. ✅ Don't run against production data
3. ✅ Review test output for cleanup confirmation
4. ✅ Check for orphaned test blocks after failures

---

## 🐛 Troubleshooting

### "SiYuan is not running"
**Solution**: Start SiYuan application before running tests

```bash
# Check if SiYuan is running
curl http://127.0.0.1:6806/api/system/version

# Expected response:
{"code":0,"msg":"","data":{"version":"3.0.0"}}
```

### "No notebooks found"
**Solution**: Create at least one notebook in SiYuan

1. Open SiYuan
2. Click "New Notebook"
3. Re-run tests

### WebSocket connection timeout
**Possible causes**:
- SiYuan WebSocket disabled (rare)
- Firewall blocking `ws://` connections
- Port 6806 in use by another service

**Solution**:
```bash
# Check WebSocket endpoint
wscat -c ws://127.0.0.1:6806/ws
```

### Attribute updates fail
**Possible causes**:
- Block doesn't exist (deleted manually)
- Invalid block ID
- SiYuan API version incompatibility

**Solution**: Check SiYuan version compatibility
- Tested with: SiYuan 2.x, 3.x
- Older versions may have different API contracts

### Tests timeout on slow systems
**Solution**: Increase test timeout

```typescript
const TEST_TIMEOUT = 20000; // Increase to 20 seconds
```

---

## 📈 Performance Benchmarks

Expected performance on modern systems:

| Operation | Target | Typical |
|-----------|--------|---------|
| **Ping kernel** | <50ms | ~30ms |
| **Block attribute write** | <100ms | ~50ms |
| **Block attribute read** | <80ms | ~40ms |
| **SQL query (100 blocks)** | <100ms | ~60ms |
| **SQL query (1000 blocks)** | <500ms | ~170ms |
| **WebSocket connection** | <2s | ~200ms |
| **Complete lifecycle** | <1s | ~450ms |

---

## 🔗 Related Documentation

- [Cache Implementation](../../PHASE2_CACHE_IMPLEMENTATION.md)
- [API Mapping](../../../API_MAPPING_OBSIDIAN_TO_SIYUAN.md)
- [Performance Benchmarks](../../PERFORMANCE_BENCHMARK_RESULTS.md)
- [SiYuan API Docs](https://github.com/siyuan-note/siyuan/blob/master/API.md)

---

## 🚀 Next Steps

After integration tests pass:

1. ✅ **Days 6-7 Complete**: SiYuan kernel integration validated
2. ⏳ **Days 8-9**: Write unit tests for Cache system
3. ⏳ **Day 10**: Complete documentation

---

**Last Updated**: February 13, 2026  
**Test Framework**: Vitest  
**SiYuan Version**: 2.x, 3.x compatible
