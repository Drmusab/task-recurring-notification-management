# Block API Usage Examples

This guide demonstrates how to use the new centralized Block API in the task-recurring-notification-management plugin.

---

## 📦 Importing

```typescript
import { BlockAPI, TaskBlockService } from "@backend/core/api/block-api";
import type { Plugin } from "siyuan";
```

---

## 🔧 Basic Block Operations

### Initialize BlockAPI

```typescript
class MyService {
  private blockAPI: BlockAPI;

  constructor(plugin: Plugin) {
    this.blockAPI = new BlockAPI(plugin);
  }
}
```

### Create a Block

```typescript
// Insert block at cursor
async createNewBlock(content: string): Promise<any> {
  return await this.blockAPI.insertBlock("markdown", content);
}

// Append to parent block
async appendToParent(parentId: string, content: string): Promise<any> {
  return await this.blockAPI.appendBlock(parentId, "markdown", content);
}

// Prepend to parent block
async prependToParent(parentId: string, content: string): Promise<any> {
  return await this.blockAPI.prependBlock(parentId, "markdown", content);
}
```

### Update a Block

```typescript
async updateBlockContent(blockId: string, newContent: string): Promise<any> {
  return await this.blockAPI.updateBlock(blockId, newContent, "markdown");
}
```

### Delete a Block

```typescript
async removeBlock(blockId: string): Promise<any> {
  return await this.blockAPI.deleteBlock(blockId);
}
```

---

## 🏷️ Block Attributes

### Set Custom Attributes

```typescript
async tagTaskBlock(blockId: string, taskId: string): Promise<any> {
  return await this.blockAPI.setBlockAttrs(blockId, {
    "custom-task-id": taskId,
    "custom-task-type": "recurring",
    "custom-priority": "high",
    "custom-due-date": "2026-02-21"
  });
}
```

### Get Block Attributes

```typescript
async getTaskMetadata(blockId: string): Promise<any> {
  const attrs = await this.blockAPI.getBlockAttrs(blockId);
  return attrs;
}
```

---

## ✅ Task-Specific Operations

### Initialize TaskBlockService

```typescript
class TaskIntegrationService {
  private taskBlockService: TaskBlockService;

  constructor(plugin: Plugin) {
    this.taskBlockService = new TaskBlockService(plugin);
  }
}
```

### Create Task Block

```typescript
async createRecurringTaskBlock(task: Task): Promise<string> {
  const blockId = await this.taskBlockService.createTaskBlock({
    id: task.id,
    name: task.name,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt,
    enabled: task.enabled
  });
  
  console.log("Created task block:", blockId);
  return blockId;
}

// Create as child of specific block
async createTaskUnderParent(task: Task, parentBlockId: string): Promise<string> {
  return await this.taskBlockService.createTaskBlock(task, parentBlockId);
}
```

### Update Task Block

```typescript
async syncTaskToBlock(task: Task, blockId: string): Promise<void> {
  await this.taskBlockService.updateTaskBlock(blockId, {
    id: task.id,
    name: task.name,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueAt: task.dueAt,
    enabled: task.enabled
  });
}
```

### Find Task Blocks

```typescript
async findAllTaskBlocks(taskId: string): Promise<any[]> {
  const blocks = await this.taskBlockService.findTaskBlocks(taskId);
  
  console.log(`Found ${blocks.length} blocks for task ${taskId}`);
  return blocks;
}
```

---

## 🗃️ SQL Queries

### Query Blocks by Attributes

```typescript
async findTasksByPriority(priority: string): Promise<any[]> {
  const sql = `
    SELECT * FROM blocks 
    WHERE type='p' 
    AND ial LIKE '%custom-priority="${priority}"%'
    ORDER BY updated DESC
  `;
  
  const result = await this.blockAPI.sql(sql);
  return result || [];
}

async findOverdueTasks(today: string): Promise<any[]> {
  const sql = `
    SELECT * FROM blocks 
    WHERE type='p' 
    AND ial LIKE '%custom-task-type="recurring"%'
    AND ial LIKE '%custom-due-date%'
    AND json_extract(ial, '$.custom-due-date') < '${today}'
  `;
  
  return await this.blockAPI.sql(sql) || [];
}
```

### Count Tasks

```typescript
async countTaskBlocks(): Promise<number> {
  const sql = `
    SELECT COUNT(*) as count FROM blocks 
    WHERE ial LIKE '%custom-task-id%'
  `;
  
  const result = await this.blockAPI.sql(sql);
  return result?.[0]?.count || 0;
}
```

---

## 📝 Document Operations

### Create Document with Tasks

```typescript
async createTaskDocument(notebookId: string, path: string): Promise<string> {
  const markdown = `
# Daily Tasks

## High Priority
- [ ] [high] Important task 1
- [ ] [high] Important task 2

## Normal Priority
- [ ] [medium] Regular task 1
- [ ] [medium] Regular task 2

## Low Priority
- [ ] [low] Optional task 1
  `;
  
  const docId = await this.blockAPI.createDocWithMd(
    notebookId,
    path,
    markdown
  );
  
  return docId;
}
```

---

## 🔄 Complete Workflow Example

### Create and Link Recurring Task

```typescript
class RecurringTaskWorkflow {
  private blockAPI: BlockAPI;
  private taskBlockService: TaskBlockService;
  private taskStorage: TaskStorage;

  constructor(plugin: Plugin, taskStorage: TaskStorage) {
    this.blockAPI = new BlockAPI(plugin);
    this.taskBlockService = new TaskBlockService(plugin);
    this.taskStorage = taskStorage;
  }

  /**
   * Complete workflow: Create task in storage and link to SiYuan block
   */
  async createLinkedRecurringTask(
    taskData: {
      name: string;
      description?: string;
      priority: string;
      dueAt: string;
      frequency: any;
    },
    parentBlockId?: string
  ): Promise<{ task: Task; blockId: string }> {
    // 1. Create task in storage
    const task: Task = {
      id: crypto.randomUUID(),
      name: taskData.name,
      description: taskData.description || "",
      status: "todo",
      priority: taskData.priority as any,
      dueAt: taskData.dueAt,
      scheduledAt: undefined,
      startAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
      frequency: taskData.frequency,
      dependsOn: [],
      blockActions: [],
      tags: [],
      category: "",
      completionCount: 0,
      missCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      version: 1,
    };

    await this.taskStorage.saveTask(task);

    // 2. Create block in SiYuan
    const blockId = await this.taskBlockService.createTaskBlock(
      task,
      parentBlockId
    );

    // 3. Link block ID back to task
    task.blockActions = [{
      type: "insert",
      targetBlockId: blockId,
      content: task.name,
      timing: "immediate"
    } as any];

    await this.taskStorage.saveTask(task);

    return { task, blockId };
  }

  /**
   * Update both task storage and SiYuan block
   */
  async updateLinkedTask(task: Task, blockId: string): Promise<void> {
    // 1. Update task in storage
    await this.taskStorage.saveTask(task);

    // 2. Update block in SiYuan
    await this.taskBlockService.updateTaskBlock(blockId, task);
  }

  /**
   * Find all blocks linked to a task
   */
  async getTaskBlocks(taskId: string): Promise<any[]> {
    return await this.taskBlockService.findTaskBlocks(taskId);
  }

  /**
   * Generate next occurrence and create new block
   */
  async generateNextOccurrence(task: Task, parentBlockId?: string): Promise<string> {
    // Generate next occurrence date (implement based on recurrence engine)
    const nextDueAt = "2026-02-22"; // Placeholder

    // Create new block for next occurrence
    const nextTask = {
      ...task,
      dueAt: nextDueAt,
      status: "todo" as const
    };

    return await this.taskBlockService.createTaskBlock(nextTask, parentBlockId);
  }
}
```

---

## 🎯 Real-World Integration Example

### TaskStorage Integration

Update `src/backend/core/storage/TaskStorage.ts`:

```typescript
import { BlockAPI, TaskBlockService } from "@backend/core/api/block-api";

export class TaskStorage {
  private blockAPI: BlockAPI;
  private taskBlockService: TaskBlockService;

  constructor(plugin: Plugin) {
    this.blockAPI = new BlockAPI(plugin);
    this.taskBlockService = new TaskBlockService(plugin);
    // ... existing initialization
  }

  /**
   * Save task and optionally sync to block
   */
  async saveTask(task: Task, syncToBlock = false, blockId?: string): Promise<void> {
    // 1. Save to storage (existing logic)
    await this.saveTaskToStorage(task);

    // 2. Optionally sync to SiYuan block
    if (syncToBlock && blockId) {
      try {
        await this.taskBlockService.updateTaskBlock(blockId, task);
      } catch (error) {
        console.warn("Failed to sync task to block:", error);
        // Non-fatal - task is already saved to storage
      }
    }
  }

  /**
   * Create task with automatic block creation
   */
  async createTaskWithBlock(
    task: Task,
    parentBlockId?: string
  ): Promise<{ task: Task; blockId: string }> {
    // 1. Save task
    await this.saveTask(task);

    // 2. Create block
    const blockId = await this.taskBlockService.createTaskBlock(task, parentBlockId);

    return { task, blockId };
  }
}
```

---

## ⚠️ Error Handling

### Recommended Pattern

```typescript
async safeCreateTaskBlock(task: Task): Promise<string | null> {
  try {
    const blockId = await this.taskBlockService.createTaskBlock(task);
    console.log("✅ Task block created:", blockId);
    return blockId;
  } catch (error) {
    console.error("❌ Failed to create task block:", error);
    
    // Show user-friendly message
    if (error instanceof Error) {
      showMessage(`Block creation failed: ${error.message}`, 5000, "error");
    }
    
    return null;
  }
}
```

---

## 🧪 Testing Examples

### Unit Test

```typescript
import { describe, it, expect, vi } from "vitest";
import { BlockAPI } from "@backend/core/api/block-api";

describe("BlockAPI", () => {
  it("should create block with correct parameters", async () => {
    const mockPlugin = {} as Plugin;
    const blockAPI = new BlockAPI(mockPlugin);

    // Mock fetchSyncPost
    vi.mock("siyuan", () => ({
      fetchSyncPost: vi.fn().mockResolvedValue({
        code: 0,
        data: [{ doOperations: [{ id: "block-123" }] }]
      })
    }));

    const result = await blockAPI.insertBlock("markdown", "Test content");
    expect(result).toBeDefined();
  });
});
```

---

## 📚 Additional Resources

- **SiYuan Block API**: https://github.com/siyuan-note/siyuan/blob/master/API.md
- **Official Plugin Sample**: `plugin-sample-vite-svelte-main/src/api.ts`
- **Plugin Architecture**: `REFACTOR_ARCHITECTURE.md`

---

## 🔧 Troubleshooting

### Issue: Block not created

**Solution**: Check if `fetchPost` is available and SiYuan API is responding

```typescript
try {
  const result = await this.blockAPI.insertBlock("markdown", content);
  if (!result) {
    console.error("API returned null - check SiYuan connection");
  }
} catch (error) {
  console.error("Block API error:", error);
}
```

### Issue: Attributes not set

**Solution**: Ensure block ID is valid before setting attributes

```typescript
if (blockId && blockId.length > 0) {
  await this.blockAPI.setBlockAttrs(blockId, attrs);
} else {
  console.warn("Invalid block ID, skipping attributes");
}
```

---

**Last Updated**: 2026-02-21
