/**
 * Plugin menu utilities - task name and time extraction from block content.
 */

/**
 * Extract a task name from block content text.
 */
export function extractTaskName(content: string): string {
  if (!content) return "";
  // Remove markdown markers (*, -, [ ], [x], etc.)
  let name = content.replace(/^[\s]*[-*+]\s*(\[.\]\s*)?/, "").trim();
  // Remove trailing timestamps or dates
  name = name.replace(/\s*(@\d{4}-\d{2}-\d{2}.*)?$/, "").trim();
  return name;
}

/**
 * Extract time information from block content.
 */
export function extractTimeFromContent(content: string): string | undefined {
  if (!content) return undefined;
  // Match common time patterns: @2024-01-15, due:2024-01-15, ⏰ 2024-01-15
  const timePatterns = [
    /@(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/,
    /due:\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/,
    /⏰\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/,
    /📅\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/,
  ];
  for (const pattern of timePatterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}
