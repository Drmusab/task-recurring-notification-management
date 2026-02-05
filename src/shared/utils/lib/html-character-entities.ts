/**
 * Map of special characters to their HTML entity equivalents.
 */
const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
};

/**
 * Encode a single character as its HTML entity if needed.
 * @param char - The character to encode
 * @returns The HTML entity if the character needs encoding, otherwise the original character
 */
export function htmlEncodeCharacter(char: string): string {
    if (!char || char.length === 0) {
        return char;
    }
    // Only encode the first character if multiple are passed
    const firstChar = char.charAt(0);
    return htmlEntities[firstChar] ?? firstChar;
}

/**
 * Encode all special HTML characters in a string.
 * @param text - The string to encode
 * @returns The string with all special characters replaced with HTML entities
 */
export function htmlEncodeString(text: string): string {
    if (!text) {
        return text;
    }
    return text.replace(/[&<>"'`=\/]/g, (char) => htmlEntities[char] ?? char);
}
