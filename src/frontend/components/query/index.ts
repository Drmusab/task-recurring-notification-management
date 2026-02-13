/**
 * Query Components Index
 * 
 * Central export file for all Phase 3 + Phase 4 Query Features components
 * 
 * @module query
 */

// Phase 3 - Advanced Query Features
export { default as AdvancedQueryDashboard } from "./AdvancedQueryDashboard.svelte";
export { default as QueryFolderManager } from "./QueryFolderManager.svelte";
export { default as QueryTagManager } from "./QueryTagManager.svelte";
export { default as QueryStatisticsDashboard } from "./QueryStatisticsDashboard.svelte";
export { default as VisualQueryBuilder } from "./VisualQueryBuilder.svelte";
export { default as QueryTemplatesLibrary } from "./QueryTemplatesLibrary.svelte";

// Phase 1 - Existing Components
export { default as SavedQueriesDropdown } from "./SavedQueriesDropdown.svelte";
export { default as QueryExplanationPanel } from "./QueryExplanationPanel.svelte";

// Phase 4 - Explanation Enhancements (re-export from ui/components/query)
export { default as ExplanationDiffPanel } from "../../../ui/components/query/ExplanationDiffPanel.svelte";
export { default as SuggestedFixesPanel } from "../../../ui/components/query/SuggestedFixesPanel.svelte";
export { default as ExplanationDiagramView } from "../../../ui/components/query/ExplanationDiagramView.svelte";
