/**
 * SiYuan Compatibility Layer
 * Provides Obsidian-like APIs using SiYuan's native APIs
 * This allows gradual migration of Obsidian-based code to SiYuan
 */

import { Plugin as SiyuanPlugin, Dialog, Menu as SiyuanMenu, showMessage, fetchPost } from "siyuan";

// Re-export SiYuan types with Obsidian-compatible names
export type App = {
  workspace: {
    activeLeaf: WorkspaceLeaf | null;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    off: (event: string, callback: (...args: unknown[]) => void) => void;
  };
  vault: Vault;
};

export type Plugin = SiyuanPlugin;

export interface TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
}

export interface TFolder {
  path: string;
  name: string;
  children: (TFile | TFolder)[];
}

export type TAbstractFile = TFile | TFolder;

export interface Vault {
  getFiles(): TFile[];
  read(file: TFile): Promise<string>;
  modify(file: TFile, content: string): Promise<void>;
  create(path: string, content: string): Promise<TFile>;
  delete(file: TFile): Promise<void>;
}

export interface WorkspaceLeaf {
  view: View;
}

export interface View {
  getViewType(): string;
}

export interface ItemView extends View {
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  onOpen(): Promise<void>;
  onClose(): Promise<void>;
}

export type FileView = ItemView;

export interface Editor {
  getValue(): string;
  setValue(value: string): void;
  getLine(line: number): string;
  setLine(line: number, text: string): void;
  getCursor(): EditorPosition;
  setCursor(pos: EditorPosition): void;
  getSelection(): string;
  replaceSelection(text: string): void;
  replaceRange(text: string, from: EditorPosition, to?: EditorPosition): void;
}

export interface EditorPosition {
  line: number;
  ch: number;
}

export interface MarkdownView {
  editor: Editor;
  file: TFile | null;
}

export interface CachedMetadata {
  frontmatter?: Record<string, unknown>;
  tags?: { tag: string; position: { start: { line: number } } }[];
  links?: { link: string; original: string; position: { start: { line: number } } }[];
}

export interface Reference {
  link: string;
  original: string;
  displayText?: string;
}

export interface Command {
  id: string;
  name: string;
  callback?: () => void;
  checkCallback?: (checking: boolean) => boolean | void;
  editorCallback?: (editor: Editor, view: MarkdownView) => void;
  editorCheckCallback?: (checking: boolean, editor: Editor, view: MarkdownView) => boolean | void;
  hotkeys?: { modifiers: string[]; key: string }[];
  icon?: string;
}

// Modal replacement using SiYuan Dialog
export class Modal {
  protected app: App;
  public containerEl: HTMLElement;
  public contentEl: HTMLElement;
  public modalEl: HTMLElement;
  private dialog: Dialog | null = null;

  constructor(app: App) {
    this.app = app;
    this.containerEl = document.createElement("div");
    this.contentEl = document.createElement("div");
    this.modalEl = document.createElement("div");
    this.containerEl.appendChild(this.modalEl);
    this.modalEl.appendChild(this.contentEl);
  }

  open(): void {
    this.onOpen();
    this.dialog = new Dialog({
      title: "",
      content: this.containerEl.innerHTML,
      width: "520px",
      destroyCallback: () => {
        this.onClose();
      },
    });
    // Re-attach content to dialog
    const dialogContent = this.dialog.element.querySelector(".b3-dialog__content");
    if (dialogContent) {
      dialogContent.innerHTML = "";
      dialogContent.appendChild(this.contentEl);
    }
  }

  close(): void {
    this.dialog?.destroy();
  }

  onOpen(): void {
    // Override in subclass
  }

  onClose(): void {
    // Override in subclass
  }
}

// SuggestModal base class
export abstract class SuggestModal<T> extends Modal {
  protected inputEl: HTMLInputElement;
  protected resultsEl: HTMLElement;

  constructor(app: App) {
    super(app);
    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.className = "b3-text-field";
    this.inputEl.placeholder = "Type to search...";
    
    this.resultsEl = document.createElement("div");
    this.resultsEl.className = "suggest-results";
    
    this.contentEl.appendChild(this.inputEl);
    this.contentEl.appendChild(this.resultsEl);
    
    this.inputEl.addEventListener("input", () => {
      this.updateSuggestions();
    });
  }

  abstract getSuggestions(query: string): T[] | Promise<T[]>;
  abstract renderSuggestion(item: T, el: HTMLElement): void;
  abstract onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void;

  private async updateSuggestions(): Promise<void> {
    const query = this.inputEl.value;
    const suggestions = await this.getSuggestions(query);
    this.resultsEl.innerHTML = "";
    
    suggestions.forEach((item) => {
      const el = document.createElement("div");
      el.className = "suggest-item";
      this.renderSuggestion(item, el);
      el.addEventListener("click", (evt) => {
        this.onChooseSuggestion(item, evt);
        this.close();
      });
      this.resultsEl.appendChild(el);
    });
  }

  onOpen(): void {
    super.onOpen();
    this.updateSuggestions();
    setTimeout(() => this.inputEl.focus(), 10);
  }
}

// FuzzySuggestModal
export abstract class FuzzySuggestModal<T> extends SuggestModal<T> {
  abstract getItems(): T[];
  abstract getItemText(item: T): string;

  getSuggestions(query: string): T[] {
    const items = this.getItems();
    if (!query) return items;
    
    const lowerQuery = query.toLowerCase();
    return items.filter(item => 
      this.getItemText(item).toLowerCase().includes(lowerQuery)
    );
  }
}

// Menu replacement
export class Menu {
  private menu: SiyuanMenu;

  constructor() {
    this.menu = new SiyuanMenu("compat-menu");
  }

  addItem(cb: (item: MenuItem) => void): this {
    const item = new MenuItem();
    cb(item);
    this.menu.addItem({
      label: item.titleText,
      icon: item.iconName,
      click: item.clickHandler,
    });
    return this;
  }

  addSeparator(): this {
    this.menu.addSeparator();
    return this;
  }

  showAtMouseEvent(event: MouseEvent): this {
    this.menu.open({ x: event.clientX, y: event.clientY });
    return this;
  }

  showAtPosition(pos: { x: number; y: number }): this {
    this.menu.open(pos);
    return this;
  }
}

export class MenuItem {
  titleText: string = "";
  iconName: string = "";
  clickHandler: () => void = () => {};

  setTitle(title: string): this {
    this.titleText = title;
    return this;
  }

  setIcon(icon: string): this {
    this.iconName = icon;
    return this;
  }

  onClick(handler: () => void): this {
    this.clickHandler = handler;
    return this;
  }
}

// Notice replacement
export class Notice {
  constructor(message: string, timeout?: number) {
    showMessage(message, timeout || 5000);
  }
}

// Setting replacement
export class Setting {
  private containerEl: HTMLElement;
  private settingEl: HTMLElement;
  private infoEl: HTMLElement;
  private controlEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
    this.settingEl = document.createElement("div");
    this.settingEl.className = "b3-label";
    
    this.infoEl = document.createElement("div");
    this.infoEl.className = "b3-label__text";
    
    this.controlEl = document.createElement("div");
    this.controlEl.className = "b3-label__value";
    
    this.settingEl.appendChild(this.infoEl);
    this.settingEl.appendChild(this.controlEl);
    this.containerEl.appendChild(this.settingEl);
  }

  setName(name: string): this {
    const nameEl = document.createElement("span");
    nameEl.textContent = name;
    this.infoEl.prepend(nameEl);
    return this;
  }

  setDesc(desc: string): this {
    const descEl = document.createElement("div");
    descEl.className = "b3-label__desc";
    descEl.textContent = desc;
    this.infoEl.appendChild(descEl);
    return this;
  }

  addToggle(cb: (toggle: ToggleComponent) => void): this {
    const toggle = new ToggleComponent(this.controlEl);
    cb(toggle);
    return this;
  }

  addText(cb: (text: TextComponent) => void): this {
    const text = new TextComponent(this.controlEl);
    cb(text);
    return this;
  }

  addDropdown(cb: (dropdown: DropdownComponent) => void): this {
    const dropdown = new DropdownComponent(this.controlEl);
    cb(dropdown);
    return this;
  }

  addButton(cb: (button: ButtonComponent) => void): this {
    const button = new ButtonComponent(this.controlEl);
    cb(button);
    return this;
  }
}

export class ToggleComponent {
  private toggleEl: HTMLInputElement;
  private changeHandler: (value: boolean) => void = () => {};

  constructor(containerEl: HTMLElement) {
    this.toggleEl = document.createElement("input");
    this.toggleEl.type = "checkbox";
    this.toggleEl.className = "b3-switch";
    this.toggleEl.addEventListener("change", () => {
      this.changeHandler(this.toggleEl.checked);
    });
    containerEl.appendChild(this.toggleEl);
  }

  setValue(value: boolean): this {
    this.toggleEl.checked = value;
    return this;
  }

  onChange(handler: (value: boolean) => void): this {
    this.changeHandler = handler;
    return this;
  }
}

export class TextComponent {
  protected inputEl: HTMLInputElement;
  private changeHandler: (value: string) => void = () => {};

  constructor(containerEl: HTMLElement) {
    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.className = "b3-text-field";
    this.inputEl.addEventListener("input", () => {
      this.changeHandler(this.inputEl.value);
    });
    containerEl.appendChild(this.inputEl);
  }

  setValue(value: string): this {
    this.inputEl.value = value;
    return this;
  }

  setPlaceholder(placeholder: string): this {
    this.inputEl.placeholder = placeholder;
    return this;
  }

  onChange(handler: (value: string) => void): this {
    this.changeHandler = handler;
    return this;
  }
}

export type AbstractTextComponent<T extends HTMLInputElement | HTMLTextAreaElement> = TextComponent;

export class DropdownComponent {
  private selectEl: HTMLSelectElement;
  private changeHandler: (value: string) => void = () => {};

  constructor(containerEl: HTMLElement) {
    this.selectEl = document.createElement("select");
    this.selectEl.className = "b3-select";
    this.selectEl.addEventListener("change", () => {
      this.changeHandler(this.selectEl.value);
    });
    containerEl.appendChild(this.selectEl);
  }

  addOption(value: string, display: string): this {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = display;
    this.selectEl.appendChild(option);
    return this;
  }

  addOptions(options: Record<string, string>): this {
    Object.entries(options).forEach(([value, display]) => {
      this.addOption(value, display);
    });
    return this;
  }

  setValue(value: string): this {
    this.selectEl.value = value;
    return this;
  }

  onChange(handler: (value: string) => void): this {
    this.changeHandler = handler;
    return this;
  }
}

export class ButtonComponent {
  private buttonEl: HTMLButtonElement;

  constructor(containerEl: HTMLElement) {
    this.buttonEl = document.createElement("button");
    this.buttonEl.className = "b3-button";
    containerEl.appendChild(this.buttonEl);
  }

  setButtonText(text: string): this {
    this.buttonEl.textContent = text;
    return this;
  }

  setCta(): this {
    this.buttonEl.classList.add("b3-button--primary");
    return this;
  }

  setWarning(): this {
    this.buttonEl.classList.add("b3-button--warning");
    return this;
  }

  onClick(handler: () => void): this {
    this.buttonEl.addEventListener("click", handler);
    return this;
  }
}

// PluginSettingTab replacement
export abstract class PluginSettingTab {
  protected app: App;
  protected plugin: Plugin;
  public containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
  }

  abstract display(): void;

  hide(): void {
    this.containerEl.innerHTML = "";
  }
}

// Platform detection
export const Platform = {
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isDesktop: !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
  isMacOS: navigator.platform.includes("Mac"),
  isWin: navigator.platform.includes("Win"),
  isLinux: navigator.platform.includes("Linux"),
  isIosApp: false,
  isAndroidApp: false,
};

// Point type for menu positioning
export interface Point {
  x: number;
  y: number;
}

// Utility functions
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function getLinkpath(link: string): string {
  // Remove any heading or block references
  return link.split(/[#^]/)[0];
}

export function parseYaml(yaml: string): Record<string, unknown> {
  // Simple YAML parser for frontmatter
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Try to parse as number or boolean
      if (value === "true") result[key] = true;
      else if (value === "false") result[key] = false;
      else if (!isNaN(Number(value))) result[key] = Number(value);
      else result[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  
  return result;
}

export function parseFrontMatterTags(frontmatter: Record<string, unknown> | undefined): string[] {
  if (!frontmatter) return [];
  const tags = frontmatter.tags;
  if (Array.isArray(tags)) return tags.map(t => String(t));
  if (typeof tags === "string") return tags.split(",").map(t => t.trim());
  return [];
}

// Icon helper using SiYuan icons
export function setIcon(el: HTMLElement, iconId: string): void {
  el.innerHTML = `<svg class="b3-icon"><use xlink:href="#icon${iconId}"></use></svg>`;
}

// MarkdownRenderer replacement
export const MarkdownRenderer = {
  async renderMarkdown(
    markdown: string,
    el: HTMLElement,
    sourcePath: string,
    component: unknown
  ): Promise<void> {
    // Use SiYuan's lute for markdown rendering
    try {
      const response = await new Promise<{ data: string }>((resolve) => {
        fetchPost("/api/lute/spinBlockDOM", { dom: markdown }, resolve);
      });
      el.innerHTML = response.data || markdown;
    } catch {
      // Fallback to basic text
      el.textContent = markdown;
    }
  },
};

// Export confirm for use
export { confirm, showMessage, fetchPost };

// FuzzyMatch type
export interface FuzzyMatch<T> {
  item: T;
  match: {
    score: number;
    matches: [number, number][];
  };
}

// Simple search implementation
export interface SearchResult<T> {
  item: T;
  score: number;
}

export function prepareSimpleSearch(query: string): (text: string) => SearchResult<string> | null {
  const lowerQuery = query.toLowerCase();
  
  return (text: string): SearchResult<string> | null => {
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return null;
    
    // Calculate a simple score based on position and match ratio
    const score = (1 - index / lowerText.length) * (lowerQuery.length / lowerText.length);
    
    return {
      item: text,
      score,
    };
  };
}

// Component base class for Obsidian compatibility
export class Component {
  private children: Component[] = [];
  private loaded = false;

  load(): void {
    this.loaded = true;
    this.onload();
  }

  unload(): void {
    this.loaded = false;
    this.onunload();
    this.children.forEach(child => child.unload());
    this.children = [];
  }

  onload(): void {
    // Override in subclass
  }

  onunload(): void {
    // Override in subclass
  }

  addChild<T extends Component>(child: T): T {
    this.children.push(child);
    if (this.loaded) {
      child.load();
    }
    return child;
  }

  removeChild<T extends Component>(child: T): T {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.unload();
    }
    return child;
  }

  register(cb: () => void): void {
    // Register a callback to be called on unload
    const originalUnload = this.onunload.bind(this);
    this.onunload = () => {
      cb();
      originalUnload();
    };
  }

  registerEvent(eventRef: unknown): void {
    // Event registration stub
  }

  registerDomEvent<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    callback: (ev: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    el.addEventListener(type, callback, options);
    this.register(() => el.removeEventListener(type, callback, options));
  }

  registerInterval(id: number): number {
    this.register(() => window.clearInterval(id));
    return id;
  }
}
