/**
 * Re-export Grouper via UIQueryService facade (code-split dynamic import).
 * Frontend components should use uiQueryService.getGrouperClass() instead.
 */
import { uiQueryService } from '../../../../services/UIQueryService';

/** @deprecated Use uiQueryService.getGrouperClass() instead */
export const getGrouper = () => uiQueryService.getGrouperClass();
