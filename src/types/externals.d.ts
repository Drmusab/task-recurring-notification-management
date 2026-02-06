/**
 * Ambient module declarations for external packages
 * not installed but referenced in non-build-path code.
 */

declare module "axios" {
  interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    params?: unknown;
    data?: unknown;
    timeout?: number;
    signal?: AbortSignal;
  }
  interface AxiosResponse<T = unknown> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: AxiosRequestConfig;
  }
  interface AxiosError extends Error {
    config: AxiosRequestConfig;
    code?: string;
    response?: AxiosResponse;
    isAxiosError: boolean;
  }
  interface AxiosInstance {
    get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  }
  function create(config?: AxiosRequestConfig): AxiosInstance;
  const axios: AxiosInstance & {
    create: typeof create;
    isAxiosError(payload: unknown): payload is AxiosError;
  };
  export default axios;
  export { AxiosRequestConfig, AxiosResponse, AxiosError, AxiosInstance };
}

declare module "electron" {
  namespace Electron {
    interface Remote {
      dialog: unknown;
      app: unknown;
    }
  }
  export default Electron;
}

declare module "jsep" {
  interface Expression {
    type: string;
    [key: string]: unknown;
  }
  interface UnaryExpression extends Expression {
    type: "UnaryExpression";
    operator: string;
    argument: Expression;
    prefix: boolean;
  }
  interface BinaryExpression extends Expression {
    type: "BinaryExpression";
    operator: string;
    left: Expression;
    right: Expression;
  }
  interface CallExpression extends Expression {
    type: "CallExpression";
    callee: Expression;
    arguments: Expression[];
  }
  interface Identifier extends Expression {
    type: "Identifier";
    name: string;
  }
  interface Literal extends Expression {
    type: "Literal";
    value: unknown;
    raw: string;
  }
  interface ConditionalExpression extends Expression {
    type: "ConditionalExpression";
    test: Expression;
    consequent: Expression;
    alternate: Expression;
  }
  interface MemberExpression extends Expression {
    type: "MemberExpression";
    computed: boolean;
    object: Expression;
    property: Expression;
  }
  interface ArrayExpression extends Expression {
    type: "ArrayExpression";
    elements: Expression[];
  }
  function jsep(expression: string): Expression;
  export default jsep;
  export {
    Expression,
    UnaryExpression,
    BinaryExpression,
    CallExpression,
    Identifier,
    Literal,
    ConditionalExpression,
    MemberExpression,
    ArrayExpression,
  };
}

declare module "@codemirror/state" {
  export class EditorState {
    doc: { toString(): string; lineAt(pos: number): { from: number; to: number; text: string } };
    selection: EditorSelection;
    static create(config?: { doc?: string; extensions?: unknown[] }): EditorState;
  }
  export class EditorSelection {
    main: SelectionRange;
    ranges: readonly SelectionRange[];
    static single(anchor: number, head?: number): EditorSelection;
    static cursor(pos: number): EditorSelection;
  }
  export class SelectionRange {
    from: number;
    to: number;
    anchor: number;
    head: number;
    empty: boolean;
  }
  export class Transaction {
    state: EditorState;
    docChanged: boolean;
  }
  export class StateField<T> {
    static define<T>(config: { create: (state: EditorState) => T; update: (value: T, tr: Transaction) => T }): StateField<T>;
  }
  export class StateEffect<T> {
    static define<T>(): StateEffect<T>;
    value: T;
    map(mapping: unknown): StateEffect<T>;
    is(type: StateEffect<unknown>): boolean;
  }
  export type Extension = unknown;
}

declare module "@codemirror/view" {
  import type { EditorState, Extension } from "@codemirror/state";
  export class EditorView {
    state: EditorState;
    dom: HTMLElement;
    dispatch(tr: unknown): void;
    destroy(): void;
  }
  export class ViewPlugin<T> {
    static fromClass<T>(
      cls: new (view: EditorView) => T,
      spec?: { decorations?: (value: T) => unknown }
    ): ViewPlugin<T>;
    extension: Extension;
  }
  export class ViewUpdate {
    view: EditorView;
    state: EditorState;
    docChanged: boolean;
    selectionSet: boolean;
  }
  export class Decoration {
    static mark(spec: { class?: string; attributes?: Record<string, string> }): unknown;
    static widget(spec: { widget: unknown; side?: number }): unknown;
    static set(decorations: unknown[]): unknown;
    static none: unknown;
  }
  export class WidgetType {
    toDOM(): HTMLElement;
    eq(other: WidgetType): boolean;
  }
}
