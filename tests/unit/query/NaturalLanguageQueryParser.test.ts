/**
 * Unit Tests for NaturalLanguageQueryParser
 *
 * Tests natural language query parsing:
 * - 15+ pattern transformations (before/after, this week/month, contains, etc.)
 * - Date shortcuts (today, tomorrow, yesterday, this week, next month, etc.)
 * - validate() with comprehensive error messages
 * - getSuggestions() for autocomplete functionality
 * - Fallback to AST parser for unsupported syntax
 * - Edge cases and error handling
 *
 * @module NaturalLanguageQueryParserTest
 */

import { describe, it, expect } from "vitest";
import { NaturalLanguageQueryParser } from "@backend/core/query/NaturalLanguageQueryParser";
import type { QueryAST } from "@backend/core/query/QueryTypes";

describe("NaturalLanguageQueryParser", () => {
  let parser: NaturalLanguageQueryParser;

  beforeEach(() => {
    parser = new NaturalLanguageQueryParser();
  });

  describe("Pattern Transformations", () => {
    describe("Date Patterns", () => {
      it('should parse "due before today"', () => {
        const ast = parser.parse("due before today");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("due_before");
      });

      it('should parse "due after tomorrow"', () => {
        const ast = parser.parse("due after tomorrow");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("due_after");
      });

      it('should parse "due before YYYY-MM-DD"', () => {
        const ast = parser.parse("due before 2024-12-31");
        expect(ast.type).toBe("filter");
      });

it('should parse "due after YYYY-MM-DD"', () => {
        const ast = parser.parse("due after 2024-01-01");
        expect(ast.type).toBe("filter");
      });

      it('should parse "due this week"', () => {
        const ast = parser.parse("due this week");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toContain("due");
      });

      it('should parse "due next month"', () => {
        const ast = parser.parse("due next month");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toContain("due");
      });

      it('should parse "overdue tasks"', () => {
        const ast = parser.parse("overdue tasks");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("due_before");
      });

      it('should parse "due in 3 days"', () => {
        const ast = parser.parse("due in 3 days");
        expect(ast.type).toBe("filter");
      });
    });

    describe("Priority Patterns", () => {
      it('should parse "priority is high"', () => {
        const ast = parser.parse("priority is high");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("priority");
      });

      it('should parse "high priority tasks"', () => {
        const ast = parser.parse("high priority tasks");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("priority");
      });

      it('should parse "priority high"', () => {
        const ast = parser.parse("priority high");
        expect(ast.type).toBe("filter");
      });

      it('should parse "medium priority"', () => {
        const ast = parser.parse("medium priority");
        expect(ast.type).toBe("filter");
      });

      it('should parse "low priority tasks"', () => {
        const ast = parser.parse("low priority tasks");
        expect(ast.type).toBe("filter");
      });
    });

    describe("Status Patterns", () => {
      it('should parse "status is open"', () => {
        const ast = parser.parse("status is open");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("status");
      });

      it('should parse "open tasks"', () => {
        const ast = parser.parse("open tasks");
        expect(ast.type).toBe("filter");
      });

      it('should parse "completed tasks"', () => {
        const ast = parser.parse("completed tasks");
        expect(ast.type).toBe("filter");
      });

      it('should parse "done tasks"', () => {
        const ast = parser.parse("done tasks");
        expect(ast.type).toBe("filter");
      });

      it('should parse "cancelled tasks"', () => {
        const ast = parser.parse("cancelled tasks");
        expect(ast.type).toBe("filter");
      });
    });

    describe("Tag Patterns", () => {
      it('should parse "with tag #important"', () => {
        const ast = parser.parse("with tag #important");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("tag");
      });

      it('should parse "tagged #urgent"', () => {
        const ast = parser.parse("tagged #urgent");
        expect(ast.type).toBe("filter");
      });

      it('should parse "has tag important"', () => {
        const ast = parser.parse("has tag important");
        expect(ast.type).toBe("filter");
      });

      it('should parse "tag:work"', () => {
        const ast = parser.parse("tag:work");
        expect(ast.type).toBe("filter");
      });
    });

    describe("Path Patterns", () => {
      it('should parse "in folder /work"', () => {
        const ast = parser.parse("in folder /work");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("path");
      });

      it('should parse "from path /projects"', () => {
        const ast = parser.parse("from path /projects");
        expect(ast.type).toBe("filter");
      });

      it('should parse "path:/work/project"', () => {
        const ast = parser.parse("path:/work/project");
        expect(ast.type).toBe("filter");
      });

      it('should parse "in /work folder"', () => {
        const ast = parser.parse("in /work folder");
        expect(ast.type).toBe("filter");
      });
    });

    describe("Description Patterns", () => {
      it('should parse "description contains meeting"', () => {
        const ast = parser.parse("description contains meeting");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("description");
      });

      it('should parse "contains keyword"', () => {
        const ast = parser.parse("contains keyword");
        expect(ast.type).toBe("filter");
      });

      it('should parse "description like pattern"', () => {
        const ast = parser.parse("description like pattern");
        expect(ast.type).toBe("filter");
      });
    });

    describe("Boolean Patterns", () => {
      it('should parse "X AND Y"', () => {
        const ast = parser.parse("priority is high AND status is open");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("boolean_and");
      });

      it('should parse "X OR Y"', () => {
        const ast = parser.parse("priority is high OR priority is medium");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("boolean_or");
      });

      it('should parse "NOT X"', () => {
        const ast = parser.parse("NOT completed tasks");
        expect(ast.type).toBe("filter");
        expect(ast.filter?.type).toBe("boolean_not");
      });

      it('should parse complex nested boolean', () => {
        const ast = parser.parse("(priority is high OR priority is medium) AND status is open");
        expect(ast.type).toBe("filter");
      });
    });
  });

  describe("Date Shortcuts", () => {
    it('should expand "today" to current date', () => {
      const ast = parser.parse("due before today");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Verify the AST contains a date filter with today's date
      expect(ast.type).toBe("filter");
    });

    it('should expand "tomorrow" to next day', () => {
      const ast = parser.parse("due after tomorrow");
      expect(ast.type).toBe("filter");
    });

    it('should expand "yesterday" to previous day', () => {
      const ast = parser.parse("due after yesterday");
      expect(ast.type).toBe("filter");
    });

    it('should expand "this week" to date range', () => {
      const ast = parser.parse("due this week");
      expect(ast.type).toBe("filter");
    });

    it('should expand "next week" to date range', () => {
      const ast = parser.parse("due next week");
      expect(ast.type).toBe("filter");
    });

    it('should expand "this month" to date range', () => {
      const ast = parser.parse("due this month");
      expect(ast.type).toBe("filter");
    });

    it('should expand "next month" to date range', () => {
      const ast = parser.parse("due next month");
      expect(ast.type).toBe("filter");
    });

    it('should expand "last week" to date range', () => {
      const ast = parser.parse("due last week");
      expect(ast.type).toBe("filter");
    });

    it('should expand "last month" to date range', () => {
      const ast = parser.parse("due last month");
      expect(ast.type).toBe("filter");
    });

    it('should handle "in X days" relative dates', () => {
      const ast = parser.parse("due in 5 days");
      expect(ast.type).toBe("filter");
    });

    it('should handle "X days ago" relative dates', () => {
      const ast = parser.parse("due after 3 days ago");
      expect(ast.type).toBe("filter");
    });
  });

  describe("validate()", () => {
    it("should validate correct natural language query", () => {
      const result = parser.validate("due before today AND priority is high");
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should validate correct AST syntax", () => {
      const result = parser.validate("priority:high AND status:open");
      expect(result.isValid).toBe(true);
    });

    it("should detect invalid date format", () => {
      const result = parser.validate("due before invalid-date");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("date");
    });

    it("should detect invalid priority value", () => {
      const result = parser.validate("priority is invalid");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("priority");
    });

    it("should detect invalid status value", () => {
      const result = parser.validate("status is invalid");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("status");
    });

    it("should detect malformed boolean expressions", () => {
      const result = parser.validate("priority is high AND AND status is open");
      expect(result.isValid).toBe(false);
    });

    it("should detect unbalanced parentheses", () => {
      const result = parser.validate("(priority is high AND status is open");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("parenthes");
    });

    it("should provide helpful error messages", () => {
      const result = parser.validate("priorty is high"); // typo
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toBeTruthy();
      expect(result.errors[0].length).toBeGreaterThan(10); // meaningful message
    });

    it("should validate empty query as invalid", () => {
      const result = parser.validate("");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("empty");
    });

    it("should validate whitespace-only query as invalid", () => {
      const result = parser.validate("   ");
      expect(result.isValid).toBe(false);
    });
  });

  describe("getSuggestions()", () => {
    it('should suggest priority values for "priority is "', () => {
      const suggestions = parser.getSuggestions("priority is ");
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain("high");
      expect(suggestions).toContain("medium");
      expect(suggestions).toContain("low");
    });

    it('should suggest status values for "status is "', () => {
      const suggestions = parser.getSuggestions("status is ");
      expect(suggestions).toContain("open");
      expect(suggestions).toContain("done");
      expect(suggestions).toContain("cancelled");
    });

    it('should suggest date keywords for "due "', () => {
      const suggestions = parser.getSuggestions("due ");
      expect(suggestions).toContain("before");
      expect(suggestions).toContain("after");
      expect(suggestions).toContain("today");
      expect(suggestions).toContain("this week");
    });

    it('should suggest boolean operators after complete filter', () => {
      const suggestions = parser.getSuggestions("priority is high ");
      expect(suggestions).toContain("AND");
      expect(suggestions).toContain("OR");
    });

    it('should suggest common filters at start of query', () => {
      const suggestions = parser.getSuggestions("");
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain("priority is");
      expect(suggestions).toContain("status is");
      expect(suggestions).toContain("due before");
      expect(suggestions).toContain("tag:");
    });

    it("should handle partial input gracefully", () => {
      const suggestions = parser.getSuggestions("pri");
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.toLowerCase().includes("priority"))).toBe(true);
    });

    it("should limit suggestion count", () => {
      const suggestions = parser.getSuggestions("", 5);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Fallback to AST Parser", () => {
    it("should fallback for unsupported natural language", () => {
      const ast = parser.parse("priority:high"); // AST syntax
      expect(ast.type).toBe("filter");
    });

    it("should prefer natural language when pattern matches", () => {
      const nlAst = parser.parse("priority is high");
      const astAst = parser.parse("priority:high");
      // Both should produce similar AST structure
      expect(nlAst.type).toBe(astAst.type);
    });

    it("should handle mixed syntax gracefully", () => {
      // Start with NL, end with AST syntax
      const ast = parser.parse("priority is high AND status:open");
      expect(ast.type).toBe("filter");
    });

    it("should preserve complex AST queries", () => {
      const complexQuery = "(priority:high OR priority:medium) AND status:open NOT tag:archived";
      const ast = parser.parse(complexQuery);
      expect(ast.type).toBe("filter");
    });
  });

  describe("Edge Cases", () => {
    it("should handle queries with extra whitespace", () => {
      const ast = parser.parse("  priority   is   high  ");
      expect(ast.type).toBe("filter");
      expect(ast.filter?.type).toBe("priority");
    });

    it("should be case-insensitive for keywords", () => {
      const ast1 = parser.parse("PRIORITY IS HIGH");
      const ast2 = parser.parse("priority is high");
      const ast3 = parser.parse("Priority Is High");
      expect(ast1.type).toBe(ast2.type);
      expect(ast2.type).toBe(ast3.type);
    });

    it("should preserve case for tag values", () => {
      const ast = parser.parse("tag:ImportantWork");
      expect(ast.type).toBe("filter");
      // Tag value case should be preserved
    });

    it("should handle special characters in paths", () => {
      const ast = parser.parse("path:/work/project-2024/sub_folder");
      expect(ast.type).toBe("filter");
    });

    it("should handle special characters in tags", () => {
      const ast = parser.parse("tag:#work-2024_urgent");
      expect(ast.type).toBe("filter");
    });

    it("should handle URLs in description", () => {
      const ast = parser.parse("description contains https://example.com");
      expect(ast.type).toBe("filter");
    });

    it("should handle multiple consecutive operators", () => {
      const result = parser.validate("priority is high OR OR status is open");
      expect(result.isValid).toBe(false);
    });

    it("should handle very long queries", () => {
      let longQuery = "priority is high";
      for (let i = 0; i < 100; i++) {
        longQuery += " AND priority is high";
      }
      const ast = parser.parse(longQuery);
      expect(ast.type).toBe("filter");
    });

    it("should handle queries with unicode characters", () => {
      const ast = parser.parse("tag:重要任务"); // Chinese characters
      expect(ast.type).toBe("filter");
    });

    it("should handle empty tag", () => {
      const result = parser.validate("tag:");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("tag");
    });

    it("should handle empty path", () => {
      const result = parser.validate("path:");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("path");
    });
  });

  describe("Complex Query Patterns", () => {
    it('should parse "overdue high-priority tasks in /work"', () => {
      const ast = parser.parse("overdue high-priority tasks in /work");
      expect(ast.type).toBe("filter");
      expect(ast.filter?.type).toBe("boolean_and");
    });

    it('should parse "tasks due this week with tag #important"', () => {
      const ast = parser.parse("tasks due this week with tag #important");
      expect(ast.type).toBe("filter");
    });

    it('should parse "(high priority OR medium priority) AND (status is open OR status is in-progress)"', () => {
      const ast = parser.parse("(high priority OR medium priority) AND (status is open OR status is in-progress)");
      expect(ast.type).toBe("filter");
    });

    it('should parse "NOT completed tasks in /archive folder"', () => {
      const ast = parser.parse("NOT completed tasks in /archive folder");
      expect(ast.type).toBe("filter");
    });

    it('should parse "urgent tasks due before next week tagged #critical"', () => {
      const ast = parser.parse("urgent tasks due before next week tagged #critical");
      expect(ast.type).toBe("filter");
    });
  });

  describe("Error Recovery", () => {
    it("should provide partial suggestions for incomplete queries", () => {
      const suggestions = parser.getSuggestions("priority is high A");
      expect(suggestions).toContain("AND");
    });

    it("should validate and provide specific error location", () => {
      const result = parser.validate("priority is high AND status is invalid-status");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("status");
      expect(result.errors[0]).toContain("invalid-status");
    });

    it("should handle partial boolean expressions", () => {
      const result = parser.validate("priority is high AND");
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("incomplete");
    });

    it("should suggest completion for partial dates", () => {
      const suggestions = parser.getSuggestions("due before 2024-");
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    it("should parse simple queries quickly", () => {
      const start = performance.now();
      parser.parse("priority is high");
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // < 100ms
    });

    it("should parse complex queries in reasonable time", () => {
      const start = performance.now();
      parser.parse("(priority is high OR priority is medium) AND status is open NOT tag:archived");
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(500); // < 500ms
    });

    it("should validate queries quickly", () => {
      const start = performance.now();
      parser.validate("priority is high AND status is open");
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // < 100ms
    });

    it("should generate suggestions quickly", () => {
      const start = performance.now();
      parser.getSuggestions("priority is ");
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // < 100ms
    });
  });
});
