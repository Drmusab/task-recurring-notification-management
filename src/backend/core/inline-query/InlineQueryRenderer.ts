import type { QueryResult } from "@backend/core/query/QueryEngine";
import type { Task } from "@backend/core/models/Task";
import type { InlineQueryView } from "@backend/core/inline-query/InlineQueryBlockParser";

export interface InlineQueryRenderOptions {
  query: string;
  view: InlineQueryView;
  result?: QueryResult;
  error?: string;
  isIndexing?: boolean;
  maxItems?: number;
  renderedCount?: number;
}

export class InlineQueryRenderer {
  render(container: HTMLElement, options: InlineQueryRenderOptions): void {
    container.innerHTML = "";
    container.classList.add("rt-inline-query");
    container.dataset.query = options.query;
    container.dataset.view = options.view;
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Task query results");

    if (options.isIndexing) {
      container.appendChild(this.renderLoadingState());
      return;
    }

    if (options.error) {
      container.appendChild(this.renderErrorState(options.error));
      return;
    }

    if (!options.result) {
      container.appendChild(this.renderState("No results yet."));
      return;
    }

    const tasks = options.result.tasks;
    const total = tasks.length;
    if (total === 0 || tasks.length === 0) {
      container.appendChild(this.renderEmptyState());
      return;
    }

    const header = document.createElement("div");
    header.className = "rt-inline-query__header";
    header.textContent = `Inline Tasks · ${total}`;
    container.appendChild(header);

    const view = options.view || "list";
    const groupMap = options.result.groups;
    if (groupMap && groupMap.size > 0) {
      groupMap.forEach((groupTasks, name) => {
        const section = this.renderGroupSection(name, groupTasks, view, options);
        container.appendChild(section);
      });
    } else {
      container.appendChild(this.renderTaskCollection(tasks, view, options));
    }

    if (typeof options.maxItems === "number" && typeof options.renderedCount === "number") {
      if (options.renderedCount < total) {
        const footer = document.createElement("div");
        footer.className = "rt-inline-query__footer";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rt-inline-query__more";
        button.dataset.rtAction = "more";
        button.textContent = `Show more (${options.renderedCount}/${total})`;
        footer.appendChild(button);
        container.appendChild(footer);
      }
    }
  }

  private renderGroupSection(
    name: string,
    tasks: Task[],
    view: InlineQueryView,
    options: InlineQueryRenderOptions
  ): HTMLElement {
    const section = document.createElement("section");
    section.className = "rt-inline-query__group";

    const heading = document.createElement("div");
    heading.className = "rt-inline-query__group-title";
    heading.textContent = name || "Untitled";
    section.appendChild(heading);

    section.appendChild(this.renderTaskCollection(tasks, view, options));
    return section;
  }

  private renderTaskCollection(
    tasks: Task[],
    view: InlineQueryView,
    options: InlineQueryRenderOptions
  ): HTMLElement {
    if (view === "table") {
      return this.renderTable(tasks, options);
    }
    return this.renderList(tasks, options);
  }

  private renderList(tasks: Task[], options: InlineQueryRenderOptions): HTMLElement {
    const list = document.createElement("ul");
    list.className = "rt-inline-query__list";
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", "Tasks");

    // Use DocumentFragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    const rendered = this.getRenderedTasks(tasks, options);
    
    rendered.forEach((task) => {
      const item = document.createElement("li");
      item.className = "rt-inline-query__item";
      item.dataset.taskId = task.id;

      const checkbox = document.createElement("button");
      checkbox.type = "button";
      checkbox.className = "rt-inline-query__checkbox";
      checkbox.dataset.rtAction = "toggle";
      checkbox.setAttribute("aria-pressed", String(task.status === "done"));
      // Sanitize task name for aria-label to prevent attribute injection
      const checkboxLabel = task.status === "done" 
        ? `Mark incomplete: ${task.name.replace(/"/g, "'")}`
        : `Mark complete: ${task.name.replace(/"/g, "'")}`;
      checkbox.setAttribute("aria-label", checkboxLabel);
      checkbox.textContent = task.status === "done" ? "☑" : "☐";

      const title = document.createElement("span");
      title.className = "rt-inline-query__title";
      title.textContent = task.name;
      if (task.status === "done") {
        title.classList.add("rt-inline-query__title--done");
      }

      const meta = document.createElement("span");
      meta.className = "rt-inline-query__meta";
      meta.textContent = this.formatTaskMeta(task);

      const source = this.renderSource(task);

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "rt-inline-query__edit";
      editButton.dataset.rtAction = "edit";
      // Sanitize task name for aria-label to prevent attribute injection
      editButton.setAttribute("aria-label", `Edit task: ${task.name.replace(/"/g, "'")}`);
      editButton.textContent = "Edit";

      item.appendChild(checkbox);
      item.appendChild(title);
      item.appendChild(meta);
      if (source) {
        item.appendChild(source);
      }
      item.appendChild(editButton);

      fragment.appendChild(item);
    });

    list.appendChild(fragment);
    return list;
  }

  private renderTable(tasks: Task[], options: InlineQueryRenderOptions): HTMLElement {
    const table = document.createElement("table");
    table.className = "rt-inline-query__table";
    table.setAttribute("role", "table");
    table.setAttribute("aria-label", "Tasks table");

    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Status", "Task", "Dates", "Priority", "Source", ""].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement("tbody");
    
    // Use DocumentFragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    const rendered = this.getRenderedTasks(tasks, options);
    
    rendered.forEach((task) => {
      const row = document.createElement("tr");
      row.dataset.taskId = task.id;

      const statusCell = document.createElement("td");
      const checkbox = document.createElement("button");
      checkbox.type = "button";
      checkbox.className = "rt-inline-query__checkbox";
      checkbox.dataset.rtAction = "toggle";
      checkbox.setAttribute("aria-pressed", String(task.status === "done"));
      // Sanitize task name for aria-label to prevent attribute injection
      const ariaLabel = task.status === "done" 
        ? `Mark incomplete: ${task.name.replace(/"/g, "'")}`
        : `Mark complete: ${task.name.replace(/"/g, "'")}`;
      checkbox.setAttribute("aria-label", ariaLabel);
      checkbox.textContent = task.status === "done" ? "☑" : "☐";
      statusCell.appendChild(checkbox);

      const titleCell = document.createElement("td");
      titleCell.textContent = task.name;
      if (task.status === "done") {
        titleCell.classList.add("rt-inline-query__title--done");
      }

      const dateCell = document.createElement("td");
      dateCell.textContent = this.formatTaskDates(task);

      const priorityCell = document.createElement("td");
      priorityCell.textContent = task.priority ?? "—";

      const sourceCell = document.createElement("td");
      const source = this.renderSource(task);
      if (source) {
        sourceCell.appendChild(source);
      } else {
        sourceCell.textContent = "—";
      }

      const actionsCell = document.createElement("td");
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "rt-inline-query__edit";
      editButton.dataset.rtAction = "edit";
      // Sanitize task name for aria-label to prevent attribute injection
      editButton.setAttribute("aria-label", `Edit task: ${task.name.replace(/"/g, "'")}`);
      editButton.textContent = "Edit";
      actionsCell.appendChild(editButton);

      row.appendChild(statusCell);
      row.appendChild(titleCell);
      row.appendChild(dateCell);
      row.appendChild(priorityCell);
      row.appendChild(sourceCell);
      row.appendChild(actionsCell);

      fragment.appendChild(row);
    });
    
    body.appendChild(fragment);
    table.appendChild(body);

    return table;
  }

  private getRenderedTasks(tasks: Task[], options: InlineQueryRenderOptions): Task[] {
    if (!options.maxItems) {
      return tasks;
    }
    return tasks.slice(0, options.maxItems);
  }

  private formatTaskDates(task: Task): string {
    const parts: string[] = [];
    if (task.dueAt) {
      parts.push(`Due ${this.formatDate(task.dueAt)}`);
    }
    if (task.scheduledAt) {
      parts.push(`Scheduled ${this.formatDate(task.scheduledAt)}`);
    }
    if (task.startAt) {
      parts.push(`Start ${this.formatDate(task.startAt)}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "—";
  }

  private formatTaskMeta(task: Task): string {
    const parts: string[] = [];
    if (task.dueAt) {
      parts.push(`Due ${this.formatDate(task.dueAt)}`);
    }
    if (task.scheduledAt) {
      parts.push(`Scheduled ${this.formatDate(task.scheduledAt)}`);
    }
    if (task.startAt) {
      parts.push(`Start ${this.formatDate(task.startAt)}`);
    }
    if (task.priority) {
      parts.push(`Priority ${task.priority}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "No dates";
  }

  private formatDate(iso?: string): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  }

  private renderSource(task: Task): HTMLElement | null {
    if (!task.linkedBlockId && !task.path) {
      return null;
    }
    const link = document.createElement("a");
    link.className = "rt-inline-query__source";
    link.dataset.rtAction = "jump";
    link.dataset.blockId = task.linkedBlockId ?? "";
    if (task.linkedBlockId) {
      link.href = `siyuan://blocks/${task.linkedBlockId}`;
    }
    link.textContent = this.formatSourceLabel(task);
    link.title = task.path ?? task.linkedBlockId ?? "";
    return link;
  }

  private formatSourceLabel(task: Task): string {
    if (task.path) {
      const parts = task.path.split("/");
      return parts[parts.length - 1] || task.path;
    }
    if (task.linkedBlockId) {
      return "Block";
    }
    return "Source";
  }

  private renderState(message: string, tone: "info" | "error" = "info"): HTMLElement {
    const state = document.createElement("div");
    state.className = `rt-inline-query__state rt-inline-query__state--${tone}`;
    state.textContent = message;
    return state;
  }

  /**
   * Renders a loading state with skeleton screen
   */
  private renderLoadingState(): HTMLElement {
    const loading = document.createElement("div");
    loading.className = "rt-inline-query__loading";
    loading.setAttribute("role", "status");
    loading.setAttribute("aria-live", "polite");
    loading.setAttribute("aria-label", "Loading tasks");

    const spinner = document.createElement("div");
    spinner.className = "rt-inline-query__spinner";
    
    const text = document.createElement("div");
    text.className = "rt-inline-query__loading-text";
    text.textContent = "Building index…";

    loading.appendChild(spinner);
    loading.appendChild(text);
    return loading;
  }

  /**
   * Renders an error state with actionable message
   */
  private renderErrorState(error: string): HTMLElement {
    const errorDiv = document.createElement("div");
    errorDiv.className = "rt-inline-query__state rt-inline-query__state--error";
    errorDiv.setAttribute("role", "alert");

    const icon = document.createElement("div");
    icon.className = "rt-inline-query__error-icon";
    icon.textContent = "⚠";

    const message = document.createElement("div");
    message.className = "rt-inline-query__error-message";
    message.textContent = error;

    const hint = document.createElement("div");
    hint.className = "rt-inline-query__error-hint";
    hint.textContent = "Check your query syntax and try again.";

    errorDiv.appendChild(icon);
    errorDiv.appendChild(message);
    errorDiv.appendChild(hint);
    return errorDiv;
  }

  /**
   * Renders an empty state when no tasks match
   */
  private renderEmptyState(): HTMLElement {
    const empty = document.createElement("div");
    empty.className = "rt-inline-query__state rt-inline-query__state--empty";

    const icon = document.createElement("div");
    icon.className = "rt-inline-query__empty-icon";
    icon.textContent = "📋";

    const message = document.createElement("div");
    message.className = "rt-inline-query__empty-message";
    message.textContent = "No tasks match this query";

    const hint = document.createElement("div");
    hint.className = "rt-inline-query__empty-hint";
    hint.textContent = "Try adjusting your filters or create a new task.";

    empty.appendChild(icon);
    empty.appendChild(message);
    empty.appendChild(hint);
    return empty;
  }
}
