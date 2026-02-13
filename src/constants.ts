/**
 * Re-export calendar constants from their canonical location.
 * This shim exists because modules import from 'src/constants'.
 */
export {
  DEFAULT_WEEK_FORMAT,
  DEFAULT_WORDS_PER_DOT,
  VIEW_TYPE_CALENDAR,
  TRIGGER_ON_OPEN,
} from "@components/calendar/constants";
