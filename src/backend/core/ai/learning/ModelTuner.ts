/**
 * Model Tuner - Continuous learning and weight optimization
 */

/**
 * Prediction outcome record
 */
export interface PredictionOutcome {
  taskId: string;
  scheduledTime: { hour: number; dayOfWeek: number };
  actualCompletionTime: { hour: number; dayOfWeek: number };
  wasSuccessful: boolean;
  timestamp: string;
}

/**
 * Model Tuner tracks prediction accuracy and adjusts weights
 */
export class ModelTuner {
  private outcomes: PredictionOutcome[] = [];
  private readonly MAX_OUTCOMES = 1000;

  /**
   * Record outcome of a prediction
   */
  async recordOutcome(
    taskId: string,
    scheduledTime: { hour: number; dayOfWeek: number },
    actualCompletionTime: { hour: number; dayOfWeek: number },
    wasSuccessful: boolean
  ): Promise<void> {
    const outcome: PredictionOutcome = {
      taskId,
      scheduledTime,
      actualCompletionTime,
      wasSuccessful,
      timestamp: new Date().toISOString()
    };

    this.outcomes.push(outcome);

    // Keep only recent outcomes
    if (this.outcomes.length > this.MAX_OUTCOMES) {
      this.outcomes = this.outcomes.slice(-this.MAX_OUTCOMES);
    }
  }

  /**
   * Calculate prediction accuracy
   */
  getAccuracy(): number {
    if (this.outcomes.length === 0) return 0;

    const successfulPredictions = this.outcomes.filter(o => o.wasSuccessful).length;
    return successfulPredictions / this.outcomes.length;
  }

  /**
   * Get accuracy for specific time ranges
   */
  getAccuracyByTimeOfDay(): Map<string, number> {
    const timeRanges = new Map<string, { success: number; total: number }>();

    for (const outcome of this.outcomes) {
      const hour = outcome.scheduledTime.hour;
      let range: string;

      if (hour >= 6 && hour < 12) {
        range = 'morning';
      } else if (hour >= 12 && hour < 17) {
        range = 'afternoon';
      } else if (hour >= 17 && hour < 22) {
        range = 'evening';
      } else {
        range = 'night';
      }

      if (!timeRanges.has(range)) {
        timeRanges.set(range, { success: 0, total: 0 });
      }

      const stats = timeRanges.get(range)!;
      stats.total++;
      if (outcome.wasSuccessful) {
        stats.success++;
      }
    }

    const accuracyMap = new Map<string, number>();
    for (const [range, stats] of timeRanges.entries()) {
      accuracyMap.set(range, stats.success / stats.total);
    }

    return accuracyMap;
  }

  /**
   * Optimize scoring weights based on prediction accuracy
   * (Simplified heuristic approach)
   */
  async optimizeWeights(): Promise<{
    historicalSuccess: number;
    workloadBalance: number;
    taskDensity: number;
    userPreference: number;
    energyLevel: number;
    contextSwitching: number;
  }> {
    // Start with default weights
    const weights = {
      historicalSuccess: 0.35,
      workloadBalance: 0.20,
      taskDensity: 0.15,
      userPreference: 0.15,
      energyLevel: 0.10,
      contextSwitching: 0.05,
    };

    const accuracy = this.getAccuracy();

    // If accuracy is low, increase historical success weight
    if (accuracy < 0.7) {
      weights.historicalSuccess = 0.45;
      weights.workloadBalance = 0.15;
      weights.userPreference = 0.20;
      weights.energyLevel = 0.10;
      weights.taskDensity = 0.05;
      weights.contextSwitching = 0.05;
    }

    // If accuracy is high, balance weights more evenly
    if (accuracy > 0.85) {
      weights.historicalSuccess = 0.30;
      weights.workloadBalance = 0.20;
      weights.taskDensity = 0.15;
      weights.userPreference = 0.15;
      weights.energyLevel = 0.12;
      weights.contextSwitching = 0.08;
    }

    return weights;
  }

  /**
   * Get learning statistics
   */
  getStats(): {
    totalOutcomes: number;
    accuracy: number;
    timeRangeAccuracy: Map<string, number>;
  } {
    return {
      totalOutcomes: this.outcomes.length,
      accuracy: this.getAccuracy(),
      timeRangeAccuracy: this.getAccuracyByTimeOfDay()
    };
  }

  /**
   * Clear all recorded outcomes
   */
  reset(): void {
    this.outcomes = [];
  }
}
