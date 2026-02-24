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
│   ├── application/                            # Application layer (CQRS)
│   │   └── actions/                           # Command/Query handlers
│   │
│   ├── assets/                                 # Source-level assets
│   │
│   ├── backend/                                # 🔧 Backend business logic
│   │   ├── README.md                          # Backend architecture guide
│   │   ├── Task/                              # Task domain models
│   │   ├── adapters/                          # External service adapters
│   │   ├── analytics/                         # Analytics & tracking
│   │   ├── blocks/                            # SiYuan block handlers
│   │   ├── bulk/                              # Bulk operations
│   │   ├── commands/                          # Command pattern handlers
│   │   ├── config/                            # Backend configuration
│   │   ├── core/                              # Core business logic
│   │   ├── events/                            # Event bus & handlers
│   │   ├── features/                          # Feature modules
│   │   ├── integrations/                      # Third-party integrations
│   │   ├── intelligence/                      # AI/ML suggestion engine
│   │   ├── logging/                           # Logging infrastructure
│   │   ├── parsers/                           # Inline task parsers
│   │   ├── query/                             # Query handlers (CQRS)
│   │   ├── recurrence/                        # Recurrence engine (RRule)
│   │   ├── services/                          # Business services
│   │   ├── utils/                             # Backend utilities
│   │   ├── webhook/                           # Webhook handler
│   │   ├── webhooks/                          # Webhook integrations
│   │   └── index.ts                           # Backend entry point
│   │
│   ├── domain/                                 # 📐 Domain models & business rules
│   │   ├── dependencies/                      # Task dependency logic
│   │   ├── index/                             # Domain indexes
│   │   ├── models/                            # Core domain entities
│   │   ├── parser/                            # Domain-level parsers
│   │   ├── query/                             # Domain query objects
│   │   ├── recurrence/                        # Recurrence domain logic
│   │   ├── tags/                              # Tag management
│   │   └── utils/                             # Domain utilities
│   │
│   ├── /frontend/
├── 📄 index.ts                          # Main frontend entry point
├── 📄 README.md                         # Frontend documentation
│
├── 📁 components/                       # UI Components (Svelte)
│   ├── 📄 index.ts
│   │
│   ├── 📁 analytics/                    # Analytics & Insights Components
│   │   ├── 📄 AnalyticsDashboard.svelte
│   │   ├── 📄 CompletionChart.svelte
│   │   ├── 📄 HabitTracker.svelte
│   │   ├── 📄 HealthBreakdown.svelte
│   │   ├── 📄 HeatmapView.svelte
│   │   ├── 📄 PredictiveInsightsPanel.svelte
│   │   ├── 📄 PriorityDistribution.svelte
│   │   ├── 📄 StatsCard.svelte
│   │   ├── 📄 TaskAnalytics.svelte
│   │   ├── 📄 TimelineChart.svelte
│   │   ├── 📄 WeekOverWeekComparison.svelte
│   │   ├── 📄 export.ts
│   │   ├── 📄 index.ts
│   │   │
│   │   ├── 📁 insight-table/           # Insight Data Tables
│   │   │   ├── 📄 data-table.ts
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 loader.ts            # Currently opened file
│   │   │   └── 📄 root.ts
│   │   │
│   │   ├── 📁 overview/                # Analytics Overview
│   │   │   ├── 📄 active-project-item.ts
│   │   │   ├── 📄 active-projects.ts
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 project-insights.ts
│   │   │   └── 📄 root.ts
│   │   │
│   │   ├── 📁 select/                  # Analytics Selectors
│   │   │   ├── 📄 analytics-params.ts
│   │   │   ├── 📄 duration.ts
│   │   │   ├── 📄 project.ts
│   │   │   ├── 📄 select-x-axis.ts
│   │   │   └── 📄 select-y-axis.tsx
│   │   │
│   │   ├── 📁 widgets/                 # Dashboard Widgets
│   │   │   ├── 📄 DashboardCustomizationToolbar.svelte
│   │   │   ├── 📄 DashboardLayoutManager.ts
│   │   │   ├── 📄 DashboardWidget.svelte
│   │   │   ├── 📄 DragDropManager.ts
│   │   │   └── 📄 WidgetTypes.ts
│   │   │
│   │   └── 📁 work-items/              # Work Item Analytics
│   │
│   ├── 📁 calendar/                     # Calendar View Components
│   │   ├── 📄 CalendarDay.svelte
│   │   ├── 📄 CalendarView.svelte
│   │   ├── 📄 TaskChip.svelte
│   │   ├── 📄 constants.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 main.ts
│   │   ├── 📄 settings.ts
│   │   ├── 📄 view.ts
│   │   │
│   │   ├── 📁 io/                      # Calendar I/O Operations
│   │   │   ├── 📄 dailyNotes.ts
│   │   │   └── 📄 weeklyNotes.ts
│   │   │
│   │   ├── 📁 testUtils/               # Calendar Testing Utilities
│   │   │
│   │   └── 📁 ui/                      # Calendar UI Components
│   │       ├── 📄 Calendar.svelte
│   │       ├── 📄 fileMenu.ts
│   │       ├── 📄 modal.ts
│   │       ├── 📄 stores.ts
│   │       ├── 📄 utils.ts
│   │       └── 📁 sources/
│   │
│   ├── 📁 dashboard/                    # Main Dashboard Components
│   │   ├── 📄 Dashboard.svelte
│   │   ├── 📄 DockPanel.svelte
│   │   ├── 📄 QuickActions.svelte
│   │   ├── 📄 TaskStats.svelte
│   │   ├── 📄 TaskSummary.svelte
│   │   ├── 📄 UpcomingTasks.svelte
│   │   ├── 📄 bulletChart.ts
│   │   ├── 📄 chartRendering.ts
│   │   ├── 📄 dashboardData.ts
│   │   ├── 📄 dashboardHelpers.ts
│   │   ├── 📄 dashboardMain.ts
│   │   ├── 📄 dashboardSettings.ts
│   │   ├── 📄 dataCollecting.ts
│   │   ├── 📄 dataParser.ts
│   │   ├── 📄 expressionParser.ts
│   │   ├── 📄 heatmapChart.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 monthView.ts
│   │   ├── 📄 pieChart.ts
│   │   ├── 📄 summaryData.ts
│   │   │
│   │   └── 📁 views/                   # Dashboard Views
│   │       ├── 📄 QueriesView.svelte
│   │       ├── 📄 SettingsView.svelte
│   │       └── 📄 TasksView.svelte
│   │
│   ├── 📁 query/                        # Query Management Components
│   │   ├── 📄 AdvancedQueryDashboard.svelte
│   │   ├── 📄 QueryExplanationPanel.svelte
│   │   ├── 📄 QueryFolderManager.svelte
│   │   ├── 📄 QueryStatisticsDashboard.svelte
│   │   ├── 📄 QueryTagManager.svelte
│   │   ├── 📄 QueryTemplatesLibrary.svelte
│   │   ├── 📄 SavedQueriesDropdown.svelte
│   │   ├── 📄 VisualQueryBuilder.svelte
│   │   └── 📄 index.ts
│   │
│   ├── 📁 reminders/                    # Notification & Reminders
│   │   ├── 📄 NotificationPanel.svelte
│   │   ├── 📄 ReminderCard.svelte
│   │   ├── 📄 ReminderList.svelte
│   │   ├── 📄 ReminderSettings.svelte
│   │   ├── 📄 global.d.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 main.ts
│   │   └── 📁 ui/
│   │
│   ├── 📁 settings/                     # Settings Components
│   │   ├── 📄 AdvancedSettings.svelte
│   │   ├── 📄 DataSettings.svelte
│   │   ├── 📄 DisplaySettings.svelte
│   │   ├── 📄 GeneralSettings.svelte
│   │   ├── 📄 KeyboardSettings.svelte
│   │   ├── 📄 NotificationSettings.svelte
│   │   ├── 📄 SettingsPanel.svelte
│   │   └── 📄 index.ts
│   │
│   ├── 📁 shared/                       # Shared/Reusable Components
│   │   ├── 📄 AISuggestionsPanel.svelte
│   │   ├── 📄 Button.svelte
│   │   ├── 📄 ContextMenu.svelte
│   │   ├── 📄 Dependency.scss
│   │   ├── 📄 Dependency.svelte
│   │   ├── 📄 Dropdown.svelte
│   │   ├── 📄 EditTask.scss
│   │   ├── 📄 EditTaskUnified.ts
│   │   ├── 📄 ErrorBoundary.svelte
│   │   ├── 📄 ErrorMessage.svelte
│   │   ├── 📄 Icon.svelte
│   │   ├── 📄 IQuery.ts
│   │   ├── 📄 KeyboardShortcutsHelp.svelte
│   │   ├── 📄 LoadingSpinner.svelte
│   │   ├── 📄 Modal.svelte
│   │   ├── 📄 ModalOptionsEditor.scss
│   │   ├── 📄 README.md
│   │   ├── 📄 SettingsStore.ts
│   │   ├── 📄 TaskChip.svelte
│   │   ├── 📄 TaskListItem.svelte
│   │   ├── 📄 TaskListView.svelte
│   │   ├── 📄 TaskTemplateManager.svelte
│   │   ├── 📄 TimelineView.svelte
│   │   ├── 📄 Tooltip.svelte
│   │   ├── 📄 TrackerDashboard.svelte
│   │   ├── 📄 index.ts
│   │   ├── 📄 styles.scss
│   │   │
│   │   ├── 📁 EditInstructions/        # Edit Instructions Components
│   │   │
│   │   ├── 📁 editors/                 # Field Editors
│   │   │   ├── 📄 BlockActionsEditor.svelte
│   │   │   ├── 📄 DateEditor.svelte
│   │   │   ├── 📄 PriorityEditor.svelte
│   │   │   ├── 📄 RecurrenceEditor.svelte
│   │   │   ├── 📄 RecurrencePreview.svelte
│   │   │   ├── 📄 StatusEditor.svelte
│   │   │   └── 📄 TagsCategoryEditor.svelte
│   │   │
│   │   ├── 📁 forms/                   # Form Components
│   │   │   └── 📄 RecurrenceBuilder.svelte
│   │   │
│   │   ├── 📁 Layout/                  # Layout Components
│   │   │   ├── 📄 QueryLayoutOptions.ts
│   │   │   └── 📄 TaskLayoutOptions.ts
│   │   │
│   │   ├── 📁 Menus/                   # Context Menus
│   │   │   ├── 📄 DateMenu.ts
│   │   │   ├── 📄 DatePicker.ts
│   │   │   ├── 📄 PostponeMenu.ts
│   │   │   ├── 📄 PriorityMenu.ts
│   │   │   ├── 📄 StatusMenu.ts
│   │   │   └── 📄 TaskEditingMenu.ts
│   │   │
│   │   ├── 📁 modals/                  # Modal Components
│   │   │
│   │   ├── 📁 pickers/                 # Value Pickers
│   │   │   ├── 📄 DatePicker.svelte
│   │   │   ├── 📄 MonthPicker.svelte
│   │   │   ├── 📄 QuickFilters.svelte
│   │   │   ├── 📄 RecurrencePicker.svelte
│   │   │   ├── 📄 SearchBar.svelte
│   │   │   ├── 📄 TagSelector.svelte
│   │   │   ├── 📄 TimePicker.svelte
│   │   │   └── 📄 YearPicker.svelte
│   │   │
│   │   ├── 📁 Query/                   # Query Components
│   │   │   ├── 📄 QueryResult.ts
│   │   │   └── 📁 Group/
│   │   │
│   │   ├── 📁 selectors/               # Selection Components
│   │   │
│   │   ├── 📁 styles/                  # Shared Styles
│   │   │
│   │   ├── 📁 Task/                    # Task Components (Empty)
│   │   │
│   │   └── 📁 utils/                   # Shared Component Utilities
│   │
│   └── 📁 tasks/                        # Task Management Components
│       ├── 📄 TaskActions.svelte
│       ├── 📄 TaskBatch.svelte
│       ├── 📄 TaskCard.svelte
│       ├── 📄 TaskDetails.svelte
│       ├── 📄 TaskFilters.svelte
│       ├── 📄 TaskForm.svelte
│       ├── 📄 TaskGrouper.svelte
│       ├── 📄 TaskSorter.svelte
│       ├── 📄 UpgradeRecurrenceButton.svelte
│       └── 📄 index.ts
│
├── 📁 modals/                           # Modal Dialogs
│   ├── 📄 OptionsModal.ts
│   ├── 📄 TaskEditModal.svelte
│   ├── 📄 TaskModal.ts
│   ├── 📄 index.ts
│   └── 📄 modalHelpers.ts
│
├── 📁 stores/                           # Svelte Stores (State Management)
│   ├── 📄 BulkSelection.store.ts       # Bulk operations state
│   ├── 📄 I18n.store.ts                # Internationalization
│   ├── 📄 KeyboardShortcuts.store.ts   # Keyboard shortcuts state
│   ├── 📄 Search.store.ts              # Search state
│   ├── 📄 Settings.store.ts            # Settings state
│   ├── 📄 Task.store.ts                # Task state management
│   ├── 📄 TaskAnalytics.store.ts       # Analytics state
│   ├── 📄 TaskOrder.store.ts           # Task ordering state
│   └── 📄 index.ts
│
├── 📁 styles/                           # Global Styles
│   ├── 📄 accessibility.css            # Accessibility styles
│   ├── 📄 main.scss                    # Main stylesheet
│   ├── 📄 optimistic-ui.scss           # Optimistic UI updates
│   └── 📄 renderer.scss                # Renderer styles
│
└── 📁 utils/                            # Utility Functions
    ├── 📄 accessibility.ts             # Accessibility helpers
    ├── 📄 dateFormatters.ts            # Date formatting utilities
    ├── 📄 debounce.ts                  # Debounce/throttle functions
    ├── 📄 keyboardHandler.ts           # Keyboard event handling
    ├── 📄 keyboardShortcuts.ts         # Keyboard shortcuts logic
    ├── 📄 lazyD3.ts                    # Lazy D3.js loading
    ├── 📄 notifications.ts             # Notification utilities
    ├── 📄 taskHelpers.ts               # Task helper functions
    ├── 📄 uiHelpers.ts                 # UI helper functions
    └── 📄 useCancellableAsync.ts       # Cancellable async hook                        # Frontend entry point
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
│   │
│   ├── constants.ts                            # Global constants
│   ├── index.ts                                # 🚀 Plugin entry point
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