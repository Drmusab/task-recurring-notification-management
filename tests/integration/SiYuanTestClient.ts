/**
 * SiYuan HTTP Client for Integration Testing
 * 
 * Provides typed HTTP interface to SiYuan kernel API for integration tests.
 * Uses standard fetch API for compatibility with browser and Node.js environments.
 * 
 * Default: http://127.0.0.1:6806
 * WebSocket: ws://127.0.0.1:6806/ws
 */

// Import WebSocket for Node.js environment
import WebSocket from 'ws';

/**
 * Standard SiYuan API response structure
 */
export interface SiYuanResponse<T = any> {
    code: number;
    msg: string;
    data: T;
}

/**
 * Block information from SiYuan
 */
export interface BlockInfo {
    id: string;
    content: string;
    markdown: string;
    type: string;
    subtype?: string;
    box?: string;       // Notebook ID
    path?: string;      // Document path
    root_id?: string;   // Parent document ID
    created?: string;
    updated?: string;
    [key: string]: any;
}

/**
 * Notebook information
 */
export interface NotebookInfo {
    id: string;
    name: string;
    closed: boolean;
    [key: string]: any;
}

/**
 * SiYuan kernel version info
 */
export interface VersionInfo {
    version: string;
    [key: string]: any;
}

/**
 * HTTP client for SiYuan kernel API
 * 
 * Usage:
 * ```typescript
 * const client = new SiYuanTestClient();
 * const isRunning = await client.ping();
 * const attrs = await client.getBlockAttrs('block-id');
 * ```
 */
export class SiYuanTestClient {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://127.0.0.1:6806') {
        this.baseUrl = baseUrl;
    }

    /**
     * Make HTTP POST request to SiYuan API
     */
    private async request<T>(endpoint: string, data: any = {}): Promise<SiYuanResponse<T>> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`SiYuan API request failed: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Ping SiYuan kernel to check if running
     * 
     * @returns true if SiYuan is running and accessible
     */
    async ping(): Promise<boolean> {
        try {
            const result = await this.request<VersionInfo>('/api/system/version');
            return result.code === 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get SiYuan version
     */
    async getVersion(): Promise<string | null> {
        try {
            const result = await this.request<VersionInfo>('/api/system/version');
            return result.code === 0 ? result.data.version : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Set block attributes
     * 
     * API: /api/attr/setBlockAttrs
     */
    async setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
        const result = await this.request('/api/attr/setBlockAttrs', {
            id: blockId,
            attrs,
        });

        if (result.code !== 0) {
            throw new Error(`Failed to set block attributes: ${result.msg}`);
        }
    }

    /**
     * Get block attributes
     * 
     * API: /api/attr/getBlockAttrs
     */
    async getBlockAttrs(blockId: string): Promise<Record<string, string>> {
        const result = await this.request<Record<string, string>>('/api/attr/getBlockAttrs', {
            id: blockId,
        });

        if (result.code !== 0) {
            throw new Error(`Failed to get block attributes: ${result.msg}`);
        }

        return result.data || {};
    }

    /**
     * Get block by ID
     * 
     * API: /api/block/getBlockByID
     */
    async getBlockByID(blockId: string): Promise<BlockInfo | null> {
        const result = await this.request<{ block: BlockInfo }>('/api/block/getBlockInfo', {
            id: blockId,
        });

        if (result.code !== 0) {
            return null;
        }

        return result.data?.block || null;
    }

    /**
     * Update block content
     * 
     * API: /api/block/updateBlock
     */
    async updateBlock(blockId: string, content: string): Promise<void> {
        const result = await this.request('/api/block/updateBlock', {
            id: blockId,
            data: content,
            dataType: 'markdown',
        });

        if (result.code !== 0) {
            throw new Error(`Failed to update block: ${result.msg}`);
        }
    }

    /**
     * Execute SQL query
     * 
     * API: /api/query/sql
     */
    async querySQL(sql: string): Promise<any[]> {
        const result = await this.request<any[]>('/api/query/sql', {
            stmt: sql,
        });

        if (result.code !== 0) {
            throw new Error(`Failed to execute SQL: ${result.msg}`);
        }

        return result.data || [];
    }

    /**
     * Create a new block
     * 
     * API: /api/block/insertBlock
     */
    async insertBlock(
        previousId: string,
        dataType: 'markdown' | 'dom' = 'markdown',
        data: string
    ): Promise<string> {
        const result = await this.request<Array<{ id: string }>>('/api/block/insertBlock', {
            previousID: previousId,
            dataType,
            data,
        });

        if (result.code !== 0 || !result.data || result.data.length === 0) {
            throw new Error(`Failed to insert block: ${result.msg}`);
        }

        return result.data[0].id;
    }

    /**
     * Delete a block
     * 
     * API: /api/block/deleteBlock
     */
    async deleteBlock(blockId: string): Promise<void> {
        const result = await this.request('/api/block/deleteBlock', {
            id: blockId,
        });

        if (result.code !== 0) {
            throw new Error(`Failed to delete block: ${result.msg}`);
        }
    }

    /**
     * Get all notebooks
     * 
     * API: /api/notebook/lsNotebooks
     */
    async listNotebooks(): Promise<NotebookInfo[]> {
        const result = await this.request<{ notebooks: NotebookInfo[] }>('/api/notebook/lsNotebooks');

        if (result.code !== 0) {
            throw new Error(`Failed to list notebooks: ${result.msg}`);
        }

        return result.data?.notebooks || [];
    }

    /**
     * Find blocks with custom-task-id attribute
     * 
     * Helper for testing task persistence
     */
    async findTaskBlocks(): Promise<BlockInfo[]> {
        const sql = `
            SELECT * FROM blocks WHERE id IN (
                SELECT block_id FROM attributes WHERE name = 'custom-task-id'
            )
        `;
        return await this.querySQL(sql);
    }

    /**
     * Find task blocks in specific document
     */
    async findTaskBlocksInDocument(docId: string): Promise<BlockInfo[]> {
        const sql = `
            SELECT * FROM blocks WHERE root_id = '${docId}' AND id IN (
                SELECT block_id FROM attributes WHERE name = 'custom-task-id'
            )
        `;
        return await this.querySQL(sql);
    }

    /**
     * Create WebSocket connection to SiYuan
     * 
     * Endpoint: ws://127.0.0.1:6806/ws
     */
    createWebSocket(): WebSocket {
        const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
        return new WebSocket(wsUrl);
    }

    /**
     * Wait for WebSocket to connect
     */
    async waitForWebSocketConnection(ws: WebSocket, timeout: number = 5000): Promise<void> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, timeout);

            ws.onopen = () => {
                clearTimeout(timer);
                resolve();
            };

            ws.onerror = (error) => {
                clearTimeout(timer);
                reject(new Error('WebSocket connection error'));
            };
        });
    }
}
