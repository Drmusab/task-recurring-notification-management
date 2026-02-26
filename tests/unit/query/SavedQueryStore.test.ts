/**
 * Unit Tests for SavedQueryStore
 *
 * Tests saved query persistence and management using in-memory cache.
 * The store uses SiYuan plugin.loadData/saveData in production,
 * but operates on in-memory cachedCollection for test isolation.
 *
 * @module SavedQueryStoreTest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  SavedQueryStore,
  _resetSavedQueryStoreForTesting,
  type SavedQuery,
  type SavedQueryFolder,
} from "@backend/core/query/SavedQueryStore";

/** Helper to create a minimal valid SavedQuery */
function makeQuery(overrides: Partial<SavedQuery> = {}): SavedQuery {
  return {
    id: overrides.id ?? `q-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? "Test Query",
    queryString: overrides.queryString ?? "status:open",
    description: overrides.description ?? "",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    tags: overrides.tags ?? [],
    folder: overrides.folder,
    useCount: overrides.useCount ?? 0,
    lastUsedAt: overrides.lastUsedAt,
    pinned: overrides.pinned ?? false,
  };
}

describe("SavedQueryStore", () => {
  beforeEach(() => {
    // Reset in-memory cache before each test for isolation
    _resetSavedQueryStoreForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── CRUD Operations ────────────────────────────────────────────

  describe("CRUD Operations", () => {
    describe("save()", () => {
      it("should save a new query", () => {
        const query = makeQuery({ id: "q1", name: "High Priority Tasks", queryString: "priority:high" });
        SavedQueryStore.save(query);
        const loaded = SavedQueryStore.load();

        expect(loaded.length).toBe(1);
        expect(loaded[0].id).toBe("q1");
        expect(loaded[0].name).toBe("High Priority Tasks");
      });

      it("should set default useCount to 0", () => {
        const query = makeQuery({ id: "q1" });
        SavedQueryStore.save(query);
        const loaded = SavedQueryStore.load();

        expect(loaded[0].useCount).toBe(0);
      });

      it("should update existing query with same ID", () => {
        const query = makeQuery({ id: "q1", name: "Original Name" });
        SavedQueryStore.save(query);

        const updated = makeQuery({ id: "q1", name: "Updated Name", description: "Updated description" });
        SavedQueryStore.save(updated);
        const loaded = SavedQueryStore.load();

        expect(loaded.length).toBe(1);
        expect(loaded[0].name).toBe("Updated Name");
        expect(loaded[0].description).toBe("Updated description");
      });

      it("should save multiple queries", () => {
        SavedQueryStore.save(makeQuery({ id: "q1", name: "Query 1" }));
        SavedQueryStore.save(makeQuery({ id: "q2", name: "Query 2" }));
        SavedQueryStore.save(makeQuery({ id: "q3", name: "Query 3" }));

        const loaded = SavedQueryStore.load();
        expect(loaded.length).toBe(3);
      });
    });

    describe("load()", () => {
      it("should load all saved queries", () => {
        SavedQueryStore.save(makeQuery({ id: "q1" }));
        SavedQueryStore.save(makeQuery({ id: "q2" }));

        const loaded = SavedQueryStore.load();
        expect(loaded.length).toBe(2);
        expect(loaded.find(q => q.id === "q1")).toBeDefined();
        expect(loaded.find(q => q.id === "q2")).toBeDefined();
      });

      it("should return empty array if no queries saved", () => {
        const loaded = SavedQueryStore.load();
        expect(loaded).toEqual([]);
      });
    });

    describe("get()", () => {
      beforeEach(() => {
        SavedQueryStore.save(makeQuery({ id: "q1", name: "Query 1" }));
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
        SavedQueryStore.save(makeQuery({ id: "q1", name: "Query 1" }));
        SavedQueryStore.save(makeQuery({ id: "q2", name: "Query 2" }));
      });

      it("should delete query by ID", () => {
        SavedQueryStore.delete("q1");
        const loaded = SavedQueryStore.load();

        expect(loaded.length).toBe(1);
        expect(loaded.find(q => q.id === "q1")).toBeUndefined();
        expect(loaded.find(q => q.id === "q2")).toBeDefined();
      });

      it("should not throw for non-existent ID", () => {
        expect(() => SavedQueryStore.delete("nonexistent")).not.toThrow();
      });
    });

    describe("update()", () => {
      beforeEach(() => {
        SavedQueryStore.save(
          makeQuery({ id: "q1", name: "Original", queryString: "original query", useCount: 5 })
        );
      });

      it("should update specific fields", () => {
        SavedQueryStore.update("q1", { name: "Updated Name", description: "Updated description" });

        const query = SavedQueryStore.get("q1");
        expect(query?.name).toBe("Updated Name");
        expect(query?.description).toBe("Updated description");
        expect(query?.queryString).toBe("original query");
        expect(query?.useCount).toBe(5);
      });

      it("should increment use count via update", () => {
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

    describe("recordUse()", () => {
      it("should increment useCount and set lastUsedAt", () => {
        SavedQueryStore.save(makeQuery({ id: "q1", useCount: 3 }));
        SavedQueryStore.recordUse("q1");
        const query = SavedQueryStore.get("q1");

        expect(query?.useCount).toBe(4);
        expect(query?.lastUsedAt).toBeDefined();
      });
    });

    describe("clear()", () => {
      it("should remove all queries", () => {
        SavedQueryStore.save(makeQuery({ id: "q1" }));
        SavedQueryStore.save(makeQuery({ id: "q2" }));
        SavedQueryStore.clear();

        expect(SavedQueryStore.load()).toEqual([]);
      });
    });
  });

  // ─── Search Functionality ────────────────────────────────────────

  describe("Search Functionality", () => {
    beforeEach(() => {
      SavedQueryStore.save(
        makeQuery({
          id: "q1",
          name: "High Priority Work Tasks",
          queryString: "priority:high AND folder:/work",
          description: "Important work tasks",
          folder: "Work",
          tags: ["priority", "work"],
          pinned: true,
          useCount: 10,
          lastUsedAt: new Date("2024-01-10").toISOString(),
          createdAt: new Date("2024-01-01").toISOString(),
        })
      );

      SavedQueryStore.save(
        makeQuery({
          id: "q2",
          name: "Personal Goals",
          queryString: "folder:/personal AND status:open",
          description: "My personal goals",
          folder: "Personal",
          tags: ["personal", "goals"],
          useCount: 3,
          lastUsedAt: new Date("2024-01-08").toISOString(),
          createdAt: new Date("2024-01-05").toISOString(),
        })
      );

      SavedQueryStore.save(
        makeQuery({
          id: "q3",
          name: "Overdue Tasks",
          queryString: "due:before:today",
          description: "All overdue tasks",
          folder: "Work",
          tags: ["overdue", "urgent"],
          useCount: 15,
          lastUsedAt: new Date("2024-01-12").toISOString(),
          createdAt: new Date("2024-01-03").toISOString(),
        })
      );
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
        expect(results.every(q => q.folder === "Work")).toBe(true);
      });

      it("should return empty array for non-existent folder", () => {
        const results = SavedQueryStore.getByFolder("Nonexistent");
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

      it("should respect limit parameter", () => {
        const results = SavedQueryStore.getRecentlyUsed(1);
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("q3");
      });

      it("should exclude queries never used", () => {
        SavedQueryStore.save(makeQuery({ id: "q4", name: "Never Used", useCount: 0, lastUsedAt: undefined }));

        const results = SavedQueryStore.getRecentlyUsed(10);
        expect(results.find(q => q.id === "q4")).toBeUndefined();
      });
    });

    describe("getMostUsed()", () => {
      it("should get most used queries in descending order", () => {
        const results = SavedQueryStore.getMostUsed(2);
        expect(results.length).toBe(2);
        expect(results[0].id).toBe("q3"); // useCount: 15
        expect(results[1].id).toBe("q1"); // useCount: 10
      });

      it("should respect limit parameter", () => {
        const results = SavedQueryStore.getMostUsed(1);
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("q3");
      });
    });

    describe("getPinned()", () => {
      it("should return only pinned queries", () => {
        const results = SavedQueryStore.getPinned();
        expect(results.length).toBe(1);
        expect(results[0].id).toBe("q1");
      });
    });
  });

  // ─── Folder Management ──────────────────────────────────────────

  describe("Folder Management", () => {
    describe("saveFolder()", () => {
      it("should save a new folder", () => {
        const folder: SavedQueryFolder = { id: "f1", name: "Work", color: "#ff0000" };
        SavedQueryStore.saveFolder(folder);
        const folders = SavedQueryStore.getFolders();

        expect(folders.length).toBe(1);
        expect(folders[0].id).toBe("f1");
        expect(folders[0].name).toBe("Work");
      });

      it("should update existing folder", () => {
        SavedQueryStore.saveFolder({ id: "f1", name: "Work" });
        SavedQueryStore.saveFolder({ id: "f1", name: "Work Updated", color: "#00ff00" });
        const folders = SavedQueryStore.getFolders();

        expect(folders.length).toBe(1);
        expect(folders[0].name).toBe("Work Updated");
      });
    });

    describe("deleteFolder()", () => {
      it("should delete folder and move queries to root", () => {
        SavedQueryStore.saveFolder({ id: "f1", name: "Work" });
        SavedQueryStore.save(makeQuery({ id: "q1", folder: "f1" }));

        SavedQueryStore.deleteFolder("f1");

        const folders = SavedQueryStore.getFolders();
        expect(folders.length).toBe(0);

        // Queries with that folder should have folder cleared
        const query = SavedQueryStore.get("q1");
        expect(query?.folder).toBeUndefined();
      });
    });

    describe("getFolders()", () => {
      it("should return empty array when no folders exist", () => {
        const folders = SavedQueryStore.getFolders();
        expect(folders).toEqual([]);
      });

      it("should return all saved folders", () => {
        SavedQueryStore.saveFolder({ id: "f1", name: "Work" });
        SavedQueryStore.saveFolder({ id: "f2", name: "Personal" });
        const folders = SavedQueryStore.getFolders();

        expect(folders.length).toBe(2);
      });
    });
  });

  // ─── Statistics ──────────────────────────────────────────────────

  describe("Statistics", () => {
    beforeEach(() => {
      SavedQueryStore.save(makeQuery({ id: "q1", useCount: 10 }));
      SavedQueryStore.save(makeQuery({ id: "q2", useCount: 20 }));
      SavedQueryStore.save(makeQuery({ id: "q3", useCount: 30 }));
    });

    describe("getStats()", () => {
      it("should calculate total queries", () => {
        const stats = SavedQueryStore.getStats();
        expect(stats.totalQueries).toBe(3);
      });

      it("should calculate total uses", () => {
        const stats = SavedQueryStore.getStats();
        expect(stats.totalUses).toBe(60);
      });

      it("should calculate average uses per query", () => {
        const stats = SavedQueryStore.getStats();
        expect(stats.averageUsesPerQuery).toBe(20);
      });

      it("should handle empty store", () => {
        SavedQueryStore.clear();

        const stats = SavedQueryStore.getStats();
        expect(stats.totalQueries).toBe(0);
        expect(stats.totalUses).toBe(0);
        expect(stats.averageUsesPerQuery).toBe(0);
      });
    });
  });

  // ─── Import / Export ─────────────────────────────────────────────

  describe("Import/Export", () => {
    beforeEach(() => {
      SavedQueryStore.save(makeQuery({ id: "q1", name: "Existing Query", queryString: "existing", useCount: 5 }));
    });

    describe("export()", () => {
      it("should export all queries as JSON", () => {
        const json = SavedQueryStore.export();
        const data = JSON.parse(json);

        expect(data.queries).toBeDefined();
        expect(Array.isArray(data.queries)).toBe(true);
        expect(data.queries.length).toBe(1);
        expect(data.queries[0].id).toBe("q1");
      });

      it("should include version in export", () => {
        const json = SavedQueryStore.export();
        const data = JSON.parse(json);
        expect(data.version).toBeDefined();
      });
    });

    describe("import()", () => {
      it("should import new queries without overwrite (merge)", () => {
        const importData = {
          version: 1,
          queries: [makeQuery({ id: "q2", name: "Imported Query", queryString: "imported" })],
          folders: [],
        };

        const result = SavedQueryStore.import(JSON.stringify(importData), false);
        const queries = SavedQueryStore.load();

        expect(result.imported).toBe(1);
        expect(queries.length).toBe(2);
        expect(queries.find(q => q.id === "q1")).toBeDefined();
        expect(queries.find(q => q.id === "q2")).toBeDefined();
      });

      it("should skip existing IDs without overwrite", () => {
        const importData = {
          version: 1,
          queries: [makeQuery({ id: "q1", name: "Conflicting", queryString: "different" })],
          folders: [],
        };

        const result = SavedQueryStore.import(JSON.stringify(importData), false);
        expect(result.skipped).toBe(1);
        expect(result.imported).toBe(0);

        const query = SavedQueryStore.get("q1");
        expect(query?.name).toBe("Existing Query"); // not overwritten
      });

      it("should overwrite existing IDs when overwrite=true", () => {
        const importData = {
          version: 1,
          queries: [makeQuery({ id: "q1", name: "Overwritten Query", queryString: "overwritten" })],
          folders: [],
        };

        const result = SavedQueryStore.import(JSON.stringify(importData), true);
        expect(result.imported).toBe(1);

        const query = SavedQueryStore.get("q1");
        expect(query?.name).toBe("Overwritten Query");
      });

      it("should handle array format (legacy)", () => {
        const importData = [makeQuery({ id: "q2", name: "Legacy Import", queryString: "legacy" })];

        const result = SavedQueryStore.import(JSON.stringify(importData), false);
        expect(result.imported).toBe(1);
      });

      it("should report errors for invalid query objects", () => {
        const importData = {
          version: 1,
          queries: [{ invalid: true }],
          folders: [],
        };

        const result = SavedQueryStore.import(JSON.stringify(importData), false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should handle invalid JSON gracefully", () => {
        const result = SavedQueryStore.import("invalid json {{{", false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  // ─── Duplicate ───────────────────────────────────────────────────

  describe("duplicate()", () => {
    it("should create a copy with new ID", () => {
      SavedQueryStore.save(makeQuery({ id: "q1", name: "Original" }));

      const dup = SavedQueryStore.duplicate("q1");
      expect(dup).toBeDefined();
      expect(dup!.id).not.toBe("q1");
      expect(dup!.name).toBe("Original (Copy)");
      expect(dup!.useCount).toBe(0);
    });

    it("should return null for non-existent query", () => {
      const dup = SavedQueryStore.duplicate("nonexistent");
      expect(dup).toBeNull();
    });
  });

  // ─── Template ────────────────────────────────────────────────────

  describe("createTemplate()", () => {
    it("should create a query template with defaults", () => {
      const template = SavedQueryStore.createTemplate("My Query");
      expect(template.name).toBe("My Query");
      expect(template.queryString).toBe("");
      expect(template.id).toBeDefined();
      expect(template.id.length).toBeGreaterThan(0);
    });
  });

  // ─── State Isolation ─────────────────────────────────────────────

  describe("State Isolation", () => {
    it("should not leak state between tests (test A - save)", () => {
      SavedQueryStore.save(makeQuery({ id: "isolation-a" }));
      expect(SavedQueryStore.load().length).toBe(1);
    });

    it("should not leak state between tests (test B - verify clean)", () => {
      // This must be 0 — proving beforeEach reset works
      expect(SavedQueryStore.load().length).toBe(0);
    });
  });
});
