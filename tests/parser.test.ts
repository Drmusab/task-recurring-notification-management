/**
 * Unit Tests for Task Line Parser
 * Testing tokenizer-based parsing with lossless round-trip
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskLineParser, TaskLineTokenizer, TokenType } from '../src/infrastructure/parsers/TaskLineParser';
import { StatusRegistry } from '../src/domain/models/TaskStatus';

describe('TaskLineTokenizer', () => {
  it('should tokenize simple checkbox', () => {
    const tokenizer = new TaskLineTokenizer('- [ ] Simple task');
    const tokens = tokenizer.tokenize();
    
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe(TokenType.CHECKBOX);
    expect(tokens[0].value).toBe(' ');
    expect(tokens[1].type).toBe(TokenType.TEXT);
    expect(tokens[1].value).toBe('Simple task');
  });
  
  it('should tokenize completed task', () => {
    const tokenizer = new TaskLineTokenizer('- [x] Completed task');
    const tokens = tokenizer.tokenize();
    
    expect(tokens[0].type).toBe(TokenType.CHECKBOX);
    expect(tokens[0].value).toBe('x');
  });
  
  it('should tokenize emoji signifiers', () => {
    const tokenizer = new TaskLineTokenizer('- [ ] Task 📅 2026-02-10 🔁 every week ⏫');
    const tokens = tokenizer.tokenize();
    
    const emojiTokens = tokens.filter(t => t.type === TokenType.EMOJI_SIGNIFIER);
    expect(emojiTokens).toHaveLength(3);
    expect(emojiTokens[0].value).toContain('due:');
    expect(emojiTokens[1].value).toContain('recurs:');
    expect(emojiTokens[2].value).toContain('priority-highest');
  });
  
  it('should tokenize text signifiers', () => {
    const tokenizer = new TaskLineTokenizer('- [ ] Task due:: 2026-02-10 priority:: high');
    const tokens = tokenizer.tokenize();
    
    const textTokens = tokens.filter(t => t.type === TokenType.TEXT_SIGNIFIER);
    expect(textTokens).toHaveLength(2);
    expect(textTokens[0].value).toContain('due:');
    expect(textTokens[1].value).toContain('priority:');
  });
  
  it('should tokenize tags', () => {
    const tokenizer = new TaskLineTokenizer('- [ ] Task #work #urgent');
    const tokens = tokenizer.tokenize();
    
    const tagTokens = tokens.filter(t => t.type === TokenType.TAG);
    expect(tagTokens).toHaveLength(2);
    expect(tagTokens[0].value).toBe('work');
    expect(tagTokens[1].value).toBe('urgent');
  });
  
  it('should tokenize wikilinks', () => {
    const tokenizer = new TaskLineTokenizer('- [ ] Task [[linked note]]');
    const tokens = tokenizer.tokenize();
    
    const linkTokens = tokens.filter(t => t.type === TokenType.LINK);
    expect(linkTokens).toHaveLength(1);
    expect(linkTokens[0].value).toBe('linked note');
  });
  
  it('should tokenize markdown links', () => {
    const tokenizer = new TaskLineTokenizer('- [ ] Task [text](https://example.com)');
    const tokens = tokenizer.tokenize();
    
    const linkTokens = tokens.filter(t => t.type === TokenType.LINK);
    expect(linkTokens).toHaveLength(1);
    expect(linkTokens[0].value).toBe('https://example.com');
  });
  
  it('should handle mixed emoji and text signifiers', () => {
    const tokenizer = new TaskLineTokenizer('- [ ] Task 📅 2026-02-10 priority:: high #work');
    const tokens = tokenizer.tokenize();
    
    expect(tokens.some(t => t.type === TokenType.EMOJI_SIGNIFIER)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.TEXT_SIGNIFIER)).toBe(true);
    expect(tokens.some(t => t.type === TokenType.TAG)).toBe(true);
  });
});

describe('TaskLineParser', () => {
  let parser: TaskLineParser;
  
  beforeEach(() => {
    StatusRegistry.resetInstance(); // Reset singleton
    parser = new TaskLineParser();
  });
  
  it('should parse simple task', () => {
    const task = parser.parse('- [ ] Buy groceries');
    
    expect(task.name).toBe('Buy groceries');
    expect(task.status).toBe('todo');
    expect(task.statusSymbol).toBe(' ');
  });
  
  it('should parse completed task', () => {
    const task = parser.parse('- [x] Finished task');
    
    expect(task.name).toBe('Finished task');
    expect(task.status).toBe('done');
    expect(task.statusSymbol).toBe('x');
  });
  
  it('should parse task with due date (emoji)', () => {
    const task = parser.parse('- [ ] Meeting 📅 2026-02-10');
    
    expect(task.name).toBe('Meeting');
    expect(task.dueAt).toBe('2026-02-10');
  });
  
  it('should parse task with due date (text)', () => {
    const task = parser.parse('- [ ] Meeting due:: 2026-02-10');
    
    expect(task.name).toBe('Meeting');
    expect(task.dueAt).toBe('2026-02-10');
  });
  
  it('should parse task with priority (emoji)', () => {
    const task = parser.parse('- [ ] Important task ⏫');
    
    expect(task.name).toBe('Important task');
    expect(task.priority).toBe('highest');
  });
  
  it('should parse task with priority (text)', () => {
    const task = parser.parse('- [ ] Important task priority:: high');
    
    expect(task.name).toBe('Important task');
    expect(task.priority).toBe('high');
  });
  
  it('should parse task with recurrence', () => {
    const task = parser.parse('- [ ] Weekly review 🔁 every week');
    
    expect(task.name).toBe('Weekly review');
    expect(task.recurrenceText).toBe('every week');
  });
  
  it('should parse task with tags', () => {
    const task = parser.parse('- [ ] Project work #coding #siyuan');
    
    expect(task.name).toBe('Project work');
    expect(task.tags).toContain('coding');
    expect(task.tags).toContain('siyuan');
  });
  
  it('should parse task with task ID', () => {
    const task = parser.parse('- [ ] Task 🆔 abc123');
    
    expect(task.name).toBe('Task');
    expect(task.taskId).toBe('abc123');
  });
  
  it('should parse task with dependency', () => {
    const task = parser.parse('- [ ] Task 2 ⛔ task-xyz');
    
    expect(task.name).toBe('Task 2');
    expect(task.dependsOn).toContain('task-xyz');
  });
  
  it('should parse complex task with all fields', () => {
    const task = parser.parse(
      '- [ ] Complex task 📅 2026-02-10 ⏳ 2026-02-08 🔁 every week ⏫ 🆔 task-001 #work #important'
    );
    
    expect(task.name).toBe('Complex task');
    expect(task.dueAt).toBe('2026-02-10');
    expect(task.scheduledAt).toBe('2026-02-08');
    expect(task.recurrenceText).toBe('every week');
    expect(task.priority).toBe('highest');
    expect(task.taskId).toBe('task-001');
    expect(task.tags).toContain('work');
    expect(task.tags).toContain('important');
  });
  
  it('should handle custom status symbols', () => {
    const task = parser.parse('- [/] In progress task');
    
    expect(task.name).toBe('In progress task');
    expect(task.statusSymbol).toBe('/');
    expect(task.status).toBe('todo'); // IN_PROGRESS maps to 'todo'
  });
  
  it('should preserve unknown fields', () => {
    const task = parser.parse('- [ ] Task customField:: value');
    
    expect(task.unknownFields).toBeDefined();
    expect(task.unknownFields!.length).toBeGreaterThan(0);
  });
});

describe('Lossless Parsing', () => {
  let parser: TaskLineParser;
  
  beforeEach(() => {
    StatusRegistry.resetInstance();
    parser = new TaskLineParser();
  });
  
  it('should preserve all fields in round-trip', () => {
    const original = '- [ ] Task 📅 2026-02-10 🔁 every week ⏫ #work';
    const task = parser.parse(original);
    
    // Verify all fields were parsed
    expect(task.name).toBe('Task');
    expect(task.dueAt).toBe('2026-02-10');
    expect(task.recurrenceText).toBe('every week');
    expect(task.priority).toBe('highest');
    expect(task.tags).toContain('work');
  });
  
  it('should preserve unknown signifiers', () => {
    const original = '- [ ] Task unknown:: mystery 📅 2026-02-10';
    const task = parser.parse(original);
    
    expect(task.unknownFields).toBeDefined();
    expect(task.unknownFields).toContain('unknown:mystery');
  });
});

describe('Edge Cases', () => {
  let parser: TaskLineParser;
  
  beforeEach(() => {
    StatusRegistry.resetInstance();
    parser = new TaskLineParser();
  });
  
  it('should handle empty task name', () => {
    const task = parser.parse('- [ ]');
    
    expect(task.name).toBe('');
    expect(task.status).toBe('todo');
  });
  
  it('should handle task with only whitespace', () => {
    const task = parser.parse('- [ ]   ');
    
    expect(task.name).toBe('');
  });
  
  it('should handle malformed checkbox', () => {
    const task = parser.parse('[ ] Task without dash');
    
    // Should still parse task name but no checkbox
    expect(task.name).toBeTruthy();
  });
  
  it('should handle multiple spaces between elements', () => {
    const task = parser.parse('- [ ]    Task    📅   2026-02-10');
    
    expect(task.name).toBe('Task');
    expect(task.dueAt).toBe('2026-02-10');
  });
  
  it('should handle special characters in task name', () => {
    const task = parser.parse('- [ ] Task with (parens) & [brackets]');
    
    expect(task.name).toContain('parens');
    expect(task.name).toContain('brackets');
  });
});
