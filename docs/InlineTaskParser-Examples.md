# Inline Task Parser Examples

This file demonstrates the inline task parser with real-world examples.

## Quick Start

```typescript
import { parseInlineTask, normalizeTask } from './src/parser/InlineTaskParser';

// Parse a simple task
const result = parseInlineTask('- [ ] Buy groceries 📅 tomorrow #personal');
console.log(result);
// {
//   description: 'Buy groceries',
//   status: 'todo',
//   dueDate: '2026-01-24',
//   tags: ['personal']
// }

// Normalize back to markdown
const markdown = normalizeTask(result);
console.log(markdown);
// "- [ ] Buy groceries 📅 2026-01-24 #personal"
```

## Real-World Examples

### Personal Task Management

```markdown
# Morning Routine
- [ ] Morning workout 🔁 every day when done 🔼 #health
- [ ] Meditation 🔁 every day ⏳ 07:00 #wellness
- [ ] Review daily goals 📅 today #planning

# Household
- [ ] Weekly grocery shopping 📅 saturday 🔁 every week #chores
- [ ] Pay rent 📅 2026-02-01 🔺 🔁 every month #finance
- [ ] Clean apartment 📅 tomorrow 🔽 #chores
```

### Work/Project Management

```markdown
# Sprint Tasks
- [ ] Sprint planning 📅 next monday 🔁 every 2 weeks 🔼 #scrum
- [ ] Daily standup 🔁 every weekday ⏳ 09:00 #team
- [ ] Sprint review 📅 2026-02-14 🔺 🆔 review-s12 #scrum

# Feature Development
- [ ] Design API endpoints 🆔 api-design 🔺 📅 2026-01-26 #backend
- [ ] Implement auth flow ⛔ api-design 🆔 auth-impl 📅 2026-01-28 #backend
- [ ] Write unit tests ⛔ auth-impl 📅 2026-01-29 🔼 #testing
- [ ] Code review 📅 2026-01-30 ⛔ auth-impl #review
- [ ] Deploy to staging 📅 2026-01-31 ⛔ auth-impl 🔺 🆔 deploy-staging #deploy
```

### Content Creation

```markdown
# Blog Posts
- [ ] Research topic 🆔 blog-research 📅 next monday #content
- [ ] Write draft ⛔ blog-research 📅 next wednesday 🔼 #writing
- [ ] Edit and review ⛔ blog-research 📅 next friday #editing
- [ ] Publish post 📅 2026-02-03 🔺 #publishing

# Social Media
- [ ] Weekly newsletter 📅 friday 🔁 every week #newsletter
- [ ] Twitter thread 📅 tomorrow #social
- [ ] LinkedIn post 📅 2026-01-27 #professional
```

### Health & Fitness

```markdown
- [ ] Gym workout 🔁 every 2 days when done 🔼 #fitness
- [ ] Run 5K 🔁 every week on saturday #cardio
- [ ] Meal prep 📅 sunday 🔁 every week #nutrition
- [ ] Doctor checkup 📅 2026-02-15 🔺 #health
- [ ] Refill prescription 📅 2026-02-01 🔁 every month #medication
```

### Learning & Development

```markdown
- [ ] TypeScript course 📅 today 🔼 #learning #programming
- [ ] Practice coding problems 🔁 every weekday ⏳ 20:00 #practice
- [ ] Read tech book 🔁 every day when done 📅 today #reading
- [ ] Weekly reflection 📅 sunday 🔁 every week #growth
```

## Complex Dependencies Example

```markdown
# Product Launch
- [ ] Market research 🆔 research 📅 2026-01-25 🔺 #planning
- [ ] Define MVP 🆔 mvp 📅 2026-01-27 ⛔ research 🔺 #product
- [ ] Design mockups 🆔 design 📅 2026-01-30 ⛔ mvp 🔼 #design
- [ ] Setup infrastructure 🆔 infra 📅 2026-01-28 ⛔ mvp 🔺 #devops
- [ ] Backend development 🆔 backend 📅 2026-02-05 ⛔ design,infra 🔺 #dev
- [ ] Frontend development 🆔 frontend 📅 2026-02-08 ⛔ design,backend 🔺 #dev
- [ ] Integration testing 🆔 testing 📅 2026-02-10 ⛔ frontend,backend 🔼 #qa
- [ ] UAT 🆔 uat 📅 2026-02-12 ⛔ testing 🔼 #qa
- [ ] Production deploy 🆔 deploy 📅 2026-02-15 ⛔ uat 🔺 #launch
- [ ] Monitor metrics 📅 2026-02-16 ⛔ deploy 🔺 #ops
```

## Recurring Task Patterns

```markdown
# Daily Recurring
- [ ] Check emails 🔁 every day ⏳ 09:00 #work
- [ ] Evening review 🔁 every day when done ⏳ 18:00 #planning

# Weekly Recurring
- [ ] Team meeting 🔁 every week on monday ⏳ 10:00 #meetings
- [ ] Weekly report 🔁 every week when done 📅 friday #reporting

# Monthly Recurring
- [ ] Invoice clients 🔁 every month on the 1st 🔺 #finance
- [ ] Team retrospective 🔁 every month 🔼 #team

# Custom Intervals
- [ ] Review goals 🔁 every 2 weeks 🔼 #planning
- [ ] Backup data 🔁 every 3 days 🔺 #maintenance
```

## Advanced Use Cases

### Time-Boxed Project

```markdown
- [ ] Phase 1: Research ⏳ 2026-01-24 🛫 2026-01-24 📅 2026-01-26 🆔 phase1 🔺
- [ ] Phase 2: Development ⏳ 2026-01-27 🛫 2026-01-27 📅 2026-02-02 ⛔ phase1 🔺
- [ ] Phase 3: Testing ⏳ 2026-02-03 🛫 2026-02-03 📅 2026-02-05 ⛔ phase2 🔼
- [ ] Phase 4: Deployment ⏳ 2026-02-06 🛫 2026-02-06 📅 2026-02-07 ⛔ phase3 🔺
```

### Multi-Tag Organization

```markdown
- [ ] Fix critical bug 🔺 📅 today #bug #critical #backend #urgent
- [ ] Update documentation 📅 tomorrow #docs #maintenance #low-priority
- [ ] Refactor auth module 📅 next week #tech-debt #security #backend
- [ ] Performance optimization 🔼 📅 2026-02-01 #performance #backend #optimization
```

### Completion-Based Recurring

Perfect for habit tracking:

```markdown
- [ ] Drink 8 glasses of water 🔁 every day when done #health
- [ ] Exercise for 30 minutes 🔁 every day when done #fitness
- [ ] Read for 1 hour 🔁 every day when done #learning
- [ ] Practice meditation 🔁 every day when done #wellness
```

## Parser Behavior Examples

### Round-Trip Consistency

```typescript
const original = '- [ ] Task 📅 tomorrow 🔁 every week 🔼 #dev';
const parsed = parseInlineTask(original);
const normalized = normalizeTask(parsed);
const reparsed = parseInlineTask(normalized);

// parsed === reparsed (data is identical)
// normalized uses canonical format with ISO dates
```

### Error Handling

```typescript
// Invalid date
parseInlineTask('- [ ] Task 📅 notadate');
// { error: true, message: 'Invalid due date: ...', token: 'notadate' }

// Invalid recurrence
parseInlineTask('- [ ] Task 🔁 invalid pattern');
// { error: true, message: 'Invalid recurrence: ...', token: 'invalid pattern' }

// Not a checklist
parseInlineTask('Just regular text');
// { error: true, message: 'Not a checklist item: ...' }
```

### Flexible Input, Canonical Output

```typescript
// Input with any order
parseInlineTask('- [ ] #urgent Task 🔺 description 📅 tomorrow');

// Output always uses canonical order
normalizeTask(parsed);
// "- [ ] #urgent Task description 📅 2026-01-24 🔺 #urgent"
```

## Integration Examples

### Command Handler (Future Phase 2)

```typescript
// This will be implemented in Phase 2
function createTaskFromBlock(blockText: string) {
  const result = parseInlineTask(blockText);
  
  if ('error' in result) {
    showError(result.message);
    return;
  }
  
  // Create task in storage
  taskStorage.create(result);
  
  // Normalize and update block
  const normalized = normalizeTask(result);
  updateBlock(normalized);
}
```

### Auto-Complete (Future Phase 3)

```typescript
// This will be implemented in Phase 3
function onTaskInput(text: string) {
  const validation = validateSyntax(text);
  
  if (!validation.valid) {
    showValidationErrors(validation.errors);
  } else {
    // Parse and show preview
    const preview = parseInlineTask(text);
    showPreview(preview);
  }
}
```

## Performance Characteristics

```typescript
// Simple task: ~1ms
parseInlineTask('- [ ] Simple task');

// Complex task: <5ms (after warm-up)
parseInlineTask('- [ ] Complex ⏳ tomorrow 📅 2026-02-01 🔁 every week 🔺 🆔 t1 ⛔ t2 #work #urgent');

// 100 tasks: <500ms total (<5ms average per task)
for (let i = 0; i < 100; i++) {
  parseInlineTask(`- [ ] Task ${i} 📅 2026-01-${i % 28 + 1}`);
}
```

## Best Practices

1. **Use natural language dates for flexibility:**
   ```markdown
   ✅ - [ ] Review PR 📅 tomorrow
   ⚠️ - [ ] Review PR 📅 2026-01-24
   ```

2. **Leverage dependencies for workflows:**
   ```markdown
   - [ ] Design 🆔 design
   - [ ] Develop ⛔ design 🆔 develop
   - [ ] Test ⛔ develop
   ```

3. **Tag consistently for better filtering:**
   ```markdown
   - [ ] Task 1 #project-alpha #high-priority #backend
   - [ ] Task 2 #project-alpha #medium-priority #frontend
   ```

4. **Use recurrence for habits and routines:**
   ```markdown
   - [ ] Exercise 🔁 every day when done
   - [ ] Weekly review 🔁 every week on friday
   ```

5. **Combine metadata meaningfully:**
   ```markdown
   - [ ] Deploy to prod 🆔 deploy-v2 ⛔ tests-pass,review-done 🔺 📅 friday #release
   ```

## See Also

- [Complete Syntax Reference](./InlineTaskSyntax.md)
- [API Documentation](../src/parser/InlineTaskParser.ts)
- [Test Suite](../src/parser/InlineTaskParser.test.ts)
