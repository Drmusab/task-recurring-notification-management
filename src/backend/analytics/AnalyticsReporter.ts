import type { Task } from '../core/models/Task';
import { ProductivityAnalyzer, type ProductivityMetrics, type ProductivityComparison, type ProductivityInsights } from './ProductivityAnalyzer';
import { TrendAnalyzer, type TrendReport, type TrendAnalysis, type TrendDataPoint } from './TrendAnalyzer';

/**
 * Report format types
 */
export type ReportFormat = 'markdown' | 'html' | 'json' | 'csv';

/**
 * Report period types
 */
export type ReportPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/**
 * Complete analytics report
 */
export interface AnalyticsReport {
    metadata: {
        generatedAt: Date;
        period: { start: Date; end: Date };
        taskCount: number;
        reportType: ReportPeriod;
    };
    productivity: ProductivityMetrics;
    comparison?: ProductivityComparison;
    insights: ProductivityInsights;
    trends: TrendReport;
    summary: {
        highlights: string[];
        concerns: string[];
        recommendations: string[];
    };
}

/**
 * Export data structure
 */
export interface ExportData {
    format: ReportFormat;
    content: string;
    filename: string;
}

/**
 * Configuration for analytics reporter
 */
export interface AnalyticsReporterConfig {
    includeCharts: boolean;
    includeRawData: boolean;
    comparisonEnabled: boolean;
}

/**
 * Generates comprehensive analytics reports with multiple export formats
 */
export class AnalyticsReporter {
    private productivityAnalyzer: ProductivityAnalyzer;
    private trendAnalyzer: TrendAnalyzer;
    private config: AnalyticsReporterConfig;

    constructor(config?: Partial<AnalyticsReporterConfig>) {
        this.config = {
            includeCharts: true,
            includeRawData: false,
            comparisonEnabled: true,
            ...config,
        };

        this.productivityAnalyzer = new ProductivityAnalyzer();
        this.trendAnalyzer = new TrendAnalyzer();
    }

    /**
     * Generate complete analytics report for a period
     */
    generateReport(
        tasks: Task[],
        period: ReportPeriod,
        customStart?: Date,
        customEnd?: Date
    ): AnalyticsReport {
        const { start, end } = this.calculatePeriodDates(period, customStart, customEnd);

        // Productivity analysis
        const productivity = this.productivityAnalyzer.analyzeProductivity(tasks, start, end);

        // Comparison with previous period
        const comparison = this.config.comparisonEnabled
            ? this.productivityAnalyzer.compareProductivity(tasks, start, end)
            : undefined;

        // Insights
        const insights = this.productivityAnalyzer.generateInsights(tasks, start, end);

        // Trend analysis
        const metricsHistory = this.buildMetricsHistory(tasks, start, end);
        const trends = this.trendAnalyzer.generateTrendReport(
            tasks,
            metricsHistory,
            start,
            end
        );

        // Summary
        const summary = this.generateSummary(productivity, insights, trends);

        return {
            metadata: {
                generatedAt: new Date(),
                period: { start, end },
                taskCount: tasks.length,
                reportType: period,
            },
            productivity,
            comparison,
            insights,
            trends,
            summary,
        };
    }

    /**
     * Export report to specified format
     */
    exportReport(report: AnalyticsReport, format: ReportFormat): ExportData {
        switch (format) {
            case 'markdown':
                return this.exportMarkdown(report);
            case 'html':
                return this.exportHTML(report);
            case 'json':
                return this.exportJSON(report);
            case 'csv':
                return this.exportCSV(report);
        }
    }

    /**
     * Generate quick summary for dashboard
     */
    generateDashboardSummary(tasks: Task[]): {
        todayScore: number;
        weekScore: number;
        monthScore: number;
        streakDays: number;
        topInsight: string;
        quickStats: { label: string; value: string; trend?: 'up' | 'down' | 'stable' }[];
    } {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(today);
        monthStart.setDate(monthStart.getDate() - 30);

        const weekMetrics = this.productivityAnalyzer.analyzeProductivity(
            tasks,
            weekStart,
            today
        );
        const monthMetrics = this.productivityAnalyzer.analyzeProductivity(
            tasks,
            monthStart,
            today
        );

        // Get comparison to determine trends
        const weekComparison = this.productivityAnalyzer.compareProductivity(
            tasks,
            weekStart,
            today
        );

        const topInsight =
            weekComparison.insights[0] || 'Keep up the great work!';

        const quickStats = [
            {
                label: 'Completion Rate',
                value: `${(weekMetrics.completionRate * 100).toFixed(0)}%`,
                trend: this.getTrendIndicator(weekComparison.changes.completionRate),
            },
            {
                label: 'Tasks/Day',
                value: weekMetrics.averageCompletionsPerDay.toFixed(1),
                trend: this.getTrendIndicator(weekComparison.changes.averageCompletionsPerDay),
            },
            {
                label: 'Current Streak',
                value: `${weekMetrics.currentStreak} days`,
            },
            {
                label: 'Focus Score',
                value: `${weekMetrics.focusScore.toFixed(0)}/100`,
                trend: this.getTrendIndicator(weekComparison.changes.focusScore),
            },
        ];

        return {
            todayScore: weekMetrics.productivityScore,
            weekScore: weekMetrics.productivityScore,
            monthScore: monthMetrics.productivityScore,
            streakDays: weekMetrics.currentStreak,
            topInsight,
            quickStats,
        };
    }

    // Private helper methods

    private calculatePeriodDates(
        period: ReportPeriod,
        customStart?: Date,
        customEnd?: Date
    ): { start: Date; end: Date } {
        const end = customEnd || new Date();
        let start: Date;

        switch (period) {
            case 'day':
                start = new Date(end);
                start.setHours(0, 0, 0, 0);
                break;
            case 'week':
                start = new Date(end);
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start = new Date(end);
                start.setDate(start.getDate() - 30);
                break;
            case 'quarter':
                start = new Date(end);
                start.setDate(start.getDate() - 90);
                break;
            case 'year':
                start = new Date(end);
                start.setDate(start.getDate() - 365);
                break;
            case 'custom':
                start = customStart || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
        }

        return { start, end };
    }

    private buildMetricsHistory(
        tasks: Task[],
        start: Date,
        end: Date
    ): ProductivityMetrics[] {
        const history: ProductivityMetrics[] = [];
        const weekMs = 7 * 24 * 60 * 60 * 1000;

        let current = new Date(start);
        while (current < end) {
            const weekEnd = new Date(Math.min(current.getTime() + weekMs, end.getTime()));
            const metrics = this.productivityAnalyzer.analyzeProductivity(
                tasks,
                current,
                weekEnd
            );
            history.push(metrics);
            current = weekEnd;
        }

        return history;
    }

    private generateSummary(
        productivity: ProductivityMetrics,
        insights: ProductivityInsights,
        trends: TrendReport
    ): {
        highlights: string[];
        concerns: string[];
        recommendations: string[];
    } {
        const highlights: string[] = [];
        const concerns: string[] = [];

        // Add productivity highlights
        if (productivity.productivityScore >= 80) {
            highlights.push(`Excellent productivity score: ${productivity.productivityScore.toFixed(0)}/100`);
        }

        if (productivity.currentStreak >= 7) {
            highlights.push(`Strong ${productivity.currentStreak}-day completion streak`);
        }

        // Add trend highlights
        if (trends.overallTrend === 'improving') {
            highlights.push('Overall trend is improving');
        }

        // Add strengths as highlights
        highlights.push(...insights.strengths.slice(0, 3));

        // Add concerns
        if (productivity.productivityScore < 60) {
            concerns.push(`Productivity score needs attention: ${productivity.productivityScore.toFixed(0)}/100`);
        }

        if (trends.overallTrend === 'declining') {
            concerns.push('Overall trend is declining');
        }

        // Add weaknesses as concerns
        concerns.push(...insights.weaknesses);

        return {
            highlights,
            concerns,
            recommendations: insights.recommendations,
        };
    }

    private getTrendIndicator(changePercent: number): 'up' | 'down' | 'stable' {
        if (changePercent > 5) return 'up';
        if (changePercent < -5) return 'down';
        return 'stable';
    }

    // Export format implementations

    private exportMarkdown(report: AnalyticsReport): ExportData {
        const { metadata, productivity, comparison, insights, trends, summary } = report;

        let md = `# Productivity Report\n\n`;
        md += `**Period:** ${metadata.period.start.toLocaleDateString()} - ${metadata.period.end.toLocaleDateString()}\n`;
        md += `**Generated:** ${metadata.generatedAt.toLocaleString()}\n`;
        md += `**Tasks Analyzed:** ${metadata.taskCount}\n\n`;

        // Summary
        md += `## Summary\n\n`;
        md += `**Productivity Score:** ${productivity.productivityScore.toFixed(0)}/100\n\n`;

        if (summary.highlights.length > 0) {
            md += `### 🎉 Highlights\n\n`;
            summary.highlights.forEach(h => (md += `- ${h}\n`));
            md += `\n`;
        }

        if (summary.concerns.length > 0) {
            md += `### ⚠️ Areas for Improvement\n\n`;
            summary.concerns.forEach(c => (md += `- ${c}\n`));
            md += `\n`;
        }

        // Metrics
        md += `## Metrics\n\n`;
        md += `| Metric | Value |\n`;
        md += `|--------|-------|\n`;
        md += `| Completion Rate | ${(productivity.completionRate * 100).toFixed(1)}% |\n`;
        md += `| Tasks Per Day | ${productivity.averageCompletionsPerDay.toFixed(1)} |\n`;
        md += `| Current Streak | ${productivity.currentStreak} days |\n`;
        md += `| Focus Score | ${productivity.focusScore.toFixed(0)}/100 |\n`;
        md += `| Consistency Score | ${productivity.consistencyScore.toFixed(0)}/100 |\n`;
        md += `| Efficiency Score | ${productivity.efficiencyScore.toFixed(0)}/100 |\n\n`;

        // Comparison
        if (comparison) {
            md += `## Comparison with Previous Period\n\n`;
            md += `| Metric | Change |\n`;
            md += `|--------|--------|\n`;
            md += `| Completion Rate | ${this.formatChange(comparison.changes.completionRate)} |\n`;
            md += `| Tasks Per Day | ${this.formatChange(comparison.changes.averageCompletionsPerDay)} |\n`;
            md += `| Productivity Score | ${this.formatChange(comparison.changes.productivityScore)} |\n\n`;

            if (comparison.insights.length > 0) {
                md += `### Insights\n\n`;
                comparison.insights.forEach(i => (md += `- ${i}\n`));
                md += `\n`;
            }
        }

        // Recommendations
        if (summary.recommendations.length > 0) {
            md += `## 💡 Recommendations\n\n`;
            summary.recommendations.forEach(r => (md += `- ${r}\n`));
            md += `\n`;
        }

        // Trends
        md += `## Trends\n\n`;
        md += `**Overall Trend:** ${trends.overallTrend}\n\n`;
        md += `- **Completion Rate:** ${trends.completionRate.summary}\n`;
        md += `- **Tasks Per Day:** ${trends.tasksPerDay.summary}\n`;
        md += `- **Productivity Score:** ${trends.productivityScore.summary}\n\n`;

        return {
            format: 'markdown',
            content: md,
            filename: `productivity-report-${metadata.period.start.toISOString().split('T')[0]}.md`,
        };
    }

    private exportHTML(report: AnalyticsReport): ExportData {
        const md = this.exportMarkdown(report);

        // Simple conversion: wrap in HTML with basic styling
        let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Productivity Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 0 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
        h3 { color: #7f8c8d; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ecf0f1; }
        th { background-color: #3498db; color: white; }
        tr:hover { background-color: #f8f9fa; }
        ul { list-style-type: none; padding-left: 0; }
        li { padding: 8px 0; padding-left: 24px; position: relative; }
        li:before { content: "▸"; position: absolute; left: 0; color: #3498db; font-weight: bold; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .positive { color: #27ae60; }
        .negative { color: #e74c3c; }
    </style>
</head>
<body>`;

        // Convert markdown to HTML (simple conversion)
        const lines = md.content.split('\n');
        for (const line of lines) {
            if (line.startsWith('# ')) {
                html += `<h1>${line.substring(2)}</h1>\n`;
            } else if (line.startsWith('## ')) {
                html += `<h2>${line.substring(3)}</h2>\n`;
            } else if (line.startsWith('### ')) {
                html += `<h3>${line.substring(4)}</h3>\n`;
            } else if (line.startsWith('**')) {
                html += `<p><strong>${line.replace(/\*\*/g, '')}</strong></p>\n`;
            } else if (line.startsWith('- ')) {
                if (!html.endsWith('<ul>\n')) html += '<ul>\n';
                html += `<li>${line.substring(2)}</li>\n`;
            } else if (line.startsWith('|')) {
                // Table handling (simplified)
                if (!html.includes('<table>') || html.lastIndexOf('</table>') > html.lastIndexOf('<table>')) {
                    html += '<table>\n';
                }
                const cells = line.split('|').filter(c => c.trim());
                if (cells.every(c => c.includes('---'))) continue;
                const tag = html.split('<table>').pop()?.includes('<tbody>') ? 'td' : 'th';
                html += '<tr>';
                cells.forEach(cell => (html += `<${tag}>${cell.trim()}</${tag}>`));
                html += '</tr>\n';
                if (tag === 'th') html += '<tbody>\n';
            } else if (line.trim() === '') {
                if (html.endsWith('</li>\n')) html += '</ul>\n';
                if (html.includes('<table>') && !html.endsWith('</table>\n') && html.lastIndexOf('<table>') > html.lastIndexOf('</table>')) {
                    html += '</tbody></table>\n';
                }
                html += '<br>\n';
            } else if (line.trim()) {
                html += `<p>${line}</p>\n`;
            }
        }

        html += `</body>\n</html>`;

        return {
            format: 'html',
            content: html,
            filename: `productivity-report-${report.metadata.period.start.toISOString().split('T')[0]}.html`,
        };
    }

    private exportJSON(report: AnalyticsReport): ExportData {
        return {
            format: 'json',
            content: JSON.stringify(report, null, 2),
            filename: `productivity-report-${report.metadata.period.start.toISOString().split('T')[0]}.json`,
        };
    }

    private exportCSV(report: AnalyticsReport): ExportData {
        const { productivity, trends } = report;

        let csv = 'Metric,Value\n';
        csv += `Period Start,${report.metadata.period.start.toISOString()}\n`;
        csv += `Period End,${report.metadata.period.end.toISOString()}\n`;
        csv += `Task Count,${report.metadata.taskCount}\n`;
        csv += `\nProductivity Metrics,\n`;
        csv += `Productivity Score,${productivity.productivityScore.toFixed(2)}\n`;
        csv += `Completion Rate,${(productivity.completionRate * 100).toFixed(2)}%\n`;
        csv += `Average Completions Per Day,${productivity.averageCompletionsPerDay.toFixed(2)}\n`;
        csv += `Current Streak,${productivity.currentStreak}\n`;
        csv += `Focus Score,${productivity.focusScore.toFixed(2)}\n`;
        csv += `Consistency Score,${productivity.consistencyScore.toFixed(2)}\n`;
        csv += `Efficiency Score,${productivity.efficiencyScore.toFixed(2)}\n`;

        csv += `\nTrend Analysis,\n`;
        csv += `Overall Trend,${trends.overallTrend}\n`;
        csv += `Completion Rate Trend,${trends.completionRate.direction}\n`;
        csv += `Tasks Per Day Trend,${trends.tasksPerDay.direction}\n`;

        return {
            format: 'csv',
            content: csv,
            filename: `productivity-report-${report.metadata.period.start.toISOString().split('T')[0]}.csv`,
        };
    }

    private formatChange(changePercent: number): string {
        const sign = changePercent >= 0 ? '+' : '';
        return `${sign}${changePercent.toFixed(1)}%`;
    }
}
