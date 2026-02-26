/**
 * Obsidian → SiYuan compatibility shim.
 *
 * This module re-exports or polyfills Obsidian API types that are referenced
 * by code ported from the obsidian-tasks plugin.  Where a direct SiYuan
 * equivalent exists the real SiYuan symbol is re-exported; otherwise a
 * lightweight stub is provided.
 *
 * Consumers:
 *   TaskEditingMenu.ts  – Menu, MenuItem
 *   PostponeMenu.ts     – Notice
 *   tasks-date.ts       – Notice
 *   dependencyHelpers.ts – FuzzyMatch, prepareSimpleSearch
 *   link-resolver.ts    – Reference (type-only)
 *   link.ts             – Reference (type-only)
 */

import { Menu as SiYuanMenu, showMessage } from "siyuan";
import type { IMenu, IPosition } from "siyuan";

// ─── Menu ──────────────────────────────────────────────────
// SiYuan's Menu.addItem() takes an IMenu options object.
// Obsidian's Menu.addItem() takes a callback (item: MenuItem) => void.
// This wrapper supports BOTH signatures so ported Obsidian code compiles
// and works at runtime under SiYuan.

/**
 * Fluent builder mirroring Obsidian's `MenuItem`.
 * Collects property assignments and materialises them into an IMenu object
 * that SiYuan's real Menu understands.
 */
export class MenuItem {
    private _title = "";
    private _checked = false;
    private _icon = "";
    private _disabled = false;
    private _onClick: ((el: HTMLElement, ev: MouseEvent) => void) | undefined;

    setTitle(title: string): this {
        this._title = title;
        return this;
    }

    setChecked(checked: boolean): this {
        this._checked = checked;
        return this;
    }

    setIcon(icon: string): this {
        this._icon = icon;
        return this;
    }

    setDisabled(disabled: boolean): this {
        this._disabled = disabled;
        return this;
    }

    onClick(handler: () => void | Promise<void>): this {
        this._onClick = () => { handler(); };
        return this;
    }

    /** Convert the accumulated state into a SiYuan IMenu option object. */
    toMenuOption(): IMenu {
        return {
            label: this._title,
            checked: this._checked,
            icon: this._icon || undefined,
            disabled: this._disabled,
            click: this._onClick,
        };
    }
}

/**
 * A Menu subclass that wraps SiYuan's native Menu while supporting
 * the Obsidian-style `addItem(callback)` calling convention.
 */
export class Menu extends SiYuanMenu {
    constructor(id?: string) {
        super(id);
    }

    /**
     * Overloaded addItem:
     *   • addItem(option: IMenu)              – SiYuan native
     *   • addItem(cb: (item: MenuItem) => void) – Obsidian compat
     */
    override addItem(optionOrCallback: IMenu | ((item: MenuItem) => void)): HTMLElement {
        if (typeof optionOrCallback === "function") {
            const builder = new MenuItem();
            optionOrCallback(builder);
            return super.addItem(builder.toMenuOption());
        }
        return super.addItem(optionOrCallback);
    }

    /**
     * Obsidian-compat alias for SiYuan's `open()`.
     * @deprecated Use `menu.open({ x, y })` directly.
     */
    showAtPosition(position: IPosition): void {
        this.open(position);
    }
}

// ─── Notice ────────────────────────────────────────────────
// Obsidian's Notice shows a toast and can also be thrown as an error.
// SiYuan's showMessage() provides the toast; we extend Error so
// `throw new Notice(msg)` still works.

export class Notice extends Error {
    constructor(message: string, timeout?: number) {
        super(message);
        this.name = "Notice";
        showMessage(message, timeout, "info");
    }
}

// ─── Reference ─────────────────────────────────────────────
// Obsidian's internal link reference.

export interface Reference {
    link: string;
    original: string;
    displayText?: string;
}

// ─── FuzzyMatch / prepareSimpleSearch ──────────────────────
// Obsidian's fuzzy-search helpers.  Provided as lightweight stubs.

export interface SearchResult {
    score: number;
    matches: Array<[number, number]>;
}

export interface FuzzyMatch<T> {
    item: T;
    match: SearchResult;
}

/**
 * Returns a function that fuzzy-searches `query` against any input string.
 * Simple implementation: case-insensitive substring match scored by
 * string length difference (closer to 0 = better).
 */
export function prepareSimpleSearch(
    query: string,
): (text: string) => SearchResult | null {
    const lowerQuery = query.toLowerCase();
    return (text: string): SearchResult | null => {
        const lowerText = text.toLowerCase();
        const idx = lowerText.indexOf(lowerQuery);
        if (idx === -1) return null;
        // Score: 0 = perfect, increasingly negative for longer text.
        const score = -(lowerText.length - lowerQuery.length);
        return { score, matches: [[idx, idx + lowerQuery.length]] };
    };
}
