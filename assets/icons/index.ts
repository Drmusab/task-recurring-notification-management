/**
 * Icon Registry
 * Central registry for all SVG icons used in the application
 * Auto-generated from icon files - modify with care
 */

// Navigation Icons (16×16)
import navigationInbox16 from './navigation/navigation-inbox-16.svg';
import navigationToday16 from './navigation/navigation-today-16.svg';
import navigationCalendar16 from './navigation/navigation-calendar-16.svg';
import navigationDone16 from './navigation/navigation-done-16.svg';
import navigationFolder16 from './navigation/navigation-folder-16.svg';
import navigationSearch16 from './navigation/navigation-search-16.svg';
import navigationList16 from './navigation/navigation-list-16.svg';
import navigationInsights16 from './navigation/navigation-insights-16.svg';

// Action Icons (16×16, 20×20)
import actionClose16 from './actions/actions-close-16.svg';
import actionCheck16 from './actions/actions-check-16.svg';
import actionCheck20 from './actions/actions-check-20.svg';
import actionDelay20 from './actions/actions-delay-20.svg';
import actionSkip20 from './actions/actions-skip-20.svg';
import actionSave20 from './actions/actions-save-20.svg';
import actionRefresh16 from './actions/actions-refresh-16.svg';
import actionRefresh20 from './actions/actions-refresh-20.svg';
import actionDelete16 from './actions/actions-delete-16.svg';
import actionDelete20 from './actions/actions-delete-20.svg';
import actionImport20 from './actions/actions-import-20.svg';

// Status Icons (16×16, 20×20)
import statusWarning16 from './status/status-warning-16.svg';
import statusWarning20 from './status/status-warning-20.svg';
import statusTrophy16 from './status/status-trophy-16.svg';
import statusStreak16 from './status/status-streak-16.svg';
import statusClock16 from './status/status-clock-16.svg';

// Feature Icons (24×24)
import featureSuggestion24 from './features/features-suggestion-24.svg';
import featureAnalytics24 from './features/features-analytics-24.svg';
import featureConsolidate24 from './features/features-consolidate-24.svg';
import featureDelegate24 from './features/features-delegate-24.svg';

/**
 * Icon registry organized by category and size
 */
export const Icons = {
  navigation: {
    inbox: {
      16: navigationInbox16,
    },
    today: {
      16: navigationToday16,
    },
    calendar: {
      16: navigationCalendar16,
    },
    done: {
      16: navigationDone16,
    },
    folder: {
      16: navigationFolder16,
    },
    search: {
      16: navigationSearch16,
    },
    list: {
      16: navigationList16,
    },
    insights: {
      16: navigationInsights16,
    },
  },
  actions: {
    close: {
      16: actionClose16,
    },
    check: {
      16: actionCheck16,
      20: actionCheck20,
    },
    delay: {
      20: actionDelay20,
    },
    skip: {
      20: actionSkip20,
    },
    save: {
      20: actionSave20,
    },
    refresh: {
      16: actionRefresh16,
      20: actionRefresh20,
    },
    delete: {
      16: actionDelete16,
      20: actionDelete20,
    },
    import: {
      20: actionImport20,
    },
  },
  status: {
    warning: {
      16: statusWarning16,
      20: statusWarning20,
    },
    trophy: {
      16: statusTrophy16,
    },
    streak: {
      16: statusStreak16,
    },
    clock: {
      16: statusClock16,
    },
  },
  features: {
    suggestion: {
      24: featureSuggestion24,
    },
    analytics: {
      24: featureAnalytics24,
    },
    consolidate: {
      24: featureConsolidate24,
    },
    delegate: {
      24: featureDelegate24,
    },
  },
} as const;

/**
 * Type definitions for icon usage
 */
export type IconCategory = keyof typeof Icons;
export type IconSize = 16 | 20 | 24;

/**
 * Icon names by category
 */
export type NavigationIcon = keyof typeof Icons.navigation;
export type ActionIcon = keyof typeof Icons.actions;
export type StatusIcon = keyof typeof Icons.status;
export type FeatureIcon = keyof typeof Icons.features;

/**
 * Helper to get icon URL by category, name, and size
 */
export function getIconUrl(
  category: IconCategory,
  name: string,
  size: IconSize = 16
): string | undefined {
  const categoryIcons = Icons[category];
  if (!categoryIcons) return undefined;
  
  const icon = categoryIcons[name as keyof typeof categoryIcons];
  if (!icon) return undefined;
  
  return icon[size as keyof typeof icon];
}
