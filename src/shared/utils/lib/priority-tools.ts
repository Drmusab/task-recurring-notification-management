import { Priority } from "@shared/utils/task/priority";

/**
 * Maps priority names using 'None' for the default priority level.
 */
const priorityNamesUsingNone: Record<Priority, string> = {
    [Priority.Highest]: 'Highest',
    [Priority.High]: 'High',
    [Priority.Medium]: 'Medium',
    [Priority.None]: 'None',
    [Priority.Low]: 'Low',
    [Priority.Lowest]: 'Lowest',
};

/**
 * Maps priority names using 'Normal' for the default priority level.
 */
const priorityNamesUsingNormal: Record<Priority, string> = {
    [Priority.Highest]: 'Highest',
    [Priority.High]: 'High',
    [Priority.Medium]: 'Medium',
    [Priority.None]: 'Normal',
    [Priority.Low]: 'Low',
    [Priority.Lowest]: 'Lowest',
};

/**
 * Maps priority name strings to Priority enum values.
 */
const priorityValues: Record<string, Priority> = {
    highest: Priority.Highest,
    high: Priority.High,
    medium: Priority.Medium,
    none: Priority.None,
    normal: Priority.None,
    low: Priority.Low,
    lowest: Priority.Lowest,
};

/**
 * Tools for working with Priority values.
 */
export class PriorityTools {
    /**
     * Get the display name of a priority, using 'None' for the default priority.
     * @param priority - The Priority enum value
     * @returns The priority name string
     */
    public static priorityNameUsingNone(priority: Priority): string {
        return priorityNamesUsingNone[priority] ?? 'None';
    }

    /**
     * Get the display name of a priority, using 'Normal' for the default priority.
     * @param priority - The Priority enum value
     * @returns The priority name string
     */
    public static priorityNameUsingNormal(priority: Priority): string {
        return priorityNamesUsingNormal[priority] ?? 'Normal';
    }

    /**
     * Convert a priority name string to its Priority enum value.
     * @param priorityName - The priority name string (case-insensitive)
     * @returns The corresponding Priority enum value, or Priority.None if not found
     */
    public static priorityValue(priorityName: string): Priority {
        const normalizedName = priorityName.toLowerCase().trim();
        return priorityValues[normalizedName] ?? Priority.None;
    }
}
