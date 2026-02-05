import type { Moment } from "moment";
import type { TFile } from "@shared/utils/misc/siyuan-compat";
import type { ICalendarSource, IDayMetadata } from "@shared/utils/misc/daily-notes-compat";
import { getDailyNote, getWeeklyNote } from "@shared/utils/misc/daily-notes-compat";
import { get } from "svelte/store";

import { dailyNotes, weeklyNotes } from "@components/calendar/ui-calandar/stores";
import { classList } from "@components/calendar/ui-calandar/utils";

const getStreakClasses = (file: TFile): string[] => {
  return classList({
    "has-note": !!file,
  });
};

export const streakSource: ICalendarSource = {
  getDailyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getDailyNote(date, get(dailyNotes));
    return {
      classes: getStreakClasses(file),
      dots: [],
    };
  },

  getWeeklyMetadata: async (date: Moment): Promise<IDayMetadata> => {
    const file = getWeeklyNote(date, get(weeklyNotes));
    return {
      classes: getStreakClasses(file),
      dots: [],
    };
  },
};
