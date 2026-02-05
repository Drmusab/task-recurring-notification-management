/**
 * Capitalizes the first letter of a string.
 * @param text - The input string
 * @returns The string with its first letter capitalized
 */
export function capitalizeFirstLetter(text: string): string {
    if (!text || text.length === 0) {
        return text;
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
}
