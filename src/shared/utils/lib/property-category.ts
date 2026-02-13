/**
 * Represents a category with a name and sort order for grouping/sorting.
 * Used for categorizing task properties like dates (Today, Future, Overdue, etc.)
 */
export class PropertyCategory {
    public readonly name: string;
    public readonly sortOrder: number;

    /**
     * Create a new PropertyCategory.
     * @param name - Display name of the category
     * @param sortOrder - Numeric order for sorting (lower = first)
     */
    constructor(name: string, sortOrder: number) {
        this.name = name;
        this.sortOrder = sortOrder;
    }

    /**
     * Compare this category with another for sorting.
     * @param other - The other category to compare with
     * @returns Negative if this comes first, positive if other comes first, 0 if equal
     */
    public compareTo(other: PropertyCategory): number {
        return this.sortOrder - other.sortOrder;
    }

    /**
     * Get string representation of this category.
     * @returns The category name
     */
    public toString(): string {
        return this.name;
    }
}
