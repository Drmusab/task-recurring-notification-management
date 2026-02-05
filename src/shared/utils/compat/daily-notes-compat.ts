/**
 * Daily Notes Interface Compatibility Layer for SiYuan
 * Provides Obsidian daily-notes-interface-like APIs for SiYuan
 */

import { fetchPost } from "siyuan";
import type { Moment } from "moment";
import moment from "moment";
import type { TFile } from "./siyuan-compat";

// Types
export interface ISettings {
  format: string;
  folder: string;
  template: string;
}

export interface ILocaleOverride {
  locale: string;
}

export interface IWeekStartOption {
  weekStart: number;
}

export interface ICalendarSource {
  getDayMetadata(date: Moment): Promise<IDayMetadata | null>;
  getWeekMetadata(date: Moment): Promise<IDayMetadata | null>;
}

export interface IDayMetadata {
  dots: IDot[];
  classes?: string[];
  dataAttributes?: Record<string, string>;
}

export interface IDot {
  className?: string;
  color?: string;
  isFilled?: boolean;
}

// Daily note settings cache
let dailyNoteSettings: ISettings = {
  format: "YYYY-MM-DD",
  folder: "/daily",
  template: "",
};

let weeklyNoteSettings: ISettings = {
  format: "YYYY-[W]WW",
  folder: "/weekly",
  template: "",
};

// Settings getters/setters
export function getDailyNoteSettings(): ISettings {
  return { ...dailyNoteSettings };
}

export function getWeeklyNoteSettings(): ISettings {
  return { ...weeklyNoteSettings };
}

export function setDailyNoteSettings(settings: Partial<ISettings>): void {
  dailyNoteSettings = { ...dailyNoteSettings, ...settings };
}

export function setWeeklyNoteSettings(settings: Partial<ISettings>): void {
  weeklyNoteSettings = { ...weeklyNoteSettings, ...settings };
}

// Check if daily notes plugin is available (always true in SiYuan since we handle it ourselves)
export function appHasDailyNotesPluginLoaded(): boolean {
  return true;
}

// Get all daily notes
export async function getAllDailyNotes(): Promise<Record<string, TFile>> {
  const notes: Record<string, TFile> = {};
  
  try {
    const response = await new Promise<{ data: Array<{ id: string; path: string; name: string }> }>((resolve) => {
      fetchPost("/api/filetree/listDocsByPath", {
        path: dailyNoteSettings.folder,
        sort: 0,
      }, resolve);
    });
    
    if (response.data) {
      for (const doc of response.data) {
        const dateStr = doc.name.replace(/\.sy$/, "");
        const date = moment(dateStr, dailyNoteSettings.format, true);
        if (date.isValid()) {
          notes[getDateUID(date, "day")] = {
            path: doc.path,
            name: doc.name,
            basename: doc.name.replace(/\.sy$/, ""),
            extension: "sy",
          };
        }
      }
    }
  } catch (error) {
    console.warn("Failed to get daily notes:", error);
  }
  
  return notes;
}

// Get all weekly notes
export async function getAllWeeklyNotes(): Promise<Record<string, TFile>> {
  const notes: Record<string, TFile> = {};
  
  try {
    const response = await new Promise<{ data: Array<{ id: string; path: string; name: string }> }>((resolve) => {
      fetchPost("/api/filetree/listDocsByPath", {
        path: weeklyNoteSettings.folder,
        sort: 0,
      }, resolve);
    });
    
    if (response.data) {
      for (const doc of response.data) {
        const dateStr = doc.name.replace(/\.sy$/, "");
        const date = moment(dateStr, weeklyNoteSettings.format, true);
        if (date.isValid()) {
          notes[getDateUID(date, "week")] = {
            path: doc.path,
            name: doc.name,
            basename: doc.name.replace(/\.sy$/, ""),
            extension: "sy",
          };
        }
      }
    }
  } catch (error) {
    console.warn("Failed to get weekly notes:", error);
  }
  
  return notes;
}

// Get daily note for a specific date
export function getDailyNote(
  date: Moment,
  dailyNotes: Record<string, TFile>
): TFile | null {
  const uid = getDateUID(date, "day");
  return dailyNotes[uid] || null;
}

// Get weekly note for a specific date
export function getWeeklyNote(
  date: Moment,
  weeklyNotes: Record<string, TFile>
): TFile | null {
  const uid = getDateUID(date, "week");
  return weeklyNotes[uid] || null;
}

// Get date from file
export function getDateFromFile(
  file: TFile,
  granularity: "day" | "week" | "month" | "quarter" | "year"
): Moment | null {
  const format = granularity === "week" 
    ? weeklyNoteSettings.format 
    : dailyNoteSettings.format;
    
  const date = moment(file.basename, format, true);
  return date.isValid() ? date : null;
}

// Get unique identifier for a date
export function getDateUID(
  date: Moment,
  granularity: "day" | "week" | "month" | "quarter" | "year" = "day"
): string {
  switch (granularity) {
    case "week":
      return date.format("YYYY-[W]WW");
    case "month":
      return date.format("YYYY-MM");
    case "quarter":
      return date.format("YYYY-[Q]Q");
    case "year":
      return date.format("YYYY");
    case "day":
    default:
      return date.format("YYYY-MM-DD");
  }
}

// Create daily note
export async function createDailyNote(date: Moment): Promise<TFile | null> {
  const filename = date.format(dailyNoteSettings.format);
  const path = `${dailyNoteSettings.folder}/${filename}.sy`;
  
  try {
    const response = await new Promise<{ data: { id: string } }>((resolve) => {
      fetchPost("/api/filetree/createDocWithMd", {
        notebook: "", // Will use default notebook
        path: path,
        markdown: dailyNoteSettings.template || `# ${filename}`,
      }, resolve);
    });
    
    if (response.data?.id) {
      return {
        path: path,
        name: `${filename}.sy`,
        basename: filename,
        extension: "sy",
      };
    }
  } catch (error) {
    console.error("Failed to create daily note:", error);
  }
  
  return null;
}

// Create weekly note
export async function createWeeklyNote(date: Moment): Promise<TFile | null> {
  const filename = date.format(weeklyNoteSettings.format);
  const path = `${weeklyNoteSettings.folder}/${filename}.sy`;
  
  try {
    const response = await new Promise<{ data: { id: string } }>((resolve) => {
      fetchPost("/api/filetree/createDocWithMd", {
        notebook: "",
        path: path,
        markdown: weeklyNoteSettings.template || `# ${filename}`,
      }, resolve);
    });
    
    if (response.data?.id) {
      return {
        path: path,
        name: `${filename}.sy`,
        basename: filename,
        extension: "sy",
      };
    }
  } catch (error) {
    console.error("Failed to create weekly note:", error);
  }
  
  return null;
}

// Configure global moment locale
export function configureGlobalMomentLocale(
  localeOverride?: ILocaleOverride,
  weekStartOption?: IWeekStartOption
): void {
  if (localeOverride?.locale) {
    moment.locale(localeOverride.locale);
  }
  
  if (weekStartOption?.weekStart !== undefined) {
    moment.updateLocale(moment.locale(), {
      week: {
        dow: weekStartOption.weekStart,
        doy: 4, // ISO week calculation
      },
    });
  }
}

// Calendar type for backward compatibility
export const Calendar = {
  configureGlobalMomentLocale,
};
