task-recurring-notification-management/
│
├── .github/                                    # GitHub Actions workflows & CI/CD
│
├── assets/                                     # Root-level static assets
│
├── benchmarks/                                 # Performance benchmark data
│
├── docs/                                       # 📚 Comprehensive documentation
│   ├── architecture/                           # System architecture diagrams
│   ├── examples/                               # Usage examples
│   ├── guides/                                 # User and developer guides
│   ├── integration/                            # Integration documentation
│   ├── scripts/                                # Doc generation utilities
│   ├── AI_AGENT_CODING_PROMPT.md              # AI pair programming guide
│   ├── AI_FEATURES.md                         # AI suggestion engine docs
│   ├── ARCHITECTURE_ANALYSIS.md               # Deep architecture analysis
│   ├── CHANGELOG.md                           # Version changelog
│   ├── CHANGELOG_PHASE3.md                    # Phase 3 updates
│   ├── CHANGELOG_UI_IMPROVEMENTS.md           # UI improvement history
│   ├── COMPREHENSIVE_PLUGIN_COMPARISON.md     # Plugin comparison matrix
│   ├── IMPLEMENTATION_ROADMAP.md              # Development roadmap
│   ├── InlineTaskSyntax.md                    # Emoji-based syntax guide
│   ├── KEYBOARD_SHORTCUTS.md                  # Keyboard shortcuts reference
│   ├── PHASE_0_AUDIT.md                       # Initial audit report
│   ├── presets.md                             # Task preset templates
│   └── README.md                              # Documentation index
│
├── i18n/                                       # 🌐 Internationalization
│   ├── en_US.json                             # English (US) translations
│   └── zh_CN.json                             # Chinese (Simplified) translations
│
├── scripts/                                    # 🛠️ Build and development automation
│   ├── copy-dist.js                           # Post-build file copier
│   ├── generate-icons.js                      # SVG icon generator
│   ├── generate-plugin-images.js              # Plugin preview generator
│   ├── generate-png-placeholders.js           # PNG placeholder creator
│   └── make_dev_link.js                       # Development symlink creator
│
├── src/                                        # 💻 Main source code (TypeScript + Svelte)
│   │
│   ├── application/                            # 📋 Application layer (CQRS)
│   │   └── actions/                           # Command/Query handlers
│   │
│   ├── assets/                                 # 🖼️ Source-level assets
│   │
│   ├── backend/                                # 🔧 Backend business logic
│   │   ├── 📄 README.md                       # Backend architecture guide
│   │   ├── 📄 index.ts                        # Backend entry point & exports
│   │   │
│   │   ├── 📁 Task/                           # Task domain models
│   │   │   ├── 📄 Task.ts                     # Core Task entity (schema, version, analytics fields)
│   │   │   ├── 📄 TaskDefaults.ts             # Default task values & factory
│   │   │   ├── 📄 TaskStatus.ts               # Task status enum & transitions
│   │   │   ├── 📄 TaskPriority.ts             # Priority levels (🔺🔼🔽 mapping)
│   │   │   ├── 📄 TaskValidator.ts            # Task validation rules
│   │   │   ├── 📄 TaskSerializer.ts           # Serialization/deserialization
│   │   │   └── 📄 index.ts                    # Task module exports
│   │   │
│   │   ├── 📁 adapters/                       # External service adapters
│   │   │   ├── 📄 SiYuanAPIAdapter.ts         # SiYuan fetchPost wrapper
│   │   │   ├── 📄 BlockAttributeAdapter.ts    # BLOCK_ATTR_* sync adapter
│   │   │   ├── 📄 StorageAdapter.ts           # SiYuan storage API adapter
│   │   │   ├── 📄 NotificationAdapter.ts      # System notification adapter
│   │   │   └── 📄 index.ts                    # Adapter exports
│   │   │
│   │   ├── 📁 analytics/                      # Analytics & tracking
│   │   │   ├── 📄 AnalyticsEngine.ts          # Core analytics computation
│   │   │   ├── 📄 CompletionAnalyzer.ts       # Completion rate & streak tracking
│   │   │   ├── 📄 PatternDetector.ts          # Usage pattern detection
│   │   │   ├── 📄 StreakCalculator.ts         # Streak computation (currentStreak, bestStreak)
│   │   │   ├── 📄 HealthScoreCalculator.ts    # Task health scoring algorithm
│   │   │   ├── 📄 TimeDistributionAnalyzer.ts # Completion time distribution
│   │   │   └── 📄 index.ts                    # Analytics exports
│   │   │
│   │   ├── 📁 blocks/                         # SiYuan block handlers
│   │   │   ├── 📄 BlockAttributeSync.ts       # Sync task data ↔ block attributes
│   │   │   ├── 📄 BlockEventHandler.ts        # Block CRUD event reactions
│   │   │   ├── 📄 BlockActionExecutor.ts      # Execute blockActions[] triggers
│   │   │   ├── 📄 BlockRetryQueue.ts          # Retry queue for failed block syncs
│   │   │   ├── 📄 BlockConstants.ts           # BLOCK_ATTR_TASK_ID, BLOCK_ATTR_TASK_DUE, etc.
│   │   │   └── 📄 index.ts                    # Block module exports
│   │   │
│   │   ├── 📁 bulk/                           # Bulk operations
│   │   │   ├── 📄 BulkOperationManager.ts     # Batch task operations coordinator
│   │   │   ├── 📄 BulkUpdateStrategy.ts       # Strategy pattern for bulk updates
│   │   │   ├── 📄 BulkDeleteHandler.ts        # Bulk deletion with cleanup
│   │   │   ├── 📄 BulkArchiveHandler.ts       # Bulk archive with chunked storage
│   │   │   └── 📄 index.ts                    # Bulk module exports
│   │   │
│   │   ├── 📁 commands/                       # Command pattern handlers
│   │   │   ├── 📄 CommandBus.ts               # Command dispatch & routing
│   │   │   ├── 📄 CreateTaskCommand.ts        # Task creation command
│   │   │   ├── 📄 UpdateTaskCommand.ts        # Task update command
│   │   │   ├── 📄 DeleteTaskCommand.ts        # Task deletion command
│   │   │   ├── 📄 CompleteTaskCommand.ts      # Task completion + recurrence trigger
│   │   │   ├── 📄 ToggleTaskCommand.ts        # Inline checkbox toggle command
│   │   │   ├── 📄 RescheduleTaskCommand.ts    # Reschedule with validation
│   │   │   ├── 📄 PostponeTaskCommand.ts      # Postpone by duration
│   │   │   └── 📄 index.ts                    # Command exports
│   │   │
│   │   ├── 📁 config/                         # Backend configuration
│   │   │   ├── 📄 PluginConfig.ts             # Plugin-level configuration schema
│   │   │   ├── 📄 DefaultSettings.ts          # Default settings values
│   │   │   ├── 📄 ConfigValidator.ts          # Settings validation
│   │   │   ├── 📄 FeatureFlags.ts             # Feature toggle management
│   │   │   └── 📄 index.ts                    # Config exports
│   │   │
│   │   ├── 📁 core/                           # Core business logic
│   │   │   ├── 📄 TaskManager.ts              # Central singleton (getInstance pattern)
│   │   │   ├── 📄 TaskStorage.ts              # In-memory Map + SiYuan persistence
│   │   │   ├── 📄 TaskIndex.ts                # Triple indexing (block, task-block, due)
│   │   │   ├── 📄 TaskLifecycle.ts            # Task state machine & transitions
│   │   │   ├── 📄 GlobalFilter.ts             # Singleton filter applied at load time
│   │   │   ├── 📄 ArchiveManager.ts           # Chunked on-demand archive loading
│   │   │   ├── 📄 SchemaVersion.ts            # CURRENT_SCHEMA_VERSION & migration check
│   │   │   └── 📄 index.ts                    # Core exports
│   │   │
│   │   ├── 📁 events/                         # Event bus & handlers
│   │   │   ├── 📄 EventBus.ts                 # Central event emitter
│   │   │   ├── 📄 EventService.ts             # NotificationState & event reactions
│   │   │   ├── 📄 TaskEventTypes.ts           # Event type definitions (task:due, task:overdue, etc.)
│   │   │   ├── 📄 OnCompletionHandler.ts      # Post-completion recurrence trigger
│   │   │   ├── 📄 DueEventEmitter.ts          # Emits task:due & task:overdue events
│   │   │   ├── 📄 EventQueue.ts               # Async event delivery queue
│   │   │   └── 📄 index.ts                    # Event module exports
│   │   │
│   │   ├── 📁 features/                       # Feature modules
│   │   │   ├── 📄 DependencyManager.ts        # Task dependency graph & circular detection
│   │   │   ├── 📄 TagManager.ts               # Tag CRUD & aggregation
│   │   │   ├── 📄 TemplateManager.ts          # Task template creation & application
│   │   │   ├── 📄 PresetManager.ts            # Preset task configurations
│   │   │   ├── 📄 TimezoneHandler.ts          # Timezone normalization for scheduling
│   │   │   ├── 📄 BlockActionsManager.ts      # Block action trigger-action pairs
│   │   │   └── 📄 index.ts                    # Feature exports
│   │   │
│   │   ├── 📁 integrations/                   # Third-party integrations
│   │   │   ├── 📄 IntegrationManager.ts       # Integration lifecycle & registry
│   │   │   ├── 📄 N8nIntegration.ts           # n8n workflow integration
│   │   │   ├── 📄 TelegramIntegration.ts      # Telegram Bot API integration
│   │   │   ├── 📄 GmailIntegration.ts         # Gmail API integration
│   │   │   └── 📄 index.ts                    # Integration exports
│   │   │
│   │   ├── 📁 intelligence/                   # AI/ML suggestion engine
│   │   │   ├── 📄 SmartSuggestionEngine.ts    # Rule-based AI suggestions (no external APIs)
│   │   │   ├── 📄 AbandonmentDetector.ts      # 5+ misses OR <10% completion rate
│   │   │   ├── 📄 RescheduleAnalyzer.ts       # Completion hour patterns (≥70% confidence)
│   │   │   ├── 📄 UrgencyDetector.ts          # 3+ consecutive misses → high priority
│   │   │   ├── 📄 FrequencyOptimizer.ts       # Completion rate >1.5× → increase frequency
│   │   │   ├── 📄 PatternLearner.ts           # Historical pattern analysis from completionContexts
│   │   │   ├── 📄 SuggestionTypes.ts          # Suggestion type definitions & confidence scores
│   │   │   └── 📄 index.ts                    # Intelligence exports
│   │   │
│   │   ├── 📁 logging/                        # Logging infrastructure
│   │   │   ├── 📄 Logger.ts                   # Core logger with levels
│   │   │   ├── 📄 LogFormatter.ts             # Log message formatting
│   │   │   ├── 📄 PerformanceLogger.ts        # Performance timing & metrics
│   │   │   └── 📄 index.ts                    # Logging exports
│   │   │
│   │   ├── 📁 parsers/                        # Inline task parsers
│   │   │   ├── 📄 InlineTaskParser.ts         # Emoji-based metadata parsing (📅🔁🔺🔼🔽🆔⛔#)
│   │   │   ├── 📄 NaturalDateParser.ts        # chrono-node wrapper ("tomorrow at 3pm", etc.)
│   │   │   ├── 📄 RecurrenceParser.ts         # Recurrence rule text → RRule
│   │   │   ├── 📄 MarkdownSerializer.ts       # ParsedTask → markdown (bidirectional)
│   │   │   ├── 📄 DependencyParser.ts         # ⛔ dependency ID parsing
│   │   │   ├── 📄 TagParser.ts                # # tag extraction
│   │   │   └── 📄 index.ts                    # Parser exports
│   │   │
│   │   ├── 📁 query/                          # Query handlers (CQRS)
│   │   │   ├── 📄 QueryBus.ts                 # Query dispatch & routing
│   │   │   ├── 📄 GetTaskByIdQuery.ts         # Single task retrieval
│   │   │   ├── 📄 GetTasksByFilterQuery.ts    # Filtered task list query
│   │   │   ├── 📄 GetDueTasksQuery.ts         # Tasks due by date range (dueIndex)
│   │   │   ├── 📄 GetTasksByTagQuery.ts       # Tag-based task retrieval
│   │   │   ├── 📄 GetTasksByBlockQuery.ts     # Block ID → task lookup (blockIndex)
│   │   │   ├── 📄 GetOverdueTasksQuery.ts     # Overdue task list
│   │   │   ├── 📄 GetAnalyticsQuery.ts        # Analytics data aggregation query
│   │   │   ├── 📄 SearchTasksQuery.ts         # Fuzzy search across tasks
│   │   │   └── 📄 index.ts                    # Query exports
│   │   │
│   │   ├── 📁 recurrence/                     # Recurrence engine (RRule)
│   │   │   ├── 📄 RecurrenceEngine.ts         # RRule-based recurrence computation
│   │   │   ├── 📄 RecurrenceCalculator.ts     # Next occurrence calculation with forward progress
│   │   │   ├── 📄 RecurrenceValidator.ts      # Validation (interval ≠ 0, horizon check)
│   │   │   ├── 📄 RecurrenceTypes.ts          # Recurrence pattern type definitions
│   │   │   ├── 📄 RRuleAdapter.ts             # rrule library wrapper
│   │   │   ├── 📄 ForwardProgressGuard.ts     # RECURRENCE_NO_PROGRESS error & iteration limit (1000)
│   │   │   └── 📄 index.ts                    # Recurrence module exports
│   │   │
│   │   ├── 📁 services/                       # Business services
│   │   │   ├── 📄 TaskService.ts              # High-level task CRUD orchestration
│   │   │   ├── 📄 SchedulerService.ts         # Scheduler (task:due, task:overdue emission)
│   │   │   ├── 📄 NotificationService.ts      # Notification dispatch & state
│   │   │   ├── 📄 SettingsService.ts          # Settings load/save/validate
│   │   │   ├── 📄 SyncService.ts              # Task ↔ SiYuan DOM synchronization
│   │   │   ├── 📄 ArchiveService.ts           # Archive/unarchive operations
│   │   │   ├── 📄 ExportService.ts            # Task export (JSON, CSV)
│   │   │   ├── 📄 ImportService.ts            # Task import with validation
│   │   │   └── 📄 index.ts                    # Service exports
│   │   │
│   │   ├── 📁 utils/                          # Backend utilities
│   │   │   ├── 📄 DateUtils.ts                # Date manipulation helpers
│   │   │   ├── 📄 IdGenerator.ts              # Unique ID generation
│   │   │   ├── 📄 DeepClone.ts                # Deep clone for immutability
│   │   │   ├── 📄 Debounce.ts                 # Debounce/throttle utilities
│   │   │   ├── 📄 RetryHelper.ts              # Generic retry with backoff
│   │   │   ├── 📄 CircularDependencyDetector.ts # Graph cycle detection
│   │   │   └── 📄 index.ts                    # Util exports
│   │   │
│   │   ├── 📁 webhook/                        # Webhook handler (legacy/inbound)
│   │   │   ├── 📄 WebhookHandler.ts           # Inbound webhook processor
│   │   │   └── 📄 index.ts                    # Webhook exports
│   │   │
│   │   └── 📁 webhooks/                       # Webhook integrations (outbound)
│   │       ├── 📄 OutboundWebhookEmitter.ts   # Fire-and-forget event emission
│   │       ├── 📄 SignatureGenerator.ts        # HMAC webhook signature security
│   │       ├── 📄 WebhookChannel.ts           # Channel configuration interface
│   │       ├── 📄 RetryManager.ts             # Failed webhook retry with exponential backoff
│   │       ├── 📄 WebhookEventMapper.ts       # Task events → webhook payload mapping
│   │       └── 📄 index.ts                    # Webhooks exports
│   │
│   ├── components/                             # 🎨 UI Components (Svelte)
│   │   ├── 📄 index.ts                        # Component barrel exports
│   │   │
│   │   ├── 📁 analytics/                      # 📊 Analytics & Insights Components
│   │   │   ├── 📄 AnalyticsDashboard.svelte   # Main analytics dashboard container
│   │   │   ├── 📄 CompletionChart.svelte      # Completion rate over time (D3/SVG)
│   │   │   ├── 📄 HabitTracker.svelte         # Habit streak visualization
│   │   │   ├── 📄 HealthBreakdown.svelte      # Task health score breakdown view
│   │   │   ├── 📄 HeatmapView.svelte          # Calendar heatmap (GitHub-style)
│   │   │   ├── 📄 PredictiveInsightsPanel.svelte # AI-driven predictive insights display
│   │   │   ├── 📄 PriorityDistribution.svelte # Priority level distribution chart
│   │   │   ├── 📄 StatsCard.svelte            # Reusable statistics card widget
│   │   │   ├── 📄 TaskAnalytics.svelte        # Per-task analytics detail view
│   │   │   ├── 📄 TimelineChart.svelte        # Timeline-based task visualization
│   │   │   ├── 📄 WeekOverWeekComparison.svelte # Week-over-week comparison chart
│   │   │   ├── 📄 export.ts                   # Analytics component exports
│   │   │   ├── 📄 index.ts                    # Analytics barrel exports
│   │   │   │
│   │   │   ├── 📁 insight-table/              # Insight Data Tables
│   │   │   │   ├── 📄 data-table.ts           # Table data model & rendering
│   │   │   │   ├── 📄 index.ts                # Insight table exports
│   │   │   │   ├── 📄 loader.ts               # Async data loader for tables
│   │   │   │   └── 📄 root.ts                 # Root table component mount
│   │   │   │
│   │   │   ├── 📁 overview/                   # Analytics Overview Panel
│   │   │   │   ├── 📄 active-project-item.ts  # Single project item renderer
│   │   │   │   ├── 📄 active-projects.ts      # Active projects list component
│   │   │   │   ├── 📄 index.ts                # Overview exports
│   │   │   │   ├── 📄 project-insights.ts     # Project-level insight aggregation
│   │   │   │   └── 📄 root.ts                 # Overview root component mount
│   │   │   │
│   │   │   ├── 📁 select/                     # Analytics Selectors & Filters
│   │   │   │   ├── 📄 analytics-params.ts     # Analytics parameter store
│   │   │   │   ├── 📄 duration.ts             # Time duration selector
│   │   │   │   ├── 📄 project.ts              # Project scope selector
│   │   │   │   ├── 📄 select-x-axis.ts        # X-axis metric selector
│   │   │   │   └── 📄 select-y-axis.tsx       # Y-axis metric selector
│   │   │   │
│   │   │   ├── 📁 widgets/                    # Dashboard Widgets (Drag & Drop)
│   │   │   │   ├── 📄 DashboardCustomizationToolbar.svelte # Widget toolbar controls
│   │   │   │   ├── 📄 DashboardLayoutManager.ts # Grid layout persistence & computation
│   │   │   │   ├── 📄 DashboardWidget.svelte  # Generic draggable widget wrapper
│   │   │   │   ├── 📄 DragDropManager.ts      # Drag-and-drop interaction handler
│   │   │   │   └── 📄 WidgetTypes.ts          # Widget type definitions & registry
│   │   │   │
│   │   │   └── 📁 work-items/                 # Work Item Analytics (empty/planned)
│   │   │
│   │   ├── 📁 calendar/                       # 📅 Calendar View Components
│   │   │   ├── 📄 CalendarDay.svelte          # Single day cell with task indicators
│   │   │   ├── 📄 CalendarView.svelte         # Monthly/weekly calendar grid
│   │   │   ├── 📄 TaskChip.svelte             # Compact task chip for calendar cells
│   │   │   ├── 📄 constants.ts                # Calendar constants (DAYS_IN_WEEK, etc.)
│   │   │   ├── 📄 index.ts                    # Calendar barrel exports
│   │   │   ├── 📄 main.ts                     # Calendar entry point & initialization
│   │   │   ├── 📄 settings.ts                 # Calendar-specific settings
│   │   │   ├── 📄 view.ts                     # Calendar view state management
│   │   │   │
│   │   │   ├── 📁 io/                         # Calendar I/O Operations
│   │   │   │   ├── 📄 dailyNotes.ts           # Daily note creation & linking
│   │   │   │   └── 📄 weeklyNotes.ts          # Weekly note creation & linking
│   │   │   │
│   │   │   ├── 📁 testUtils/                  # Calendar Testing Utilities
│   │   │   │
│   │   │   └── 📁 ui/                         # Calendar UI Sub-components
│   │   │       ├── 📄 Calendar.svelte         # Core calendar renderer
│   │   │       ├── 📄 fileMenu.ts             # Calendar file context menu
│   │   │       ├── 📄 modal.ts                # Calendar modal helper
│   │   │       ├── 📄 stores.ts               # Calendar-specific Svelte stores
│   │   │       ├── 📄 utils.ts                # Calendar UI utilities
│   │   │       └── 📁 sources/                # Calendar data sources
│   │   │
│   │   ├── 📁 dashboard/                      # 🏠 Main Dashboard Components
│   │   │   ├── 📄 Dashboard.svelte            # Root dashboard layout container
│   │   │   ├── 📄 DockPanel.svelte            # SiYuan dock panel integration (addDock)
│   │   │   ├── 📄 QuickActions.svelte         # Quick action buttons (create, complete, etc.)
│   │   │   ├── 📄 TaskStats.svelte            # Task statistics summary cards
│   │   │   ├── 📄 TaskSummary.svelte          # Compact task summary view
│   │   │   ├── 📄 UpcomingTasks.svelte        # Upcoming/due-soon task list
│   │   │   ├── 📄 bulletChart.ts              # Bullet chart rendering (D3)
│   │   │   ├── 📄 chartRendering.ts           # Chart rendering utilities (lazy D3)
│   │   │   ├── 📄 dashboardData.ts            # Dashboard data aggregation layer
│   │   │   ├── 📄 dashboardHelpers.ts         # Dashboard helper functions
│   │   │   ├── 📄 dashboardMain.ts            # Dashboard initialization & lifecycle
│   │   │   ├── 📄 dashboardSettings.ts        # Dashboard layout preferences
│   │   │   ├── 📄 dataCollecting.ts           # Data collection from TaskManager
│   │   │   ├── 📄 dataParser.ts               # Raw data → chart data transformation
│   │   │   ├── 📄 expressionParser.ts         # Query expression parser for filters
│   │   │   ├── 📄 heatmapChart.ts             # Heatmap chart rendering (D3)
│   │   │   ├── 📄 index.ts                    # Dashboard barrel exports
│   │   │   ├── 📄 monthView.ts                # Month-level view data
│   │   │   ├── 📄 pieChart.ts                 # Pie chart rendering (D3)
│   │   │   ├── 📄 summaryData.ts              # Summary statistics computation
│   │   │   │
│   │   │   └── 📁 views/                      # Dashboard Tab Views
│   │   │       ├── 📄 QueriesView.svelte      # Saved queries management tab
│   │   │       ├── 📄 SettingsView.svelte     # Inline settings tab
│   │   │       └── 📄 TasksView.svelte        # Task list management tab
│   │   │
│   │   ├── 📁 query/                          # 🔍 Query Management Components
│   │   │   ├── 📄 AdvancedQueryDashboard.svelte    # Advanced query builder dashboard
│   │   │   ├── 📄 QueryExplanationPanel.svelte     # Natural language query explanation
│   │   │   ├── 📄 QueryFolderManager.svelte        # Query folder organization
│   │   │   ├── 📄 QueryStatisticsDashboard.svelte  # Query result statistics
│   │   │   ├── 📄 QueryTagManager.svelte           # Query tag management
│   │   │   ├── 📄 QueryTemplatesLibrary.svelte     # Predefined query templates
│   │   │   ├── 📄 SavedQueriesDropdown.svelte      # Saved queries quick-select dropdown
│   │   │   ├── 📄 VisualQueryBuilder.svelte        # Drag-and-drop visual query builder
│   │   │   └── 📄 index.ts                         # Query component exports
│   │   │
│   │   ├── 📁 reminders/                      # 🔔 Notification & Reminders
│   │   │   ├── 📄 NotificationPanel.svelte    # Notification center panel
│   │   │   ├── 📄 ReminderCard.svelte         # Individual reminder card
│   │   │   ├── 📄 ReminderList.svelte         # Scrollable reminder list
│   │   │   ├── 📄 ReminderSettings.svelte     # Reminder configuration form
│   │   │   ├── 📄 global.d.ts                 # Reminder type declarations
│   │   │   ├── 📄 index.ts                    # Reminder barrel exports
│   │   │   ├── 📄 main.ts                     # Reminder module entry point
│   │   │   └── 📁 ui/                         # Reminder UI primitives
│   │   │
│   │   ├── 📁 settings/                       # ⚙️ Settings Components
│   │   │   ├── 📄 AdvancedSettings.svelte     # Advanced/debug settings panel
│   │   │   ├── 📄 DataSettings.svelte         # Data management (export/import/reset)
│   │   │   ├── 📄 DisplaySettings.svelte      # Display & theme settings
│   │   │   ├── 📄 GeneralSettings.svelte      # General plugin settings
│   │   │   ├── 📄 KeyboardSettings.svelte     # Keyboard shortcut customization
│   │   │   ├── 📄 NotificationSettings.svelte # Notification channel settings
│   │   │   ├── 📄 SettingsPanel.svelte        # Settings panel container with tabs
│   │   │   └── 📄 index.ts                    # Settings barrel exports
│   │   │
│   │   ├── 📁 shared/                         # 🔗 Shared/Reusable Components
│   │   │   ├── 📄 AISuggestionsPanel.svelte   # AI suggestion cards with approve/dismiss
│   │   │   ├── 📄 Button.svelte               # Themed button component
│   │   │   ├── 📄 ContextMenu.svelte          # Right-click context menu
│   │   │   ├── 📄 Dependency.scss             # Dependency picker styles
│   │   │   ├── 📄 Dependency.svelte           # Task dependency picker (circular dep check)
│   │   │   ├── 📄 Dropdown.svelte             # Dropdown select component
│   │   │   ├── 📄 EditTask.scss               # Task editor modal styles
│   │   │   ├── 📄 EditTaskUnified.ts          # Unified task editor logic (10 sections)
│   │   │   ├── 📄 ErrorBoundary.svelte        # Error boundary wrapper
│   │   │   ├── 📄 ErrorMessage.svelte         # Error message display
│   │   │   ├── 📄 Icon.svelte                 # SVG icon component
│   │   │   ├── 📄 IQuery.ts                   # Query interface types
│   │   │   ├── 📄 KeyboardShortcutsHelp.svelte # Keyboard shortcuts help overlay
│   │   │   ├── 📄 LoadingSpinner.svelte       # Loading spinner animation
│   │   │   ├── 📄 Modal.svelte                # Generic modal wrapper
│   │   │   ├── 📄 ModalOptionsEditor.scss     # Modal options editor styles
│   │   │   ├── 📄 README.md                   # Shared components documentation
│   │   │   ├── 📄 SettingsStore.ts            # Component-level settings store
│   │   │   ├── 📄 TaskChip.svelte             # Compact task tag/chip display
│   │   │   ├── 📄 TaskListItem.svelte         # Single task list row
│   │   │   ├── 📄 TaskListView.svelte         # Scrollable task list container
│   │   │   ├── 📄 TaskTemplateManager.svelte  # Task template CRUD UI
│   │   │   ├── 📄 TimelineView.svelte         # Horizontal timeline visualization
│   │   │   ├── 📄 Tooltip.svelte              # Tooltip on hover/focus
│   │   │   ├── 📄 TrackerDashboard.svelte     # Habit/streak tracker dashboard
│   │   │   ├── 📄 index.ts                    # Shared barrel exports
│   │   │   ├── 📄 styles.scss                 # Shared component styles
│   │   │   │
│   │   │   ├── 📁 EditInstructions/           # Edit Instructions Components
│   │   │   │
│   │   │   ├── 📁 editors/                    # 📝 Field Editors (TaskEditorModal sections)
│   │   │   │   ├── 📄 BlockActionsEditor.svelte    # Block action trigger-action pair editor
│   │   │   │   ├── 📄 DateEditor.svelte            # Date picker with start ≤ scheduled ≤ due validation
│   │   │   │   ├── 📄 PriorityEditor.svelte        # Priority selector (🔺🔼🔽)
│   │   │   │   ├── 📄 RecurrenceEditor.svelte      # Recurrence pattern configuration
│   │   │   │   ├── 📄 RecurrencePreview.svelte     # Next 5 occurrences preview
│   │   │   │   ├── 📄 StatusEditor.svelte          # Task status selector with transitions
│   │   │   │   └── 📄 TagsCategoryEditor.svelte    # Tags & category editor
│   │   │   │
│   │   │   ├── 📁 forms/                      # Form Components
│   │   │   │   └── 📄 RecurrenceBuilder.svelte # Visual recurrence rule builder
│   │   │   │
│   │   │   ├── 📁 Layout/                     # Layout Configuration
│   │   │   │   ├── 📄 QueryLayoutOptions.ts   # Query result layout options
│   │   │   │   └── 📄 TaskLayoutOptions.ts    # Task list layout options
│   │   │   │
│   │   │   ├── 📁 Menus/                      # Context Menus (SiYuan Menu API)
│   │   │   │   ├── 📄 DateMenu.ts             # Date quick-pick context menu
│   │   │   │   ├── 📄 DatePicker.ts           # Date picker popup menu
│   │   │   │   ├── 📄 PostponeMenu.ts         # Postpone duration options menu
│   │   │   │   ├── 📄 PriorityMenu.ts         # Priority quick-select menu
│   │   │   │   ├── 📄 StatusMenu.ts           # Status transition menu
│   │   │   │   └── 📄 TaskEditingMenu.ts      # Full task editing context menu
│   │   │   │
│   │   │   ├── 📁 modals/                     # Modal Components (planned)
│   │   │   │
│   │   │   ├── 📁 pickers/                    # 🎯 Value Pickers
│   │   │   │   ├── 📄 DatePicker.svelte       # Calendar date picker (chrono-node NLP input)
│   │   │   │   ├── 📄 MonthPicker.svelte      # Month selector
│   │   │   │   ├── 📄 QuickFilters.svelte     # Preset quick filter buttons
│   │   │   │   ├── 📄 RecurrencePicker.svelte # Recurrence pattern picker
│   │   │   │   ├── 📄 SearchBar.svelte        # Fuzzy search input with debounce
│   │   │   │   ├── 📄 TagSelector.svelte      # Multi-select tag picker
│   │   │   │   ├── 📄 TimePicker.svelte       # Time-of-day picker
│   │   │   │   └── 📄 YearPicker.svelte       # Year selector
│   │   │   │
│   │   │   ├── 📁 Query/                      # Query Result Components
│   │   │   │   ├── 📄 QueryResult.ts          # Query result renderer
│   │   │   │   └── 📁 Group/                  # Grouped query results
│   │   │   │
│   │   │   ├── 📁 selectors/                  # Selection Components (planned)
│   │   │   │
│   │   │   ├── 📁 styles/                     # Shared Component Styles
│   │   │   │
│   │   │   ├── 📁 Task/                       # Task Sub-components (planned)
│   │   │   │
│   │   │   └── 📁 utils/                      # Shared Component Utilities
│   │   │
│   │   └── 📁 tasks/                          # ✅ Task Management Components
│   │       ├── 📄 TaskActions.svelte          # Task action buttons (complete, delete, archive)
│   │       ├── 📄 TaskBatch.svelte            # Bulk selection & batch operations UI
│   │       ├── 📄 TaskCard.svelte             # Task card view (priority border, status badge)
│   │       ├── 📄 TaskDetails.svelte          # Expanded task detail panel
│   │       ├── 📄 TaskFilters.svelte          # Filter controls (status, priority, date, tags)
│   │       ├── 📄 TaskForm.svelte             # Task creation/edit form
│   │       ├── 📄 TaskGrouper.svelte          # Group-by controls (status, priority, due date)
│   │       ├── 📄 TaskSorter.svelte           # Sort controls (date, priority, name, health)
│   │       ├── 📄 UpgradeRecurrenceButton.svelte # Legacy → RRule recurrence migration button
│   │       └── 📄 index.ts                    # Task component exports
│   │
│   ├── modals/                                 # 💬 Modal Dialogs
│   │   ├── 📄 OptionsModal.ts                 # Plugin options modal
│   │   ├── 📄 TaskEditModal.svelte            # Full task editor (10 sections, validation)
│   │   ├── 📄 TaskModal.ts                    # Task modal lifecycle manager
│   │   ├── 📄 index.ts                        # Modal barrel exports
│   │   └── 📄 modalHelpers.ts                 # Modal open/close/transition helpers
│   │
│   ├── stores/                                 # 🗃️ Svelte Stores (State Management)
│   │   ├── 📄 BulkSelection.store.ts          # Bulk selection state (Set<taskId>)
│   │   ├── 📄 I18n.store.ts                   # i18n locale & translation store
│   │   ├── 📄 KeyboardShortcuts.store.ts      # Active keyboard shortcuts registry
│   │   ├── 📄 Search.store.ts                 # Search query & results state
│   │   ├── 📄 Settings.store.ts               # Plugin settings reactive store
│   │   ├── 📄 Task.store.ts                   # Task list reactive store (syncs w/ TaskManager)
│   │   ├── 📄 TaskAnalytics.store.ts          # Analytics data reactive store
│   │   ├── 📄 TaskOrder.store.ts              # Task sort order & grouping state
│   │   └── 📄 index.ts                        # Store barrel exports
│   │
│   ├── styles/                                 # 🎨 Global Styles
│   │   ├── 📄 accessibility.css               # WCAG 2.1 AA accessibility styles
│   │   ├── 📄 main.scss                       # Main SCSS entry (imports, variables, mixins)
│   │   ├── 📄 optimistic-ui.scss              # Optimistic UI transition animations
│   │   └── 📄 renderer.scss                   # SiYuan block renderer style overrides
│   │
│   ├── utils/                                  # 🛠️ Frontend Utility Functions
│   │   ├── 📄 accessibility.ts                # ARIA attribute helpers & focus management
│   │   ├── 📄 dateFormatters.ts               # Date display formatting (relative, absolute)
│   │   ├── 📄 debounce.ts                     # Debounce (100ms default) & throttle
│   │   ├── 📄 keyboardHandler.ts              # Keyboard event listener & dispatch
│   │   ├── 📄 keyboardShortcuts.ts            # Shortcut registration & conflict detection
│   │   ├── 📄 lazyD3.ts                       # Lazy D3.js dynamic import wrapper
│   │   ├── 📄 notifications.ts                # Browser notification API wrapper
│   │   ├── 📄 taskHelpers.ts                  # Task display helpers (emoji mapping, etc.)
│   │   ├── 📄 uiHelpers.ts                    # DOM manipulation & SiYuan UI helpers
│   │   └── 📄 useCancellableAsync.ts          # Cancellable async operation hook
│   │
│   ├── infrastructure/                         # 🗄️ Infrastructure layer
│   │   ├── detectors/                         # Context detectors
│   │   ├── integrations/                      # External integrations
│   │   ├── io/                                # File I/O operations
│   │   ├── parsers/                           # Infrastructure parsers
│   │   └── persistence/                       # Data persistence (SQLite)
│   │
│   ├── migration/                              # 📦 Data migration scripts
│   │
│   ├── plugin/                                 # 🔌 SiYuan plugin integration
│   │   └── menus.ts                           # Context menu handlers
│   │
│   ├── shared/                                 # 🔗 Shared utilities & types
│   │   ├── README.md                          # Shared utilities guide
│   │   ├── assets/                            # Shared icons
│   │   ├── config/                            # Configuration interfaces
│   │   ├── constants/                         # Constants & enums
│   │   ├── utils/                             # Cross-layer utilities
│   │   │   ├── compat/                        # Compatibility shims
│   │   │   ├── date/                          # Date manipulation
│   │   │   ├── dateTime/                      # DateTime utilities
│   │   │   ├── function/                      # Function utilities (debounce)
│   │   │   ├── lib/                           # External library wrappers
│   │   │   ├── search/                        # Fuzzy search
│   │   │   ├── string/                        # String utilities
│   │   │   └── task/                          # Task-related utilities
│   │   └── index.ts                           # Shared exports
│   │
│   ├── ui/                                     # 🎭 Low-level UI components
│   │   └── components/                        # Reusable UI primitives
│
│   ├── constants.ts                            # Global constants
│   ├── index.ts                                # 🚀 Plugin entry point (onload → TaskManager)
│   └── settings.ts                             # Settings configuration
│
├── tests/                                      # ✅ Test suite (59+ tests, Vitest)
│   ├── analytics/                             # Analytics tests
│   ├── integration/                           # Integration tests
│   ├── performance/                           # Performance benchmarks
│   ├── security/                              # Security tests
│   ├── unit/                                  # Unit tests
│   ├── index.test.ts                          # Core plugin tests
│   ├── load-testing.test.ts                   # Load testing
│   ├── migration.test.ts                      # Migration tests
│   ├── parser.test.ts                         # Parser tests
│   ├── phase2-week6-integration.test.ts       # Phase 2 integration
│   ├── phase4-integration.test.ts             # Phase 4 integration
│   ├── recurrence.test.ts                     # Recurrence engine tests
│   ├── serializer.test.ts                     # Serialization tests
│   ├── toggle.test.ts                         # Toggle handler tests
│   └── ...                                    # (More test files)
│
├── .gitignore                                  # Git ignore rules
├── LICENSE                                     # MIT License
├── README.md                                   # 📖 Main project README
├── icon.png                                    # Plugin icon (160x160)
├── index.css                                   # Compiled CSS output
├── index.js                                    # Compiled JS bundle (206KB)
├── package.json                                # NPM dependencies & scripts
├── plugin.json                                 # SiYuan plugin manifest
├── preview.png                                 # Plugin preview image
├── preview.svg                                 # SVG preview template
├── run-benchmark.js                            # Benchmark runner
├── tsconfig.json                               # TypeScript configuration
├── vite.config.ts                              # Vite build config
└── vitest.config.ts                            # Vitest test config