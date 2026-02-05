/**
 * SiYuan Task Management Plugin
 * Main entry point
 */

import {
  Plugin,
  showMessage,
  Dialog,
  Menu,
  getFrontend,
  fetchPost,
  type IProtyle,
} from "siyuan";

import { TaskManager } from "@backend/core/managers/TaskManager";
import { SmartSuggestionEngine } from "@backend/core/ai/SmartSuggestionEngine";
import type { Task } from "@backend/core/models/Task";
import * as logger from "@backend/logging/logger";
import { TaskUIStateManager } from "@backend/core/ui/TaskUIState";
import { updateAnalyticsFromTasks } from "@frontend/stores/task-analytics.store";
import { getTaskReminderBridge } from "@backend/core/integration/TaskReminderBridge";
import { i18nStore } from "@frontend/stores/i18n.store";

// Import styles
import "@frontend/styles/main.scss";

const DOCK_TYPE = "task-management-dock";

export default class TaskManagementPlugin extends Plugin {
  private taskManager: TaskManager | null = null;
  private aiEngine: SmartSuggestionEngine | null = null;
  private isMobile: boolean = false;
  private uiStateManager: TaskUIStateManager = TaskUIStateManager.getInstance();

  async onload() {
    try {
      logger.info("Loading Task Management Plugin...");
      
      // Detect platform
      const frontEnd = getFrontend();
      this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
      
      // Initialize i18n store with plugin translations
      i18nStore.init(this.i18n);
      
      // Initialize services
      await this.initializeServices();
      
      // Register UI components
      this.registerDock();
      this.registerCommands();
      this.registerTopBarIcon();
      this.registerSlashCommands();
      
      // Start task manager
      if (this.taskManager) {
        await this.taskManager.start(
          (task) => this.onTaskDue(task),
          (task) => this.onTaskMissed(task)
        );
      }
      
      logger.info("Task Management Plugin loaded successfully");
      showMessage(this.i18n.pluginLoaded || "Task Management loaded", 3000);
    } catch (error) {
      logger.error("Fatal error loading Task Management Plugin", error);
      showMessage(
        (this.i18n.pluginLoadFailed || "Failed to load Task Management Plugin") + 
        ': ' + (error instanceof Error ? error.message : String(error)),
        10000,
        'error'
      );
      // Continue plugin load but mark as failed
      // This prevents SiYuan from crashing but alerts the user
    }
  }

  async onunload() {
    logger.info("Unloading Task Management Plugin...");
    
    try {
      // Destroy task manager
      if (this.taskManager) {
        await this.taskManager.destroy();
      }
    } catch (error) {
      logger.error("Error during TaskManager cleanup", error);
      // Continue with cleanup even if TaskManager.destroy() fails
    } finally {
      // Always clean up references
      this.taskManager = null;
      this.aiEngine = null;
      logger.info("Task Management Plugin unloaded");
    }
  }

  onLayoutReady() {
    logger.debug("Layout ready");
    // Dock will be auto-restored by SiYuan if it was open before
    // Refresh the task list to ensure it's up-to-date
    this.refreshTaskList();
  }

  private async initializeServices() {
    try {
      // Initialize task manager (singleton)
      this.taskManager = TaskManager.getInstance(this);
      if (this.taskManager) {
        await this.taskManager.initialize();
      } else {
        throw new Error('Failed to create TaskManager instance');
      }
      
      // Initialize AI engine
      this.aiEngine = new SmartSuggestionEngine();
      
      // Initialize UI state manager
      this.uiStateManager = TaskUIStateManager.getInstance();
      
      // Initialize analytics on load
      try {
        const allTasks = this.taskManager?.getRepository()?.getAllTasks() || [];
        updateAnalyticsFromTasks(allTasks);
        logger.info(`Analytics initialized with ${allTasks.length} tasks`);
      } catch (error) {
        logger.error('Failed to initialize analytics', error);
        // Non-fatal - analytics is not critical for plugin operation
      }
      
      // Initialize reminder bridge
      try {
        const reminderBridge = getTaskReminderBridge({ enabled: true });
        // Note: ReminderPlugin initialization happens separately
        // Bridge will be ready when ReminderPlugin calls initialize()
        logger.info('TaskReminderBridge created (waiting for ReminderPlugin)');
      } catch (error) {
        logger.error('Failed to initialize reminder bridge', error);
        // Non-fatal - reminder bridge is optional
      }
    } catch (error) {
      logger.error('Critical error during service initialization', error);
      showMessage(
        (this.i18n.initializationError || 'Failed to initialize Task Management Plugin') + 
        ': ' + (error instanceof Error ? error.message : String(error)),
        7000,
        'error'
      );
      throw error; // Re-throw to prevent plugin from starting in broken state
    }
  }

  private onTaskDue(task: Task) {
    showMessage(`Task due: ${task.name}`, 5000);
  }

  private onTaskMissed(task: Task) {
    showMessage(`Missed task: ${task.name}`, 5000, "error");
  }

  private registerDock() {
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 300, height: 0 },
        icon: "iconTask",
        title: this.i18n.dockTitle || "Tasks",
        hotkey: "⌥⌘T",
      },
      data: {
        tasks: [],
      },
      type: DOCK_TYPE,
      resize() {},
      update() {},
      init: (dock) => {
        this.initDockContent(dock.element as HTMLElement);
      },
      destroy() {},
    });
  }

  private initDockContent(container: HTMLElement) {
    container.innerHTML = "";
    
    const wrapper = document.createElement("div");
    wrapper.className = "task-management-dock";
    
    // Header
    const header = document.createElement("div");
    header.className = "task-dock-header";
    header.innerHTML = `
      <h3>${this.i18n.dockTitle || "Tasks"}</h3>
      <div class="task-dock-actions">
        <button class="b3-button b3-button--small" data-action="add">
          <svg class="b3-icon"><use xlink:href="#iconAdd"></use></svg>
        </button>
        <button class="b3-button b3-button--small" data-action="refresh">
          <svg class="b3-icon"><use xlink:href="#iconRefresh"></use></svg>
        </button>
        <button class="b3-button b3-button--small" data-action="settings">
          <svg class="b3-icon"><use xlink:href="#iconSettings"></use></svg>
        </button>
      </div>
    `;
    
    // Task list container
    const taskList = document.createElement("div");
    taskList.className = "task-dock-list";
    taskList.id = "task-dock-list";
    
    wrapper.appendChild(header);
    wrapper.appendChild(taskList);
    container.appendChild(wrapper);
    
    // Bind events
    header.querySelector('[data-action="add"]')?.addEventListener("click", () => {
      this.showCreateTaskDialog();
    });
    
    header.querySelector('[data-action="refresh"]')?.addEventListener("click", () => {
      this.refreshTaskList();
    });
    
    header.querySelector('[data-action="settings"]')?.addEventListener("click", () => {
      this.showSettingsDialog();
    });
    
    // Initial load
    this.refreshTaskList();
  }

  private registerCommands() {
    // Create task command
    this.addCommand({
      langKey: "createTask",
      langText: this.i18n.createTask || "Create Task",
      hotkey: "⌘⇧T",
      callback: () => {
        this.showCreateTaskDialog();
      },
    });
    
    // Show task list command
    this.addCommand({
      langKey: "showTaskList",
      langText: this.i18n.showTaskList || "Show Task List",
      hotkey: "⌘⌥T",
      callback: () => {
        this.showTaskListDialog();
      },
    });
    
    // Toggle task status command
    this.addCommand({
      langKey: "toggleTaskStatus",
      langText: this.i18n.toggleTaskStatus || "Toggle Task Status",
      hotkey: "⌘⇧X",
      editorCallback: (protyle) => {
        this.toggleCurrentBlockTask(protyle as any);
      },
    });
    
    // Show AI suggestions command
    this.addCommand({
      langKey: "showAISuggestions",
      langText: this.i18n.showAISuggestions || "Show AI Suggestions",
      hotkey: "⌘⌥A",
      callback: () => {
        this.showAISuggestionsDialog();
      },
    });
    
    // Show calendar command
    this.addCommand({
      langKey: "showCalendar",
      langText: this.i18n.showCalendar || "Show Calendar",
      hotkey: "⌘⌥C",
      callback: () => {
        this.showCalendarDialog();
      },
    });
  }

  private registerTopBarIcon() {
    const topBarElement = this.addTopBar({
      icon: "iconTask",
      title: this.i18n.pluginName || "Task Management",
      position: "right",
      callback: () => {
        this.showQuickMenu();
      },
    });
    
    topBarElement.addEventListener("contextmenu", (e: MouseEvent) => {
      e.preventDefault();
      this.showQuickMenu();
    });
  }

  private registerSlashCommands() {
    this.protyleSlash = [{
      filter: ["task", "todo", "任务"],
      html: `<div class="b3-list-item__first">
        <svg class="b3-list-item__graphic"><use xlink:href="#iconTask"></use></svg>
        <span class="b3-list-item__text">${this.i18n.insertTask || "Insert Task"}</span>
      </div>`,
      id: "insert-task",
      callback: (protyle) => {
        this.insertTaskAtCursor(protyle as any);
      },
    }];
  }

  private showQuickMenu() {
    const menu = new Menu("task-quick-menu");
    
    menu.addItem({
      icon: "iconAdd",
      label: this.i18n.createTask || "Create Task",
      click: () => this.showCreateTaskDialog(),
    });
    
    menu.addItem({
      icon: "iconList",
      label: this.i18n.showTaskList || "Show Task List",
      click: () => this.showTaskListDialog(),
    });
    
    menu.addSeparator();
    
    menu.addItem({
      icon: "iconChart",
      label: this.i18n.trackerAnalytics || "📊 Tracker & Analytics",
      click: () => this.showTrackerDashboardDialog(),
    });
    
    menu.addItem({
      icon: "iconCalendar",
      label: this.i18n.showCalendar || "Calendar",
      click: () => this.showCalendarDialog(),
    });
    
    menu.addItem({
      icon: "iconSparkles",
      label: this.i18n.aiSuggestions || "AI Suggestions",
      click: () => this.showAISuggestionsDialog(),
    });
    
    menu.addSeparator();
    
    menu.addItem({
      icon: "iconSettings",
      label: this.i18n.settings || "Settings",
      click: () => this.showSettingsDialog(),
    });
    
    const rect = document.querySelector('.toolbar__item[data-type="task-management"]')?.getBoundingClientRect();
    menu.open({
      x: rect?.right || 0,
      y: rect?.bottom || 0,
    });
  }

  private async showCreateTaskDialog() {
    const { TaskModal } = await import("@modals/TaskModal");
    
    const allTasks = this.taskManager?.getRepository()?.getAllTasks() || [];
    
    const modal = new TaskModal(
      this,
      null, // New task
      [], // Status options - could be enhanced
      async (task: Task) => {
        await this.taskManager?.getRepository()?.saveTask(task);
        this.refreshTaskList();
        showMessage(this.i18n.taskCreated || "Task created", 3000);
      },
      allTasks
    );
    
    modal.open();
  }

  private showTaskListDialog() {
    const dialog = new Dialog({
      title: this.i18n.taskList || "Task List",
      content: `<div id="task-list-dialog" class="task-list-dialog"></div>`,
      width: "80vw",
      height: "80vh",
    });
    
    const container = dialog.element.querySelector("#task-list-dialog");
    if (container) {
      this.renderTaskList(container as HTMLElement);
    }
  }

  private showSettingsDialog() {
    const dialog = new Dialog({
      title: this.i18n.settings || "Settings",
      content: `<div id="settings-dialog" class="settings-dialog"></div>`,
      width: "600px",
      height: "70vh",
    });
    
    const container = dialog.element.querySelector("#settings-dialog");
    if (container) {
      this.renderSettings(container as HTMLElement);
    }
  }

  private showAISuggestionsDialog() {
    const dialog = new Dialog({
      title: this.i18n.aiSuggestions || "AI Suggestions",
      content: `<div id="ai-suggestions-dialog" class="ai-suggestions-dialog"></div>`,
      width: "600px",
      height: "70vh",
    });
    
    const container = dialog.element.querySelector("#ai-suggestions-dialog");
    if (container) {
      this.renderAISuggestions(container as HTMLElement);
    }
  }

  private showTrackerDashboardDialog() {
    const dialog = new Dialog({
      title: this.i18n.trackerAnalytics || "Tracker & Analytics",
      content: `<div id="tracker-dashboard-container"></div>`,
      width: "900px",
      height: "auto",
    });
    
    const container = dialog.element.querySelector("#tracker-dashboard-container");
    if (container) {
      this.renderTrackerDashboard(container as HTMLElement, () => dialog.destroy());
    }
  }
  
  private showCalendarDialog() {
    const dialog = new Dialog({
      title: this.i18n.calendar || "Calendar",
      content: `<div id="calendar-dialog" class="calendar-dialog"></div>`,
      width: "80vw",
      height: "80vh",
    });
    
    const container = dialog.element.querySelector("#calendar-dialog");
    if (container) {
      this.renderCalendar(container as HTMLElement);
    }
  }

  private async refreshTaskList() {
    const container = document.getElementById("task-dock-list");
    if (container) {
      await this.renderTaskList(container);
    }
  }

  private async renderTaskList(container: HTMLElement) {
    const tasks = this.taskManager?.getRepository()?.getAllTasks() || [];
    
    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="task-empty-state">
          <svg class="task-empty-icon"><use xlink:href="#iconTask"></use></svg>
          <p>${this.i18n.noTasks || "No tasks yet"}</p>
          <button class="b3-button b3-button--outline" id="create-first-task">
            ${this.i18n.createFirstTask || "Create your first task"}
          </button>
        </div>
      `;
      
      container.querySelector("#create-first-task")?.addEventListener("click", () => {
        this.showCreateTaskDialog();
      });
      return;
    }
    
    container.innerHTML = "";
    
    for (const task of tasks) {
      const taskEl = document.createElement("div");
      taskEl.className = `task-item task-item--${task.status}`;
      taskEl.dataset.taskId = task.id;
      
      taskEl.innerHTML = `
        <div class="task-item-checkbox">
          <input type="checkbox" ${task.status === "done" ? "checked" : ""} />
        </div>
        <div class="task-item-content">
          <div class="task-item-name">${task.name}</div>
          ${task.dueAt ? `<div class="task-item-due">${task.dueAt}</div>` : ""}
        </div>
        <div class="task-item-priority">${task.priority || ""}</div>
      `;
      
      // Toggle with optimistic update
      const checkbox = taskEl.querySelector("input");
      checkbox?.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        const newStatus = target.checked ? "done" : "todo";
        const originalChecked = !target.checked;
        
        // Handle async operation with proper error handling
        (async () => {
          try {
            await this.uiStateManager.updateOptimistically(
              task.id,
              task,
              (t) => ({ ...t, status: newStatus } as Task),
              async (updatedTask) => {
                const result = await this.taskManager?.getRepository()?.saveTask(updatedTask);
                if (!result) throw new Error('Failed to save task');
                
                // Recalculate analytics after successful save
                try {
                  const allTasks = this.taskManager?.getRepository()?.getAllTasks() || [];
                  updateAnalyticsFromTasks(allTasks);
                  logger.debug('Analytics updated after task toggle');
                } catch (analyticsError) {
                  logger.error('Failed to update analytics after task toggle', analyticsError);
                }
                
                return result;
              }
            );
            
            await this.refreshTaskList();
          } catch (error) {
            // Rollback checkbox state
            target.checked = originalChecked;
            logger.error('Failed to toggle task status', error);
            showMessage(this.i18n.updateFailed || "Failed to update task", 5000, "error");
          }
        })().catch((error) => {
          // Catch any unhandled promise rejections
          logger.error('Unhandled error in checkbox toggle handler', error);
          target.checked = originalChecked;
          showMessage(this.i18n.updateFailed || "Failed to update task", 5000, "error");
        });
      });
      
      // Edit on click
      const content = taskEl.querySelector(".task-item-content");
      content?.addEventListener("click", () => {
        // Handle async operation with proper error handling
        (async () => {
          try {
            const { TaskModal } = await import("@modals/TaskModal");
            
            const modal = new TaskModal(
              this,
              task,
              [],
              async (updatedTask: Task) => {
                try {
                  await this.taskManager?.getRepository()?.saveTask(updatedTask);
                  await this.refreshTaskList();
                  showMessage(this.i18n.taskUpdated || "Task updated", 3000);
                } catch (error) {
                  logger.error('Failed to save updated task', error);
                  showMessage(this.i18n.updateFailed || "Failed to update task", 5000, "error");
                  throw error; // Re-throw for modal to handle
                }
              },
              this.taskManager?.getRepository()?.getAllTasks() || []
            );
            
            modal.open();
          } catch (error) {
            logger.error('Failed to open task edit modal', error);
            showMessage(this.i18n.modalError || "Failed to open task editor", 5000, "error");
          }
        })().catch((error) => {
          logger.error('Unhandled error in task edit click handler', error);
          showMessage(this.i18n.updateFailed || "Failed to edit task", 5000, "error");
        });
      });
      
      container.appendChild(taskEl);
    }
  }

  private renderSettings(container: HTMLElement) {
    const settings = this.taskManager?.getSettingsService()?.get();
    
    container.innerHTML = `
      <div class="settings-section">
        <h3>Date Tracking</h3>
        <div class="b3-label">
          <div class="b3-label__text">Auto-add created date</div>
          <input type="checkbox" class="b3-switch" id="setting-autoAddCreated" 
            ${settings?.dates?.autoAddCreated ? "checked" : ""} />
        </div>
        <div class="b3-label">
          <div class="b3-label__text">Auto-add done date</div>
          <input type="checkbox" class="b3-switch" id="setting-autoAddDone"
            ${settings?.dates?.autoAddDone ? "checked" : ""} />
        </div>
      </div>
      <div class="settings-section">
        <h3>Smart Suggestions</h3>
        <div class="b3-label">
          <div class="b3-label__text">Enable Smart Suggestions</div>
          <input type="checkbox" class="b3-switch" id="setting-smartSuggestionsEnabled"
            ${settings?.smartSuggestions?.enabled ? "checked" : ""} />
        </div>
      </div>
      <div class="settings-section">
        <h3>Recurrence Settings</h3>
        <div class="b3-label">
          <div class="b3-label__text">Preserve original time on recurrence</div>
          <input type="checkbox" class="b3-switch" id="setting-preserveOriginalTime"
            ${settings?.recurrence?.preserveOriginalTime ? "checked" : ""} />
        </div>
      </div>
    `;
    
    container.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", async (e) => {
        const target = e.target as HTMLInputElement;
        const id = target.id.replace("setting-", "");
        const settingsService = this.taskManager?.getSettingsService();
        if (settingsService) {
          const currentSettings = settingsService.get();
          // Handle nested settings
          if (id === "autoAddCreated" || id === "autoAddDone") {
            await settingsService.save({ 
              ...currentSettings, 
              dates: { ...currentSettings.dates, [id]: target.checked } 
            });
          } else if (id === "smartSuggestionsEnabled") {
            await settingsService.save({ 
              ...currentSettings, 
              smartSuggestions: { ...currentSettings.smartSuggestions, enabled: target.checked } 
            });
          } else if (id === "preserveOriginalTime") {
            await settingsService.save({ 
              ...currentSettings, 
              recurrence: { ...currentSettings.recurrence, preserveOriginalTime: target.checked } 
            });
          }
        }
      });
    });
  }

  private async renderAISuggestions(container: HTMLElement) {
    const tasks = this.taskManager?.getRepository()?.getAllTasks() || [];
    
    // Analyze cross-task patterns
    let suggestions: any[] = [];
    if (this.aiEngine && tasks.length > 0) {
      suggestions = await this.aiEngine.analyzeCrossTaskPatterns(tasks);
    }
    
    if (suggestions.length === 0) {
      container.innerHTML = `
        <div class="ai-empty-state">
          <svg class="ai-empty-icon"><use xlink:href="#iconSparkles"></use></svg>
          <p>${this.i18n.noSuggestions || "No suggestions at this time"}</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="ai-suggestions-list">
        ${suggestions.map(s => `
          <div class="ai-suggestion" data-suggestion-id="${s.id}">
            <div class="ai-suggestion-type ai-suggestion-type--${s.type}">
              ${s.type}
            </div>
            <div class="ai-suggestion-content">
              <div class="ai-suggestion-title">${s.reason}</div>
              <div class="ai-suggestion-description">Confidence: ${Math.round(s.confidence * 100)}%</div>
            </div>
            <div class="ai-suggestion-actions">
              <button class="b3-button b3-button--small" data-action="apply">
                ${this.i18n.apply || "Apply"}
              </button>
              <button class="b3-button b3-button--small b3-button--outline" data-action="dismiss">
                ${this.i18n.dismiss || "Dismiss"}
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    
    container.querySelectorAll(".ai-suggestion").forEach(el => {
      const suggestionId = el.getAttribute("data-suggestion-id");
      
      el.querySelector('[data-action="apply"]')?.addEventListener("click", () => {
        this.applySuggestion(suggestionId!);
        el.remove();
      });
      
      el.querySelector('[data-action="dismiss"]')?.addEventListener("click", () => {
        el.remove();
      });
    });
  }

  private renderCalendar(container: HTMLElement) {
    container.innerHTML = `
      <div class="calendar-wrapper">
        <div class="calendar-header">
          <button class="b3-button" id="cal-prev">&lt;</button>
          <span id="cal-month"></span>
          <button class="b3-button" id="cal-next">&gt;</button>
        </div>
        <div class="calendar-grid" id="cal-grid"></div>
      </div>
    `;
    
    let currentDate = new Date();
    
    const renderMonth = async () => {
      const monthEl = container.querySelector("#cal-month");
      const gridEl = container.querySelector("#cal-grid");
      
      if (!monthEl || !gridEl) return;
      
      monthEl.textContent = currentDate.toLocaleDateString("default", { 
        month: "long", 
        year: "numeric" 
      });
      
      const tasks = this.taskManager?.getRepository()?.getAllTasks() || [];
      const tasksByDate: Record<string, Task[]> = {};
      
      tasks.forEach(task => {
        if (task.dueAt) {
          const dateKey = task.dueAt.split("T")[0];
          if (!tasksByDate[dateKey]) tasksByDate[dateKey] = [];
          tasksByDate[dateKey].push(task);
        }
      });
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      let html = '<div class="calendar-weekdays">Sun Mon Tue Wed Thu Fri Sat</div>';
      html += '<div class="calendar-days">';
      
      for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day calendar-day--empty"></div>';
      }
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const dayTasks = tasksByDate[dateKey] || [];
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
        
        html += `
          <div class="calendar-day ${isToday ? 'calendar-day--today' : ''}" data-date="${dateKey}">
            <span class="calendar-day-number">${day}</span>
            ${dayTasks.length > 0 ? `<span class="calendar-day-tasks">${dayTasks.length}</span>` : ''}
          </div>
        `;
      }
      
      html += '</div>';
      gridEl.innerHTML = html;
      
      gridEl.querySelectorAll(".calendar-day:not(.calendar-day--empty)").forEach(dayEl => {
        dayEl.addEventListener("click", () => {
          const date = dayEl.getAttribute("data-date");
          if (date) this.showTasksForDate(date);
        });
      });
    };
    
    container.querySelector("#cal-prev")?.addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderMonth();
    });
    
    container.querySelector("#cal-next")?.addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderMonth();
    });
    
    renderMonth();
  }

  private showTasksForDate(date: string) {
    showMessage(`${this.i18n.tasksFor || "Tasks for"} ${date}`, 3000);
  }

  private renderTrackerDashboard(container: HTMLElement, onClose: () => void) {
    import('@components/common/TrackerDashboard.svelte').then(({ default: TrackerDashboard }) => {
      new TrackerDashboard({
        target: container,
        props: {
          onClose,
        },
      });
    });
  }
  
  private async applySuggestion(suggestionId: string) {
    logger.info("Applying suggestion:", suggestionId);
    showMessage(this.i18n.suggestionApplied || "Suggestion applied", 3000);
  }

  private async toggleCurrentBlockTask(protyle: IProtyle) {
    const selection = window.getSelection();
    const blockElement = selection?.anchorNode?.parentElement?.closest("[data-node-id]");
    
    if (blockElement) {
      const blockId = blockElement.getAttribute("data-node-id");
      if (blockId) {
        showMessage(this.i18n.taskToggled || "Task status toggled", 2000);
      }
    }
  }

  private async insertTaskAtCursor(protyle: IProtyle) {
    const taskBlock = "* [ ] ";
    
    // Get current block ID from protyle
    const blockId = (protyle as any).block?.id || 
                    (protyle as any).protyle?.block?.id || 
                    "";
    
    fetchPost("/api/block/insertBlock", {
      dataType: "markdown",
      data: taskBlock,
      previousID: blockId,
    }, () => {
      showMessage(this.i18n.taskInserted || "Task inserted", 2000);
    });
  }

  // Public API
  get api() {
    return {
      createTask: (task: Task) => this.taskManager?.getRepository()?.saveTask(task),
      getTasks: () => this.taskManager?.getRepository()?.getAllTasks(),
      updateTask: (task: Task) => this.taskManager?.getRepository()?.saveTask(task),
      deleteTask: (id: string) => this.taskManager?.getRepository()?.deleteTask(id),
      getAISuggestions: (tasks: Task[]) => this.aiEngine?.analyzeCrossTaskPatterns(tasks),
    };
  }
}
