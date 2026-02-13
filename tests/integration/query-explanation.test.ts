/**
 * Integration Tests for Query Enhancement System (Phase 1)
 *
 * Tests end-to-end workflows:
 * - Natural language → parse → execute → explain
 * - Saved query persistence across sessions
 * - QueryEngine.executeWithExplanation() with all filter types
 * - Multi-filter boolean queries (AND/OR/NOT)
 * - UI component integration
 *
 * @module QueryEnhancementIntegrationTest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NaturalLanguageQueryParser } from "@backend/core/query/NaturalLanguageQueryParser";
import { QueryEngine } from "@backend/core/query/QueryEngine";
import { QueryExplainer } from "@backend/core/query/QueryExplainer";
import { SavedQueryStore, type SavedQuery } from "@backend/core/query/SavedQueryStore";
import { Task } from "@backend/core/models/Task";
import type { QueryAST } from "@backend/core/query/QueryTypes";

describe("Query Enhancement Integration", () => {
  let parser: NaturalLanguageQueryParser;
  let queryEngine: QueryEngine;
  let explainer: QueryExplainer;
  let taskIndex: any;
  let tasks: Task[];

  // Mock localStorage
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    parser = new NaturalLanguageQueryParser();
    explainer = new QueryExplainer();

    // Create comprehensive task set
    tasks = [
      new Task({
        id: "task1",
        name: "High priority overdue work task",
        description: "Critical project deadline",
        dueAt: new Date("2024-01-01").toISOString(),
        path: "/work/project-alpha",
        priority: 1,
        status: "open",
        tags: ["urgent", "important", "project"],
        createdAt: new Date("2023-12-01").toISOString(),
        updatedAt: new Date("2023-12-01").toISOString()
      }),
      new Task({
        id: "task2",
        name: "Medium priority upcoming personal task",
        description: "Review fitness goals",
        dueAt: new Date("2024-12-31").toISOString(),
        path: "/personal/health",
        priority: 2,
        status: "open",
        tags: ["personal", "health"],
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString()
      }),
      new Task({
        id: "task3",
        name: "Low priority completed archive task",
        description: "Archived work",
        dueAt: new Date("2024-06-01").toISOString(),
        path: "/archive/old-projects",
        priority: 3,
        status: "done",
        tags: ["completed", "archive"],
        createdAt: new Date("2024-05-01").toISOString(),
        updatedAt: new Date("2024-06-02").toISOString()
      }),
      new Task({
        id: "task4",
        name: "High priority today's work meeting",
        description: "Team standup meeting",
        dueAt: new Date().toISOString(),
        path: "/work/meetings",
        priority: 1,
        status: "open",
        tags: ["meeting", "team", "work"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }),
      new Task({
        id: "task5",
        name: "Medium priority personal shopping",
        description: "Buy groceries",
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        path: "/personal/errands",
        priority: 2,
        status: "open",
        tags: ["personal", "shopping"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    ];

    taskIndex = {
      getAllTasks: () => tasks
    };

    queryEngine = new QueryEngine(taskIndex);

    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      get length() {
        return Object.keys(localStorageMock).length;
      },
      key: vi.fn((index: number) => Object.keys(localStorageMock)[index] || null)
    } as Storage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("End-to-End: Natural Language → Parse → Execute → Explain", () => {
    it("should execute simple natural language query with explanation", () => {
      const nlQuery = "priority is high";

      // 1. Parse natural language
      const ast = parser.parse(nlQuery);
      expect(ast.type).toBe("filter");

      // 2. Execute query with explanation
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      // 3. Verify results
      expect(result.tasks.length).toBe(2); // task1 and task4
      expect(result.tasks.every((t) => t.priority === 1)).toBe(true);

      // 4. Verify explanation
      expect(explanation.queryDescription).toContain("Priority is high");
      expect(explanation.matchedTasks.length).toBe(2);
      expect(explanation.notMatchedTasks.length).toBe(3);
      expect(explanation.totalTasks).toBe(5);

      // 5. Verify matched task explanations
      explanation.matchedTasks.forEach((match) => {
        expect(match.reasons.length).toBeGreaterThan(0);
        expect(match.reasons[0]).toContain("Priority is high");
      });

      // 6. Verify not matched task explanations
      explanation.notMatchedTasks.forEach((notMatch) => {
        expect(notMatch.reasons.length).toBeGreaterThan(0);
        expect(notMatch.reasons[0]).toContain("Priority is not high");
      });
    });

    it("should execute complex AND query with explanation", () => {
      const nlQuery = "priority is high AND status is open";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.length).toBe(2); // task1 and task4 (both high priority and open)
      expect(explanation.queryDescription).toContain("Priority is high");
      expect(explanation.queryDescription).toContain("AND");
      expect(explanation.queryDescription).toContain("Status is open");
    });

    it("should execute complex OR query with explanation", () => {
      const nlQuery = "priority is high OR priority is medium";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.length).toBe(4); // task1, task2, task4, task5
      expect(explanation.queryDescription).toContain("Priority is high");
      expect(explanation.queryDescription).toContain("OR");
      expect(explanation.queryDescription).toContain("Priority is medium");
    });

    it("should execute NOT query with explanation", () => {
      const nlQuery = "NOT status is done";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.length).toBe(4); // All except task3
      expect(result.tasks.find((t) => t.id === "task3")).toBeUndefined();
      expect(explanation.queryDescription).toContain("NOT");
      expect(explanation.queryDescription).toContain("Status is done");
    });

    it("should execute nested boolean query with explanation", () => {
      const nlQuery = "(priority is high OR priority is medium) AND status is open";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.length).toBe(4); // task1, task2, task4, task5
      expect(result.tasks.every((t) => t.status === "open")).toBe(true);
      expect(result.tasks.every((t) => t.priority === 1 || t.priority === 2)).toBe(true);
    });

    it("should execute date-based query with explanation", () => {
      const nlQuery = "due before today";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      // task1 is overdue
      expect(result.tasks.find((t) => t.id === "task1")).toBeDefined();
      expect(explanation.queryDescription).toContain("due before");
    });

    it("should execute tag-based query with explanation", () => {
      const nlQuery = "with tag #urgent";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.every((t) => t.tags.includes("urgent"))).toBe(true);
      expect(explanation.queryDescription).toContain("tag");
    });

    it("should execute path-based query with explanation", () => {
      const nlQuery = "in folder /work";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.every((t) => t.path.startsWith("/work"))).toBe(true);
      expect(explanation.queryDescription).toContain("path");
    });

    it("should handle query with no results", () => {
      const nlQuery = "priority is ultra-high"; // Non-existent priority

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.length).toBe(0);
      expect(explanation.matchedTasks.length).toBe(0);
      expect(explanation.notMatchedTasks.length).toBe(5);
    });

    it("should generate markdown explanation", () => {
      const nlQuery = "priority is high AND status is open";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      const markdown = explanation.asMarkdown();

      expect(markdown).toContain("# Query Explanation");
      expect(markdown).toContain("## Summary");
      expect(markdown).toContain("**Matched:**");
      expect(markdown).toContain("**Not Matched:**");
      expect(markdown).toContain("## Query");
      expect(markdown).toContain("Priority is high");
      expect(markdown).toContain("## Matched Tasks");
      expect(markdown).toContain("## Not Matched Tasks");
    });
  });

  describe("Saved Query Persistence", () => {
    it("should save and load query across sessions", () => {
      const query: SavedQuery = {
        id: "q1",
        name: "High Priority Work Tasks",
        queryString: "priority is high AND in folder /work",
        description: "All high priority tasks in work folder",
        folder: "Work",
        tags: ["priority", "work"],
        pinned: false,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      };

      // Save query
      SavedQueryStore.save(query);

      // Load query (simulating new session)
      const loaded = SavedQueryStore.load();
      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe("q1");
      expect(loaded[0].queryString).toBe(query.queryString);

      // Update use count (simulate query execution)
      SavedQueryStore.update("q1", {
        useCount: 1,
        lastUsedAt: new Date().toISOString()
      });

      const updated = SavedQueryStore.get("q1");
      expect(updated?.useCount).toBe(1);
      expect(updated?.lastUsedAt).not.toBeNull();
    });

    it("should execute saved query end-to-end", () => {
      // 1. Save a query
      const savedQuery: SavedQuery = {
        id: "q1",
        name: "Overdue High Priority Tasks",
        queryString: "due before today AND priority is high",
        description: "Critical overdue tasks",
        folder: "Work",
        tags: ["overdue", "urgent"],
        pinned: true,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      };

      SavedQueryStore.save(savedQuery);

      // 2. Load saved query
      const loaded = SavedQueryStore.get("q1");
      expect(loaded).not.toBeNull();

      // 3. Parse and execute saved query
      const ast = parser.parse(loaded!.queryString);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      // 4. Verify results
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.every((t) => t.priority === 1)).toBe(true);

      // 5. Update use statistics
      SavedQueryStore.update("q1", {
        useCount: (loaded!.useCount || 0) + 1,
        lastUsedAt: new Date().toISOString()
      });

      // 6. Verify statistics update
      const updatedQuery = SavedQueryStore.get("q1");
      expect(updatedQuery?.useCount).toBe(1);
    });

    it("should export and import saved queries", () => {
      // Save multiple queries
      SavedQueryStore.save({
        id: "q1",
        name: "Query 1",
        queryString: "priority:high",
        description: "",
        folder: "Work",
        tags: [],
        pinned: false,
        useCount: 5,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      SavedQueryStore.save({
        id: "q2",
        name: "Query 2",
        queryString: "status:open",
        description: "",
        folder: "Personal",
        tags: [],
        pinned: false,
        useCount: 3,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      // Export
      const exportJson = SavedQueryStore.export();
      expect(exportJson).toBeTruthy();

      const exportData = JSON.parse(exportJson);
      expect(exportData.queries.length).toBe(2);

      // Clear storage (simulate new session)
      SavedQueryStore.delete("q1");
      SavedQueryStore.delete("q2");
      expect(SavedQueryStore.load().length).toBe(0);

      // Import
      SavedQueryStore.import(exportJson, true);
      const imported = SavedQueryStore.load();

      expect(imported.length).toBe(2);
      expect(imported.find((q) => q.id === "q1")).toBeDefined();
      expect(imported.find((q) => q.id === "q2")).toBeDefined();
    });

    it("should track query usage statistics", () => {
      SavedQueryStore.save({
        id: "q1",
        name: "Popular Query",
        queryString: "priority:high",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 50,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      });

      SavedQueryStore.save({
        id: "q2",
        name: "Less Used Query",
        queryString: "status:done",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 3,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString()
      });

      const stats = SavedQueryStore.getStats();
      expect(stats.totalQueries).toBe(2);
      expect(stats.totalUses).toBe(53);
      expect(stats.averageUses).toBe(26.5);

      const mostUsed = SavedQueryStore.getMostUsed(1);
      expect(mostUsed[0].id).toBe("q1");
    });
  });

  describe("Multi-Filter Boolean Queries", () => {
    it("should handle 3-level nested AND/OR", () => {
      const nlQuery = "((priority is high OR priority is medium) AND status is open) OR status is done";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.length).toBeGreaterThan(0);
      expect(explanation.queryDescription).toContain("OR");
      expect(explanation.queryDescription).toContain("AND");
    });

    it("should handle AND with multiple NOT filters", () => {
      const nlQuery = "NOT status is done AND NOT priority is low";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result.tasks.every((t) => t.status !== "done")).toBe(true);
      expect(result.tasks.every((t) => t.priority !== 3)).toBe(true);
    });

    it("should handle query with all filter types", () => {
      const nlQuery =
        "priority is high AND status is open AND due before today AND with tag #urgent AND in folder /work";

      const ast = parser.parse(nlQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      // Verify all filters are applied
      expect(explanation.queryDescription).toContain("Priority is high");
      expect(explanation.queryDescription).toContain("Status is open");
      expect(explanation.queryDescription).toContain("due before");
      expect(explanation.queryDescription).toContain("tag");
      expect(explanation.queryDescription).toContain("folder");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid natural language gracefully", () => {
      expect(() => {
        parser.parse("this is not a valid query syntax at all");
      }).not.toThrow();
    });

    it("should handle empty query string", () => {
      const result = parser.validate("");
      expect(result.isValid).toBe(false);
    });

    it("should provide helpful error messages", () => {
      const result = parser.validate("priority is invalid-value");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("priority");
    });

    it("should handle corrupted saved query storage", () => {
      localStorageMock["rtm:saved_queries"] = "invalid json {{{";
      const loaded = SavedQueryStore.load();
      expect(loaded).toEqual([]);
    });
  });

  describe("Performance", () => {
    it("should execute simple query in < 100ms", () => {
      const ast = parser.parse("priority is high");
      const start = performance.now();
      queryEngine.execute(ast);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it("should execute complex query in < 500ms", () => {
      const ast = parser.parse("(priority is high OR priority is medium) AND status is open");
      const start = performance.now();
      queryEngine.execute(ast);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500);
    });

    it("should generate explanation in < 200ms", () => {
      const ast = parser.parse("priority is high");
      const start = performance.now();
      queryEngine.executeWithExplanation(ast);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });

  describe("Real-World Scenarios", () => {
    it("Scenario: User searches for urgent work tasks", () => {
      // User types natural language query
      const userQuery = "urgent tasks in work folder";

      // Parse query
      const ast = parser.parse(userQuery);

      // Execute with explanation
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      // Verify results contain work tasks with urgent tag
      expect(result.tasks.every((t) => t.path.includes("/work"))).toBe(true);
      expect(result.tasks.every((t) => t.tags.includes("urgent"))).toBe(true);

      // User can see why each task matched or didn't match
      expect(explanation.matchedTasks.length).toBeGreaterThan(0);
      expect(explanation.matchedTasks[0].reasons.length).toBeGreaterThan(0);
    });

    it("Scenario: User saves frequently used query", () => {
      // User creates and saves query
      const query: SavedQuery = {
        id: "daily-review",
        name: "Daily Review",
        queryString: "status is open AND due before tomorrow",
        description: "Tasks to review daily",
        folder: "Daily",
        tags: ["review", "daily"],
        pinned: true,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      };

      SavedQueryStore.save(query);

      // User executes saved query multiple times
      for (let i = 0; i < 5; i++) {
        const saved = SavedQueryStore.get("daily-review");
        const ast = parser.parse(saved!.queryString);
        queryEngine.execute(ast);

        SavedQueryStore.update("daily-review", {
          useCount: (saved!.useCount || 0) + 1,
          lastUsedAt: new Date().toISOString()
        });
      }

      // Verify usage tracking
      const updated = SavedQueryStore.get("daily-review");
      expect(updated?.useCount).toBe(5);
      expect(updated?.lastUsedAt).not.toBeNull();

      // Query appears in "most used" list
      const mostUsed = SavedQueryStore.getMostUsed(5);
      expect(mostUsed.find((q) => q.id === "daily-review")).toBeDefined();
    });

    it("Scenario: Power user creates complex query", () => {
      const powerUserQuery =
        "(priority is high OR (priority is medium AND with tag #important)) AND " +
        "status is open AND " +
        "NOT in folder /archive AND " +
        "due before next week";

      // Parse and execute
      const ast = parser.parse(powerUserQuery);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      // All tasks match complex criteria
      result.tasks.forEach((task) => {
        expect(task.status).toBe("open");
        expect(task.path).not.toContain("/archive");
        expect(
          task.priority === 1 ||
          (task.priority === 2 && task.tags.includes("important"))
        ).toBe(true);
      });

      // Explanation is comprehensive
      expect(explanation.queryDescription.length).toBeGreaterThan(50);
      expect(explanation.matchedTasks.length + explanation.notMatchedTasks.length).toBe(tasks.length);
    });
  });
});
