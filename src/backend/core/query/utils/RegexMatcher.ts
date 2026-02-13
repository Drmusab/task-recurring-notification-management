/**
 * RegexMatcher - Centralized regex compilation and evaluation
 * 
 * This module handles all regex compilation, validation, and testing
 * to ensure consistent behavior across the query system.
 */

export interface RegexSpec {
  pattern: string;
  flags?: string;
}

/**
 * Centralized regex matcher with validation and caching
 */
export class RegexMatcher {
  /**
   * Compile a regex from a specification
   * @throws Error if pattern or flags are invalid
   */
  static compile(spec: RegexSpec): RegExp {
    const { pattern, flags = '' } = spec;

    // Validate pattern
    const patternValidation = this.validatePattern(pattern);
    if (!patternValidation.valid) {
      throw new Error(patternValidation.error || 'Invalid regex pattern');
    }

    // Validate flags
    const flagsValidation = this.validateFlags(flags);
    if (!flagsValidation.valid) {
      throw new Error(flagsValidation.error || 'Invalid regex flags');
    }

    // Compile the regex
    try {
      return new RegExp(pattern, flags);
    } catch (error) {
      throw new Error(`Failed to compile regex: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test a regex against a value
   * @param re The compiled regular expression
   * @param value The string to test
   * @returns true if the regex matches, false otherwise
   */
  static test(re: RegExp, value: string): boolean {
    try {
      return re.test(value);
    } catch {
      return false;
    }
  }

  /**
   * Validate a regex pattern
   */
  static validatePattern(pattern: string): { valid: boolean; error?: string } {
    // Check for empty pattern
    if (pattern.length === 0) {
      return { valid: false, error: 'Regex pattern cannot be empty' };
    }

    // Optional: Check for excessively long patterns
    if (pattern.length > 500) {
      return { valid: false, error: 'Regex pattern is too long (max 500 characters)' };
    }

    // Try to compile to check for syntax errors
    try {
      new RegExp(pattern);
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, error: `Invalid regex syntax: ${message}` };
    }
  }

  /**
   * Validate regex flags
   * Only allows: i (case-insensitive), m (multiline), s (dotall), u (unicode)
   * Rejects: g (global), y (sticky), d (indices)
   */
  static validateFlags(flags: string): { valid: boolean; error?: string } {
    if (!flags) {
      return { valid: true };
    }

    const allowedFlags = ['i', 'm', 's', 'u'];
    const disallowedFlags = ['g', 'y', 'd'];

    // Check for disallowed flags
    for (const flag of flags) {
      if (disallowedFlags.includes(flag)) {
        return { valid: false, error: `Unsupported flag: "${flag}" (use i, m, s, u only)` };
      }
    }

    // Check for unknown flags
    for (const flag of flags) {
      if (!allowedFlags.includes(flag)) {
        return { valid: false, error: `Unknown flag: "${flag}" (use i, m, s, u only)` };
      }
    }

    // Check for duplicate flags
    const flagsArray = Array.from(flags);
    const uniqueFlags = new Set(flagsArray);
    if (uniqueFlags.size !== flagsArray.length) {
      return { valid: false, error: 'Duplicate flags found' };
    }

    return { valid: true };
  }

  /**
   * Parse regex literal syntax: /pattern/flags
   * @returns RegexSpec or null if not a regex literal
   */
  static parseRegexLiteral(input: string): RegexSpec | null {
    // Must start and end with /
    if (!input.startsWith('/') || input.length < 2) {
      return null;
    }

    // Find the last unescaped /
    let endIndex = -1;
    for (let i = input.length - 1; i > 0; i--) {
      if (input[i] === '/') {
        // Check if it's escaped
        let backslashCount = 0;
        for (let j = i - 1; j >= 0 && input[j] === '\\'; j--) {
          backslashCount++;
        }
        // If even number of backslashes (including 0), the / is not escaped
        if (backslashCount % 2 === 0) {
          endIndex = i;
          break;
        }
      }
    }

    if (endIndex <= 0) {
      return null;
    }

    // Extract pattern (between slashes)
    const rawPattern = input.substring(1, endIndex);
    
    // Unescape escaped slashes in the pattern
    const pattern = rawPattern.replace(/\\\//g, '/');

    // Extract flags (after the closing slash)
    const flags = input.substring(endIndex + 1);

    return { pattern, flags };
  }
}
