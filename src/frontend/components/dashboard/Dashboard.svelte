<script lang="ts">
  /**
   * Main Dashboard Component with WCAG 2.1 AA Accessibility
   *
   * Integrates all task management features:
   * - Task list display with inline editing
   * - Task creation
   * - Query Enhancement (Phase 1)
   * - Tracker dashboard
   * - Settings placeholder
   *
   * @module Dashboard
   * @accessibility WCAG 2.1 AA compliant tab navigation
   * @version 2.0.0
   */

  import { onMount, onDestroy } from "svelte";
  import { generateAriaId } from "@frontend/utils/accessibility";
  import TrackerDashboard from "@components/shared/TrackerDashboard.svelte";
  import UpgradeRecurrenceButton from "@components/tasks/UpgradeRecurrenceButton.svelte";
  import QueryExplanationPanel from "@components/query/QueryExplanationPanel.svelte";
  import SavedQueriesDropdown from "@components/query/SavedQueriesDropdown.svelte";
  import LoadingSpinner from "@components/shared/LoadingSpinner.svelte";
  import ErrorMessage from "@components/shared/ErrorMessage.svelte";
  import KeyboardShortcutsHelp from "@components/shared/KeyboardShortcutsHelp.svelte";
  import { getKeyboardShortcutManager } from "@frontend/utils/keyboardShortcuts";
  import type { Task } from "@backend/core/models/Task";
  import type { TaskStorage } from "@backend/core/storage/TaskStorage";
  import type { RecurrenceEngine } from "@backend/core/engine/recurrence/RecurrenceEngine";
  import type { Scheduler } from "@backend/core/engine/Scheduler";
  import type { EventService } from "@backend/services/EventService";
  import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
  import type { Plugin } from "siyuan";
  import type { TaskCreationService } from "@backend/core/services/TaskCreationService";
  import type { AutoMigrationService } from "@backend/core/services/AutoMigrationService";
  import type { PluginSettings } from "@backend/core/settings/PluginSettings";
  import { QueryExplainer, type Explanation } from "@backend/core/query/QueryExplainer";
  import { NaturalLanguageQueryParser } from "@backend/core/query/NaturalLanguageQueryParser";
  import { QueryEngine } from "@backend/core/query/QueryEngine";
  import type { SavedQuery } from "@backend/core/query/SavedQueryStore";

  // Props - all passed from index.ts mount call
  export let taskStorage: TaskStorage;
  export let recurrenceEngine: RecurrenceEngine | undefined = undefined;
  export let taskScheduler: Scheduler | undefined = undefined;
  export let notificationService: EventService | undefined = undefined;
  export let eventBus: PluginEventBus;
  export let plugin: Plugin;
  export let taskCreationService: TaskCreationService;
  export let autoMigrationService: AutoMigrationService;
  export let settings: PluginSettings;

  // Use refs to services for future expansion
  void recurrenceEngine;
  void taskScheduler;
  void notificationService;
  void plugin;

  // State
  let tasks: Task[] = [];
  let isLoading = true;
  let activeTab: "tasks" | "queries" | "tracker" | "settings" = "tasks";
  let editingTask: Task | null = null;
  let isCreating = false;

  // Inline edit form state
  let editName = "";
  let editDueAt = "";
  let editDescription = "";

  // Migration state (Phase 2)
  let isMigrating = false;
  let migrationProgress = { current: 0, total: 0 };
  let migrationStats = { migratable: 0, alreadyMigrated: 0 };

  // Query state (Phase 1)
  let queryString = "";
  let queryResults: Task[] = [];
  let queryExplanation: Explanation | null = null;
  let showExplanation = false;
  let isExecutingQuery = false;
  let queryError: string | null = null;
  let showShortcutsHelp = false;

  // Keyboard shortcuts manager
  const shortcutManager = getKeyboardShortcutManager();

  // Generate unique IDs for ARIA relationships
  const tablistId = generateAriaId('tablist');
  const tasksTabId = generateAriaId('tasks-tab');
  const tasksTabPanelId = generateAriaId('tasks-panel');
  const queriesTabId = generateAriaId('queries-tab');
  const queriesTabPanelId = generateAriaId('queries-panel');
  const trackerTabId = generateAriaId('tracker-tab');
  const trackerTabPanelId = generateAriaId('tracker-panel');
  const settingsTabId = generateAriaId('settings-tab');
  const settingsTabPanelId = generateAriaId('settings-panel');

  // Subscriptions
  let unsubscribeRefresh: (() => void) | null = null;
  let unsubscribeSaved: (() => void) | null = null;
  let unsubscribeEdit: (() => void) | null = null;

  onMount(async () => {
    await loadTasks();
    await updateMigrationStats();

    // Subscribe to events
    unsubscribeRefresh = eventBus.on("task:refresh", () => {
      loadTasks();
    });

    unsubscribeSaved = eventBus.on("task:saved", ({ task, isNew }: { task: Task; isNew: boolean }) => {
      if (isNew) {
        tasks = [...tasks, task];
      } else {
        tasks = tasks.map((t: Task) => (t.id === task.id ? task : t));
      }
      editingTask = null;
      isCreating = false;
    });

    unsubscribeEdit = eventBus.on("task:edit", (data) => {
      if (data.task) {
        editingTask = data.task;
        editName = data.task.name;
        editDueAt = data.task.dueAt ? data.task.dueAt.slice(0, 16) : "";
        editDescription = data.task.description || "";
      } else {
        isCreating = true;
        editName = "";
        editDueAt = "";
        editDescription = "";
      }
    });
  });

  onDestroy(() => {
    unsubscribeRefresh?.();
    unsubscribeSaved?.();
    unsubscribeEdit?.();
  });

  async function loadTasks() {
    isLoading = true;
    try {
      const loadedTasks = await taskStorage.loadActive();
      tasks = Array.from(loadedTasks.values());
    } catch (error) {
      console.error("[Dashboard] Failed to load tasks:", error);
    } finally {
      isLoading = false;
    }
  }

  function handleCreateTask() {
    isCreating = true;
    editingTask = null;
    editName = "";
    editDueAt = "";
    editDescription = "";
  }

  function handleEditTask(task: Task) {
    editingTask = task;
    isCreating = false;
    editName = task.name;
    editDueAt = task.dueAt ? task.dueAt.slice(0, 16) : "";
    editDescription = task.description || "";
  }

  async function handleSaveTask() {
    try {
      if (isCreating) {
        // Create a new task using TaskCreationService (Phase 2)
        const newTask = taskCreationService.createTask({
          name: editName,
          dueAt: editDueAt ? new Date(editDueAt) : new Date(),
          frequency: { type: "daily", interval: 1 },
          description: editDescription || undefined,
        });
        await taskStorage.saveTask(newTask);
        eventBus.emit("task:saved", { task: newTask, isNew: true });
      } else if (editingTask) {
        let updatedTask: Task = {
          ...editingTask,
          name: editName,
          dueAt: editDueAt ? new Date(editDueAt).toISOString() : editingTask.dueAt,
          description: editDescription || undefined,
        };
        
        // Auto-migrate task if Phase 2 is enabled (Phase 2)
        if (autoMigrationService.shouldAutoMigrate(updatedTask as any)) {
          const migrationResult = autoMigrationService.migrateOnEdit(updatedTask as any);
          if (migrationResult.migrated && migrationResult.migratedTask) {
            updatedTask = migrationResult.migratedTask as any;
            console.log('[Dashboard] Task auto-migrated to RRule:', updatedTask.id);
          }
        }
        
        await taskStorage.saveTask(updatedTask);
        eventBus.emit("task:saved", { task: updatedTask, isNew: false });
      }
    } catch (error) {
      console.error("[Dashboard] Failed to save task:", error);
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await taskStorage.deleteTask(taskId);
      tasks = tasks.filter((t: Task) => t.id !== taskId);
    } catch (error) {
      console.error("[Dashboard] Failed to delete task:", error);
    }
  }

  async function handleCompleteTask(taskId: string) {
    eventBus.emit("task:complete", { taskId });
    await loadTasks();
  }

  function handleCancelEdit() {
    editingTask = null;
    isCreating = false;
    editName = "";
    editDueAt = "";
    editDescription = "";
  }

  // Settings handlers
  async function handleSettingChange(key: keyof PluginSettings['recurrence'], value: boolean) {
    (settings.recurrence as any)[key] = value;
    await plugin.saveData("settings", settings);
    console.log(`[Dashboard] Updated setting ${key}:`, value);
  }

  async function handleMigrateAll() {
    if (isMigrating) return;
    
    isMigrating = true;
    migrationProgress = { current: 0, total: tasks.length };

    try {
      const stats = await autoMigrationService.migrateAll(tasks as any[], async (migratedTask) => {
        migrationProgress.current++;
        await taskStorage.saveTask(migratedTask as any);
        console.log('[Dashboard] Migrated task:', migratedTask.id);
      });

      console.log(`[Dashboard] Migration complete:`, stats);
      await loadTasks();
      await updateMigrationStats();
    } catch (error) {
      console.error('[Dashboard] Migration failed:', error);
    } finally {
      isMigrating = false;
      migrationProgress = { current: 0, total: 0 };
    }
  }

  async function updateMigrationStats() {
    // Phase 3: All tasks should have recurrence, count any legacy tasks as migratable
    const migratable = tasks.filter(t => (t as any).frequency && !(t as any).recurrence).length;
    const alreadyMigrated = tasks.filter(t => (t as any).recurrence).length;
    migrationStats = { migratable, alreadyMigrated };
  }

  function formatDueDate(dueAt: string): string {
    const date = new Date(dueAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days < 0) return `Overdue by ${Math.abs(days)} day(s)`;
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days} days`;
  }

  function getTaskStatus(task: Task): "overdue" | "today" | "upcoming" {
    const now = new Date();
    const due = new Date(task.dueAt);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    if (dueDay < today) return "overdue";
    if (dueDay.getTime() === today.getTime()) return "today";
    return "upcoming";
  }

  // Phase 1: Query Enhancement Functions
  async function handleExecuteQuery() {
    if (!queryString.trim()) {
      queryError = "Please enter a query";
      return;
    }

    isExecutingQuery = true;
    queryError = null;
    showExplanation = false;

    try {
      // Parse natural language query
      const nlParser = new NaturalLanguageQueryParser();
      const ast = nlParser.parse(queryString);

      // Create a simple task index from current tasks
      const taskIndex = {
        getAllTasks: () => tasks
      };

      // Execute query
      const queryEngine = new QueryEngine(taskIndex, {
        urgencySettings: settings.urgency,
        escalationSettings: settings.escalation,
        attentionSettings: settings.attention
      });
      
      const result = queryEngine.execute(ast);
      queryResults = result.tasks;
      queryError = null;
    } catch (error) {
      queryError = error instanceof Error ? error.message : "Query execution failed";
      queryResults = [];
      console.error("[Query] Execution error:", error);
    } finally {
      isExecutingQuery = false;
    }
  }

  async function handleExplainQuery() {
    if (!queryString.trim()) {
      queryError = "Please enter a query to explain";
      return;
    }

    isExecutingQuery = true;
    queryError = null;

    try {
      // Parse natural language query
      const nlParser = new NaturalLanguageQueryParser();
      const ast = nlParser.parse(queryString);

      // Create task index
      const taskIndex = {
        getAllTasks: () => tasks
      };

      // Execute query with explanation
      const queryEngine = new QueryEngine(taskIndex, {
        urgencySettings: settings.urgency,
        escalationSettings: settings.escalation,
        attentionSettings: settings.attention
      });

      const { result, explanation } = queryEngine.executeWithExplanation(ast);
      queryResults = result.tasks;
      queryExplanation = explanation;
      showExplanation = true;
      queryError = null;
    } catch (error) {
      queryError = error instanceof Error ? error.message : "Query explanation failed";
      queryExplanation = null;
      queryResults = [];
      console.error("[Query] Explanation error:", error);
    } finally {
      isExecutingQuery = false;
    }
  }

  function handleQuerySelected(query: SavedQuery) {
    queryString = query.queryString;
  }

  function handleCloseExplanation() {
    showExplanation = false;
  }

  // Accessibility: Tab keyboard navigation
  function handleTabKeyDown(event: KeyboardEvent) {
    const tabs = ['tasks', 'queries', 'tracker', 'settings'] as const;
    const currentIndex = tabs.indexOf(activeTab);

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        activeTab = tabs[(currentIndex + 1) % tabs.length]!;
        focusActiveTab();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        activeTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length]!;
        focusActiveTab();
        break;
      case 'Home':
        event.preventDefault();
        activeTab = tabs[0]!;
        focusActiveTab();
        break;
      case 'End':
        event.preventDefault();
        activeTab = tabs[tabs.length - 1]!;
        focusActiveTab();
        break;
    }
  }

  function focusActiveTab() {
    // Focus the active tab button after keyboard navigation
    const activeTabButton = document.querySelector(
      '.rtm-tab[aria-selected="true"]'
    ) as HTMLButtonElement;
    if (activeTabButton) {
      activeTabButton.focus();
    }
  }
</script>

<div class="rtm-dashboard">
  <!-- Tab Navigation - WCAG 2.1 AA Compliant -->
  <div 
    class="rtm-tabs" 
    role="tablist" 
    aria-label="Dashboard sections"
    id={tablistId}
    tabindex="-1"
    on:keydown={handleTabKeyDown}
  >
    <button
      class="rtm-tab"
      class:active={activeTab === "tasks"}
      role="tab"
      aria-selected={activeTab === "tasks"}
      aria-controls={tasksTabPanelId}
      id={tasksTabId}
      tabindex={activeTab === "tasks" ? 0 : -1}
      on:click={() => (activeTab = "tasks")}
    >
      <span aria-hidden="true">📋</span>
      <span>Tasks</span>
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "queries"}
      role="tab"
      aria-selected={activeTab === "queries"}
      aria-controls={queriesTabPanelId}
      id={queriesTabId}
      tabindex={activeTab === "queries" ? 0 : -1}
      on:click={() => (activeTab = "queries")}
    >
      <span aria-hidden="true">🔍</span>
      <span>Queries</span>
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "tracker"}
      role="tab"
      aria-selected={activeTab === "tracker"}
      aria-controls={trackerTabPanelId}
      id={trackerTabId}
      tabindex={activeTab === "tracker" ? 0 : -1}
      on:click={() => (activeTab = "tracker")}
    >
      <span aria-hidden="true">📊</span>
      <span>Tracker</span>
    </button>
    <button
      class="rtm-tab"
      class:active={activeTab === "settings"}
      role="tab"
      aria-selected={activeTab === "settings"}
      aria-controls={settingsTabPanelId}
      id={settingsTabId}
      tabindex={activeTab === "settings" ? 0 : -1}
      on:click={() => (activeTab = "settings")}
    >
      <span aria-hidden="true">⚙️</span>
      <span>Settings</span>
    </button>
  </div>

  <!-- Content Area -->
  <div class="rtm-content">
    {#if activeTab === "tasks"}
      <div 
        class="rtm-tasks-panel" 
        role="tabpanel" 
        id={tasksTabPanelId}
        aria-labelledby={tasksTabId}
        tabindex="0"
      >
        <!-- Header -->
        <div class="rtm-panel-header">
          <h3>Recurring Tasks</h3>
          <button class="rtm-btn-primary" on:click={handleCreateTask}>
            + New Task
          </button>
        </div>

        {#if isLoading}
          <div class="rtm-loading">Loading tasks...</div>
        {:else if isCreating || editingTask}
          <!-- Inline Task Editor -->
          <div class="rtm-edit-form">
            <h4>{isCreating ? "New Task" : "Edit Task"}</h4>
            <label class="rtm-field">
              <span>Name</span>
              <input type="text" bind:value={editName} placeholder="Task name" />
            </label>
            <label class="rtm-field">
              <span>Due Date</span>
              <input type="datetime-local" bind:value={editDueAt} />
            </label>
            <label class="rtm-field">
              <span>Description</span>
              <textarea bind:value={editDescription} placeholder="Optional description" rows="3"></textarea>
            </label>
            <div class="rtm-form-actions">
              <button class="rtm-btn-primary" on:click={handleSaveTask} disabled={!editName.trim()}>
                {isCreating ? "Create" : "Save"}
              </button>
              <button class="rtm-btn-secondary" on:click={handleCancelEdit}>Cancel</button>
              {#if editingTask}
                <button class="rtm-btn-danger-text" on:click={() => { if (editingTask) handleDeleteTask(editingTask.id); }}>
                  Delete
                </button>
              {/if}
            </div>
          </div>
        {:else if tasks.length === 0}
          <div class="rtm-empty-state">
            <p>No recurring tasks yet</p>
            <button class="rtm-btn-secondary" on:click={handleCreateTask}>
              Create your first task
            </button>
          </div>
        {:else}
          <div class="rtm-task-list">
            {#each tasks as task (task.id)}
              <div
                class="rtm-task-card"
                class:overdue={getTaskStatus(task) === "overdue"}
                class:today={getTaskStatus(task) === "today"}
              >
                <div class="rtm-task-info">
                  <div class="rtm-task-name">{task.name}</div>
                  <div class="rtm-task-due">{formatDueDate(task.dueAt)}</div>
                  {#if (task as any).recurrence}
                    <div class="rtm-task-recurrence">
                      🔄 {(task as any).recurrence.humanReadable || "Recurring"}
                    </div>
                  {/if}
                </div>
                <div class="rtm-task-actions">
                  <button
                    class="rtm-btn-icon"
                    title="Complete"
                    on:click={() => handleCompleteTask(task.id)}
                  >
                    ✓
                  </button>
                  <button
                    class="rtm-btn-icon"
                    title="Edit"
                    on:click={() => handleEditTask(task)}
                  >
                    ✏️
                  </button>
                  <button
                    class="rtm-btn-icon rtm-btn-danger"
                    title="Delete"
                    on:click={() => handleDeleteTask(task.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeTab === "queries"}
      <!-- Phase 1: Query Enhancement Tab -->
      <div 
        class="rtm-queries-panel" 
        role="tabpanel" 
        id={queriesTabPanelId}
        aria-labelledby={queriesTabId}
        tabindex="0"
      >
        <div class="rtm-panel-header">
          <h3>🔍 Advanced Query & Explanation</h3>
        </div>

        <!-- Saved Queries Dropdown -->
        <div class="rtm-query-section">
          <SavedQueriesDropdown
            currentQueryString={queryString}
            onQuerySelected={handleQuerySelected}
          />
        </div>

        <!-- Query Input -->
        <div class="rtm-query-section">
          <label class="rtm-field">
            <span class="rtm-field-label">Query (Natural Language or AST Syntax)</span>
            <textarea
              bind:value={queryString}
              placeholder='Try: "due before today AND priority is high"&#10;Or: "overdue high-priority tasks in /work"&#10;Or: "tasks due this week with tag #important"'
              rows="4"
              class="rtm-query-input"
            ></textarea>
          </label>
        </div>

        <!-- Query Actions -->
        <div class="rtm-query-actions">
          <button
            class="rtm-btn-primary"
            on:click={handleExecuteQuery}
            disabled={isExecutingQuery || !queryString.trim()}
          >
            {isExecutingQuery ? "⏳ Executing..." : "▶️ Execute Query"}
          </button>
          <button
            class="rtm-btn-secondary"
            on:click={handleExplainQuery}
            disabled={isExecutingQuery || !queryString.trim()}
          >
            {isExecutingQuery ? "⏳ Analyzing..." : "🔍 Explain Query"}
          </button>
        </div>

        <!-- Query Error -->
        {#if queryError}
          <div class="rtm-error-box">
            ❌ {queryError}
          </div>
        {/if}

        <!-- Query Results -->
        {#if queryResults.length > 0}
          <div class="rtm-query-results">
            <div class="rtm-results-header">
              <h4>Query Results ({queryResults.length})</h4>
            </div>
            <div class="rtm-task-list">
              {#each queryResults as task}
                <div class="rtm-task-card">
                  <div class="rtm-task-main">
                    <div class="rtm-task-name">{task.name}</div>
                    {#if task.description}
                      <div class="rtm-task-description">{task.description}</div>
                    {/if}
                    <div class="rtm-task-meta">
                      <span class="rtm-task-status" class:overdue={getTaskStatus(task) === "overdue"}>
                        📅 {formatDueDate(task.dueAt)}
                      </span>
                      {#if task.tags && task.tags.length > 0}
                        <span class="rtm-task-tags">
                          {task.tags.map(t => `#${t}`).join(" ")}
                        </span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else if !isExecutingQuery && queryString.trim() && !queryError && !showExplanation}
          <div class="rtm-info-box">
            ℹ️ No tasks match your query.
          </div>
        {/if}

        <!-- Query Explanation Panel -->
        {#if showExplanation && queryExplanation}
          <QueryExplanationPanel
            explanation={queryExplanation}
            onClose={handleCloseExplanation}
          />
        {/if}
      </div>
    {:else if activeTab === "tracker"}
      <div 
        role="tabpanel" 
        id={trackerTabPanelId}
        aria-labelledby={trackerTabId}
        tabindex="0"
      >
        <TrackerDashboard onClose={() => (activeTab = "tasks")} />
      </div>
    {:else if activeTab === "settings"}
      <div 
        class="rtm-settings-panel" 
        role="tabpanel" 
        id={settingsTabPanelId}
        aria-labelledby={settingsTabId}
        tabindex="0"
      >
        <h3>Settings</h3>
        
        <!-- Recurrence Engine Settings (Phase 3: RRule-Only) -->
        <div class="rtm-settings-section">
          <h4>🔄 Recurrence Engine (Phase 3: RRule-Only)</h4>
          <p class="rtm-phase-notice">
            ✅ All tasks now use the industry-standard RRule format for powerful, flexible recurring patterns.
            Legacy Frequency-based tasks are automatically migrated on plugin load.
          </p>

          <div class="rtm-migration-section">
            <h5>Migration Status</h5>
            <div class="rtm-migration-stats">
              <div class="rtm-stat">
                <span class="rtm-stat-value">{migrationStats.alreadyMigrated}</span>
                <span class="rtm-stat-label">Tasks using RRule</span>
              </div>
              <div class="rtm-stat">
                <span class="rtm-stat-value">{migrationStats.migratable}</span>
                <span class="rtm-stat-label">Legacy tasks remaining</span>
              </div>
            </div>

            {#if migrationStats.migratable > 0}
              <div class="rtm-warning-box">
                ⚠️ {migrationStats.migratable} legacy task(s) detected. They will be auto-migrated on next plugin reload.
              </div>
            {:else}
              <div class="rtm-success-box">
                ✅ All tasks migrated to RRule format!
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .rtm-dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-family: var(--b3-font-family);
    color: var(--b3-theme-on-background);
    background: var(--b3-theme-background);
  }

  .rtm-tabs {
    display: flex;
    border-bottom: 1px solid var(--b3-border-color);
    padding: 0 8px;
    gap: 4px;
  }

  .rtm-tab {
    padding: 8px 16px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--b3-theme-on-surface);
    font-size: 13px;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .rtm-tab:hover {
    background: var(--b3-theme-surface-light);
  }

  .rtm-tab.active {
    color: var(--b3-theme-primary);
    border-bottom-color: var(--b3-theme-primary);
  }

  .rtm-content {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }

  .rtm-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .rtm-panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .rtm-btn-primary {
    padding: 6px 12px;
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .rtm-btn-primary:hover {
    opacity: 0.9;
  }

  .rtm-btn-secondary {
    padding: 6px 12px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .rtm-loading,
  .rtm-empty-state {
    text-align: center;
    padding: 24px;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rtm-task-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: var(--b3-theme-surface);
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
  }

  .rtm-task-card.overdue {
    border-left: 3px solid var(--b3-card-error-color, #ef4444);
  }

  .rtm-task-card.today {
    border-left: 3px solid var(--b3-card-warning-color, #f59e0b);
  }

  .rtm-task-info {
    flex: 1;
  }

  .rtm-task-name {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .rtm-task-due {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-task-recurrence {
    font-size: 11px;
    color: var(--b3-theme-primary);
    margin-top: 2px;
  }

  .rtm-task-actions {
    display: flex;
    gap: 4px;
  }

  .rtm-btn-icon {
    padding: 4px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
  }

  .rtm-btn-icon:hover {
    background: var(--b3-theme-surface-light);
  }

  .rtm-btn-danger:hover {
    background: var(--b3-card-error-background, #fef2f2);
    color: var(--b3-card-error-color, #ef4444);
  }

  .rtm-settings-panel {
    padding: 16px;
  }

  .rtm-settings-panel h3 {
    margin: 0 0 12px 0;
  }

  .rtm-settings-section {
    margin-bottom: 24px;
  }

  .rtm-settings-section h4 {
    font-size: 15px;
    margin: 0 0 16px 0;
    color: var(--b3-theme-on-surface);
  }

  .rtm-settings-section h5 {
    font-size: 13px;
    margin: 12px 0 8px 0;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-migration-section {
    margin-top: 16px;
    padding: 16px;
    background: var(--b3-theme-surface);
    border-radius: 6px;
  }

  .rtm-migration-stats {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }

  .rtm-stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rtm-stat-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--b3-theme-primary);
  }

  .rtm-stat-label {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-phase-notice {
    padding: 12px;
    background: var(--b3-theme-primary-lighter, rgba(59, 130, 246, 0.1));
    border-left: 3px solid var(--b3-theme-primary, #3b82f6);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
    line-height: 1.5;
  }

  .rtm-warning-box {
    padding: 12px;
    background: var(--b3-card-warning-background, #fef3c7);
    color: var(--b3-card-warning-color, #92400e);
    border-left: 3px solid var(--b3-card-warning-color, #f59e0b);
    border-radius: 4px;
    font-size: 13px;
    margin-top: 12px;
  }

  .rtm-success-box {
    padding: 12px;
    background: var(--b3-card-success-background, #d1fae5);
    color: var(--b3-card-success-color, #065f46);
    border-left: 3px solid var(--b3-card-success-color, #10b981);
    border-radius: 4px;
    font-size: 13px;
    margin-top: 12px;
  }

  .rtm-edit-form {
    padding: 16px;
    background: var(--b3-theme-surface);
    border-radius: 6px;
    border: 1px solid var(--b3-border-color);
  }

  .rtm-edit-form h4 {
    margin: 0 0 12px 0;
    font-size: 15px;
  }

  .rtm-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .rtm-field span {
    font-size: 12px;
    font-weight: 500;
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-field input,
  .rtm-field textarea {
    padding: 6px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    font-family: var(--b3-font-family);
  }

  .rtm-field textarea {
    resize: vertical;
  }

  .rtm-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .rtm-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rtm-btn-danger-text {
    padding: 6px 12px;
    background: transparent;
    color: var(--b3-card-error-color, #ef4444);
    border: none;
    cursor: pointer;
    font-size: 13px;
    margin-left: auto;
  }

  .rtm-btn-danger-text:hover {
    text-decoration: underline;
  }

  /* Query Panel Styles (Phase 1) */
  .rtm-queries-panel {
    max-width: 1200px;
    margin: 0 auto;
  }

  .rtm-query-section {
    margin-bottom: 16px;
  }

  .rtm-field-label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-surface);
  }

  .rtm-query-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    font-family: var(--b3-font-family-code, monospace);
    resize: vertical;
    min-height: 80px;
  }

  .rtm-query-input:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px var(--b3-theme-primary-light);
  }

  .rtm-query-actions {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .rtm-query-results {
    margin-top: 24px;
  }

  .rtm-results-header {
    margin-bottom: 12px;
  }

  .rtm-results-header h4 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  .rtm-task-main {
    flex: 1;
  }

  .rtm-task-description {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
    margin-top: 4px;
  }

  .rtm-task-meta {
    display: flex;
    gap: 12px;
    margin-top: 6px;
    font-size: 12px;
  }

  .rtm-task-status {
    color: var(--b3-theme-on-surface-light);
  }

  .rtm-task-status.overdue {
    color: var(--b3-card-error-color, #ef4444);
    font-weight: 500;
  }

  .rtm-task-tags {
    color: var(--b3-theme-primary);
  }

  .rtm-error-box {
    padding: 12px;
    background: var(--b3-card-error-background, rgba(239, 68, 68, 0.1));
    color: var(--b3-card-error-color, #ef4444);
    border: 1px solid var(--b3-card-error-color, #ef4444);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
  }

  .rtm-info-box {
    padding: 12px;
    background: var(--b3-card-info-background, rgba(59, 130, 246, 0.1));
    color: var(--b3-card-info-color, #3b82f6);
    border: 1px solid var(--b3-card-info-color, #3b82f6);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 13px;
  }
</style>
