/**
 * SiYuan-native Cache module for task management
 * 
 * Features:
 * - Websocket integration for real-time block updates (ws://127.0.0.1:6806/ws)
 * - Block attribute synchronization (custom-task-* prefix)
 * - Debounced updates to prevent excessive refreshes (100ms)
 * - Integration with TaskIndex for O(1) lookups
 * - Auto-reconnecting websocket with exponential backoff
 * - Plugin EventBus integration for document load events
 * 
 * Reference: obsidian-tasks-main/src/siyuan/sync/TaskSyncService.ts
 */

import type { Task } from "@domain/models/Task";
import type { Plugin } from "siyuan";
import type { TaskIndex } from "@domain/index/TaskIndex";
import * as logger from "@backend/logging/logger";

/**
 * Cache state enumeration
 */
export enum State {
    /** Cache is not initialized */
    Cold = 'Cold',
    /** Cache is initializing (loading tasks, connecting websocket) */
    Initializing = 'Initializing',
    /** Cache is ready and actively synchronizing */
    Warm = 'Warm',
}

/**
 * SiYuan block attribute schema for tasks
 * All task properties use 'custom-task-*' prefix per SiYuan convention
 * 
 * @see API_MAPPING_OBSIDIAN_TO_SIYUAN.md - Block Attributes section
 */
export interface TaskBlockAttributes {
    'custom-task-id'?: string;
    'custom-task-name'?: string;
    'custom-task-status'?: string;
    'custom-task-due'?: string;
    'custom-task-enabled'?: string;
    'custom-task-recurrence-rrule'?: string;
    'custom-task-updated-at'?: string;
    [key: string]: string | undefined;
}

/**
 * Websocket transaction operation structure
 */
interface WebSocketOperation {
    action: 'update' | 'insert' | 'delete';
    id: string;
    data?: string;
}

/**
 * Websocket transaction container
 */
interface WebSocketTransaction {
    doOperations?: WebSocketOperation[];
}

/**
 * Websocket message from SiYuan kernel
 */
interface WebSocketMessage {
    cmd: string;
    data?: WebSocketTransaction[];
}

/**
 * Event-driven task cache for SiYuan with real-time synchronization
 * 
 * Architecture:
 * 1. Plugin EventBus listens for 'loaded-protyle-static' (document opens)
 * 2. WebSocket listens on ws://127.0.0.1:6806/ws for block updates
 * 3. Debounced refresh batches rapid changes (100ms window)
 * 4. Block attributes use 'custom-task-*' prefix for all task data
 * 5. TaskIndex provides O(1) lookups and O(log n) range queries
 * 
 * @example
 * ```typescript
 * const cache = new Cache(plugin, taskIndex);
 * await cache.init();
 * 
 * // Real-time updates from SiYuan
 * const tasks = cache.getTasks(); // Always current
 * 
 * // Manual operations
 * await cache.addTask(task);
 * await cache.updateTask(updatedTask);
 * ```
 */
export class Cache {
    private tasks: Map<string, Task> = new Map();
    private state: State = State.Cold;
    private plugin: Plugin;
    private taskIndex: TaskIndex | null = null;
    
    // Event listeners
    private eventHandlers: Array<() => void> = [];
    private websocket: WebSocket | null = null;
    
    // Debouncing for block updates
    private updateDebounceTimer: number | null = null;
    private pendingUpdates: Set<string> = new Set();
    private readonly DEBOUNCE_MS = 100;
    
    // Websocket reconnection with exponential backoff
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private readonly RECONNECT_BASE_DELAY = 1000;
    
    // Block monitoring
    private monitoredBlocks: Set<string> = new Set();

    constructor(plugin: Plugin, taskIndex?: TaskIndex) {
        this.plugin = plugin;
        this.taskIndex = taskIndex ?? null;
    }

    /**
     * Get current cache state
     */
    getState(): State {
        return this.state;
    }

    /**
     * Initialize cache with SiYuan event subscriptions
     * 
     * Process:
     * 1. Subscribe to plugin.eventBus for document load events
     * 2. Connect to SiYuan websocket (ws://127.0.0.1:6806/ws)
     * 3. Initial task refresh from block attributes
     * 
     * @throws Error if cache initialization fails
     */
    async init(): Promise<void> {
        this.state = State.Initializing;

        try {
            // 1. Subscribe to Plugin EventBus for document loads
            this.subscribeToPluginEvents();

            // 2. Connect to SiYuan websocket for real-time updates
            this.connectWebSocket();

            // 3. Initial task refresh from block attributes
            await this.refreshTasks();

            this.state = State.Warm;
            logger.info('[Cache] Initialized successfully with SiYuan integration');
        } catch (error) {
            logger.error('[Cache] Initialization failed', error);
            this.state = State.Cold;
            throw error;
        }
    }

    /**
     * Get all tasks from cache
     * 
     * @returns Array of cached tasks
     */
    getTasks(): Task[] {
        return Array.from(this.tasks.values());
    }

    /**
     * Get task by ID with O(1) lookup
     * 
     * @param taskId - Task identifier
     * @returns Task if found, undefined otherwise
     */
    getTask(taskId: string): Task | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Add task to cache and sync to SiYuan block attributes
     * 
     * Side effects:
     * - Updates TaskIndex if configured
     * - Syncs task to block attributes via SiYuan API
     * 
     * @param task - Task to add
     */
    async addTask(task: Task): Promise<void> {
        this.tasks.set(task.id, task);
        
        // Update task index if available
        if (this.taskIndex) {
            this.taskIndex.addToIndex(task);
        }
        
        // Sync to SiYuan block attributes
        await this.syncTaskToBlockAttributes(task);
    }

    /**
     * Remove task from cache and clear block attributes
     * 
     * @param taskId - Task identifier
     */
    async removeTask(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) return;

        this.tasks.delete(taskId);
        
        // Update task index
        if (this.taskIndex) {
            this.taskIndex.removeFromIndex(taskId);
        }
        
        // Remove block attributes if task has sourceBlockId
        if ((task as any).sourceBlockId) {
            await this.clearBlockAttributes((task as any).sourceBlockId);
        }
    }

    /**
     * Update task in cache and sync to block attributes
     * 
     * @param task - Updated task
     */
    async updateTask(task: Task): Promise<void> {
        const existing = this.tasks.get(task.id);
        
        this.tasks.set(task.id, task);
        
        // Update task index
        if (this.taskIndex) {
            // Use updateInIndex which does remove + add + resort automatically
            this.taskIndex.updateInIndex(task);
        }
        
        // Sync to block attributes
        await this.syncTaskToBlockAttributes(task);
    }

    /**
     * Subscribe to SiYuan plugin EventBus for document loads
     * 
     * Events:
     * - 'loaded-protyle-static': Fired when document opens in editor
     * 
     * @see API_MAPPING_OBSIDIAN_TO_SIYUAN.md - Events section
     */
    private subscribeToPluginEvents(): void {
        if (!(this.plugin as any).eventBus) {
            logger.warn('[Cache] Plugin EventBus not available, skipping event subscriptions');
            return;
        }

        const eventBus = (this.plugin as any).eventBus;
        
        // Document loaded event
        const unsubscribeDocLoad = eventBus.on('loaded-protyle-static', (detail: any) => {
            this.handleDocumentLoaded(detail).catch((error: Error) => {
                logger.error('[Cache] Failed to handle document load', error);
            });
        });
        
        this.eventHandlers.push(unsubscribeDocLoad);
        
        logger.info('[Cache] Subscribed to SiYuan plugin events');
    }

    /**
     * Connect to SiYuan websocket for real-time block updates
     * 
     * Endpoint: ws://127.0.0.1:6806/ws
     * Events: 'transactions' with doOperations array
     * 
     * @see API_MAPPING_OBSIDIAN_TO_SIYUAN.md - Vault Events section
     */
    private connectWebSocket(): void {
        try {
            // SiYuan websocket endpoint
            const wsUrl = 'ws://127.0.0.1:6806/ws';
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                logger.info('[Cache] WebSocket connected to SiYuan');
                this.reconnectAttempts = 0;
            };
            
            this.websocket.onmessage = (event: MessageEvent) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data as string);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    logger.error('[Cache] Failed to parse WebSocket message', error);
                }
            };
            
            this.websocket.onerror = (error: Event) => {
                logger.error('[Cache] WebSocket error', error);
            };
            
            this.websocket.onclose = () => {
                logger.warn('[Cache] WebSocket closed, attempting reconnection...');
                this.websocket = null;
                this.attemptReconnect();
            };
        } catch (error) {
            logger.error('[Cache] Failed to connect WebSocket', error);
        }
    }

    /**
     * Attempt to reconnect websocket with exponential backoff
     * 
     * Backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts)
     */
    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            logger.error('[Cache] Max WebSocket reconnection attempts reached');
            return;
        }

        const delay = this.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts);
        this.reconnectAttempts++;

        setTimeout(() => {
            logger.info(`[Cache] Reconnecting WebSocket (attempt ${this.reconnectAttempts})...`);
            this.connectWebSocket();
        }, delay);
    }

    /**
     * Handle websocket messages for block updates
     * 
     * Message format:
     * ```json
     * {
     *   "cmd": "transactions",
     *   "data": [{
     *     "doOperations": [{
     *       "action": "update",
     *       "id": "block-id"
     *     }]
     *   }]
     * }
     * ```
     */
    private handleWebSocketMessage(message: WebSocketMessage): void {
        if (message.cmd !== 'transactions' || !message.data) {
            return;
        }

        // Process block update operations
        for (const tx of message.data) {
            if (!tx.doOperations) continue;
            
            for (const op of tx.doOperations) {
                if (op.action === 'update' || op.action === 'insert') {
                    // Schedule debounced refresh for this block
                    this.scheduleBlockRefresh(op.id);
                } else if (op.action === 'delete') {
                    // Remove task if block is deleted
                    this.handleBlockDeleted(op.id);
                }
            }
        }
    }

    /**
     * Schedule debounced block refresh to prevent excessive updates
     * 
     * Batches rapid changes in 100ms windows to reduce API calls
     * 
     * @param blockId - SiYuan block ID
     */
    private scheduleBlockRefresh(blockId: string): void {
        this.pendingUpdates.add(blockId);
        
        if (this.updateDebounceTimer !== null) {
            clearTimeout(this.updateDebounceTimer);
        }
        
        this.updateDebounceTimer = globalThis.setTimeout(() => {
            this.processPendingUpdates().catch((error: Error) => {
                logger.error('[Cache] Failed to process pending updates', error);
            });
            this.updateDebounceTimer = null;
        }, this.DEBOUNCE_MS) as unknown as number;
    }

    /**
     * Process all pending block updates
     */
    private async processPendingUpdates(): Promise<void> {
        const blockIds = Array.from(this.pendingUpdates);
        this.pendingUpdates.clear();
        
        for (const blockId of blockIds) {
            await this.refreshBlockTask(blockId);
        }
    }

    /**
     * Handle document loaded event from SiYuan
     * 
     * @param detail - Event detail containing protyle.block.id
     */
    private async handleDocumentLoaded(detail: any): Promise<void> {
        const docId = detail?.protyle?.block?.id;
        if (!docId) return;
        
        logger.info('[Cache] Document loaded', { docId });
        
        // Refresh tasks in document using SQL query
        await this.refreshDocumentTasks(docId);
    }

    /**
     * Handle block deletion
     * 
     * @param blockId - Deleted block ID
     */
    private handleBlockDeleted(blockId: string): void {
        // Find and remove task associated with this block
        for (const [taskId, task] of this.tasks.entries()) {
            if ((task as any).sourceBlockId === blockId) {
                this.tasks.delete(taskId);
                
                if (this.taskIndex) {
                    this.taskIndex.removeFromIndex(taskId);
                }
                
                logger.info('[Cache] Task removed due to block deletion', { taskId });
                break;
            }
        }
    }

    /**
     * Refresh all tasks from SiYuan blocks with custom-task-* attributes
     * 
     * SQL query finds all blocks with 'custom-task-id' attribute
     */
    private async refreshTasks(): Promise<void> {
        try {
            // SQL query to find all blocks with custom-task-id attribute
            const sql = `SELECT * FROM blocks WHERE id IN (
                SELECT block_id FROM attributes WHERE name = 'custom-task-id'
            )`;
            
            const response = await (globalThis as any).fetchSyncPost('/api/query/sql', { stmt: sql });
            
            if (!response.data) {
                logger.info('[Cache] No task blocks found');
                return;
            }
            
            const blocks = response.data as Array<{ id: string; content: string }>;
            
            for (const block of blocks) {
                await this.refreshBlockTask(block.id);
            }
            
            logger.info(`[Cache] Refreshed ${blocks.length} tasks from block attributes`);
        } catch (error) {
            logger.error('[Cache] Failed to refresh tasks', error);
            throw error;
        }
    }

    /**
     * Refresh tasks in a specific document
     * 
     * @param docId - SiYuan document (root block) ID
     */
    private async refreshDocumentTasks(docId: string): Promise<void> {
        try {
            // Query blocks in document with task attributes
            const sql = `SELECT * FROM blocks WHERE root_id = '${docId}' AND id IN (
                SELECT block_id FROM attributes WHERE name = 'custom-task-id'
            )`;
            
            const response = await (globalThis as any).fetchSyncPost('/api/query/sql', { stmt: sql });
            
            if (!response.data) return;
            
            const blocks = response.data as Array<{ id: string }>;
            
            for (const block of blocks) {
                await this.refreshBlockTask(block.id);
            }
        } catch (error) {
            logger.error('[Cache] Failed to refresh document tasks', error);
        }
    }

    /**
     * Refresh single task from block attributes
     * 
     * API: /api/attr/getBlockAttrs
     * 
     * @param blockId - SiYuan block ID
     */
    private async refreshBlockTask(blockId: string): Promise<void> {
        try {
            const response = await (globalThis as any).fetchSyncPost('/api/attr/getBlockAttrs', { id: blockId });
            
            if (!response.data) return;
            
            const attrs = response.data as TaskBlockAttributes;
            const task = this.blockAttributesToTask(blockId, attrs);
            
            if (task) {
                this.tasks.set(task.id, task);
                
                if (this.taskIndex) {
                    this.taskIndex.updateInIndex(task);
                }
                
                this.monitoredBlocks.add(blockId);
            }
        } catch (error) {
            logger.error('[Cache] Failed to refresh block task', { blockId, error });
        }
    }

    /**
     * Convert SiYuan block attributes to Task model
     * 
     * Attributes format:
     * - custom-task-id: UUID
     * - custom-task-name: String
     * - custom-task-status: 'todo' | 'done' | 'cancelled'
     * - custom-task-due: ISO 8601 date string
     * - custom-task-enabled: 'true' | 'false'
     * - custom-task-recurrence-rrule: RFC 5545 RRule string
     * 
     * @param blockId - SiYuan block ID (stored as sourceBlockId)
     * @param attrs - Block attributes object
     * @returns Parsed Task or null if invalid
     */
    private blockAttributesToTask(blockId: string, attrs: TaskBlockAttributes): Task | null {
        const taskId = attrs['custom-task-id'];
        if (!taskId) return null;
        
        // Parse recurrence from block attributes
        const rrule = attrs['custom-task-recurrence-rrule'];
        const recurrence = rrule ? {
            rrule,
            baseOnToday: false, // Default value
            timezone: 'UTC',
        } : undefined;
        
        const task: Task & { sourceBlockId?: string } = {
            id: taskId,
            name: attrs['custom-task-name'] || 'Untitled Task',
            status: (attrs['custom-task-status'] as any) || 'todo',
            enabled: attrs['custom-task-enabled'] === 'true',
            dueAt: attrs['custom-task-due'] || new Date().toISOString(),
            recurrence,
            createdAt: new Date().toISOString(),
            updatedAt: attrs['custom-task-updated-at'] || new Date().toISOString(),
            sourceBlockId: blockId,
        };
        
        return task;
    }

    /**
     * Sync task to SiYuan block attributes
     * 
     * API: /api/attr/setBlockAttrs
     * 
     * @param task - Task to sync (must have sourceBlockId)
     */
    private async syncTaskToBlockAttributes(task: Task): Promise<void> {
        const blockId = (task as any).sourceBlockId;
        if (!blockId) {
            logger.warn('[Cache] Task has no sourceBlockId, cannot sync', { taskId: task.id });
            return;
        }
        
        const attrs: Record<string, string> = {
            'custom-task-id': task.id,
            'custom-task-name': task.name,
            'custom-task-status': task.status,
            'custom-task-enabled': task.enabled.toString(),
            'custom-task-due': task.dueAt,
            'custom-task-updated-at': new Date().toISOString(),
        };
        
        // Add recurrence attributes if present
        if (task.recurrence?.rrule) {
            attrs['custom-task-recurrence-rrule'] = task.recurrence.rrule;
        }
        
        try {
            await (globalThis as any).fetchSyncPost('/api/attr/setBlockAttrs', {
                id: blockId,
                attrs,
            });
            
            logger.debug('[Cache] Synced task to block attributes', { taskId: task.id });
        } catch (error) {
            logger.error('[Cache] Failed to sync task to block attributes', error);
        }
    }

    /**
     * Clear block attributes for deleted task
     * 
     * Sets all custom-task-* attributes to empty string
     * 
     * @param blockId - SiYuan block ID
     */
    private async clearBlockAttributes(blockId: string): Promise<void> {
        try {
            // Get current attributes
            const response = await (globalThis as any).fetchSyncPost('/api/attr/getBlockAttrs', { id: blockId });
            
            if (!response.data) return;
            
            const attrs = response.data as Record<string, string>;
            
            // Build object with empty values for all custom-task-* attributes
            const clearAttrs: Record<string, string> = {};
            for (const key of Object.keys(attrs)) {
                if (key.startsWith('custom-task-')) {
                    clearAttrs[key] = '';
                }
            }
            
            if (Object.keys(clearAttrs).length > 0) {
                await (globalThis as any).fetchSyncPost('/api/attr/setBlockAttrs', {
                    id: blockId,
                    attrs: clearAttrs,
                });
            }
        } catch (error) {
            logger.error('[Cache] Failed to clear block attributes', error);
        }
    }

    /**
     * Cleanup and destroy cache
     * 
     * Process:
     * 1. Clear debounce timer
     * 2. Close websocket connection
     * 3. Unsubscribe from all events
     * 4. Clear all data structures
     */
    destroy(): void {
        // Clear debounce timer
        if (this.updateDebounceTimer !== null) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }
        
        // Close websocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        // Unsubscribe from all events
        for (const unsubscribe of this.eventHandlers) {
            unsubscribe();
        }
        this.eventHandlers = [];
        
        // Clear data
        this.tasks.clear();
        this.pendingUpdates.clear();
        this.monitoredBlocks.clear();
        this.state = State.Cold;
        
        logger.info('[Cache] Destroyed successfully');
    }

    /**
     * Legacy compatibility method (matches old interface)
     * 
     * @deprecated Use destroy() instead
     */
    public unload(): void {
        this.destroy();
    }
}
