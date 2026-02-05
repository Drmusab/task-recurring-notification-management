# Shehab-Note Recurring Task Manager

A powerful recurring task management plugin for Shehab-Note (SiYuan fork) with advanced scheduling, multi-channel notifications, visual timeline planning, and **inline task creation**.

## Features

### ✨ Inline Task Creation (NEW)

Create tasks directly in your notes using natural markdown syntax with emoji-based metadata:

```markdown
- [ ] Buy groceries 📅 tomorrow #personal
- [ ] Weekly report 📅 next friday 🔁 every week 🔼 #work
- [ ] Deploy app 🆔 deploy-v2 ⛔ tests-pass 🔺 #release
```

**🎯 Auto-Creation (Phase 3):**
- ⚡ **Automatic task creation** - Press Enter or blur to auto-create tasks
- 🛡️ **Duplicate prevention** - Won't create multiple tasks for the same checklist
- 💡 **Visual error hints** - See parse errors inline without corrupting text
- ⚙️ **Flexible settings** - Control when and how tasks are created

[📖 Auto-Creation Guide](./docs/AUTO_CREATION.md) | [📖 Inline Syntax Reference](./docs/InlineTaskSyntax.md)

**Supported metadata:**
- 📅 **Due dates:** ISO dates or natural language (today, tomorrow, next week, etc.)
- ⏳ **Scheduled dates:** When to start working
- 🛫 **Start dates:** Earliest start date
- 🔁 **Recurrence:** `every day/week/month/year`, `when done`, custom patterns
- 🔺🔼🔽 **Priority:** High, Medium, Low
- 🆔 **Task IDs:** Unique identifiers
- ⛔ **Dependencies:** Link tasks together
- #️⃣ **Tags:** Categorize and filter

### 🔁 Advanced Recurrence Rules
- **Daily, Weekly, Monthly scheduling** with customizable intervals
- **Fixed-time scheduling** (e.g., every day at 09:00)
- **Weekday-specific rules** for weekly tasks
- **Intelligent rescheduling** after task completion

### 📋 Task Management
- **Today & Overdue View** - Quick access to tasks requiring attention
- **All Tasks View** - Comprehensive task management with enable/disable toggles
- **Timeline View** - Visual calendar showing upcoming tasks for the next 30 days

### 📅 Natural Language Date Parsing (NEW)
Create tasks faster by typing dates naturally:

- **Relative dates**: `tomorrow`, `in 3 days`, `next week`, `next month`
- **Named days**: `Monday`, `next Friday`, `last Tuesday`  
- **Specific dates**: `Jan 15`, `2024-01-15`, `March 3rd`
- **Times**: `at 9am`, `2:30pm`, `14:00`
- **Combined**: `tomorrow at 3pm`, `next Friday at 9am`
- **Shortcuts**: `eod` (end of day), `eow` (end of week), `eom` (end of month)

**Features:**
- 🎯 **Smart autocomplete** - Intelligent suggestions as you type
- ⌨️ **Keyboard shortcuts** - Quick date entry (Ctrl/Cmd+T for today, Ctrl/Cmd+M for tomorrow)
- ✓ **Real-time validation** - Visual feedback shows parsed dates instantly
- 🔄 **Fallback date picker** - Traditional date/time picker always available

See [Natural Language Dates Documentation](docs/NATURAL_LANGUAGE_DATES.md) for complete reference.

### 🤖 AI-Driven Features (NEW)
- **Smart Suggestions** - AI-powered recommendations based on completion patterns
  - Abandonment detection for never-completed tasks
  - Reschedule suggestions based on when you actually complete tasks
  - Urgency alerts for frequently missed tasks
  - Frequency optimization for tasks you complete more often than scheduled
  - Consolidation suggestions for similar tasks
  - Delegation recommendations based on delay patterns
- **Predictive Scheduling** - ML-based time slot scoring
  - Analyzes historical success rates
  - Considers workload balance and task density
  - Respects user preferences and energy levels
  - Minimizes context switching
- **Keyboard Navigation** - Vim-like shortcuts for power users
  - Full keyboard control (j/k navigation, dd delete, yy duplicate)
  - Multiple modes: Normal, Insert, Visual, Command
  - Command palette for advanced operations
  - Customizable keybindings

See [AI Features Documentation](docs/AI_FEATURES.md) for detailed information.

### 🏗️ Dashboard Architecture (NEW)

The plugin features a modern, well-architected dashboard system with clear separation of concerns:

- **Adapter Layer** - Type-safe data transformation between UI and business logic
- **Validation Layer** - Robust input validation before persistence
- **Persistent Dashboard** - Always-available sidebar interface for quick task creation
- **Comprehensive Testing** - 59 unit and integration tests for adapters, validators, and dashboard

**Documentation:**
- [Architecture Diagram](docs/integration/architecture-diagram.md) - System architecture overview
- [Data Flow](docs/integration/data-flow.md) - How data moves through the system
- [Field Mapping](docs/integration/field-mapping.md) - Complete field reference
- [Migration Guide](docs/integration/migration-guide.md) - Upgrade guide for users

### 🔔 Multi-Channel Notifications
- **n8n** - Webhook integration for workflow automation
- **Telegram** - Direct messaging via Telegram Bot API
- **Gmail** - Email notifications via Gmail API
- Send custom payloads including notes, media URLs, and links

### 🎯 Task Actions
- **✅ Done** - Mark task complete and automatically schedule next occurrence
- **🕒 Delay** - Postpone task to tomorrow without affecting recurrence pattern
- **✏️ Edit** - Modify task details, frequency, and notification settings
- **🗑️ Delete** - Remove tasks permanently

## Installation

1. Download the latest release from the [releases page](https://github.com/Drmusab/plugin-sample-shehab-note/releases)
2. Extract the `package.zip` to your Shehab-Note plugins directory
3. Restart Shehab-Note or reload plugins
4. Open the "Recurring Tasks" dock panel from the right sidebar

## Development

### Prerequisites
- Node.js 16+ and npm
- Shehab-Note or SiYuan installation

### Setup

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Development mode with auto-rebuild
npm run dev

# Create symbolic link to your workspace (optional)
npm run make-link -- --workspace=/path/to/shehab-note/workspace
```

### Project Structure

```
src/
├── index.ts                          # Plugin entry point (onload/onunload)
├── index. scss                        # Global styles
├── core/
│   ├── api/
│   │   └── SiYuanApiAdapter.ts       # SiYuan API abstraction layer
│   ├── engine/
│   │   ├── RecurrenceEngine.ts       # Date calculation logic (275 lines)
│   │   ├── Scheduler.ts              # Task timing & events (~500 lines)
│   │   ├── SchedulerTimer.ts         # ✨ NEW:  Extracted timer management
│   │   ├── SchedulerEvents.ts        # Event type definitions
│   │   ├── TimezoneHandler.ts        # Timezone utilities
│   │   └── NotificationState.ts      # Notification tracking
│   ├── managers/
│   │   └── TaskManager.ts            # Singleton lifecycle manager
│   ├── models/
│   │   ├── Task.ts                   # Task entity & helpers (now with duplicateTask)
│   │   └���─ Frequency.ts              # Recurrence rule types (now with yearly)
│   ├── storage/
│   │   ├── TaskStorage.ts            # Main storage facade
│   │   ├── TaskRepository.ts         # Repository abstraction
│   │   ├── ActiveTaskStore.ts        # Active tasks persistence
│   │   ├── ArchiveTaskStore.ts       # Archived tasks storage
│   │   ├── TaskPersistenceController.ts  # Debounced save controller
│   │   └── MigrationManager.ts       # Schema migration
│   └── events/
│       └── PluginEventBus.ts         # Internal event bus
├── services/
│   ├── EventService. ts               # n8n webhook orchestration
│   └── types. ts                      # Service type definitions
├── components/
│   ├── Dashboard.svelte              # Main dashboard container
│   ├── dashboard/
│   │   └── taskState.ts              # UI state helpers
│   ├── tabs/
│   │   ├── TodayTab.svelte           # Today & overdue view
│   │   ├── AllTasksTab.svelte        # All tasks management (now with duplicate)
│   │   ├── TimelineTab.svelte        # Calendar timeline (with memoization)
│   │   └── AnalyticsTab.svelte       # Statistics dashboard
│   ├── cards/
│   │   ├── TaskCard.svelte           # Task display component
│   │   ├── TaskForm.svelte           # Task creation/editing (with templates & preview)
│   │   └── QuickAddOverlay.svelte    # Quick task creation
│   └── settings/
│       └── Settings.svelte           # Configuration panel
├── plugin/
│   ├── commands. ts                   # Slash commands & hotkeys
│   ├── menus.ts                      # Block context menus
│   └── topbar.ts                     # Topbar integration
├── utils/
│   ├── constants.ts                  # Application constants
│   ├── date.ts                       # Date utilities
│   ├── logger.ts                     # Logging
│   ├── notifications.ts              # Toast notifications
│   ├── blocks.ts                     # Block fetching utilities
│   └── taskTemplates.ts              # ✨ NEW:  Task template management
└── __tests__/                        # Test files (comprehensive)
```

## Usage

### Creating a Task

#### Method 1: From Block Menu (NEW)

1. Right-click on any block icon in your document
2. Select "Create Recurring Task" from the context menu
3. The task form opens with pre-filled details from the block:
   - Task name extracted from first line of block
   - Time extracted if present (e.g., "09:00", "2:30 PM")
   - Block automatically linked for quick access
4. Complete the task details and click "Save Task"

**Quick Actions for Linked Blocks:**
- If a block already has a task, the menu shows:
  - ✅ Complete Task - Mark task done and reschedule
  - 🕒 Snooze Task - Delay task (15 min, 1 hour, or tomorrow)

#### Method 2: From Dashboard

1. Open the "Recurring Tasks" dock panel
2. Navigate to the "All Tasks" tab
3. Click "Create New Task"
4. Fill in task details:
   - Task name
   - Due date & time
   - Frequency (daily/weekly/monthly)
   - Interval (e.g., every 2 weeks)
   - Optional: Link to a block, add tags, set priority
5. Click "Save Task"

### Configuring Notifications

1. Click the ⚙️ Settings button in the dashboard header
2. Enable desired notification channels
3. Configure each channel:
   - **n8n**: Enter your webhook URL
   - **Telegram**: Enter bot token and chat ID
   - **Gmail**: Configure OAuth credentials and recipient email
4. Test each channel before saving
5. Click "Save Settings"

### Managing Tasks

- **Today & Overdue Tab**: View and complete tasks due today or earlier
- **All Tasks Tab**: View all recurring tasks, edit, delete, or toggle enabled/disabled
- **Timeline Tab**: Visual calendar view of upcoming tasks
- **Block Context Menu**: Right-click any block with a linked task for quick actions

### Missed Task Recovery (NEW)

The plugin now automatically recovers missed tasks after being offline:

- When the plugin restarts, it checks for tasks that were due while offline
- All missed occurrences are detected and notifications are sent
- Overdue tasks are automatically advanced to their next future occurrence
- No manual intervention needed - recovery happens automatically

**Example:** If your plugin was offline for 3 days and a daily task was due at 9 AM each day:
- You'll receive notifications for all 3 missed days
- The task will be rescheduled to tomorrow at 9 AM

## Configuration

### n8n Webhook

Get your webhook URL from your n8n workflow and paste it in the settings.

### Telegram Bot

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)
4. Enter both in the settings

### Gmail API

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Get your client ID, client secret, and refresh token
5. Enter in the settings along with recipient email

## API

The plugin exposes the following main classes:

- `TaskStorage` - Manages task persistence
- `Scheduler` - Handles task scheduling and notifications
- `RecurrenceEngine` - Calculates next occurrence dates
- `NotificationService` - Orchestrates multi-channel notifications

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please [open an issue](https://github.com/Drmusab/plugin-sample-shehab-note/issues) on GitHub.


git pull