# Task Recurring Notification Management

Advanced recurring task scheduling plugin for SiYuan Note with intelligent notifications, natural language processing, and AI-powered suggestions.

## ✨ Features

### 📅 Flexible Recurrence Rules
- **Preset patterns**: Daily, weekly, monthly, yearly
- **Custom intervals**: "Every 3 days", "Every 2 weeks"
- **Recurrence modes**: 
  - **From due date**: Next occurrence calculated from original due date
  - **When done**: Next occurrence calculated from completion date

### 🔔 Multi-Channel Notifications
- **Browser Notifications**: Native desktop notifications
- **Telegram Bot**: Send task reminders via Telegram
- **Gmail Integration**: Email notifications with OAuth
- **n8n Webhooks**: Trigger custom automation workflows

### 🗣️ Natural Language Input
Powered by `chrono-node` for intelligent date parsing:
- "tomorrow at 3pm"
- "next Monday"
- "in 3 days"
- "February 14th at 9am"

### 🤖 AI-Powered Suggestions
- Pattern recognition based on your task history
- Smart recurrence recommendations
- Predictive task scheduling

### 📊 Advanced Filtering
- **Regex support**: Filter tasks by title/description patterns
- **Tag filtering**: Multiple tag selection with AND/OR logic
- **Priority filtering**: Filter by low/medium/high/urgent
- **Date range filtering**: Custom date ranges

### 🔗 SiYuan Integration
- **Block linking**: Associate tasks with document blocks
- **Inline task creation**: Use `[[task::...]]` syntax in notes
- **Bidirectional sync**: Tasks update when blocks change (if supported by SiYuan version)

### 🌍 Multi-Language Support
- English (en_US)
- Simplified Chinese (zh_CN)
- Arabic (ar_SA) - Coming soon

## 📦 Installation

### From SiYuan Marketplace
1. Open SiYuan → Settings → Marketplace → Plugins
2. Search for "Task Recurring Notification Management"
3. Click Install
4. Restart SiYuan

### Manual Installation
```bash
cd /path/to/siyuan/data/plugins
git clone https://github.com/Drmusab/task-recurring-notification-management.git task-recurring-notfication-mangmant
cd task-recurring-notfication-mangmant
npm install
npm run build
```

## 🚀 Usage

### Quick Start
1. Click the calendar icon in the top bar
2. Click "New Task" to create your first task
3. Enter task details and set recurrence
4. Configure notifications in Settings

### Inline Task Creation
In any SiYuan document, type:
```
[[task::Buy groceries every Monday at 9am]]
```

The plugin will automatically create a task linked to that block.

### Keyboard Shortcuts
- `⌘⇧N` (Mac) / `Ctrl+Shift+N` (Windows): Create new task
- `⌘⌥T` (Mac) / `Ctrl+Alt+T` (Windows): Toggle task panel

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm or pnpm

### Setup
```bash
# Clone repository
git clone https://github.com/Drmusab/task-recurring-notification-management.git
cd task-recurring-notification-management

# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check
```

### Project Structure
```
src/
├── index.ts                    # Plugin entry point
├── core/
│   ├── api/                    # SiYuan API adapters
│   ├── models/                 # Data models (Task, Frequency)
│   ├── engine/                 # Recurrence & scheduling engines
│   ├── storage/                # TaskStorage with migration support
│   ├── ai/                     # Smart suggestions engine
│   ├── ml/                     # Pattern learning
│   ├── filtering/              # GlobalFilter system
│   ├── events/                 # Event bus for component communication
│   └── parsers/                # Natural language parsing
├── services/                   # Notification services
├── components/                 # Svelte 5 UI components
│   ├── dashboard/              # Main dashboard
│   ├── cards/                  # Task editor overlays
│   ├── ui/                     # Reusable inputs
│   └── settings/               # Settings panels
├── features/                   # AutoTaskCreator
└── commands/                   # Keyboard shortcuts
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Coding Guidelines
- Use TypeScript with strict mode
- Follow Svelte 5 Runes API (not legacy reactivity)
- Write tests for new features
- Update i18n files for new strings
- Use SiYuan CSS variables for theming

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [SiYuan Note](https://github.com/siyuan-note/siyuan) - Amazing note-taking platform
- [chrono-node](https://github.com/wanasit/chrono) - Natural language date parsing
- [rrule](https://github.com/jakubroztocil/rrule) - Recurrence rule handling
- Svelte 5 team - Fantastic reactive framework

## 📧 Contact

**Author**: Drmusab  
**Repository**: https://github.com/Drmusab/task-recurring-notification-management  
**Issues**: https://github.com/Drmusab/task-recurring-notification-management/issues

---

Made with ❤️ for the SiYuan community