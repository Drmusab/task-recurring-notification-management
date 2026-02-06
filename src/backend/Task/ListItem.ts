/**
 * ListItem - represents a parsed task line item.
 * Stub for non-build-path code.
 */
export interface ListItem {
  readonly line: string;
  readonly lineNumber: number;
  readonly parent: ListItem | null;
  readonly children: ListItem[];
  readonly task: string | null;
}

export function parseListItem(line: string, lineNumber: number): ListItem {
  return {
    line,
    lineNumber,
    parent: null,
    children: [],
    task: null,
  };
}
