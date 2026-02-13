/**
 * Tokenizer-Based Task Line Parser
 * Replaces regex soup with clean token stream approach
 * 
 * Supports dual formats:
 * - Emoji: - [ ] Task name 📅 2026-02-10 🔁 every week ⏫
 * - Text:  - [ ] Task name due:: 2026-02-10 recurs:: every week priority:: high
 */

import type { Task, TaskPriority } from '../../domain/models/Task';
import { createTask, normalizePriority } from '../../domain/models/Task';
import { StatusRegistry } from '../../domain/models/TaskStatus';

/**
 * Token types for lexical analysis
 */
export enum TokenType {
  CHECKBOX = 'CHECKBOX',           // - [ ] or - [x]
  TEXT = 'TEXT',                   // Plain text
  EMOJI_SIGNIFIER = 'EMOJI_SIGNIFIER',  // 📅, 🔁, ⏫, etc.
  TEXT_SIGNIFIER = 'TEXT_SIGNIFIER',    // due::, recurs::, priority::, etc.
  DATE = 'DATE',                   // ISO date or natural language
  TAG = 'TAG',                     // #tag
  LINK = 'LINK',                   // [[link]] or [text](url)
  ID = 'ID',                       // 🆔 abc123
  DEPENDENCY = 'DEPENDENCY',       // ⛔ task-xyz
  PRIORITY = 'PRIORITY',           // ⏫, 🔼, 🔽, etc.
  UNKNOWN = 'UNKNOWN',             // Unrecognized content (preserved for lossless)
}

/**
 * Lexical token representing a parsed unit
 */
export interface Token {
  type: TokenType;
  value: string;
  raw: string;        // Original text for lossless serialization
  position: number;   // Character position in original string
}

/**
 * Emoji signifier mappings
 */
const EMOJI_SIGNIFIERS: Record<string, string> = {
  '📅': 'due',
  '⏳': 'scheduled',
  '🛫': 'start',
  '🔁': 'recurs',
  '🆔': 'id',
  '⛔': 'dependsOn',
  '🔼': 'priority-high',
  '⏫': 'priority-highest',
  '🔽': 'priority-low',
  '⏬': 'priority-lowest',
  '🔺': 'priority-medium',
  '🏁': 'onCompletion',
};

/**
 * Text signifier mappings
 */
const TEXT_SIGNIFIERS = [
  'due::',
  'scheduled::',
  'start::',
  'recurs::',
  'id::',
  'dependsOn::',
  'priority::',
  'onCompletion::',
];

/**
 * Priority emoji to priority level mapping
 */
const PRIORITY_EMOJI_MAP: Record<string, TaskPriority> = {
  '⏫': 'highest',
  '🔼': 'high',
  '🔺': 'medium',
  '🔽': 'low',
  '⏬': 'lowest',
};

/**
 * Tokenizer: Converts task line string into token stream
 */
export class TaskLineTokenizer {
  private input: string;
  private position: number;
  private tokens: Token[];
  
  constructor(input: string) {
    this.input = input.trim();
    this.position = 0;
    this.tokens = [];
  }
  
  /**
   * Tokenize the input string
   */
  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;
    
    // 1. Parse checkbox
    this.parseCheckbox();
    
    // 2. Parse rest of line
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      // Check for emoji signifiers
      if (this.isEmojiSignifier(char)) {
        this.parseEmojiSignifier();
      }
      // Check for text signifiers
      else if (this.isTextSignifier()) {
        this.parseTextSignifier();
      }
      // Check for tags
      else if (char === '#') {
        this.parseTag();
      }
      // Check for links
      else if (char === '[') {
        this.parseLink();
      }
      // Regular text
      else {
        this.parseText();
      }
    }
    
    return this.tokens;
  }
  
  /**
   * Parse checkbox: - [ ] or - [x] or - [/] etc.
   */
  private parseCheckbox(): void {
    const checkboxRegex = /^-\s*\[(.)]/;
    const match = this.input.match(checkboxRegex);
    
    if (match) {
      const raw = match[0];
      const symbol = match[1];
      
      this.tokens.push({
        type: TokenType.CHECKBOX,
        value: symbol,
        raw,
        position: 0,
      });
      
      this.position = raw.length;
      this.skipWhitespace();
    }
  }
  
  /**
   * Check if character is an emoji signifier
   */
  private isEmojiSignifier(char: string | undefined): boolean {
    return !!char && char in EMOJI_SIGNIFIERS;
  }
  
  /**
   * Check if current position starts a text signifier
   */
  private isTextSignifier(): boolean {
    const remaining = this.input.slice(this.position);
    return TEXT_SIGNIFIERS.some(sig => remaining.startsWith(sig));
  }
  
  /**
   * Parse emoji signifier and its value
   */
  private parseEmojiSignifier(): void {
    const emoji = this.input[this.position];
    const signifierKey = EMOJI_SIGNIFIERS[emoji];
    const startPos = this.position;
    
    this.position++; // Skip emoji
    this.skipWhitespace();
    
    // Parse value (text until next emoji/signifier/end)
    const valueStart = this.position;
    let value = '';
    
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      // Stop at next emoji signifier or text signifier
      if (this.isEmojiSignifier(char) || this.isTextSignifier()) {
        break;
      }
      
      value += char;
      this.position++;
    }
    
    value = value.trim();
    const raw = this.input.slice(startPos, this.position);
    
    this.tokens.push({
      type: TokenType.EMOJI_SIGNIFIER,
      value: `${signifierKey}:${value}`,
      raw,
      position: startPos,
    });
  }
  
  /**
   * Parse text signifier and its value
   */
  private parseTextSignifier(): void {
    const remaining = this.input.slice(this.position);
    const signifier = TEXT_SIGNIFIERS.find(sig => remaining.startsWith(sig));
    
    if (!signifier) return;
    
    const startPos = this.position;
    this.position += signifier.length;
    this.skipWhitespace();
    
    // Parse value (text until next signifier/end)
    let value = '';
    
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      // Stop at next text signifier or emoji signifier
      if (this.isTextSignifier() || this.isEmojiSignifier(char)) {
        break;
      }
      
      value += char;
      this.position++;
    }
    
    value = value.trim();
    const raw = this.input.slice(startPos, this.position);
    const signifierKey = signifier.replace('::', '');
    
    this.tokens.push({
      type: TokenType.TEXT_SIGNIFIER,
      value: `${signifierKey}:${value}`,
      raw,
      position: startPos,
    });
  }
  
  /**
   * Parse tag: #tagname
   */
  private parseTag(): void {
    const startPos = this.position;
    this.position++; // Skip #
    
    let tagName = '';
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      // Tag ends at whitespace or special char
      if (/\s|[\[\]()#]/.test(char)) {
        break;
      }
      
      tagName += char;
      this.position++;
    }
    
    const raw = this.input.slice(startPos, this.position);
    
    this.tokens.push({
      type: TokenType.TAG,
      value: tagName,
      raw,
      position: startPos,
    });
  }
  
  /**
   * Parse link: [[internal]] or [text](url)
   */
  private parseLink(): void {
    const startPos = this.position;
    const remaining = this.input.slice(this.position);
    
    // Wikilink [[...]]
    if (remaining.startsWith('[[')) {
      const endIndex = remaining.indexOf(']]');
      if (endIndex !== -1) {
        const raw = remaining.slice(0, endIndex + 2);
        const value = remaining.slice(2, endIndex);
        
        this.tokens.push({
          type: TokenType.LINK,
          value,
          raw,
          position: startPos,
        });
        
        this.position += raw.length;
        return;
      }
    }
    
    // Markdown link [text](url)
    const mdLinkRegex = /^\[([^\]]+)\]\(([^)]+)\)/;
    const match = remaining.match(mdLinkRegex);
    
    if (match) {
      const raw = match[0];
      const value = match[2]; // URL
      
      this.tokens.push({
        type: TokenType.LINK,
        value,
        raw,
        position: startPos,
      });
      
      this.position += raw.length;
      return;
    }
    
    // Not a valid link, treat as text
    this.parseText();
  }
  
  /**
   * Parse regular text
   */
  private parseText(): void {
    const startPos = this.position;
    let text = '';
    
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      // Stop at emoji signifier, text signifier, tag, or link
      if (
        this.isEmojiSignifier(char) ||
        this.isTextSignifier() ||
        char === '#' ||
        char === '['
      ) {
        break;
      }
      
      text += char;
      this.position++;
    }
    
    text = text.trim();
    
    if (text.length > 0) {
      this.tokens.push({
        type: TokenType.TEXT,
        value: text,
        raw: text,
        position: startPos,
      });
    }
  }
  
  /**
   * Skip whitespace
   */
  private skipWhitespace(): void {
    while (this.position < this.input.length && /\s/.test(this.input[this.position])) {
      this.position++;
    }
  }
}

/**
 * Task Line Parser: Converts token stream into Task object
 */
export class TaskLineParser {
  private statusRegistry: StatusRegistry;
  
  constructor() {
    this.statusRegistry = StatusRegistry.getInstance();
  }
  
  /**
   * Parse task line into Task object
   */
  parse(line: string): Task {
    const tokenizer = new TaskLineTokenizer(line);
    const tokens = tokenizer.tokenize();
    
    // Extract fields from tokens
    const partial: Partial<Task> = {
      unknownFields: [], // For lossless parsing
    };
    
    let taskName = '';
    
    for (const token of tokens) {
      switch (token.type) {
        case TokenType.CHECKBOX:
          const status = this.statusRegistry.get(token.value);
          partial.statusSymbol = token.value;
          partial.status = this.statusRegistry.mapTypeToStatus(status.type);
          break;
          
        case TokenType.TEXT:
          taskName += (taskName ? ' ' : '') + token.value;
          break;
          
        case TokenType.TAG:
          if (!partial.tags) partial.tags = [];
          partial.tags.push(token.value);
          break;
          
        case TokenType.EMOJI_SIGNIFIER:
        case TokenType.TEXT_SIGNIFIER:
          this.parseSignifier(token.value, partial);
          break;
          
        case TokenType.LINK:
          // Store link in description or metadata
          if (!partial.description) partial.description = '';
          partial.description += ` [[${token.value}]]`;
          break;
          
        case TokenType.UNKNOWN:
          // Preserve unknown tokens for lossless serialization
          partial.unknownFields!.push(token.raw);
          break;
      }
    }
    
    partial.name = taskName.trim();
    
    return createTask(partial);
  }
  
  /**
   * Parse signifier value (due:2026-02-10, priority:high, etc.)
   */
  private parseSignifier(signifierValue: string, partial: Partial<Task>): void {
    const [key, value] = signifierValue.split(':');
    
    switch (key) {
      case 'due':
        partial.dueAt = this.parseDate(value);
        break;
        
      case 'scheduled':
        partial.scheduledAt = this.parseDate(value);
        break;
        
      case 'start':
        partial.startAt = this.parseDate(value);
        break;
        
      case 'recurs':
        partial.recurrenceText = value;
        // TODO: Parse into Frequency object using recurrence parser
        break;
        
      case 'id':
        partial.taskId = value;
        break;
        
      case 'dependsOn':
        if (!partial.dependsOn) partial.dependsOn = [];
        if (value) partial.dependsOn.push(value);
        break;
        
      case 'priority':
        partial.priority = normalizePriority(value);
        break;
        
      case 'priority-high':
      case 'priority-highest':
      case 'priority-medium':
      case 'priority-low':
      case 'priority-lowest':
        const priorityLevel = key.replace('priority-', '');
        partial.priority = normalizePriority(priorityLevel);
        break;
        
      case 'onCompletion':
        partial.onCompletion = value as any; // TODO: Parse completion action
        break;
        
      default:
        // Unknown signifier - preserve for lossless parsing
        if (!partial.unknownFields) partial.unknownFields = [];
        partial.unknownFields.push(`${key}:${value}`);
    }
  }
  
  /**
   * Parse date string (ISO or natural language)
   */
  private parseDate(dateString: string | undefined): string | undefined {
    if (!dateString) return undefined;
    
    // If already ISO format, return as-is
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      return dateString;
    }
    
    // TODO: Use chrono-node for natural language parsing
    // For now, return undefined for unparseable dates
    return undefined;
  }
}
