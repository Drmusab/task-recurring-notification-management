/**
 * Query Interface - Legacy compatibility
 * 
 * This interface is maintained for cross-project compatibility.
 * Not actively used in SiYuan plugin but kept for reference.
 */

import type { TaskDTO } from '../../services/DTOs';
type Task = TaskDTO;

/** Local type placeholder for Grouper (actual class is in backend — not importable from frontend) */
type Grouper = Record<string, unknown>;

/**
 * Layout options for task display (inline type definition)
 */
export interface TaskLayoutOptions {
    showDescription?: boolean;
    showPriority?: boolean;
    showRecurrence?: boolean;
    showDueDate?: boolean;
    showTags?: boolean;
}

/**
 * Layout options for query results display (inline type definition)
 */
export interface QueryLayoutOptions {
    showTaskCount?: boolean;
    showBacklinks?: boolean;
    showUrgency?: boolean;
}

/**
 * Query result type (inline type definition)
 */
export interface QueryResult {
    tasks: Task[];
    totalCount: number;
    groupedBy?: string;
}

/**
 * Standard interface for the query engine used by Tasks, multiple
 * engines can be created by using this and then updating the
 * Query Render class to handle the syntax for the new query engine.
 *
 * @interface IQuery
 */
export interface IQuery {
    /**
     * This is the text from the code block in markdown and contains
     * the query to be used by a implementation of the IQuery.
     *
     * @type {string}
     */
    source: string;

    /**
     * Collection of groupings being used in this query, this is based off
     * the main task properties like backlink, heading, path, status, etc.
     *
     * @type {Grouper[]}
     */
    grouping: Grouper[];

    /**
     * Error message if there is an error in the query. This will be
     * shown to users.
     *
     * @type {(string | undefined)}
     */
    error: string | undefined;

    /**
     * Any layout options the query engine should be aware of or
     * used in the query.
     *
     * @type {TaskLayoutOptions}
     */
    taskLayoutOptions: TaskLayoutOptions;

    /**
     * Any layout options the query engine should be aware of or
     * used in the query.
     *
     * @type {QueryLayoutOptions}
     */
    queryLayoutOptions: QueryLayoutOptions;

    /**
     * Main method for executing the query. This will be called by the
     * code block processor registered in . It takes the Task collection
     * from the cache and returns a TaskGroup collection. If there is no grouping
     * then the TaskGroup collection will contain a single TaskGroup with all tasks
     * found using the query.
     *
     * @param {Task[]} tasks
     * @return {*}  {TaskGroups}
     */
    applyQueryToTasks: (tasks: Task[]) => QueryResult;

    /**
     * Return a text representation of the query.
     *
     * This is currently displayed as a <pre> block, retaining indentation.
     */
    explainQuery: () => string;

    /**
     * A probably unique identifier for this query, typically for use in debug logging
     */
    readonly queryId: string;

    /**
     * Write a debug log message.
     *
     * This is provided to allow the query rendering code to log progress on the rendering,
     * including meaningful information about the query being rendered.
     * @param message
     * @param objects
     */
    debug(message: string, objects?: any): void;

    /**
     * Write a warn log message.
     *
     * This is provided to allow the query rendering code to log progress on the rendering,
     * including meaningful information about the query being rendered.
     * @param message
     * @param objects
     */
    warn(message: string, objects?: any): void;
}
