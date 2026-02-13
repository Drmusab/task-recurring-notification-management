/**
 * Predictive Engine
 * 
 * Machine learning models for predicting task completion probability.
 * Uses historical completion data to forecast future behavior.
 * 
 * Models:
 * 1. Time-of-Day Model: Predicts completion probability based on hour
 * 2. Day-of-Week Model: Predicts completion probability based on weekday
 * 3. Consistency Model: Predicts based on historical streak patterns
 * 4. Delay Pattern Model: Predicts based on historical lateness
 * 5. Ensemble Model: Combines all models with weighted average
 */

import type { Task, CompletionHistoryEntry } from '@backend/core/models/Task';

export interface CompletionProbability {
  /** Overall completion probability (0-1) */
  probability: number;
  
  /** Confidence in prediction (0-1) */
  confidence: number;
  
  /** Model breakdown */
  modelContributions: {
    timeOfDay: number;
    dayOfWeek: number;
    consistency: number;
    delayPattern: number;
  };
  
  /** Human-readable explanation */
  explanation: string;
  
  /** Recommended action */
  recommendation: string;
}

export interface PredictiveInsights {
  /** Best time to complete this task (0-23) */
  optimalHour: number;
  
  /** Best day to complete this task (0-6, 0=Sunday) */
  optimalDayOfWeek: number;
  
  /** Expected completion time (minutes) */
  expectedDuration: number;
  
  /** Likelihood of being late (0-1) */
  latenessRisk: number;
  
  /** Consistency score (0-100) */
  consistencyScore: number;
  
  /** Pattern strength (0-1) - how reliable are these predictions */
  patternStrength: number;
}

/**
 * Predictive Analytics Engine
 */
export class PredictiveEngine {
  private readonly MIN_DATA_POINTS = 5;
  private readonly CONFIDENCE_DECAY = 0.95; // Older data less reliable
  
  /**
   * Calculate completion probability for task at current time
   */
  calculateCompletionProbability(task: Task, targetDate: Date = new Date()): CompletionProbability {
    const history = task.completionHistory || [];
    
    // Require minimum data points
    if (history.length < this.MIN_DATA_POINTS) {
      return {
        probability: 0.5,
        confidence: 0.1,
        modelContributions: {
          timeOfDay: 0.5,
          dayOfWeek: 0.5,
          consistency: 0.5,
          delayPattern: 0.5,
        },
        explanation: `Insufficient data (${history.length}/${this.MIN_DATA_POINTS} completions needed)`,
        recommendation: 'Complete this task a few more times to enable predictions',
      };
    }
    
    // Calculate individual model predictions
    const timeOfDayProb = this.predictByTimeOfDay(history, targetDate);
    const dayOfWeekProb = this.predictByDayOfWeek(history, targetDate);
    const consistencyProb = this.predictByConsistency(task);
    const delayPatternProb = this.predictByDelayPattern(history);
    
    // Ensemble: Weighted average (time-of-day most predictive)
    const weights = {
      timeOfDay: 0.35,
      dayOfWeek: 0.25,
      consistency: 0.25,
      delayPattern: 0.15,
    };
    
    const probability = 
      timeOfDayProb * weights.timeOfDay +
      dayOfWeekProb * weights.dayOfWeek +
      consistencyProb * weights.consistency +
      delayPatternProb * weights.delayPattern;
    
    // Calculate confidence based on data volume and recency
    const confidence = this.calculateConfidence(history);
    
    // Generate explanation
    const explanation = this.generateExplanation(probability, {
      timeOfDay: timeOfDayProb,
      dayOfWeek: dayOfWeekProb,
      consistency: consistencyProb,
      delayPattern: delayPatternProb,
    }, targetDate);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(probability, task, targetDate);
    
    return {
      probability,
      confidence,
      modelContributions: {
        timeOfDay: timeOfDayProb,
        dayOfWeek: dayOfWeekProb,
        consistency: consistencyProb,
        delayPattern: delayPatternProb,
      },
      explanation,
      recommendation,
    };
  }
  
  /**
   * Generate predictive insights for task
   */
  generateInsights(task: Task): PredictiveInsights | null {
    const history = task.completionHistory || [];
    
    if (history.length < this.MIN_DATA_POINTS) {
      return null;
    }
    
    // Find optimal hour (highest completion rate)
    const hourCounts = new Array(24).fill(0);
    const hourCompletions = new Array(24).fill(0);
    
    history.forEach(entry => {
      if (entry.context?.hourOfDay !== undefined) {
        const hour = entry.context.hourOfDay;
        hourCounts[hour]++;
        if (!entry.context.wasOverdue) {
          hourCompletions[hour]++;
        }
      }
    });
    
    let optimalHour = 9; // Default to 9 AM
    let bestHourRate = 0;
    hourCounts.forEach((count, hour) => {
      if (count > 0) {
        const rate = hourCompletions[hour] / count;
        if (rate > bestHourRate) {
          bestHourRate = rate;
          optimalHour = hour;
        }
      }
    });
    
    // Find optimal day of week
    const dayOfWeekCounts = new Array(7).fill(0);
    const dayOfWeekCompletions = new Array(7).fill(0);
    
    history.forEach(entry => {
      if (entry.context?.dayOfWeek !== undefined) {
        const day = entry.context.dayOfWeek;
        dayOfWeekCounts[day]++;
        if (!entry.context.wasOverdue) {
          dayOfWeekCompletions[day]++;
        }
      }
    });
    
    let optimalDayOfWeek = 1; // Default to Monday
    let bestDayRate = 0;
    dayOfWeekCounts.forEach((count, day) => {
      if (count > 0) {
        const rate = dayOfWeekCompletions[day] / count;
        if (rate > bestDayRate) {
          bestDayRate = rate;
          optimalDayOfWeek = day;
        }
      }
    });
    
    // Calculate expected duration
    const durationsWithData = history.filter(e => e.durationMinutes !== undefined);
    const expectedDuration = durationsWithData.length > 0
      ? durationsWithData.reduce((sum, e) => sum + (e.durationMinutes || 0), 0) / durationsWithData.length
      : 30; // Default 30 minutes
    
    // Calculate lateness risk
    const overdueCount = history.filter(e => e.context?.wasOverdue).length;
    const latenessRisk = overdueCount / history.length;
    
    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(task);
    
    // Calculate pattern strength (higher with more data, more consistent patterns)
    const dataStrength = Math.min(history.length / 30, 1.0); // Max out at 30 completions
    const patternStrength = dataStrength * (consistencyScore / 100);
    
    return {
      optimalHour,
      optimalDayOfWeek,
      expectedDuration: Math.round(expectedDuration),
      latenessRisk,
      consistencyScore,
      patternStrength,
    };
  }
  
  /**
   * Predict completion probability based on time of day
   */
  private predictByTimeOfDay(history: CompletionHistoryEntry[], targetDate: Date): number {
    const targetHour = targetDate.getHours();
    
    // Count completions by hour
    const hourCompletions = new Map<number, number>();
    const hourTotal = new Map<number, number>();
    
    history.forEach((entry, index) => {
      if (entry.context?.hourOfDay !== undefined) {
        const hour = entry.context.hourOfDay;
        const isOnTime = !entry.context.wasOverdue;
        
        // Apply recency decay
        const age = history.length - index;
        const weight = Math.pow(this.CONFIDENCE_DECAY, age);
        
        hourTotal.set(hour, (hourTotal.get(hour) || 0) + weight);
        if (isOnTime) {
          hourCompletions.set(hour, (hourCompletions.get(hour) || 0) + weight);
        }
      }
    });
    
    // If we have data for this hour, use it
    if (hourTotal.has(targetHour) && hourTotal.get(targetHour)! > 0) {
      return (hourCompletions.get(targetHour) || 0) / hourTotal.get(targetHour)!;
    }
    
    // Otherwise, find similar hours (±2 hours)
    let similarCompletions = 0;
    let similarTotal = 0;
    
    for (let offset = -2; offset <= 2; offset++) {
      const hour = (targetHour + offset + 24) % 24;
      similarCompletions += hourCompletions.get(hour) || 0;
      similarTotal += hourTotal.get(hour) || 0;
    }
    
    return similarTotal > 0 ? similarCompletions / similarTotal : 0.5;
  }
  
  /**
   * Predict completion probability based on day of week
   */
  private predictByDayOfWeek(history: CompletionHistoryEntry[], targetDate: Date): number {
    const targetDay = targetDate.getDay(); // 0 = Sunday
    
    const dayCompletions = new Map<number, number>();
    const dayTotal = new Map<number, number>();
    
    history.forEach((entry, index) => {
      if (entry.context?.dayOfWeek !== undefined) {
        const day = entry.context.dayOfWeek;
        const isOnTime = !entry.context.wasOverdue;
        
        // Apply recency decay
        const age = history.length - index;
        const weight = Math.pow(this.CONFIDENCE_DECAY, age);
        
        dayTotal.set(day, (dayTotal.get(day) || 0) + weight);
        if (isOnTime) {
          dayCompletions.set(day, (dayCompletions.get(day) || 0) + weight);
        }
      }
    });
    
    // Use data for this day if available
    if (dayTotal.has(targetDay) && dayTotal.get(targetDay)! > 0) {
      return (dayCompletions.get(targetDay) || 0) / dayTotal.get(targetDay)!;
    }
    
    // Weekday vs weekend patterns
    const isWeekend = targetDay === 0 || targetDay === 6;
    let similarCompletions = 0;
    let similarTotal = 0;
    
    for (let day = 0; day < 7; day++) {
      const dayIsWeekend = day === 0 || day === 6;
      if (dayIsWeekend === isWeekend) {
        similarCompletions += dayCompletions.get(day) || 0;
        similarTotal += dayTotal.get(day) || 0;
      }
    }
    
    return similarTotal > 0 ? similarCompletions / similarTotal : 0.5;
  }
  
  /**
   * Predict based on consistency/streak patterns
   */
  private predictByConsistency(task: Task): number {
    const currentStreak = task.currentStreak || 0;
    const bestStreak = task.bestStreak || 0;
    
    // No streak data
    if (bestStreak === 0) return 0.5;
    
    // Currently on a streak - higher probability
    if (currentStreak > 0) {
      const streakRatio = currentStreak / bestStreak;
      return 0.5 + (0.3 * streakRatio); // 50-80% based on streak quality
    }
    
    // Broke a streak - lower probability
    return 0.4;
  }
  
  /**
   * Predict based on delay patterns
   */
  private predictByDelayPattern(history: CompletionHistoryEntry[]): number {
    const delays = history
      .filter(e => e.delayMinutes !== undefined)
      .map(e => e.delayMinutes!);
    
    if (delays.length === 0) return 0.5;
    
    // Calculate average delay
    const avgDelay = delays.reduce((sum, d) => sum + d, 0) / delays.length;
    
    // Negative delay = early, positive = late
    if (avgDelay < -30) return 0.8; // Typically early
    if (avgDelay < 0) return 0.7;   // Slightly early
    if (avgDelay < 30) return 0.6;  // On time ±30 min
    if (avgDelay < 120) return 0.5; // Slightly late
    if (avgDelay < 360) return 0.4; // Often late
    return 0.3; // Chronically late
  }
  
  /**
   * Calculate confidence in predictions based on data quality
   */
  private calculateConfidence(history: CompletionHistoryEntry[]): number {
    const dataPoints = history.length;
    
    // Volume confidence (0-0.5)
    const volumeConfidence = Math.min(dataPoints / 30, 0.5); // Max at 30 completions
    
    // Recency confidence (0-0.3)
    const recentCount = history.slice(-10).length;
    const recencyConfidence = (recentCount / 10) * 0.3;
    
    // Context completeness confidence (0-0.2)
    const withContext = history.filter(e => e.context !== undefined).length;
    const contexConfidence = (withContext / dataPoints) * 0.2;
    
    return volumeConfidence + recencyConfidence + contexConfidence;
  }
  
  /**
   * Calculate consistency score (0-100)
   */
  private calculateConsistencyScore(task: Task): number {
    const history = task.completionHistory || [];
    if (history.length < 2) return 50;
    
    // Calculate variance in delay times
    const delays = history
      .filter(e => e.delayMinutes !== undefined)
      .map(e => e.delayMinutes!);
    
    if (delays.length < 2) return 50;
    
    const avgDelay = delays.reduce((sum, d) => sum + d, 0) / delays.length;
    const variance = delays.reduce((sum, d) => sum + Math.pow(d - avgDelay, 2), 0) / delays.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = more consistent
    // Map 0-180 minutes std dev to 100-0 score
    const score = Math.max(0, 100 - (stdDev / 180) * 100);
    
    return Math.round(score);
  }
  
  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    probability: number,
    contributions: { timeOfDay: number; dayOfWeek: number; consistency: number; delayPattern: number },
    targetDate: Date
  ): string {
    const hour = targetDate.getHours();
    const day = targetDate.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const percent = Math.round(probability * 100);
    
    if (probability >= 0.7) {
      return `High completion likelihood (${percent}%). You usually complete this task around ${hour}:00 on ${dayNames[day]}s.`;
    } else if (probability >= 0.5) {
      return `Moderate completion likelihood (${percent}%). Historical patterns suggest mixed success at this time.`;
    } else {
      return `Low completion likelihood (${percent}%). This time/day has lower success rates in your history.`;
    }
  }
  
  /**
   * Generate actionable recommendation
   */
  private generateRecommendation(probability: number, task: Task, targetDate: Date): string {
    const insights = this.generateInsights(task);
    
    if (!insights) {
      return 'Complete this task a few more times to receive personalized recommendations.';
    }
    
    const hour = targetDate.getHours();
    const day = targetDate.getDay();
    
    // If current time is good, encourage completion
    if (probability >= 0.7) {
      return '✅ Great time to complete this task based on your patterns!';
    }
    
    // Suggest better time
    if (Math.abs(hour - insights.optimalHour) > 2) {
      const ampm = insights.optimalHour >= 12 ? 'PM' : 'AM';
      const displayHour = insights.optimalHour > 12 ? insights.optimalHour - 12 : insights.optimalHour;
      return `💡 Try completing around ${displayHour}:00 ${ampm} for better success rate.`;
    }
    
    // Suggest better day
    if (day !== insights.optimalDayOfWeek) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `💡 You have higher success rates on ${dayNames[insights.optimalDayOfWeek]}s.`;
    }
    
    // Generic encouragement
    return '⏰ Set aside time now to maintain your streak!';
  }
}

/**
 * Singleton instance
 */
export const predictiveEngine = new PredictiveEngine();
