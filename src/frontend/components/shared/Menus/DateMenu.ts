import type { Task } from "@backend/core/models/Task";
import { type AllTaskDateFields, isAHappensDate } from "@shared/utils/dateTime/date-field-types";
import { allHappensDateInstructions, allLifeCycleDateInstructions } from "@components/shared/EditInstructions/DateInstructions";
import { TaskEditingMenu, type TaskSaver, defaultTaskSaver } from "@components/shared/Menus/TaskEditingMenu";

export class DateMenu extends TaskEditingMenu {
    /**
     * Constructor, which sets up the menu items.
     * @param field - the Date field to edit
     * @param task - the Task to be edited.
     * @param taskSaver - an optional {@link TaskSaver} function. For details, see {@link TaskEditingMenu}.
     */
    constructor(field: AllTaskDateFields, task: Task, taskSaver: TaskSaver = defaultTaskSaver) {
        super(taskSaver);

        const instructions = isAHappensDate(field)
            ? allHappensDateInstructions(field, task)
            : allLifeCycleDateInstructions(field, task);
        this.addItemsForInstructions(instructions, task);
    }
}
