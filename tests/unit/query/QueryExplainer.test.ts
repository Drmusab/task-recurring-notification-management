/**
 * Unit Tests for QueryExplainer
 *
 * Tests the query explanation functionality:
 * - Explanation generation for various filter types
 * - Matched/unmatched task explanation
 * - Markdown export format
 * - Filter explainable interface compliance
 *
 * @module QueryExplainerTest
 */

import { describe, it, expect, beforeEach } from "vitest";
import { QueryExplainer, type Explanation } from "@backend/core/query/QueryExplainer";
import { QueryEngine } from "@backend/core/query/QueryEngine";
import { Task } from "@backend/core/models/Task";
import { PriorityFilter } from "@backend/core/query/filters/PriorityFilter";
import { StatusOpenFilter } from "@backend/core/query/filters/StatusOpenFilter";
import { DueDateFilter } from "@backend/core/query/filters/DueDateFilter";
import { TagFilter } from "@backend/core/query/filters/TagFilter";
import { PathFilter } from "@backend/core/query/filters/PathFilter";
import { BooleanAndFilter } from "@backend/core/query/filters/BooleanAndFilter";
import { BooleanOrFilter } from "@backend/core/query/filters/BooleanOrFilter";
import { BooleanNotFilter } from "@backend/core/query/filters/BooleanNotFilter";
import type { QueryAST } from "@backend/core/query/QueryTypes";

describe("QueryExplainer", () => {
  let explainer: QueryExplainer;
  let taskIndex: any;
  let tasks: Task[];

  beforeEach(() => {
    explainer = new QueryExplainer();

    // Create sample tasks for testing
    tasks = [
      new Task({
        id: "task1",
        name: "High priority overdue task",
        description: "Important work task",
        dueAt: new Date("2024-01-01").toISOString(),
        path: "/work/project",
        priority: 1,
        status: "open",
        tags: ["urgent", "important"],
        createdAt: new Date("2023-12-01").toISOString(),
        updatedAt: new Date("2023-12-01").toISOString()
      }),
      new Task({
        id: "task2",
        name: "Medium priority upcoming task",
        description: "Personal task",
        dueAt: new Date("2024-12-31").toISOString(),
        path: "/personal/goals",
        priority: 2,
        status: "open",
        tags: ["personal"],
        createdAt: new Date("2024-01-01").toISOString(),
        updatedAt: new Date("2024-01-01").toISOString()
      }),
      new Task({
        id: "task3",
        name: "Low priority completed task",
        description: "Done task",
        dueAt: new Date("2024-06-01").toISOString(),
        path: "/archive",
        priority: 3,
        status: "done",
        tags: ["completed"],
        createdAt: new Date("2024-05-01").toISOString(),
        updatedAt: new Date("2024-06-02").toISOString()
      })
    ];

    taskIndex = {
      getAllTasks: () => tasks
    };
  });

  describe("explainQuery", () => {
    it("should generate explanation for simple filter", () => {
      const ast: QueryAST = {
        type: "filter",
        filter: new PriorityFilter("high")
      };

      const result = { tasks: [tasks[0]], explanation: null };
      const explanation = explainer.explainQuery(ast, result.tasks, tasks);

      expect(explanation).toBeDefined();
      expect(explanation.queryDescription).toContain("Priority is high");
      expect(explanation.matchedTasks.length).toBe(1);
      expect(explanation.notMatchedTasks.length).toBe(2);
      expect(explanation.totalTasks).toBe(3);
    });

    it("should generate explanation for AND boolean filter", () => {
      const ast: QueryAST = {
        type: "filter",
        filter: new BooleanAndFilter([
          new PriorityFilter("high"),
          new StatusOpenFilter()
        ])
      };

      const explanation = explainer.explainQuery(ast, [tasks[0]], tasks);

      expect(explanation.queryDescription).toContain("Priority is high");
      expect(explanation.queryDescription).toContain("AND");
      expect(explanation.queryDescription).toContain("Status is open");
    });

    it("should generate explanation for OR boolean filter", () => {
      const ast: QueryAST = {
        type: "filter",
        filter: new BooleanOrFilter([
          new PriorityFilter("high"),
          new PriorityFilter("medium")
        ])
      };

      const explanation = explainer.explainQuery(ast, [tasks[0], tasks[1]], tasks);

      expect(explanation.queryDescription).toContain("Priority is high");
      expect(explanation.queryDescription).toContain("OR");
      expect(explanation.queryDescription).toContain("Priority is medium");
      expect(explanation.matchedTasks.length).toBe(2);
    });

    it("should generate explanation for NOT boolean filter", () => {
      const ast: QueryAST = {
        type: "filter",
        filter: new BooleanNotFilter(new PriorityFilter("high"))
      };

      const explanation = explainer.explainQuery(ast, [tasks[1], tasks[2]], tasks);

      expect(explanation.queryDescription).toContain("NOT");
      expect(explanation.queryDescription).toContain("Priority is high");
      expect(explanation.matchedTasks.length).toBe(2);
      expect(explanation.notMatchedTasks.length).toBe(1);
    });

    it("should generate explanation for complex nested filter", () => {
      const ast: QueryAST = {
        type: "filter",
        filter: new BooleanAndFilter([
          new BooleanOrFilter([
            new PriorityFilter("high"),
            new PriorityFilter("medium")
          ]),
          new StatusOpenFilter()
        ])
      };

      const explanation = explainer.explainQuery(ast, [tasks[0], tasks[1]], tasks);

      expect(explanation.queryDescription).toContain("(");
      expect(explanation.queryDescription).toContain(")");
      expect(explanation.queryDescription).toContain("AND");
      expect(explanation.queryDescription).toContain("OR");
    });
  });

  describe("explainMatches", () => {
    it("should explain why tasks matched for single filter", () => {
      const filter = new PriorityFilter("high");
      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [tasks[0]],
        tasks
      );

      const match = explanation.matchedTasks[0];
      expect(match.taskId).toBe("task1");
      expect(match.reasons.length).toBeGreaterThan(0);
      expect(match.reasons[0]).toContain("Priority is high");
    });

    it("should explain why tasks matched for AND filter", () => {
      const filter = new BooleanAndFilter([
        new PriorityFilter("high"),
        new TagFilter("#urgent")
      ]);

      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [tasks[0]],
        tasks
      );

      const match = explanation.matchedTasks[0];
      expect(match.reasons.length).toBe(2);
      expect(match.reasons.some(r => r.includes("Priority is high"))).toBe(true);
      expect(match.reasons.some(r => r.includes("urgent"))).toBe(true);
    });

    it("should explain why tasks matched for OR filter", () => {
      const filter = new BooleanOrFilter([
        new PriorityFilter("high"),
        new PriorityFilter("medium")
      ]);

      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [tasks[0], tasks[1]],
        tasks
      );

      expect(explanation.matchedTasks.length).toBe(2);
      expect(explanation.matchedTasks[0].reasons.length).toBeGreaterThan(0);
      expect(explanation.matchedTasks[1].reasons.length).toBeGreaterThan(0);
    });

    it("should explain why tasks did NOT match", () => {
      const filter = new PriorityFilter("high");
      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [tasks[0]],
        tasks
      );

      expect(explanation.notMatchedTasks.length).toBe(2);
      const notMatched = explanation.notMatchedTasks.find(t => t.taskId === "task2");
      expect(notMatched).toBeDefined();
      expect(notMatched!.reasons.length).toBeGreaterThan(0);
      expect(notMatched!.reasons[0]).toContain("Priority is not high");
    });
  });

  describe("explainAsMarkdown", () => {
    it("should generate markdown format with all sections", () => {
      const filter = new PriorityFilter("high");
      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [tasks[0]],
        tasks
      );

      const markdown = explanation.asMarkdown();

      expect(markdown).toContain("# Query Explanation");
      expect(markdown).toContain("## Summary");
      expect(markdown).toContain("**Matched:**");
      expect(markdown).toContain("**Not Matched:**");
      expect(markdown).toContain("**Total:**");
      expect(markdown).toContain("## Query");
      expect(markdown).toContain("## Matched Tasks");
      expect(markdown).toContain("## Not Matched Tasks");
    });

    it("should include task names and reasons in markdown", () => {
      const filter = new PriorityFilter("high");
      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [tasks[0]],
        tasks
      );

      const markdown = explanation.asMarkdown();

      expect(markdown).toContain("High priority overdue task");
      expect(markdown).toContain("Priority is high");
    });

    it("should format complex queries correctly in markdown", () => {
      const filter = new BooleanAndFilter([
        new PriorityFilter("high"),
        new BooleanOrFilter([
          new TagFilter("#urgent"),
          new PathFilter("/work")
        ])
      ]);

      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [tasks[0]],
        tasks
      );

      const markdown = explanation.asMarkdown();

      expect(markdown).toContain("Priority is high");
      expect(markdown).toContain("AND");
      expect(markdown).toContain("OR");
    });
  });

  describe("Filter Explainable Interface", () => {
    it("should require explain() method on all filters", () => {
      const filters = [
        new PriorityFilter("high"),
        new StatusOpenFilter(),
        new TagFilter("#test"),
        new PathFilter("/test"),
        new DueDateFilter("before", new Date()),
        new BooleanAndFilter([]),
        new BooleanOrFilter([]),
        new BooleanNotFilter(new PriorityFilter("low"))
      ];

      filters.forEach(filter => {
        expect(filter.explain).toBeDefined();
        expect(typeof filter.explain).toBe("function");
        expect(filter.explain()).toBeTruthy();
      });
    });

    it("should require explainMatch() method on all filters", () => {
      const filters = [
        new PriorityFilter("high"),
        new StatusOpenFilter(),
        new TagFilter("#test")
      ];

      filters.forEach(filter => {
        expect(filter.explainMatch).toBeDefined();
        expect(typeof filter.explainMatch).toBe("function");
        expect(filter.explainMatch(tasks[0])).toBeTruthy();
      });
    });

    it("should require explainMismatch() method on all filters", () => {
      const filters = [
        new PriorityFilter("high"),
        new StatusOpenFilter(),
        new TagFilter("#test")
      ];

      filters.forEach(filter => {
        expect(filter.explainMismatch).toBeDefined();
        expect(typeof filter.explainMismatch).toBe("function");
        expect(filter.explainMismatch(tasks[0])).toBeTruthy();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty result set", () => {
      const filter = new PriorityFilter("ultra-high");
      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [],
        tasks
      );

      expect(explanation.matchedTasks.length).toBe(0);
      expect(explanation.notMatchedTasks.length).toBe(3);
    });

    it("should handle all tasks matching", () => {
      const filter = new StatusOpenFilter();
      const matched = tasks.filter(t => t.status === "open");
      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        matched,
        tasks
      );

      expect(explanation.matchedTasks.length).toBe(2);
      expect(explanation.notMatchedTasks.length).toBe(1);
    });

    it("should handle empty task list", () => {
      const filter = new PriorityFilter("high");
      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [],
        []
      );

      expect(explanation.matchedTasks.length).toBe(0);
      expect(explanation.notMatchedTasks.length).toBe(0);
      expect(explanation.totalTasks).toBe(0);
    });

    it("should handle deeply nested boolean filters", () => {
      const filter = new BooleanAndFilter([
        new BooleanOrFilter([
          new PriorityFilter("high"),
          new BooleanAndFilter([
            new PriorityFilter("medium"),
            new TagFilter("#urgent")
          ])
        ]),
        new StatusOpenFilter()
      ]);

      const explanation = explainer.explainQuery(
        { type: "filter", filter },
        [tasks[0]],
        tasks
      );

      expect(explanation.queryDescription).toBeTruthy();
      expect(explanation.queryDescription.length).toBeGreaterThan(0);
    });
  });

  describe("QueryEngine Integration", () => {
    it("should integrate with QueryEngine.executeWithExplanation()", () => {
      const filter = new PriorityFilter("high");
      const ast: QueryAST = { type: "filter", filter };

      const queryEngine = new QueryEngine(taskIndex);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      expect(result).toBeDefined();
      expect(result.tasks).toBeDefined();
      expect(explanation).toBeDefined();
      expect(explanation.queryDescription).toBeTruthy();
      expect(explanation.matchedTasks.length + explanation.notMatchedTasks.length).toBe(tasks.length);
    });

    it("should preserve task references in explanation", () => {
      const filter = new PriorityFilter("high");
      const ast: QueryAST = { type: "filter", filter };

      const queryEngine = new QueryEngine(taskIndex);
      const { result, explanation } = queryEngine.executeWithExplanation(ast);

      explanation.matchedTasks.forEach(match => {
        const originalTask = tasks.find(t => t.id === match.taskId);
        expect(originalTask).toBeDefined();
        expect(match.taskName).toBe(originalTask!.name);
      });
    });
  });
});
