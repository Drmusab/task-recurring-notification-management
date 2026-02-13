/**
 * Unit Tests for SavedQueryStore
 *
 * Tests saved query persistence and management:
 * - CRUD operations (save, load, get, delete, update)
 * - Search functionality (by term, folder, recent, most used)
 * - Folder management (save, delete, get folders)
 * - Statistics (total queries, total uses, average uses)
 * - Import/Export with overwrite flag
 * - localStorage persistence
 *
 * @module SavedQueryStoreTest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SavedQueryStore, type SavedQuery } from "@backend/core/query/SavedQueryStore";

describe("SavedQueryStore", () => {
  // Mock localStorage
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    // Reset localStorage mock
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

  describe("CRUD Operations", () => {
    describe("save()", () => {
      it("should save a new query", () => {
        const query: SavedQuery = {
          id: "q1",
          name: "High Priority Tasks",
          queryString: "priority:high",
          description: "All high priority tasks",
          folder: "Work",
          tags: ["priority", "work"],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        };

        SavedQueryStore.save(query);
        const loaded = SavedQueryStore.load();

        expect(loaded.length).toBe(1);
        expect(loaded[0].id).toBe("q1");
        expect(loaded[0].name).toBe("High Priority Tasks");
      });

      it("should generate ID if not provided", () => {
        const query: Partial<SavedQuery> = {
          name: "Test Query",
          queryString: "status:open"
        };

        SavedQueryStore.save(query as SavedQuery);
        const loaded = SavedQueryStore.load();

        expect(loaded.length).toBe(1);
        expect(loaded[0].id).toBeDefined();
        expect(loaded[0].id.length).toBeGreaterThan(0);
      });

      it("should set default values for optional fields", () => {
        const query: Partial<SavedQuery> = {
          name: "Test Query",
          queryString: "status:open"
        };

        SavedQueryStore.save(query as SavedQuery);
        const loaded = SavedQueryStore.load();

        expect(loaded[0].useCount).toBe(0);
        expect(loaded[0].pinned).toBe(false);
        expect(loaded[0].tags).toEqual([]);
        expect(loaded[0].lastUsedAt).toBeNull();
      });

      it("should update existing query with same ID", () => {
        const query: SavedQuery = {
          id: "q1",
          name: "Original Name",
          queryString: "priority:high",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        };

        SavedQueryStore.save(query);

        const updated: SavedQuery = {
          ...query,
          name: "Updated Name",
          description: "Updated description"
        };

        SavedQueryStore.save(updated);
        const loaded = SavedQueryStore.load();

        expect(loaded.length).toBe(1);
        expect(loaded[0].name).toBe("Updated Name");
        expect(loaded[0].description).toBe("Updated description");
      });
    });

    describe("load()", () => {
      it("should load all saved queries", () => {
        SavedQueryStore.save({
          id: "q1",
          name: "Query 1",
          queryString: "test1",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        });

        SavedQueryStore.save({
          id: "q2",
          name: "Query 2",
          queryString: "test2",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        });

        const loaded = SavedQueryStore.load();

        expect(loaded.length).toBe(2);
        expect(loaded.find((q) => q.id === "q1")).toBeDefined();
        expect(loaded.find((q) => q.id === "q2")).toBeDefined();
      });

      it("should return empty array if no queries saved", () => {
        const loaded = SavedQueryStore.load();
        expect(loaded).toEqual([]);
      });

      it("should handle corrupted localStorage data", () => {
        localStorageMock["rtm:saved_queries"] = "invalid json {{{";
        const loaded = SavedQueryStore.load();
        expect(loaded).toEqual([]);
      });
    });

    describe("get()", () => {
      beforeEach(() => {
        SavedQueryStore.save({
          id: "q1",
          name: "Query 1",
          queryString: "test1",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        });
      });

      it("should get query by ID", () => {
        const query = SavedQueryStore.get("q1");
        expect(query).toBeDefined();
        expect(query?.id).toBe("q1");
        expect(query?.name).toBe("Query 1");
      });

      it("should return null for non-existent ID", () => {
        const query = SavedQueryStore.get("nonexistent");
        expect(query).toBeNull();
      });
    });

    describe("delete()", () => {
      beforeEach(() => {
        SavedQueryStore.save({
          id: "q1",
          name: "Query 1",
          queryString: "test1",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        });

        SavedQueryStore.save({
          id: "q2",
          name: "Query 2",
          queryString: "test2",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        });
      });

      it("should delete query by ID", () => {
        SavedQueryStore.delete("q1");
        const loaded = SavedQueryStore.load();

        expect(loaded.length).toBe(1);
        expect(loaded.find((q) => q.id === "q1")).toBeUndefined();
        expect(loaded.find((q) => q.id === "q2")).toBeDefined();
      });

      it("should not throw error for non-existent ID", () => {
        expect(() => SavedQueryStore.delete("nonexistent")).not.toThrow();
      });
    });

    describe("update()", () => {
      beforeEach(() => {
        SavedQueryStore.save({
          id: "q1",
          name: "Original",
          queryString: "original query",
          description: "Original description",
          folder: "Work",
          tags: ["tag1"],
          pinned: false,
          useCount: 5,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        });
      });

      it("should update specific fields", () => {
        SavedQueryStore.update("q1", {
          name: "Updated Name",
          description: "Updated description"
        });

        const query = SavedQueryStore.get("q1");
        expect(query?.name).toBe("Updated Name");
        expect(query?.description).toBe("Updated description");
        expect(query?.queryString).toBe("original query"); // unchanged
        expect(query?.useCount).toBe(5); // unchanged
      });

      it("should increment use count", () => {
        SavedQueryStore.update("q1", { useCount: 6 });
        const query = SavedQueryStore.get("q1");
        expect(query?.useCount).toBe(6);
      });

      it("should update lastUsedAt", () => {
        const now = new Date().toISOString();
        SavedQueryStore.update("q1", { lastUsedAt: now });
        const query = SavedQueryStore.get("q1");
        expect(query?.lastUsedAt).toBe(now);
      });

      it("should not throw for non-existent ID", () => {
        expect(() => SavedQueryStore.update("nonexistent", { name: "Test" })).not.toThrow();
      });
    });
  });

  describe("Search Functionality", () => {
    beforeEach(() => {
      SavedQueryStore.save({
        id: "q1",
        name: "High Priority Work Tasks",
        queryString: "priority:high AND folder:/work",
        description: "Important work tasks",
        folder: "Work",
        tags: ["priority", "work"],
        pinned: true,
        useCount: 10,
        createdAt: new Date("2024-01-01").toISOString(),
        lastUsedAt: new Date("2024-01-10").toISOString()
      });

      SavedQueryStore.save({
        id: "q2",
        name: "Personal Goals",
        queryString: "folder:/personal AND status:open",
        description: "My personal goals",
        folder: "Personal",
        tags: ["personal", "goals"],
        pinned: false,
        useCount: 3,
        createdAt: new Date("2024-01-05").toISOString(),
        lastUsedAt: new Date("2024-01-08").toISOString()
      });

      SavedQueryStore.save({
        id: "q3",
        name: "Overdue Tasks",
        queryString: "due:before:today",
        description: "All overdue tasks",
        folder: "Work",
        tags: ["overdue", "urgent"],
        pinned: false,
        useCount: 15,
        createdAt: new Date("2024-01-03").toISOString(),
        lastUsedAt: new Date("2024-01-12").toISOString()
      });
    });

    describe("search()", () => {
      it("should search by name", () => {
        const results = SavedQueryStore.search("priority");
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("q1");
      });

      it("should search by description", () => {
        const results = SavedQueryStore.search("personal goals");
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("q2");
      });

      it("should search by query string", () => {
        const results = SavedQueryStore.search("folder:/work");
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("q1");
      });

      it("should search by tags", () => {
        const results = SavedQueryStore.search("overdue");
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("q3");
      });

      it("should be case-insensitive", () => {
        const results = SavedQueryStore.search("PERSONAL");
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("q2");
      });

      it("should return all queries for empty search term", () => {
        const results = SavedQueryStore.search("");
        expect(results.length).toBe(3);
      });

      it("should return empty array for no matches", () => {
        const results = SavedQueryStore.search("nonexistent query");
        expect(results.length).toBe(0);
      });
    });

    describe("getByFolder()", () => {
      it("should get queries by folder", () => {
        const results = SavedQueryStore.getByFolder("Work");
        expect(results.length).toBe(2);
        expect(results.every((q) => q.folder === "Work")).toBe(true);
      });

      it("should return empty array for non-existent folder", () => {
        const results = SavedQueryStore.getByFolder("Nonexistent");
        expect(results.length).toBe(0);
      });

      it("should handle empty folder parameter", () => {
        const results = SavedQueryStore.getByFolder("");
        expect(results.length).toBe(0);
      });
    });

    describe("getRecentlyUsed()", () => {
      it("should get recently used queries in descending order", () => {
        const results = SavedQueryStore.getRecentlyUsed(2);
        expect(results.length).toBe(2);
        expect(results[0].id).toBe("q3"); // 2024-01-12
        expect(results[1].id).toBe("q1"); // 2024-01-10
      });

      it("should return all queries if limit not specified", () => {
        const results = SavedQueryStore.getRecentlyUsed();
        expect(results.length).toBe(3);
      });

      it("should exclude queries never used", () => {
        SavedQueryStore.save({
          id: "q4",
          name: "Never Used",
          queryString: "test",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        });

        const results = SavedQueryStore.getRecentlyUsed();
        expect(results.length).toBe(3); // q1, q2, q3 only
        expect(results.find((q) => q.id === "q4")).toBeUndefined();
      });
    });

    describe("getMostUsed()", () => {
      it("should get most used queries in descending order", () => {
        const results = SavedQueryStore.getMostUsed(2);
        expect(results.length).toBe(2);
        expect(results[0].id).toBe("q3"); // useCount: 15
        expect(results[1].id).toBe("q1"); // useCount: 10
      });

      it("should return all queries if limit not specified", () => {
        const results = SavedQueryStore.getMostUsed();
        expect(results.length).toBe(3);
      });
    });
  });

  describe("Folder Management", () => {
    beforeEach(() => {
      SavedQueryStore.save({
        id: "q1",
        name: "Query 1",
        queryString: "test1",
        description: "",
        folder: "Work",
        tags: [],
        pinned: false,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      SavedQueryStore.save({
        id: "q2",
        name: "Query 2",
        queryString: "test2",
        description: "",
        folder: "Personal",
        tags: [],
        pinned: false,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      SavedQueryStore.save({
        id: "q3",
        name: "Query 3",
        queryString: "test3",
        description: "",
        folder: "Work",
        tags: [],
        pinned: false,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });
    });

    describe("getFolders()", () => {
      it("should get unique folder names", () => {
        const folders = SavedQueryStore.getFolders();
        expect(folders.length).toBe(2);
        expect(folders).toContain("Work");
        expect(folders).toContain("Personal");
      });

      it("should exclude empty folder names", () => {
        SavedQueryStore.save({
          id: "q4",
          name: "Query 4",
          queryString: "test4",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        });

        const folders = SavedQueryStore.getFolders();
        expect(folders.length).toBe(2);
        expect(folders).not.toContain("");
      });

      it("should return empty array if no folders", () => {
        SavedQueryStore.delete("q1");
        SavedQueryStore.delete("q2");
        SavedQueryStore.delete("q3");

        const folders = SavedQueryStore.getFolders();
        expect(folders).toEqual([]);
      });
    });

    describe("saveFolder()", () => {
      it("should save folder metadata", () => {
        SavedQueryStore.saveFolder("Work", { color: "#ff0000", description: "Work queries" });
        const metadata = SavedQueryStore.getFolderMetadata("Work");
        expect(metadata).toEqual({ color: "#ff0000", description: "Work queries" });
      });
    });

    describe("deleteFolder()", () => {
      it("should delete folder and update queries", () => {
        SavedQueryStore.deleteFolder("Work");

        const workQueries = SavedQueryStore.getByFolder("Work");
        expect(workQueries.length).toBe(0);

        const folders = SavedQueryStore.getFolders();
        expect(folders).not.toContain("Work");
      });
    });
  });

  describe("Statistics", () => {
    beforeEach(() => {
      SavedQueryStore.save({
        id: "q1",
        name: "Query 1",
        queryString: "test1",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 10,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      SavedQueryStore.save({
        id: "q2",
        name: "Query 2",
        queryString: "test2",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 20,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      SavedQueryStore.save({
        id: "q3",
        name: "Query 3",
        queryString: "test3",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 30,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });
    });

    describe("getStats()", () => {
      it("should calculate total queries", () => {
        const stats = SavedQueryStore.getStats();
        expect(stats.totalQueries).toBe(3);
      });

      it("should calculate total uses", () => {
        const stats = SavedQueryStore.getStats();
        expect(stats.totalUses).toBe(60); // 10 + 20 + 30
      });

      it("should calculate average uses", () => {
        const stats = SavedQueryStore.getStats();
        expect(stats.averageUses).toBe(20); // 60 / 3
      });

      it("should handle empty store", () => {
        SavedQueryStore.delete("q1");
        SavedQueryStore.delete("q2");
        SavedQueryStore.delete("q3");

        const stats = SavedQueryStore.getStats();
        expect(stats.totalQueries).toBe(0);
        expect(stats.totalUses).toBe(0);
        expect(stats.averageUses).toBe(0);
      });
    });
  });

  describe("Import/Export", () => {
    beforeEach(() => {
      SavedQueryStore.save({
        id: "q1",
        name: "Existing Query",
        queryString: "existing",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 5,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });
    });

    describe("export()", () => {
      it("should export all queries as JSON", () => {
        const json = SavedQueryStore.export();
        const data = JSON.parse(json);

        expect(data.queries).toBeDefined();
        expect(data.queries.length).toBe(1);
        expect(data.queries[0].id).toBe("q1");
        expect(data.version).toBe("1.0");
      });

      it("should include timestamp in export", () => {
        const json = SavedQueryStore.export();
        const data = JSON.parse(json);

        expect(data.exportedAt).toBeDefined();
        const exportDate = new Date(data.exportedAt);
        expect(exportDate.getTime()).toBeLessThanOrEqual(Date.now());
      });
    });

    describe("import()", () => {
      it("should import queries with overwrite=false (merge)", () => {
        const importData = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          queries: [
            {
              id: "q2",
              name: "Imported Query",
              queryString: "imported",
              description: "",
              folder: "",
              tags: [],
              pinned: false,
              useCount: 0,
              createdAt: new Date().toISOString(),
              lastUsedAt: null
            }
          ]
        };

        SavedQueryStore.import(JSON.stringify(importData), false);
        const queries = SavedQueryStore.load();

        expect(queries.length).toBe(2);
        expect(queries.find((q) => q.id === "q1")).toBeDefined(); // existing
        expect(queries.find((q) => q.id === "q2")).toBeDefined(); // imported
      });

      it("should import queries with overwrite=true (replace)", () => {
        const importData = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          queries: [
            {
              id: "q2",
              name: "Imported Query",
              queryString: "imported",
              description: "",
              folder: "",
              tags: [],
              pinned: false,
              useCount: 0,
              createdAt: new Date().toISOString(),
              lastUsedAt: null
            }
          ]
        };

        SavedQueryStore.import(JSON.stringify(importData), true);
        const queries = SavedQueryStore.load();

        expect(queries.length).toBe(1);
        expect(queries[0].id).toBe("q2");
        expect(queries.find((q) => q.id === "q1")).toBeUndefined(); // replaced
      });

      it("should handle invalid JSON", () => {
        expect(() => SavedQueryStore.import("invalid json {{{", false)).toThrow();
      });

      it("should handle missing queries array", () => {
        const invalidData = { version: "1.0", exportedAt: new Date().toISOString() };
        expect(() => SavedQueryStore.import(JSON.stringify(invalidData), false)).toThrow();
      });
    });
  });

  describe("localStorage Persistence", () => {
    it("should persist queries to localStorage", () => {
      SavedQueryStore.save({
        id: "q1",
        name: "Persistent Query",
        queryString: "test",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      expect(localStorage.setItem).toHaveBeenCalled();
      expect(localStorageMock["rtm:saved_queries"]).toBeDefined();
    });

    it("should load queries from localStorage", () => {
      const queries = [
        {
          id: "q1",
          name: "Loaded Query",
          queryString: "test",
          description: "",
          folder: "",
          tags: [],
          pinned: false,
          useCount: 0,
          createdAt: new Date().toISOString(),
          lastUsedAt: null
        }
      ];

      localStorageMock["rtm:saved_queries"] = JSON.stringify(queries);

      const loaded = SavedQueryStore.load();
      expect(loaded.length).toBe(1);
      expect(loaded[0].id).toBe("q1");
    });

    it("should survive multiple save/load cycles", () => {
      SavedQueryStore.save({
        id: "q1",
        name: "Query 1",
        queryString: "test1",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      SavedQueryStore.save({
        id: "q2",
        name: "Query 2",
        queryString: "test2",
        description: "",
        folder: "",
        tags: [],
        pinned: false,
        useCount: 0,
        createdAt: new Date().toISOString(),
        lastUsedAt: null
      });

      const loaded = SavedQueryStore.load();
      expect(loaded.length).toBe(2);

      SavedQueryStore.delete("q1");
      const reloaded = SavedQueryStore.load();
      expect(reloaded.length).toBe(1);
      expect(reloaded[0].id).toBe("q2");
    });
  });
});
