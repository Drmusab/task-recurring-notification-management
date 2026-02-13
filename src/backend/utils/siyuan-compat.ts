/**
 * SiYuan compatibility layer - provides Obsidian-like App/Plugin types
 * for code ported from Obsidian plugin patterns.
 */

export interface App {
  workspace: {
    getActiveFile(): TFile | null;
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
  };
  vault: {
    read(file: TFile): Promise<string>;
    modify(file: TFile, content: string): Promise<void>;
    getAbstractFileByPath(path: string): TFile | null;
  };
  metadataCache: {
    getFileCache(file: TFile): FileCache | null;
  };
}

export interface TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
}

export interface FileCache {
  frontmatter?: Record<string, unknown>;
  listItems?: Array<{ position: { start: { line: number; col: number } }; task?: string }>;
}

export abstract class Plugin {
  app: App;
  manifest: { id: string; name: string; version: string };
  constructor(app: App, manifest: Plugin["manifest"]) {
    this.app = app;
    this.manifest = manifest;
  }
  abstract onload(): Promise<void> | void;
  abstract onunload(): void;
  loadData(): Promise<unknown> { return Promise.resolve({}); }
  saveData(_data: unknown): Promise<void> { return Promise.resolve(); }
  addCommand(_cmd: { id: string; name: string; callback: () => void }): void {}
}

export class FileView {
  file: TFile | null = null;
}

export class ItemView extends FileView {
  containerEl: HTMLElement = document.createElement("div");
  getViewType(): string { return ""; }
  getDisplayText(): string { return ""; }
}

export class WorkspaceLeaf {
  view: ItemView = new (class extends ItemView {
    override getViewType() { return ""; }
    override getDisplayText() { return ""; }
  })();
}

export function parseFrontMatterTags(frontmatter: Record<string, unknown> | undefined): string[] {
  if (!frontmatter?.tags) return [];
  if (Array.isArray(frontmatter.tags)) return frontmatter.tags as string[];
  if (typeof frontmatter.tags === "string") return [frontmatter.tags];
  return [];
}
