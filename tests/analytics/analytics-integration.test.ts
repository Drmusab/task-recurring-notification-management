/**
 * Integration tests for Week 9-10 Analytics modules
 * 
 * Tests the complete analytics pipeline:
 * 1. ProductivityAnalyzer - Comprehensive productivity metrics
 * 2. TrendAnalyzer - Statistical trend detection
 * 3. AnalyticsReporter - Report generation and export
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProductivityAnalyzer } from '../../src/backend/analytics/ProductivityAnalyzer';
import { TrendAnalyzer } from '../../src/backend/analytics/TrendAnalyzer';
import { AnalyticsReporter } from '../../src/backend/analytics/AnalyticsReporter';
import type { Task } from '../../src/backend/core/models/Task';

describe('Week 9-10: Analytics Integration', () => {
    let productivityAnalyzer: ProductivityAnalyzer;
    let trendAnalyzer: TrendAnalyzer;
    let analyticsReporter: AnalyticsReporter;

    beforeEach(() => {
        productivityAnalyzer = new ProductivityAnalyzer();
        trendAnalyzer = new TrendAnalyzer();
        analyticsReporter = new AnalyticsReporter();
    });

    // Helper: Create mock task with actual Task model properties
    const createMockTask = (overrides: Partial<Task> = {}): Task => ({
        id: Math.random().toString(36).substring(2),
        name: 'Test Task',
        dueAt: new Date().toISOString(),
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    });

    describe('ProductivityAnalyzer', () => {
        it('should calculate basic productivity metrics', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-14');

            // Create completed tasks
            const tasks: Task[] = Array.from({ length: 10 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String((i % 14) + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const metrics = productivityAnalyzer.analyzeProductivity(tasks, startDate, endDate);

            expect(metrics).toBeDefined();
            expect(metrics.totalCompletions).toBeGreaterThanOrEqual(0);
            expect(metrics.completionRate).toBeGreaterThanOrEqual(0);
            expect(metrics.completionRate).toBeLessThanOrEqual(1);
            expect(metrics.productivityScore).toBeGreaterThanOrEqual(0);
            expect(metrics.productivityScore).toBeLessThanOrEqual(100);
        });

        it('should generate productivity insights', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-14');

            const tasks: Task[] = Array.from({ length: 15 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String((i % 14) + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const insights = productivityAnalyzer.generateInsights(tasks, startDate, endDate);

            expect(insights).toBeDefined();
            expect(insights.strengths).toBeInstanceOf(Array);
            expect(insights.weaknesses).toBeInstanceOf(Array);
            expect(insights.recommendations).toBeInstanceOf(Array);
        });

        it('should handle empty task list gracefully', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-14');

            const metrics = productivityAnalyzer.analyzeProductivity([], startDate, endDate);

            expect(metrics.totalCompletions).toBe(0);
            expect(metrics.completionRate).toBe(0);
            expect(metrics.productivityScore).toBe(0);
        });
    });

    describe('TrendAnalyzer', () => {
        it('should detect completion rate trends', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-14');

            const tasks: Task[] = Array.from({ length: 20 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String((i % 14) + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const trend = trendAnalyzer.analyzeCompletionRateTrend(tasks, startDate, endDate);

            expect(trend).toBeDefined();
            expect(trend.direction).toMatch(/increasing|decreasing|stable|volatile/);
            expect(trend.confidence).toBeGreaterThanOrEqual(0);
            expect(trend.confidence).toBeLessThanOrEqual(1);
            expect(trend.dataPoints.length).toBeGreaterThan(0);
        });

        it('should detect anomalies in task completions', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-14');

            // Normal completion pattern
            const tasks: Task[] = Array.from({ length: 10}, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const anomalies = trendAnalyzer.detectAnomalies(tasks, startDate, endDate);

            expect(anomalies).toBeInstanceOf(Array);
            // Anomalies may or may not be present depending on pattern
        });

        it('should generate comprehensive trend reports', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-14');

            const tasks: Task[] = Array.from({ length: 14 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const metricsHistory = Array.from({ length: 3 }, (_, i) => {
                const periodStart = new Date(startDate);
                periodStart.setDate(periodStart.getDate() + i * 5);
                const periodEnd = new Date(periodStart);
                periodEnd.setDate(periodEnd.getDate() + 5);
                return productivityAnalyzer.analyzeProductivity(tasks, periodStart, periodEnd);
            });

            const report = trendAnalyzer.generateTrendReport(tasks, metricsHistory, startDate, endDate);

            expect(report).toBeDefined();
            expect(report.completionRate).toBeDefined();
            expect(report.tasksPerDay).toBeDefined();
            expect(report.productivityScore).toBeDefined();
            expect(report.overallTrend).toMatch(/improving|declining|stable/);
            expect(report.insights).toBeInstanceOf(Array);
        });
    });

    describe('AnalyticsReporter', () => {
        it('should generate complete analytics report', () => {
            const tasks: Task[] = Array.from({ length: 20 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                    priority: i % 3 === 0 ? 'high' : 'medium',
                })
            );

            const report = analyticsReporter.generateReport(tasks, 'month');

            expect(report).toBeDefined();
            expect(report.metadata).toBeDefined();
            expect(report.metadata.taskCount).toBe(tasks.length);
            expect(report.productivity).toBeDefined();
            expect(report.insights).toBeDefined();
            expect(report.trends).toBeDefined();
            expect(report.summary).toBeDefined();
            expect(report.summary.highlights).toBeInstanceOf(Array);
            expect(report.summary.recommendations).toBeInstanceOf(Array);
        });

        it('should export report to markdown format', () => {
            const tasks: Task[] = Array.from({ length: 10 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const report = analyticsReporter.generateReport(tasks, 'week');
            const exportData = analyticsReporter.exportReport(report, 'markdown');

            expect(exportData).toBeDefined();
            expect(exportData.format).toBe('markdown');
            expect(exportData.content).toContain('# Productivity Report');
            expect(exportData.content).toContain('## Summary');
            expect(exportData.filename).toContain('.md');
        });

        it('should export report to JSON format', () => {
            const tasks: Task[] = Array.from({ length: 10 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const report = analyticsReporter.generateReport(tasks, 'week');
            const exportData = analyticsReporter.exportReport(report, 'json');

            expect(exportData).toBeDefined();
            expect(exportData.format).toBe('json');
            expect(exportData.content).toBeDefined();
            expect(() => JSON.parse(exportData.content)).not.toThrow();
            expect(exportData.filename).toContain('.json');
        });

        it('should export report to CSV format', () => {
            const tasks: Task[] = Array.from({ length: 10 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const report = analyticsReporter.generateReport(tasks, 'week');
            const exportData = analyticsReporter.exportReport(report, 'csv');

            expect(exportData).toBeDefined();
            expect(exportData.format).toBe('csv');
            expect(exportData.content).toContain('Metric,Value');
            expect(exportData.filename).toContain('.csv');
        });

        it('should export report to HTML format', () => {
            const tasks: Task[] = Array.from({ length: 10 }, (_, i) =>
                createMockTask({
                    doneAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`).toISOString(),
                    status: 'done',
                })
            );

            const report = analyticsReporter.generateReport(tasks, 'week');
            const exportData = analyticsReporter.exportReport(report, 'html');

            expect(exportData).toBeDefined();
            expect(exportData.format).toBe('html');
            expect(exportData.content).toContain('<!DOCTYPE html>');
            expect(exportData.content).toContain('<body>');
            expect(exportData.filename).toContain('.html');
        });

        it('should generate dashboard summary', () => {
            const tasks: Task[] = Array.from({ length: 30 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (30 - i));
                return createMockTask({
                    doneAt: date.toISOString(),
                    status: 'done',
                });
            });

            const dashboard = analyticsReporter.generateDashboardSummary(tasks);

            expect(dashboard).toBeDefined();
            expect(dashboard.todayScore).toBeGreaterThanOrEqual(0);
            expect(dashboard.todayScore).toBeLessThanOrEqual(100);
            expect(dashboard.weekScore).toBeGreaterThanOrEqual(0);
            expect(dashboard.monthScore).toBeGreaterThanOrEqual(0);
            expect(dashboard.streakDays).toBeGreaterThanOrEqual(0);
            expect(dashboard.topInsight).toBeDefined();
            expect(dashboard.quickStats).toBeInstanceOf(Array);
            expect(dashboard.quickStats.length).toBeGreaterThan(0);
        });
    });

    describe('Full Pipeline Integration', () => {
        it('should process complete analytics workflow', () => {
            // Create realistic task dataset
            const tasks: Task[] = [];
            const baseDate = new Date('2024-01-01');

            for (let day = 0; day < 30; day++) {
                const date = new Date(baseDate);
                date.setDate(date.getDate() + day);

                // Variable completions per day (realistic pattern)
                const completionsToday = Math.floor(Math.random() * 5) + 1;

                for (let i = 0; i < completionsToday; i++) {
                    tasks.push(
                        createMockTask({
                            dueAt: date.toISOString(),
                            doneAt: new Date(date.getTime() + Math.random() * 86400000).toISOString(),
                            status: 'done',
                            priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as any,
                            tags: [`tag${Math.floor(Math.random() * 3)}`],
                        })
                    );
                }
            }

            // Step 1: Analyze productivity
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-30');
            const productivity = productivityAnalyzer.analyzeProductivity(tasks, startDate, endDate);

            expect(productivity.productivityScore).toBeGreaterThan(0);

            // Step 2: Generate insights
            const insights = productivityAnalyzer.generateInsights(tasks, startDate, endDate);

            expect(insights.strengths.length + insights.weaknesses.length).toBeGreaterThan(0);

            // Step 3: Analyze trends
            const metricsHistory = [productivity]; // Would be multiple periods in real usage
            const trendReport = trendAnalyzer.generateTrendReport(tasks, metricsHistory, startDate, endDate);

            expect(trendReport.overallTrend).toBeDefined();

            // Step 4: Generate complete report
            const finalReport = analyticsReporter.generateReport(tasks, 'month');

            expect(finalReport.metadata.taskCount).toBe(tasks.length);
            expect(finalReport.productivity.productivityScore).toBe(productivity.productivityScore);
            expect(finalReport.insights).toEqual(insights);

            // Step 5: Export to all formats
            const markdownExport = analyticsReporter.exportReport(finalReport, 'markdown');
            const jsonExport = analyticsReporter.exportReport(finalReport, 'json');
            const csvExport = analyticsReporter.exportReport(finalReport, 'csv');
            const htmlExport = analyticsReporter.exportReport(finalReport, 'html');

            expect(markdownExport.content).toContain('Productivity Report');
            expect(() => JSON.parse(jsonExport.content)).not.toThrow();
            expect(csvExport.content).toContain('Metric,Value');
            expect(htmlExport.content).toContain('<!DOCTYPE html>');
        });
    });
});
