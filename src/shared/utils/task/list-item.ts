/**
 * ListItem is a base class for list-based items like tasks.
 * It handles the common properties of markdown list items.
 */

import type { TaskLocation } from "@shared/utils/task/task-location";

export interface ListItemConstructorParameters {
    originalMarkdown: string;
    indentation: string;
    listMarker: string;
    statusCharacter: string;
    description: string;
    taskLocation: TaskLocation;
    parent?: ListItem | null;
}

/**
 * Base class for markdown list items.
 * Task extends this class to add task-specific functionality.
 */
export class ListItem {
    public readonly originalMarkdown: string;
    public readonly indentation: string;
    public readonly listMarker: string;
    public readonly statusCharacter: string;
    public readonly description: string;
    public readonly taskLocation: TaskLocation;
    public readonly parent: ListItem | null;

    constructor({
        originalMarkdown,
        indentation,
        listMarker,
        statusCharacter,
        description,
        taskLocation,
        parent,
    }: ListItemConstructorParameters) {
        this.originalMarkdown = originalMarkdown;
        this.indentation = indentation;
        this.listMarker = listMarker;
        this.statusCharacter = statusCharacter;
        this.description = description;
        this.taskLocation = taskLocation;
        this.parent = parent ?? null;
    }

    /**
     * Get the path of the file containing this item
     */
    get path(): string {
        return this.taskLocation.path;
    }

    /**
     * Get the line number of this item (0-indexed)
     */
    get lineNumber(): number {
        return this.taskLocation.lineNumber;
    }

    /**
     * Get the section this item is in
     */
    get sectionIndex(): number {
        return this.taskLocation.sectionIndex;
    }

    /**
     * Find the closest parent task in the hierarchy
     */
    findClosestParentTask(): ListItem | null {
        if (!this.parent) {
            return null;
        }
        // Check if parent is a Task (has status property with symbol)
        if ('status' in this.parent) {
            return this.parent;
        }
        return this.parent.findClosestParentTask();
    }

    /**
     * Check or uncheck this item (toggle status)
     * Returns a new item with the toggled status
     */
    checkOrUncheck(): ListItem[] {
        const newStatusChar = this.statusCharacter === ' ' ? 'x' : ' ';
        return [new ListItem({
            ...this,
            statusCharacter: newStatusChar,
        })];
    }

    /**
     * Parse a list item from a markdown line
     */
    static fromListItemLine({
        line,
        taskLocation,
        parent,
    }: {
        line: string;
        taskLocation: TaskLocation;
        parent?: ListItem | null;
    }): ListItem | null {
        // Match markdown list item: "- [ ] description" or "* [x] description"
        const listItemMatch = line.match(/^([\s]*)([*\-+]|\d+\.)\s+\[(.)\]\s*(.*)/);
        
        if (!listItemMatch) {
            return null;
        }

        const [, indentation, listMarker, statusCharacter, description] = listItemMatch;

        return new ListItem({
            originalMarkdown: line,
            indentation: indentation || '',
            listMarker: listMarker || '-',
            statusCharacter: statusCharacter || ' ',
            description: description || '',
            taskLocation,
            parent,
        });
    }

    /**
     * Convert this list item back to markdown string
     */
    toMarkdown(): string {
        return `${this.indentation}${this.listMarker} [${this.statusCharacter}] ${this.description}`;
    }

    /**
     * Compare two list items for equality
     */
    identicalTo(other: ListItem): boolean {
        return this.originalMarkdown === other.originalMarkdown &&
               this.taskLocation.path === other.taskLocation.path &&
               this.taskLocation.lineNumber === other.taskLocation.lineNumber;
    }
}
