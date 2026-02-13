import { describe, it, expect, beforeEach } from 'vitest';
import { 
  createQueryPreset, 
  isValidQueryPreset, 
  exportPreset, 
  importPreset,
  exportPresetsToJSON,
  importPresetsFromJSON,
  BUILT_IN_PRESETS
} from "@backend/core/query/QueryPreset";
import type { QueryPreset } from "@backend/core/query/QueryPreset";

describe('QueryPreset', () => {
  describe('createQueryPreset', () => {
    it('should create a valid query preset', () => {
      const preset = createQueryPreset(
        'My Preset',
        'filter status is todo'
      );
      
      expect(preset).toBeDefined();
      expect(preset.id).toBeDefined();
      expect(preset.name).toBe('My Preset');
      expect(preset.query).toBe('filter status is todo');
      expect(preset.isBuiltIn).toBe(false);
      expect(preset.createdAt).toBeDefined();
      expect(preset.updatedAt).toBeDefined();
    });

    it('should create preset with optional fields', () => {
      const preset = createQueryPreset(
        'Custom Preset',
        'filter priority high',
        {
          description: 'High priority tasks',
          icon: '🔥',
          color: '#FF0000'
        }
      );
      
      expect(preset.description).toBe('High priority tasks');
      expect(preset.icon).toBe('🔥');
      expect(preset.color).toBe('#FF0000');
    });

    it('should generate unique IDs for different presets', () => {
      const preset1 = createQueryPreset('Preset 1', 'query 1');
      const preset2 = createQueryPreset('Preset 2', 'query 2');
      
      expect(preset1.id).not.toBe(preset2.id);
    });
  });

  describe('isValidQueryPreset', () => {
    it('should validate a complete preset', () => {
      const preset = createQueryPreset('Test', 'filter test');
      expect(isValidQueryPreset(preset)).toBe(true);
    });

    it('should reject preset without required fields', () => {
      const invalidPreset = {
        id: 'test',
        name: '',
        query: 'filter test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBuiltIn: false
      } as QueryPreset;
      
      expect(isValidQueryPreset(invalidPreset)).toBe(false);
    });

    it('should reject preset without query', () => {
      const invalidPreset = {
        id: 'test',
        name: 'Test',
        query: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isBuiltIn: false
      } as QueryPreset;
      
      expect(isValidQueryPreset(invalidPreset)).toBe(false);
    });
  });

  describe('exportPreset and importPreset', () => {
    it('should export and import a preset', () => {
      const original = createQueryPreset(
        'Export Test',
        'filter status is todo',
        {
          description: 'Test description',
          icon: '📝',
          color: '#00FF00'
        }
      );

      const exported = exportPreset(original);
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');

      const imported = importPreset(exported);
      expect(imported).toBeDefined();
      expect(imported!.name).toBe(original.name);
      expect(imported!.query).toBe(original.query);
      expect(imported!.description).toBe(original.description);
      expect(imported!.icon).toBe(original.icon);
      expect(imported!.color).toBe(original.color);
    });

    it('should handle invalid import data', () => {
      const result = importPreset('invalid base64');
      expect(result).toBeNull();
    });

    it('should handle incomplete import data', () => {
      const incomplete = btoa(JSON.stringify({ name: 'Test' }));
      const result = importPreset(incomplete);
      expect(result).toBeNull();
    });
  });

  describe('exportPresetsToJSON and importPresetsFromJSON', () => {
    it('should export and import multiple presets', () => {
      const presets = [
        createQueryPreset('Preset 1', 'query 1', { icon: '🎯' }),
        createQueryPreset('Preset 2', 'query 2', { color: '#FF0000' }),
        createQueryPreset('Preset 3', 'query 3')
      ];

      const json = exportPresetsToJSON(presets);
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const imported = importPresetsFromJSON(json);
      expect(imported).toHaveLength(3);
      expect(imported[0].name).toBe('Preset 1');
      expect(imported[1].name).toBe('Preset 2');
      expect(imported[2].name).toBe('Preset 3');
    });

    it('should handle invalid JSON', () => {
      const result = importPresetsFromJSON('invalid json');
      expect(result).toEqual([]);
    });

    it('should filter out invalid presets', () => {
      const mixed = JSON.stringify([
        { name: 'Valid', query: 'filter test' },
        { name: 'Invalid' }, // missing query
        { query: 'also invalid' } // missing name
      ]);

      const imported = importPresetsFromJSON(mixed);
      expect(imported).toHaveLength(1);
      expect(imported[0].name).toBe('Valid');
    });
  });

  describe('BUILT_IN_PRESETS', () => {
    it('should have predefined built-in presets', () => {
      expect(BUILT_IN_PRESETS.length).toBeGreaterThan(0);
    });

    it('should have Today\'s Focus preset', () => {
      const todayFocus = BUILT_IN_PRESETS.find(p => p.id === 'today-focus');
      expect(todayFocus).toBeDefined();
      expect(todayFocus!.name).toBe("Today's Focus");
      expect(todayFocus!.isBuiltIn).toBe(true);
    });

    it('should have Overdue preset', () => {
      const overdue = BUILT_IN_PRESETS.find(p => p.id === 'overdue');
      expect(overdue).toBeDefined();
      expect(overdue!.query).toContain('due before today');
    });

    it('all built-in presets should be valid', () => {
      for (const preset of BUILT_IN_PRESETS) {
        expect(isValidQueryPreset(preset)).toBe(true);
        expect(preset.isBuiltIn).toBe(true);
      }
    });

    it('all built-in presets should have icons', () => {
      for (const preset of BUILT_IN_PRESETS) {
        expect(preset.icon).toBeDefined();
      }
    });
  });
});
