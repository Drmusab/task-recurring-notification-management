// @ts-nocheck
import type { Task } from "@backend/core/models/Task";
import { allPriorityInstructions } from "@components/shared/EditInstructions/PriorityInstructions";
import { TaskEditingMenu, type TaskSaver, defaultTaskSaver } from "@components/shared/Menus/TaskEditingMenu";

/**
 * A Menu of options for editing the status of a Task object.
 *
 * @example
 *     editTaskPencil.addEventListener('contextmenu', (ev: MouseEvent) => {
 *         showMenu(ev, new PriorityMenu(task));
 *     });
 *     editTaskPencil.setAttribute('title', 'Right-click for options');
 */
export class PriorityMenu extends TaskEditingMenu {
    /**
     * Constructor, which sets up the menu items.
     * @param task - the Task to be edited.
     * @param taskSaver - an optional {@link TaskSaver} function. For details, see {@link TaskEditingMenu}.
     */
    constructor(task: Task, taskSaver: TaskSaver = defaultTaskSaver) {
        super(taskSaver);

        this.addItemsForInstructions(allPriorityInstructions(), task);
    }
}
