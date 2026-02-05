import type { Task, CompletionHistoryEntry } from '@backend/core/models/Task';
import type { Frequency } from '@backend/core/models/Frequency';
import type { TaskRepositoryProvider } from '@backend/core/storage/TaskRepository';
import { GlobalFilter } from '@backend/core/filtering/GlobalFilter';
import type { SmartRecurrenceSettings } from '@backend/core/settings/PluginSettings';
import type { PatternLearnerStore, PatternLearnerState, TaskPatternHistory } from '@backend/core/ml/PatternLearnerStore';

export interface RecurrenceSuggestion {
  taskId: string;
  suggestedRRule: string;          // RRULE:FREQ=...
  mode: 'fixed' | 'whenDone';
  confidence: number;             // 0..1
  evidence: SuggestionEvidence;   // explainability payload
  generatedAt: string;            // ISO
}

export interface SuggestionEvidence {
  sampleSize: number;             // number of completions used
  timeSpanDays: number;           // range covered
  detectedPattern: 'daily'|'weekly'|'monthly'|'weekday'|'custom';
  interval: number;
  byDay?: string[];               // MO,TU,...
  byMonthDay?: number[];          // 1..31
  stabilityScore: number;         // dispersion / jitter metric
  examples: string[];             // a few completion dates shown to user
}

/**
 * Completion pattern data for analysis
 */
export interface CompletionPattern {
  taskId: string;
  scheduledTime: Date;
  actualCompletionTime: Date;
  dayOfWeek: number;
  hourOfDay: number;
  delayMinutes: number;
  contextTags: string[];
}

/**
 * Insights derived from completion patterns
 */
export interface CompletionInsight {
  averageCompletionDelay: number;  // minutes
  preferredTimeOfDay: number;       // hour (0-23)
  preferredDayOfWeek: number[];     // [0-6] Sunday=0
  completionConsistency: number;    // 0-1 score
  missedTaskFrequency: number;      // percentage
  suggestedAdjustment: string;      // human-readable suggestion
  confidence: number;                // 0-1 confidence in suggestions
}

/**
 * Schedule optimization suggestion
 */
export interface ScheduleSuggestion {
  currentSchedule: {
    frequency: Frequency;
    time?: string;
  };
  suggestedSchedule: {
    frequency: Frequency;
    time?: string;
  };
  reason: string;
  confidence: number;
  expectedImprovement: string;
}

/**
 * Detected anomaly in task completion
 */
export interface Anomaly {
  type: 'consistently_skipped' | 'completion_drift' | 'irregular_completion';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedPeriod: {
    start: string;
    end: string;
  };
  suggestion: string;
}

/**
 * Time preference for a specific context
 */
export interface TimePreference {
  hour: number;
  confidence: number;
  sampleSize: number;
}

/**
 * Smart Recurrence Engine - ML-based pattern learning for task scheduling
 */
export class SmartRecurrenceEngine {
  /**
   * Analyze historical completion data and generate insights
   */
  analyzeCompletionPatterns(task: Task): CompletionInsight {
    if (!task.completionHistory || task.completionHistory.length === 0) {
      return this.getDefaultInsight();
    }

    const history = task.completionHistory;
    const analyzer = new PatternAnalyzer();

    // Calculate average delay
    const averageDelay = this.calculateAverageDelay(history);

    // Find preferred time of day
    const preferredTime = analyzer.calculateOptimalTime(history);

    // Find preferred weekdays
    const weekdayPatterns = analyzer.findWeekdayPatterns(history);
    const preferredDays = Array.from(weekdayPatterns.keys())
      .filter(day => {
        const pref = weekdayPatterns.get(day);
        return pref && pref.confidence > 0.5;
      });

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(history);

    // Calculate miss frequency
    const totalExpected = (task.completionCount || 0) + (task.missCount || 0);
    const missedFrequency = totalExpected > 0 
      ? ((task.missCount || 0) / totalExpected) * 100 
      : 0;

    // Generate suggestion
    const suggestion = this.generateSuggestion(
      averageDelay,
      preferredTime,
      preferredDays,
      consistencyScore
    );

    // Calculate overall confidence
    const confidence = this.calculateConfidence(
      history.length,
      consistencyScore,
      preferredTime.confidence
    );

    return {
      averageCompletionDelay: averageDelay,
      preferredTimeOfDay: preferredTime.hour,
      preferredDayOfWeek: preferredDays,
      completionConsistency: consistencyScore,
      missedTaskFrequency: missedFrequency,
      suggestedAdjustment: suggestion,
      confidence
    };
  }

  /**
   * Suggest optimal schedule adjustments based on patterns
   */
  suggestScheduleOptimization(task: Task): ScheduleSuggestion | null {
    const insights = this.analyzeCompletionPatterns(task);
    
    if (insights.confidence < 0.5 || !task.completionHistory || task.completionHistory.length < 10) {
      return null;
    }

    const currentFreq = task.frequency;
    const suggestedFreq = { ...currentFreq };
    let reason = '';
    let expectedImprovement = '';

    // Suggest time adjustment if consistently completing at different time
    if (Math.abs(insights.averageCompletionDelay) > 60) {
      const suggestedHour = insights.preferredTimeOfDay;
      reason = `You typically complete this task around ${suggestedHour}:00, `;
      reason += insights.averageCompletionDelay > 0 
        ? `${Math.round(insights.averageCompletionDelay / 60)} hours later than scheduled.`
        : `${Math.round(Math.abs(insights.averageCompletionDelay) / 60)} hours earlier than scheduled.`;
      expectedImprovement = 'Better alignment with your natural completion patterns';
    }

    // Suggest weekday adjustment for weekly tasks
    if (currentFreq.type === 'weekly' && insights.preferredDayOfWeek.length > 0) {
      const currentDays = currentFreq.weekdays || [];
      const preferredDays = insights.preferredDayOfWeek;
      
      if (JSON.stringify(currentDays.sort()) !== JSON.stringify(preferredDays.sort())) {
        suggestedFreq.weekdays = preferredDays;
        reason += ` Consider scheduling for ${this.formatWeekdays(preferredDays)} based on completion patterns.`;
        expectedImprovement = 'Higher completion rate on preferred days';
      }
    }

    // If no meaningful suggestions, return null
    if (!reason) {
      return null;
    }

    return {
      currentSchedule: {
        frequency: currentFreq,
        time: this.extractTimeFromDueAt(task.dueAt)
      },
      suggestedSchedule: {
        frequency: suggestedFreq,
        time: insights.preferredTimeOfDay !== undefined 
          ? `${insights.preferredTimeOfDay.toString().padStart(2, '0')}:00`
          : undefined
      },
      reason,
      confidence: insights.confidence,
      expectedImprovement
    };
  }

  /**
   * Auto-adjust schedule based on patterns (with user confirmation)
   */
  autoAdjustSchedule(task: Task, threshold: number = 0.7): boolean {
    if (!task.smartRecurrence?.autoAdjust) {
      return false;
    }

    const suggestion = this.suggestScheduleOptimization(task);
    
    if (!suggestion || suggestion.confidence < threshold) {
      return false;
    }

    // Apply the suggestion
    task.frequency = suggestion.suggestedSchedule.frequency;
    
    if (suggestion.suggestedSchedule.time) {
      const dueDate = new Date(task.dueAt);
      const [hours, minutes] = suggestion.suggestedSchedule.time.split(':').map(Number);
      dueDate.setHours(hours, minutes || 0, 0, 0);
      task.dueAt = dueDate.toISOString();
    }

    // Update learning metrics
    if (!task.learningMetrics) {
      task.learningMetrics = {
        averageDelayMinutes: 0,
        optimalHour: 0,
        consistencyScore: 0,
        lastLearningUpdate: new Date().toISOString()
      };
    }

    const insights = this.analyzeCompletionPatterns(task);
    task.learningMetrics.averageDelayMinutes = insights.averageCompletionDelay;
    task.learningMetrics.optimalHour = insights.preferredTimeOfDay;
    task.learningMetrics.consistencyScore = insights.completionConsistency;
    task.learningMetrics.lastLearningUpdate = new Date().toISOString();

    return true;
  }

  /**
   * Detect anomalies in task completion patterns
   */
  detectAnomalies(task: Task): Anomaly[] {
    const anomalies: Anomaly[] = [];
    
    if (!task.completionHistory || task.completionHistory.length < 5) {
      return anomalies;
    }

    const analyzer = new PatternAnalyzer();
    const skipPattern = analyzer.detectSkipPatterns(task);
    
    if (skipPattern.isAnomalous) {
      anomalies.push({
        type: 'consistently_skipped',
        severity: 'high',
        description: skipPattern.reason,
        affectedPeriod: {
          start: task.createdAt,
          end: new Date().toISOString()
        },
        suggestion: 'Consider adjusting the recurrence frequency or disabling this task'
      });
    }

    // Check for completion drift
    const drift = this.detectCompletionDrift(task.completionHistory);
    if (drift.isDrifting) {
      anomalies.push({
        type: 'completion_drift',
        severity: drift.severity,
        description: `Completion times are drifting ${drift.direction} by an average of ${drift.averageDriftMinutes} minutes`,
        affectedPeriod: {
          start: task.completionHistory[0].completedAt,
          end: task.completionHistory[task.completionHistory.length - 1].completedAt
        },
        suggestion: 'Consider adjusting the scheduled time to match your natural completion pattern'
      });
    }

    return anomalies;
  }

  // Private helper methods

  private getDefaultInsight(): CompletionInsight {
    return {
      averageCompletionDelay: 0,
      preferredTimeOfDay: 9,
      preferredDayOfWeek: [],
      completionConsistency: 0,
      missedTaskFrequency: 0,
      suggestedAdjustment: 'Not enough data to generate insights (need at least 10 completions)',
      confidence: 0
    };
  }

  private calculateAverageDelay(history: CompletionHistoryEntry[]): number {
    if (history.length === 0) return 0;
    
    const totalDelay = history.reduce((sum, entry) => sum + entry.delayMinutes, 0);
    return Math.round(totalDelay / history.length);
  }

  private calculateConsistencyScore(history: CompletionHistoryEntry[]): number {
    if (history.length < 2) return 0;

    // Calculate standard deviation of delays
    const avgDelay = this.calculateAverageDelay(history);
    const variance = history.reduce((sum, entry) => {
      const diff = entry.delayMinutes - avgDelay;
      return sum + (diff * diff);
    }, 0) / history.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Convert to 0-1 score (lower stdDev = higher consistency)
    // Assume stdDev > 240 minutes (4 hours) is very inconsistent
    const consistencyScore = Math.max(0, 1 - (stdDev / 240));
    
    return Math.round(consistencyScore * 100) / 100;
  }

  private generateSuggestion(
    avgDelay: number,
    preferredTime: TimePreference,
    preferredDays: number[],
    consistency: number
  ): string {
    if (consistency < 0.3) {
      return 'Completion patterns are inconsistent. Try to complete tasks at similar times.';
    }

    const suggestions: string[] = [];

    if (Math.abs(avgDelay) > 60) {
      const hours = Math.round(Math.abs(avgDelay) / 60);
      if (avgDelay > 0) {
        suggestions.push(`Consider scheduling ${hours} hour(s) later (around ${preferredTime.hour}:00)`);
      } else {
        suggestions.push(`Consider scheduling ${hours} hour(s) earlier (around ${preferredTime.hour}:00)`);
      }
    }

    if (preferredDays.length > 0 && preferredTime.confidence > 0.6) {
      suggestions.push(`Best completion rate on ${this.formatWeekdays(preferredDays)}`);
    }

    return suggestions.length > 0 
      ? suggestions.join('. ')
      : 'Maintaining good completion consistency!';
  }

  private calculateConfidence(
    sampleSize: number,
    consistencyScore: number,
    timeConfidence: number
  ): number {
    // Need at least 10 samples for reasonable confidence
    const sizeConfidence = Math.min(1, sampleSize / 30);
    
    // Weighted average
    const confidence = (
      sizeConfidence * 0.4 +
      consistencyScore * 0.3 +
      timeConfidence * 0.3
    );
    
    return Math.round(confidence * 100) / 100;
  }

  private extractTimeFromDueAt(dueAt: string): string {
    const date = new Date(dueAt);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  private formatWeekdays(days: number[]): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.map(d => dayNames[d]).join(', ');
  }

  private detectCompletionDrift(history: CompletionHistoryEntry[]): {
    isDrifting: boolean;
    direction: 'later' | 'earlier';
    averageDriftMinutes: number;
    severity: 'low' | 'medium' | 'high';
  } {
    if (history.length < 10) {
      return { isDrifting: false, direction: 'later', averageDriftMinutes: 0, severity: 'low' };
    }

    // Check if delays are trending in one direction
    const recentHistory = history.slice(-10);
    const delays = recentHistory.map(h => h.delayMinutes);
    
    // Simple linear regression to detect trend
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = delays.length;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += delays[i];
      sumXY += i * delays[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgDrift = Math.abs(slope);
    
    // If slope > 5 minutes per completion, consider it drifting
    if (avgDrift > 5) {
      const severity: 'low' | 'medium' | 'high' = 
        avgDrift > 30 ? 'high' : 
        avgDrift > 15 ? 'medium' : 
        'low';
      
      return {
        isDrifting: true,
        direction: slope > 0 ? 'later' : 'earlier',
        averageDriftMinutes: Math.round(avgDrift),
        severity
      };
    }
    
    return { isDrifting: false, direction: 'later', averageDriftMinutes: 0, severity: 'low' };
  }
}

/**
 * Pattern Analyzer - Statistical analysis of completion patterns
 */
export class PatternAnalyzer {
  /**
   * Calculate preferred completion time using weighted average
   */
  calculateOptimalTime(history: CompletionHistoryEntry[]): TimePreference {
    if (history.length === 0) {
      return { hour: 9, confidence: 0, sampleSize: 0 };
    }

    // Group completions by hour
    const hourCounts = new Map<number, number>();
    
    for (const entry of history) {
      const hour = new Date(entry.completedAt).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // Find most common hour
    let maxHour = 9;
    let maxCount = 0;
    
    for (const [hour, count] of hourCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        maxHour = hour;
      }
    }

    // Calculate confidence based on concentration
    const confidence = maxCount / history.length;
    
    return {
      hour: maxHour,
      confidence: Math.round(confidence * 100) / 100,
      sampleSize: history.length
    };
  }

  /**
   * Detect patterns using basic clustering by weekday
   */
  findWeekdayPatterns(history: CompletionHistoryEntry[]): Map<number, TimePreference> {
    const patterns = new Map<number, TimePreference>();
    
    // Group by day of week
    const dayGroups = new Map<number, CompletionHistoryEntry[]>();
    
    for (const entry of history) {
      const day = entry.dayOfWeek;
      if (!dayGroups.has(day)) {
        dayGroups.set(day, []);
      }
      dayGroups.get(day)!.push(entry);
    }

    // Analyze each day
    for (const [day, entries] of dayGroups.entries()) {
      const timePreference = this.calculateOptimalTime(entries);
      
      // Only include days with reasonable sample size
      if (entries.length >= 2) {
        patterns.set(day, timePreference);
      }
    }

    return patterns;
  }

  /**
   * Anomaly detection using standard deviation
   */
  detectSkipPatterns(task: Task): { isAnomalous: boolean; reason: string } {
    const totalExpected = (task.completionCount || 0) + (task.missCount || 0);
    const missRate = totalExpected > 0 ? (task.missCount || 0) / totalExpected : 0;

    // If missing more than 50% of tasks, flag as anomalous
    if (missRate > 0.5 && totalExpected >= 10) {
      return {
        isAnomalous: true,
        reason: `Task is skipped ${Math.round(missRate * 100)}% of the time (${task.missCount} out of ${totalExpected})`
      };
    }

    // Check for recent streak of misses
    if ((task.missCount || 0) >= 5 && task.currentStreak === 0) {
      return {
        isAnomalous: true,
        reason: 'Task has been skipped multiple times recently'
      };
    }

    return {
      isAnomalous: false,
      reason: ''
    };
  }
}

type SensitivityLevel = "conservative" | "balanced" | "aggressive";

interface PatternLearnerOptions {
  store: PatternLearnerStore;
  repository?: TaskRepositoryProvider;
  settingsProvider: () => SmartRecurrenceSettings;
}

interface PatternCandidate {
  type: SuggestionEvidence["detectedPattern"];
  interval: number;
  byDay?: string[];
  byMonthDay?: number[];
  stabilityScore: number;
  patternStrength: number;
  mode: "fixed" | "whenDone";
  rrule: string;
}

export class PatternLearner {
  private readonly store: PatternLearnerStore;
  private readonly repository?: TaskRepositoryProvider;
  private readonly settingsProvider: () => SmartRecurrenceSettings;
  private state: PatternLearnerState = { version: 1, tasks: {} };
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_COMPLETIONS = 60;
  private readonly MAX_FEEDBACK_EVENTS = 200;

  constructor(options: PatternLearnerOptions) {
    this.store = options.store;
    this.repository = options.repository;
    this.settingsProvider = options.settingsProvider;
  }

  async load(): Promise<void> {
    this.state = await this.store.load();
  }

  async clearHistory(): Promise<void> {
    this.state = { version: 1, tasks: {} };
    await this.store.clear();
  }

  recordCompletion(taskId: string, completedAtISO: string): void {
    if (!this.isEnabled()) {
      return;
    }

    const task = this.repository?.getTask(taskId);
    if (task && !this.shouldAnalyzeTask(task)) {
      return;
    }

    const history = this.getOrCreateHistory(taskId);
    const normalizedDate = this.normalizeDate(completedAtISO);
    const hasSameDay = history.completions.some((entry) => this.normalizeDate(entry) === normalizedDate);
    if (hasSameDay) {
      return;
    }

    history.completions.push(completedAtISO);
    history.completions = history.completions
      .map((entry) => new Date(entry))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
      .map((date) => date.toISOString())
      .slice(-this.MAX_COMPLETIONS);

    this.schedulePersist();
  }

  analyzeTask(taskId: string): RecurrenceSuggestion | null {
    if (!this.isEnabled()) {
      return null;
    }

    const task = this.repository?.getTask(taskId);
    if (task && !this.shouldAnalyzeTask(task)) {
      return null;
    }

    const history = this.state.tasks[taskId];
    if (!history || history.completions.length === 0) {
      return null;
    }

    const completions = this.normalizeCompletions(history.completions);
    const settings = this.settingsProvider();
    const minSampleSize = Math.max(3, settings.minSampleSize ?? 5);
    if (completions.length < minSampleSize) {
      return null;
    }

    const candidate = this.detectPattern(completions, settings);
    if (!candidate) {
      return null;
    }

    const evidence = this.buildEvidence(candidate, completions);
    const confidence = this.calculateConfidence(candidate, completions, minSampleSize, history);

    if (!this.passesThresholds(candidate, confidence, evidence, settings)) {
      return null;
    }

    const suggestion: RecurrenceSuggestion = {
      taskId,
      suggestedRRule: candidate.rrule,
      mode: candidate.mode,
      confidence,
      evidence,
      generatedAt: new Date().toISOString(),
    };

    history.lastAnalysisAt = suggestion.generatedAt;
    this.schedulePersist();

    return suggestion;
  }

  analyzeAllTasks(limit?: number): RecurrenceSuggestion[] {
    if (!this.repository) {
      return [];
    }

    const tasks = this.repository.getAllTasks();
    const suggestions: RecurrenceSuggestion[] = [];
    const allowedTasks = tasks.filter((task) => this.shouldAnalyzeTask(task));

    for (const task of allowedTasks) {
      const suggestion = this.analyzeTask(task.id);
      if (suggestion) {
        suggestions.push(suggestion);
        if (limit && suggestions.length >= limit) {
          break;
        }
      }
    }

    return suggestions;
  }

  acceptSuggestion(taskId: string, suggestionId: string): void {
    this.recordFeedback(taskId, suggestionId, true);
  }

  rejectSuggestion(taskId: string, suggestionId: string): void {
    this.recordFeedback(taskId, suggestionId, false);
  }

  getSuggestionId(suggestion: RecurrenceSuggestion): string {
    return [
      suggestion.taskId,
      suggestion.suggestedRRule,
      suggestion.mode,
    ].join("|");
  }

  buildFrequencyFromSuggestion(suggestion: RecurrenceSuggestion): Frequency | null {
    const parts = this.parseRRule(suggestion.suggestedRRule);
    if (!parts) {
      return null;
    }

    const whenDone = suggestion.mode === "whenDone";
    const dtstart = this.getRecommendedDtstart(suggestion.taskId);

    switch (parts.freq) {
      case "DAILY":
        return {
          type: "daily",
          interval: parts.interval ?? 1,
          whenDone,
          rruleString: suggestion.suggestedRRule,
          dtstart,
        };
      case "WEEKLY": {
        const weekdays = (parts.byDay ?? []).map((day) => this.mapRRuleDayToWeekday(day));
        return {
          type: "weekly",
          interval: parts.interval ?? 1,
          weekdays: weekdays.length > 0 ? weekdays : [1],
          whenDone,
          rruleString: suggestion.suggestedRRule,
          dtstart,
        };
      }
      case "MONTHLY": {
        const dayOfMonth = (parts.byMonthDay?.[0] ?? 1);
        return {
          type: "monthly",
          interval: parts.interval ?? 1,
          dayOfMonth,
          whenDone,
          rruleString: suggestion.suggestedRRule,
          dtstart,
        };
      }
      default:
        return null;
    }
  }

  getRecommendedDtstart(taskId: string): string | undefined {
    const history = this.state.tasks[taskId];
    if (!history || history.completions.length === 0) {
      return undefined;
    }
    const first = this.normalizeCompletions(history.completions)[0];
    return first?.toISOString();
  }

  private recordFeedback(taskId: string, suggestionId: string, accepted: boolean): void {
    const history = this.getOrCreateHistory(taskId);
    const suggestion = this.extractSuggestionFromId(suggestionId);
    history.feedback.push({
      suggestionId,
      accepted,
      timestamp: new Date().toISOString(),
      suggestedRRule: suggestion?.rrule ?? "",
      mode: suggestion?.mode ?? "fixed",
    });

    if (history.feedback.length > this.MAX_FEEDBACK_EVENTS) {
      history.feedback = history.feedback.slice(-this.MAX_FEEDBACK_EVENTS);
    }

    this.schedulePersist();
  }

  private getOrCreateHistory(taskId: string): TaskPatternHistory {
    if (!this.state.tasks[taskId]) {
      this.state.tasks[taskId] = {
        taskId,
        completions: [],
        feedback: [],
      };
    }
    return this.state.tasks[taskId];
  }

  private shouldAnalyzeTask(task: Task): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    if (!task.enabled) {
      return false;
    }

    const globalFilter = GlobalFilter.getInstance();
    if (!globalFilter.shouldIncludeTask(task)) {
      return false;
    }

    return true;
  }

  private isEnabled(): boolean {
    return this.settingsProvider().enabled;
  }

  private schedulePersist(): void {
    if (this.persistTimeout !== null) {
      globalThis.clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = globalThis.setTimeout(() => {
      this.persistTimeout = null;
      this.store.save(this.state).catch((error) => {
        logger.error("Failed to persist pattern learner state", error);
      });
    }, 500);
  }

  private normalizeDate(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
  }

  private normalizeCompletions(completions: string[]): Date[] {
    const seen = new Set<string>();
    const normalized: Date[] = [];

    for (const entry of completions) {
      const date = new Date(entry);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const dateKey = date.toISOString().slice(0, 10);
      if (seen.has(dateKey)) {
        continue;
      }
      seen.add(dateKey);
      normalized.push(date);
    }

    return normalized.sort((a, b) => a.getTime() - b.getTime());
  }

  private detectPattern(completions: Date[], settings: SmartRecurrenceSettings): PatternCandidate | null {
    const deltas = this.calculateDayDeltas(completions);
    if (deltas.length === 0) {
      return null;
    }

    const sensitivity = this.getSensitivity(settings);
    const daily = this.evaluateIntervalPattern({
      completions,
      expectedInterval: 1,
      pattern: "daily",
      toleranceDays: sensitivity.jitterToleranceDays,
    });
    const weekly = this.evaluateWeeklyPattern(completions, sensitivity.jitterToleranceDays);
    const monthly = this.evaluateMonthlyPattern(completions);
    const biweekly = this.evaluateIntervalPattern({
      completions,
      expectedInterval: 14,
      pattern: "custom",
      toleranceDays: sensitivity.jitterToleranceDays * 1.5,
    });

    const candidates = [daily, weekly, monthly, biweekly].filter(Boolean) as PatternCandidate[];
    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.stabilityScore - a.stabilityScore);
    return candidates[0];
  }

  private evaluateIntervalPattern(params: {
    completions: Date[];
    expectedInterval: number;
    pattern: SuggestionEvidence["detectedPattern"];
    toleranceDays: number;
  }): PatternCandidate | null {
    const { completions, expectedInterval, pattern, toleranceDays } = params;
    const deltas = this.calculateDayDeltas(completions);
    if (deltas.length === 0) {
      return null;
    }

    const deviation = this.meanAbsoluteDeviation(deltas, expectedInterval);
    const stabilityScore = this.clamp(1 - deviation / toleranceDays, 0, 1);
    if (stabilityScore < 0.6) {
      return null;
    }

    const rrule = `RRULE:FREQ=DAILY;INTERVAL=${expectedInterval}`;
    return {
      type: pattern,
      interval: expectedInterval,
      stabilityScore,
      patternStrength: stabilityScore,
      mode: "whenDone",
      rrule,
    };
  }

  private evaluateWeeklyPattern(completions: Date[], toleranceDays: number): PatternCandidate | null {
    const weekdayCounts = this.countWeekdays(completions);
    const total = completions.length;
    const sorted = Array.from(weekdayCounts.entries()).sort((a, b) => b[1] - a[1]);
    const byDay = sorted
      .filter(([, count]) => count >= 2)
      .map(([day]) => day)
      .sort((a, b) => this.dayOrder(a) - this.dayOrder(b));
    if (byDay.length === 0) {
      return null;
    }

    const patternStrength = byDay.reduce((sum, day) => sum + (weekdayCounts.get(day) || 0), 0) / total;
    const stabilityScore = this.weeklyStabilityScore(completions, byDay, toleranceDays);
    if (patternStrength < 0.75 || stabilityScore < 0.6) {
      return null;
    }

    const detectedPattern = this.isWeekdayPattern(byDay) ? "weekday" : "weekly";
    const rrule = `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=${byDay.join(",")}`;
    const mode: "fixed" | "whenDone" = detectedPattern === "weekly" || detectedPattern === "weekday" ? "fixed" : "whenDone";

    return {
      type: detectedPattern,
      interval: 1,
      byDay,
      stabilityScore,
      patternStrength,
      mode,
      rrule,
    };
  }

  private evaluateMonthlyPattern(completions: Date[]): PatternCandidate | null {
    const dayCounts = new Map<number, number>();
    for (const date of completions) {
      dayCounts.set(date.getUTCDate(), (dayCounts.get(date.getUTCDate()) || 0) + 1);
    }

    const sorted = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      return null;
    }

    const [dayOfMonth, count] = sorted[0];
    const patternStrength = count / completions.length;
    const stabilityScore = patternStrength;
    if (patternStrength < 0.8) {
      return null;
    }

    const rrule = `RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${dayOfMonth}`;
    return {
      type: "monthly",
      interval: 1,
      byMonthDay: [dayOfMonth],
      stabilityScore,
      patternStrength,
      mode: "fixed",
      rrule,
    };
  }

  private calculateConfidence(
    candidate: PatternCandidate,
    completions: Date[],
    minSampleSize: number,
    history: TaskPatternHistory
  ): number {
    const sampleSize = completions.length;
    const sizeScore = this.clamp(sampleSize / (minSampleSize + 4), 0, 1);
    const recencyScore = this.getRecencyScore(completions);
    const stabilityScore = candidate.stabilityScore;
    const patternStrength = candidate.patternStrength;
    let confidence = (
      sizeScore * 0.35 +
      stabilityScore * 0.35 +
      recencyScore * 0.2 +
      patternStrength * 0.1
    );

    confidence = this.applyFeedbackPenalty(confidence, candidate, history);

    return this.round(confidence);
  }

  private applyFeedbackPenalty(
    confidence: number,
    candidate: PatternCandidate,
    history: TaskPatternHistory
  ): number {
    if (!history.feedback || history.feedback.length === 0) {
      return confidence;
    }

    const suggestionId = this.getSuggestionId({
      taskId: history.taskId,
      suggestedRRule: candidate.rrule,
      mode: candidate.mode,
      confidence,
      evidence: {
        sampleSize: 0,
        timeSpanDays: 0,
        detectedPattern: candidate.type,
        interval: candidate.interval,
        stabilityScore: candidate.stabilityScore,
        examples: [],
      },
      generatedAt: history.lastAnalysisAt || new Date().toISOString(),
    });

    const relevant = history.feedback
      .slice()
      .reverse()
      .find((feedback) => feedback.suggestionId === suggestionId);

    if (!relevant) {
      return confidence;
    }

    const daysSince = (Date.now() - new Date(relevant.timestamp).getTime()) / 86400000;
    if (!relevant.accepted && daysSince < 30) {
      return this.clamp(confidence - 0.2, 0, 1);
    }
    if (relevant.accepted) {
      return this.clamp(confidence + 0.05, 0, 1);
    }

    return confidence;
  }

  private passesThresholds(
    candidate: PatternCandidate,
    confidence: number,
    evidence: SuggestionEvidence,
    settings: SmartRecurrenceSettings
  ): boolean {
    if (evidence.sampleSize < Math.max(5, settings.minSampleSize ?? 5)) {
      return false;
    }

    const minConfidence = Math.max(0.5, settings.minConfidence ?? 0.75);
    if (confidence < minConfidence) {
      return false;
    }

    if (candidate.type === "weekly" || candidate.type === "weekday") {
      if (evidence.timeSpanDays < 21) {
        return false;
      }
    }

    if (candidate.type === "monthly" && evidence.timeSpanDays < 60) {
      return false;
    }

    return true;
  }

  private buildEvidence(candidate: PatternCandidate, completions: Date[]): SuggestionEvidence {
    const sampleSize = completions.length;
    const timeSpanDays = this.calculateTimeSpanDays(completions);
    const examples = completions
      .slice(-6)
      .map((date) => date.toISOString().slice(0, 10));

    return {
      sampleSize,
      timeSpanDays,
      detectedPattern: candidate.type,
      interval: candidate.interval,
      byDay: candidate.byDay,
      byMonthDay: candidate.byMonthDay,
      stabilityScore: this.round(candidate.stabilityScore),
      examples,
    };
  }

  private calculateTimeSpanDays(completions: Date[]): number {
    if (completions.length < 2) {
      return 0;
    }
    const first = completions[0];
    const last = completions[completions.length - 1];
    return Math.round((last.getTime() - first.getTime()) / 86400000);
  }

  private calculateDayDeltas(completions: Date[]): number[] {
    const normalized = completions.map((date) =>
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    );
    const deltas: number[] = [];
    for (let i = 1; i < normalized.length; i++) {
      const diffDays = (normalized[i].getTime() - normalized[i - 1].getTime()) / 86400000;
      deltas.push(diffDays);
    }
    return deltas;
  }

  private meanAbsoluteDeviation(values: number[], target: number): number {
    const total = values.reduce((sum, value) => sum + Math.abs(value - target), 0);
    return total / values.length;
  }

  private countWeekdays(completions: Date[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const date of completions) {
      const day = this.mapToRRuleDay(date.getUTCDay());
      map.set(day, (map.get(day) || 0) + 1);
    }
    return map;
  }

  private weeklyStabilityScore(completions: Date[], byDay: string[], toleranceDays: number): number {
    const dayGroups = new Map<string, Date[]>();
    for (const date of completions) {
      const day = this.mapToRRuleDay(date.getUTCDay());
      if (!byDay.includes(day)) {
        continue;
      }
      if (!dayGroups.has(day)) {
        dayGroups.set(day, []);
      }
      dayGroups.get(day)!.push(date);
    }

    const deviations: number[] = [];
    for (const dates of dayGroups.values()) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < dates.length; i++) {
        const diffDays = (dates[i].getTime() - dates[i - 1].getTime()) / 86400000;
        deviations.push(Math.abs(diffDays - 7));
      }
    }

    if (deviations.length === 0) {
      return 0;
    }

    const avgDeviation = deviations.reduce((sum, value) => sum + value, 0) / deviations.length;
    return this.clamp(1 - avgDeviation / toleranceDays, 0, 1);
  }

  private isWeekdayPattern(byDay: string[]): boolean {
    const weekdays = ["MO", "TU", "WE", "TH", "FR"];
    return weekdays.every((day) => byDay.includes(day));
  }

  private mapToRRuleDay(jsDay: number): string {
    const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    return days[jsDay] ?? "MO";
  }

  private dayOrder(day: string): number {
    const order = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
    const index = order.indexOf(day);
    return index === -1 ? 0 : index;
  }

  private mapRRuleDayToWeekday(day: string): number {
    const map: Record<string, number> = {
      MO: 0,
      TU: 1,
      WE: 2,
      TH: 3,
      FR: 4,
      SA: 5,
      SU: 6,
    };
    return map[day] ?? 0;
  }

  private parseRRule(rrule: string): { freq: string; interval?: number; byDay?: string[]; byMonthDay?: number[] } | null {
    const normalized = rrule.replace(/^RRULE:/i, "");
    const parts = normalized.split(";").reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) {
        acc[key.toUpperCase()] = value.toUpperCase();
      }
      return acc;
    }, {});

    if (!parts.FREQ) {
      return null;
    }

    return {
      freq: parts.FREQ,
      interval: parts.INTERVAL ? Number(parts.INTERVAL) : undefined,
      byDay: parts.BYDAY ? parts.BYDAY.split(",") : undefined,
      byMonthDay: parts.BYMONTHDAY ? parts.BYMONTHDAY.split(",").map((value) => Number(value)) : undefined,
    };
  }

  private getRecencyScore(completions: Date[]): number {
    const last = completions[completions.length - 1];
    const daysSince = (Date.now() - last.getTime()) / 86400000;
    return this.clamp(1 - daysSince / 30, 0, 1);
  }

  private getSensitivity(settings: SmartRecurrenceSettings): { jitterToleranceDays: number } {
    const sensitivity = (settings.sensitivity || "conservative") as SensitivityLevel;
    switch (sensitivity) {
      case "aggressive":
        return { jitterToleranceDays: 0.75 };
      case "balanced":
        return { jitterToleranceDays: 0.6 };
      case "conservative":
      default:
        return { jitterToleranceDays: 0.5 };
    }
  }

  private extractSuggestionFromId(
    suggestionId: string
  ): { rrule: string; mode: "fixed" | "whenDone" } | null {
    const parts = suggestionId.split("|");
    if (parts.length < 3) {
      return null;
    }
    return {
      rrule: parts[1],
      mode: parts[2] === "whenDone" ? "whenDone" : "fixed",
    };
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
