/**
 * A helper class for creating Markdown tables.
 */
export class MarkdownTable {
    private readonly headers: string[];
    private readonly rows: string[][] = [];

    /**
     * Create a new MarkdownTable with the given column headers.
     * @param headers - Array of column header strings
     */
    constructor(headers: string[]) {
        this.headers = headers;
    }

    /**
     * Add a row to the table.
     * @param row - Array of cell values for the row
     */
    public addRow(row: string[]): void {
        this.rows.push(row);
    }

    /**
     * Add multiple rows to the table.
     * @param rows - Array of rows, each being an array of cell values
     */
    public addRows(rows: string[][]): void {
        for (const row of rows) {
            this.addRow(row);
        }
    }

    /**
     * Generate the Markdown table string.
     * @returns The complete Markdown table as a string
     */
    public render(): string {
        const lines: string[] = [];

        // Header row
        lines.push('| ' + this.headers.join(' | ') + ' |');

        // Separator row
        const separators = this.headers.map(() => '---');
        lines.push('| ' + separators.join(' | ') + ' |');

        // Data rows
        for (const row of this.rows) {
            // Pad row with empty strings if needed
            const paddedRow = [...row];
            while (paddedRow.length < this.headers.length) {
                paddedRow.push('');
            }
            lines.push('| ' + paddedRow.join(' | ') + ' |');
        }

        return lines.join('\n');
    }

    /**
     * Get string representation (alias for render).
     * @returns The complete Markdown table as a string
     */
    public toString(): string {
        return this.render();
    }
}
