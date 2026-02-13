/**
 * ExplanationDiagramGenerator - Generate visual diagrams for query explanations
 * 
 * Creates visual representations of filter logic and task flow through queries:
 * - Mermaid flowcharts for filter trees
 * - Boolean logic diagrams (AND/OR/NOT)
 * - Task flow visualizations (matched/unmatched paths)
 * 
 * Phase 4: Explanation Enhancements
 * 
 * @module ExplanationDiagramGenerator
 */

import type { QueryAST, FilterNode } from "./QueryParser";
import type { Explanation, TaskExplanation } from "./QueryExplainer";

export interface DiagramOptions {
  /** Diagram type to generate */
  type: "flowchart" | "tree" | "sankey";
  /** Include task flow (matched/unmatched paths) */
  includeTaskFlow?: boolean;
  /** Color scheme */
  colorScheme?: "default" | "dark" | "light" | "colorblind";
  /** Maximum nodes to show before summarizing */
  maxNodes?: number;
  /** Show statistics on nodes */
  showStats?: boolean;
}

export interface DiagramResult {
  /** Mermaid diagram syntax */
  mermaidSyntax: string;
  /** Diagram title */
  title: string;
  /** Estimated render complexity (1-5) */
  complexity: number;
  /** Warnings about truncation or simplification */
  warnings: string[];
}

/**
 * Generates Mermaid diagrams for query explanations
 */
export class ExplanationDiagramGenerator {
  private nodeIdCounter = 0;
  private warnings: string[] = [];

  /**
   * Generate flowchart diagram showing filter logic
   */
  generateFlowchart(
    query: QueryAST,
    explanation?: Explanation,
    options: DiagramOptions = { type: "flowchart" }
  ): DiagramResult {
    this.reset();
    const lines: string[] = [];

    lines.push("flowchart TD");
    lines.push("    Start([Query Start])");

    // Generate filter nodes
    const filterIds = this.generateFilterNodes(query, lines, options);

    // Connect start to first filter
    if (filterIds.length > 0) {
      lines.push(`    Start --> ${filterIds[0]}`);
    }

    // Chain filters (AND logic by default)
    for (let i = 0; i < filterIds.length - 1; i++) {
      lines.push(`    ${filterIds[i]} -->|Pass| ${filterIds[i + 1]}`);
      lines.push(`    ${filterIds[i]} -->|Fail| Unmatched`);
    }

    // Last filter to result
    if (filterIds.length > 0) {
      const lastId = filterIds[filterIds.length - 1];
      lines.push(`    ${lastId} -->|Pass| Matched`);
      lines.push(`    ${lastId} -->|Fail| Unmatched`);
    }

    // Result nodes
    lines.push(`    Matched([✅ Matched Tasks])`);
    lines.push(`    Unmatched([❌ Unmatched Tasks])`);

    // Add statistics if available
    if (options.showStats && explanation) {
      lines.push(`    Matched -.-> Stats1[${explanation.matchCount} tasks]`);
      lines.push(`    Unmatched -.-> Stats2[${explanation.totalCount - explanation.matchCount} tasks]`);
    }

    // Styling
    lines.push("");
    lines.push("    classDef matchedClass fill:#90EE90,stroke:#2E8B57,stroke-width:2px");
    lines.push("    classDef unmatchedClass fill:#FFB6C1,stroke:#DC143C,stroke-width:2px");
    lines.push("    classDef filterClass fill:#87CEEB,stroke:#4682B4,stroke-width:2px");
    lines.push("    class Matched matchedClass");
    lines.push("    class Unmatched unmatchedClass");
    lines.push(`    class ${filterIds.join(',')} filterClass`);

    const complexity = Math.min(5, Math.ceil(filterIds.length / 3));

    return {
      mermaidSyntax: lines.join('\n'),
      title: "Query Filter Flowchart",
      complexity,
      warnings: this.warnings
    };
  }

  /**
   * Generate tree diagram showing boolean logic
   */
  generateBooleanTree(
    query: QueryAST,
    options: DiagramOptions = { type: "tree" }
  ): DiagramResult {
    this.reset();
    const lines: string[] = [];

    lines.push("flowchart TB");
    
    const rootId = this.generateNodeId();
    lines.push(`    ${rootId}["Query: ${this.escapeLabel(query.filters.length + ' filters')}"]`);

    // Generate boolean logic tree
    this.generateBooleanNodes(query, rootId, lines);

    // Styling
    lines.push("");
    lines.push("    classDef andClass fill:#FFE4B5,stroke:#FFA500");
    lines.push("    classDef orClass fill:#E6E6FA,stroke:#9370DB");
    lines.push("    classDef notClass fill:#FFB6C1,stroke:#DC143C");
    lines.push("    classDef filterClass fill:#B0E0E6,stroke:#4682B4");

    const complexity = Math.min(5, Math.ceil(query.filters.length / 2));

    return {
      mermaidSyntax: lines.join('\n'),
      title: "Query Boolean Logic Tree",
      complexity,
      warnings: this.warnings
    };
  }

  /**
   * Generate Sankey diagram showing task flow
   */
  generateTaskFlow(
    explanation: Explanation,
    options: DiagramOptions = { type: "sankey" }
  ): DiagramResult {
    this.reset();
    const lines: string[] = [];

    // Note: Mermaid doesn't support Sankey natively yet, using flowchart as fallback
    lines.push("flowchart LR");
    
    const totalTasks = explanation.totalCount;
    const matchedCount = explanation.matchCount;
    const unmatchedCount = totalTasks - matchedCount;

    lines.push(`    Start["All Tasks<br/>${totalTasks}"]`);
    
    // Group by filter results
    const filterStats = this.calculateFilterStats(explanation);
    
    let previousId = "Start";
    filterStats.forEach((stat, index) => {
      const filterId = this.generateNodeId();
      lines.push(`    ${filterId}["${this.escapeLabel(stat.filterName)}<br/>✅ ${stat.passCount} | ❌ ${stat.failCount}"]`);
      lines.push(`    ${previousId} -->|${stat.passCount} pass| ${filterId}`);
      
      if (stat.failCount > 0 && index === filterStats.length - 1) {
        lines.push(`    ${previousId} -->|${stat.failCount} fail| Unmatched`);
      }
      
      previousId = filterId;
    });

    lines.push(`    ${previousId} --> Matched["✅ Matched<br/>${matchedCount}"]`);
    lines.push(`    Unmatched["❌ Unmatched<br/>${unmatchedCount}"]`);

    // Styling
    lines.push("");
    lines.push("    classDef matchedClass fill:#90EE90,stroke:#2E8B57,stroke-width:3px");
    lines.push("    classDef unmatchedClass fill:#FFB6C1,stroke:#DC143C,stroke-width:3px");
    lines.push("    class Matched matchedClass");
    lines.push("    class Unmatched unmatchedClass");

    const complexity = Math.min(5, Math.ceil(filterStats.length / 2));

    return {
      mermaidSyntax: lines.join('\n'),
      title: "Task Flow Through Filters",
      complexity,
      warnings: this.warnings
    };
  }

  /**
   * Generate comprehensive multi-diagram explanation
   */
  generateComprehensive(
    query: QueryAST,
    explanation: Explanation,
    options: DiagramOptions = { type: "flowchart" }
  ): DiagramResult[] {
    return [
      this.generateFlowchart(query, explanation, { ...options, showStats: true }),
      this.generateBooleanTree(query, options),
      this.generateTaskFlow(explanation, options)
    ];
  }

  /**
   * Generate simplified diagram for complex queries
   */
  generateSimplified(
    query: QueryAST,
    explanation: Explanation,
    maxFilters: number = 5
  ): DiagramResult {
    this.reset();
    const lines: string[] = [];

    lines.push("flowchart TD");
    lines.push("    Start([Start])");

    const filterCount = query.filters.length;
    
    if (filterCount <= maxFilters) {
      // Use normal flowchart
      return this.generateFlowchart(query, explanation);
    }

    // Simplify by grouping filters
    this.warnings.push(`Query has ${filterCount} filters, showing simplified view`);

    const groupSize = Math.ceil(filterCount / maxFilters);
    const groups: FilterNode[][] = [];
    
    for (let i = 0; i < query.filters.length; i += groupSize) {
      groups.push(query.filters.slice(i, i + groupSize));
    }

    const groupIds: string[] = [];
    groups.forEach((group, index) => {
      const groupId = this.generateNodeId();
      const label = group.length === 1 && group[0]
        ? this.getFilterLabel(group[0])
        : `${group.length} filters`;
      
      lines.push(`    ${groupId}{"${this.escapeLabel(label)}"}`);
      groupIds.push(groupId);
    });

    // Connect start to first group
    if (groupIds.length > 0) {
      lines.push(`    Start --> ${groupIds[0]}`);
    }

    // Chain groups
    for (let i = 0; i < groupIds.length - 1; i++) {
      lines.push(`    ${groupIds[i]} --> ${groupIds[i + 1]}`);
    }

    // Last group to result
    if (groupIds.length > 0) {
      lines.push(`    ${groupIds[groupIds.length - 1]} --> Matched`);
    }

    lines.push(`    Matched([✅ ${explanation.matchCount} Matched])`);
    lines.push(`    Unmatched([❌ ${explanation.totalCount - explanation.matchCount} Unmatched])`);

    return {
      mermaidSyntax: lines.join('\n'),
      title: "Query Overview (Simplified)",
      complexity: 2,
      warnings: this.warnings
    };
  }

  /**
   * Generate filter nodes for flowchart
   */
  private generateFilterNodes(
    query: QueryAST,
    lines: string[],
    options: DiagramOptions
  ): string[] {
    const ids: string[] = [];

    for (const filter of query.filters) {
      const nodeId = this.generateNodeId();
      const label = this.getFilterLabel(filter);
      
      lines.push(`    ${nodeId}{"${this.escapeLabel(label)}"}`);
      ids.push(nodeId);
    }

    return ids;
  }

  /**
   * Generate boolean logic nodes
   */
  private generateBooleanNodes(
    query: QueryAST,
    parentId: string,
    lines: string[]
  ): void {
    // Simplified: Treat all filters as AND by default
    // Can be enhanced to parse actual boolean operators from query

    for (const filter of query.filters) {
      const nodeId = this.generateNodeId();
      const label = this.getFilterLabel(filter);
      
      lines.push(`    ${nodeId}["${this.escapeLabel(label)}"]`);
      lines.push(`    ${parentId} -->|AND| ${nodeId}`);
    }
  }

  /**
   * Calculate statistics for each filter
   */
  private calculateFilterStats(explanation: Explanation): Array<{
    filterName: string;
    passCount: number;
    failCount: number;
  }> {
    const stats: Map<string, { pass: number; fail: number }> = new Map();

    // Analyze each task explanation
    for (const taskExpl of explanation.taskExplanations) {
      for (const filterExpl of taskExpl.filterExplanations) {
        if (!stats.has(filterExpl.filterName)) {
          stats.set(filterExpl.filterName, { pass: 0, fail: 0 });
        }

        const stat = stats.get(filterExpl.filterName)!;
        if (filterExpl.matched) {
          stat.pass++;
        } else {
          stat.fail++;
        }
      }
    }

    return Array.from(stats.entries()).map(([name, counts]) => ({
      filterName: name,
      passCount: counts.pass,
      failCount: counts.fail
    }));
  }

  /**
   * Get human-readable label for filter
   */
  private getFilterLabel(filter: FilterNode): string {
    switch (filter.type) {
      case "priority":
        return `Priority ${filter.operator || "="} ${filter.value}`;
      case "tag":
      case "tag-regex":
        return `Tag: ${filter.value}`;
      case "status":
        return `Status: ${filter.value}`;
      case "date":
        return `Date ${filter.operator || ""} ${filter.value}`;
      case "recurrence":
        return `Recurrence: ${filter.value}`;
      case "urgency":
        return `Urgency: ${filter.value}`;
      case "description":
      case "description-regex":
        return `Description: ${filter.value}`;
      default:
        return filter.type || "Filter";
    }
  }

  /**
   * Escape special characters for Mermaid labels
   */
  private escapeLabel(label: string): string {
    return label
      .replace(/"/g, '\\"')
      .replace(/\n/g, '<br/>')
      .replace(/[<>]/g, ''); // Remove < and > to avoid HTML issues
  }

  /**
   * Generate unique node ID
   */
  private generateNodeId(): string {
    return `N${++this.nodeIdCounter}`;
  }

  /**
   * Reset generator state
   */
  private reset(): void {
    this.nodeIdCounter = 0;
    this.warnings = [];
  }

  /**
   * Export diagram as SVG (requires rendering engine)
   */
  static async toSVG(mermaidSyntax: string): Promise<string> {
    // This would require integration with Mermaid rendering engine
    // Placeholder for future implementation
    throw new Error("SVG export not yet implemented - requires Mermaid renderer integration");
  }

  /**
   * Export diagram as PNG (requires rendering engine)
   */
  static async toPNG(mermaidSyntax: string): Promise<Blob> {
    // This would require integration with Mermaid rendering engine
    // Placeholder for future implementation
    throw new Error("PNG export not yet implemented - requires Mermaid renderer integration");
  }

  /**
   * Get recommended diagram type based on query complexity
   */
  static getRecommendedDiagramType(
    query: QueryAST,
    explanation?: Explanation
  ): DiagramOptions["type"] {
    const filterCount = query.filters.length;

    if (filterCount <= 3) {
      return "flowchart"; // Simple, clear for few filters
    } else if (filterCount <= 7) {
      return "tree"; // Better for moderate complexity
    } else {
      return "sankey"; // Best for showing flow through many filters
    }
  }

  /**
   * Validate Mermaid syntax (basic check)
   */
  static validateMermaidSyntax(syntax: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!syntax.startsWith("flowchart") && !syntax.startsWith("graph")) {
      errors.push("Diagram must start with 'flowchart' or 'graph'");
    }

    // Check for common syntax errors
    const lines = syntax.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      const trimmedLine = line.trim();
      
      // Check for unbalanced brackets
      const openBrackets = (trimmedLine.match(/\[/g) || []).length;
      const closeBrackets = (trimmedLine.match(/\]/g) || []).length;
      const openParens = (trimmedLine.match(/\(/g) || []).length;
      const closeParens = (trimmedLine.match(/\)/g) || []).length;
      const openBraces = (trimmedLine.match(/\{/g) || []).length;
      const closeBraces = (trimmedLine.match(/\}/g) || []).length;

      if (openBrackets !== closeBrackets) {
        errors.push(`Line ${i + 1}: Unbalanced square brackets`);
      }
      if (openParens !== closeParens) {
        errors.push(`Line ${i + 1}: Unbalanced parentheses`);
      }
      if (openBraces !== closeBraces) {
        errors.push(`Line ${i + 1}: Unbalanced curly braces`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
