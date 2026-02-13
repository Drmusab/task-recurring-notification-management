import { describe, it, expect, beforeEach } from 'vitest';
import { GlobalFilterEngine } from '@backend/core/filtering/GlobalFilterEngine';
import { createFilterRule, type GlobalFilterConfig } from '@backend/core/filtering/FilterRule';

describe('GlobalFilterEngine', () => {
  let engine: GlobalFilterEngine;
  let config: GlobalFilterConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      mode: 'include',
      rules: [],
      excludeFolders: [],
      excludeNotebooks: [],
      excludeTags: [],
      excludeFilePatterns: [],
      excludeStatusTypes: [],
    };
    engine = new GlobalFilterEngine(config);
  });

  describe('evaluate with disabled filter', () => {
    it('should treat all items as tasks when disabled', () => {
      config.enabled = false;
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Task 1', 'any.md')).toBe(true);
      expect(engine.evaluate('- [ ] Task 2 #not-task', 'any.md')).toBe(true);
    });
  });

  describe('evaluate with include mode', () => {
    it('should include items matching a tag rule', () => {
      config.mode = 'include';
      config.rules = [createFilterRule('tag', '#task')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Review PR #task', 'any.md')).toBe(true);
      expect(engine.evaluate('- [ ] Buy milk', 'any.md')).toBe(false);
    });

    it('should include items matching a path rule', () => {
      config.mode = 'include';
      config.rules = [createFilterRule('path', 'tasks/')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Do something', 'tasks/work.md')).toBe(true);
      expect(engine.evaluate('- [ ] Do something', 'shopping/list.md')).toBe(false);
    });

    it('should include items matching regex rule', () => {
      config.mode = 'include';
      config.rules = [createFilterRule('regex', '\\[priority::')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Task [priority:: high]', 'any.md')).toBe(true);
      expect(engine.evaluate('- [ ] Task without priority', 'any.md')).toBe(false);
    });

    it('should include items matching all rules (AND logic)', () => {
      config.mode = 'include';
      config.rules = [
        createFilterRule('tag', '#task'),
        createFilterRule('path', 'work/'),
      ];
      engine.updateConfig(config);

      // Must match both tag AND path
      expect(engine.evaluate('- [ ] Do work #task', 'work/project.md')).toBe(true);
      expect(engine.evaluate('- [ ] Do work #task', 'personal/todo.md')).toBe(false);
      expect(engine.evaluate('- [ ] Do work', 'work/project.md')).toBe(false);
      expect(engine.evaluate('- [ ] Do work', 'personal/todo.md')).toBe(false);
    });

    it('should return true when no rules are configured', () => {
      config.mode = 'include';
      config.rules = [];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Any task', 'any.md')).toBe(true);
    });
  });

  describe('evaluate with exclude mode', () => {
    it('should exclude items with matching tag', () => {
      config.mode = 'exclude';
      config.rules = [createFilterRule('tag', '#not-task')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Buy milk #not-task', 'any.md')).toBe(false);
      expect(engine.evaluate('- [ ] Review PR', 'any.md')).toBe(true);
    });

    it('should exclude items in matching path', () => {
      config.mode = 'exclude';
      config.rules = [createFilterRule('path', 'shopping/')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Buy milk', 'shopping/list.md')).toBe(false);
      expect(engine.evaluate('- [ ] Review PR', 'work/tasks.md')).toBe(true);
    });

    it('should exclude items matching regex', () => {
      config.mode = 'exclude';
      config.rules = [createFilterRule('regex', '^- \\[( |x)\\] Buy')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Buy groceries', 'any.md')).toBe(false);
      expect(engine.evaluate('- [ ] Complete project', 'any.md')).toBe(true);
    });

    it('should include all when no rules are configured', () => {
      config.mode = 'exclude';
      config.rules = [];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Any task', 'any.md')).toBe(true);
    });
  });

  describe('path pattern matching', () => {
    it('should handle paths with backslashes', () => {
      config.mode = 'include';
      config.rules = [createFilterRule('path', 'tasks/')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Task', 'tasks\\work.md')).toBe(true);
    });

    it('should handle partial path matches', () => {
      config.mode = 'include';
      config.rules = [createFilterRule('path', 'daily/')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] Task', 'work/daily/notes.md')).toBe(true);
    });
  });

  describe('tag pattern matching', () => {
    it('should match tags anywhere in line', () => {
      config.mode = 'include';
      config.rules = [createFilterRule('tag', '#work')];
      engine.updateConfig(config);

      expect(engine.evaluate('- [ ] #work Review PR', 'any.md')).toBe(true);
      expect(engine.evaluate('- [ ] Review PR #work', 'any.md')).toBe(true);
      expect(engine.evaluate('- [ ] Review #work PR', 'any.md')).toBe(true);
    });
  });
});
