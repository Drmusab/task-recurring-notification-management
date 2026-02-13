# SiYuan Integration Tests - Quick Reference

## 🚀 Quick Start

### Check if SiYuan is Running
```bash
npm run test:check-siyuan
```

**Expected Output (when ready)**:
```
✅ SiYuan is running
   Version: 3.0.0
📚 Found 3 notebook(s)
🔌 WebSocket connection successful
✨ SiYuan is ready for integration tests!
```

### Run Integration Tests
```bash
npm run test:integration
```

---

## 📋 Prerequisites

1. **SiYuan must be running**
   - Start SiYuan application
   - Verify it opens at `http://127.0.0.1:6806`

2. **Create test notebook**
   - Open SiYuan
   - New Notebook → Name: "Integration Tests"
   - Create at least one document inside

3. **Run connection check**
   ```bash
   npm run test:check-siyuan
   ```

---

## 📊 Test Coverage

**14 Integration Tests**:
- ✅ Kernel connection (3 tests)
- ✅ Block attributes (2 tests)
- ✅ SQL queries (3 tests)
- ✅ WebSocket (2 tests)
- ✅ End-to-end workflows (2 tests)
- ✅ Performance (2 tests)

**API Coverage**:
- `/api/system/version` - Health check
- `/api/notebook/lsNotebooks` - List notebooks
- `/api/attr/setBlockAttrs` - Write attributes
- `/api/attr/getBlockAttrs` - Read attributes
- `/api/block/insertBlock` - Create blocks
- `/api/block/deleteBlock` - Delete blocks
- `/api/query/sql` - SQL queries
- `ws://127.0.0.1:6806/ws` - WebSocket

---

## 🎯 What Gets Tested

### Block Attributes Schema
```typescript
{
  'custom-task-id': 'uuid-...',
  'custom-task-name': 'Task name',
  'custom-task-status': 'todo' | 'done' | 'cancelled',
  'custom-task-enabled': 'true' | 'false',
  'custom-task-due': '2026-02-14T00:00:00.000Z',
  'custom-task-completed-at': '2026-02-13T14:30:00.000Z',
  'custom-task-recurrence-rrule': 'FREQ=DAILY;INTERVAL=1'
}
```

### SQL Queries Tested
```sql
-- Find all task blocks
SELECT * FROM blocks WHERE id IN (
    SELECT block_id FROM attributes WHERE name = 'custom-task-id'
)

-- Find tasks in specific document
SELECT * FROM blocks WHERE root_id = '...' AND id IN (
    SELECT block_id FROM attributes WHERE name = 'custom-task-id'
)
```

### WebSocket Messages
```json
{
  "cmd": "transactions",
  "data": [
    {
      "doOperations": [
        {
          "action": "update",
          "id": "block-id"
        }
      ]
    }
  ]
}
```

---

## 🐛 Troubleshooting

### "SiYuan is not running"
**Solution**: 
1. Launch SiYuan application
2. Wait ~5 seconds for startup
3. Verify browser opens at `http://127.0.0.1:6806`
4. Re-run: `npm run test:check-siyuan`

### "No notebooks found"
**Solution**:
1. Open SiYuan
2. Click "New Notebook"
3. Name it "Test" or "Integration Tests"
4. Create at least one document
5. Re-run tests

### WebSocket timeout
**Check**:
```bash
# Install wscat if needed
npm install -g wscat

# Test WebSocket manually
wscat -c ws://127.0.0.1:6806/ws
```

---

## 📁 Files

```
tests/integration/
├── SiYuanTestClient.ts          - HTTP client
├── cache-integration.test.ts    - Test suite (14 tests)
├── check-siyuan.ts              - Connection checker
├── README.md                    - Detailed docs
├── SETUP_GUIDE.md               - Setup instructions
└── QUICK_REFERENCE.md           - This file
```

---

## 📚 Related Docs

- [Setup Guide](./SETUP_GUIDE.md) - Step-by-step setup
- [Full README](./README.md) - Comprehensive documentation
- [Implementation Summary](../../PHASE2_DAYS6-7_INTEGRATION.md) - What was built
- [Cache Implementation](../../PHASE2_CACHE_IMPLEMENTATION.md) - Cache architecture

---

## ✅ Status

**Days 6-7**: ✅ **COMPLETE**  
**Integration Tests**: ✅ Ready to run (requires SiYuan)  
**Next Phase**: Days 8-9 (Unit tests for Cache.ts)

---

**Last Updated**: February 13, 2026
