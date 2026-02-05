import type { Logger } from "@shared/utils/lib/logging";
import type { Task } from "@shared/utils/Task/Task";

/**
 * Log the start of a task edit operation.
 * @param logger - Logger instance to use
 * @param codeLocation - Location in code where edit started
 * @param task - The task being edited
 */
export function logStartOfTaskEdit(logger: Logger, codeLocation: string, task: Task): void {
    logger.debug(`${codeLocation}: Starting edit of task: "${task.description}"`);
}

/**
 * Log the end of a task edit operation.
 * @param logger - Logger instance to use
 * @param codeLocation - Location in code where edit ended
 * @param newTasks - The resulting task(s) after the edit
 */
export function logEndOfTaskEdit(logger: Logger, codeLocation: string, newTasks: Task[]): void {
    const count = newTasks.length;
    const descriptions = newTasks.map((t) => `"${t.description}"`).join(', ');
    logger.debug(`${codeLocation}: Edit complete, produced ${count} task(s): ${descriptions}`);
}
