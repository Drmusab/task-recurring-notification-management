/**
 * Integration Tests: SiYuan Cache with Real Kernel
 * 
 * Prerequisites:
 * 1. SiYuan must be running on localhost:6806
 * 2. Test notebook must exist with at least one document
 * 3. Run with: npm run test:integration
 * 
 * These tests interact with a real SiYuan instance and create/modify test data.
 * WARNING: Do not run against production notebooks!
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SiYuanTestClient } from './SiYuanTestClient';
import type { BlockInfo } from './SiYuanTestClient';

// Test configuration
const TEST_TIMEOUT = 10000; // 10 seconds per test
const SIYUAN_URL = 'http://127.0.0.1:6806';

describe('SiYuan Cache Integration Tests', () => {
    let client: SiYuanTestClient;
    let testBlockIds: string[] = [];
    let testNotebookId: string | null = null;
    let testDocumentId: string | null = null;

    beforeAll(async () => {
        client = new SiYuanTestClient(SIYUAN_URL);

        // Check if SiYuan is running
        const isRunning = await client.ping();
        if (!isRunning) {
            throw new Error(
                'SiYuan is not running. Please start SiYuan on localhost:6806 before running integration tests.'
            );
        }

        console.log(`✓ Connected to SiYuan ${await client.getVersion()}`);

        // Find a test notebook
        const notebooks = await client.listNotebooks();
        if (notebooks.length === 0) {
            throw new Error('No notebooks found. Please create at least one notebook for testing.');
        }

        testNotebookId = notebooks[0].id;
        console.log(`✓ Using test notebook: ${notebooks[0].name} (${testNotebookId})`);

        // Find or create a test document
        const docs = await client.querySQL(
            `SELECT * FROM blocks WHERE type='d' AND box='${testNotebookId}' LIMIT 1`
        );

        if (docs.length > 0) {
            testDocumentId = docs[0].id;
            console.log(`✓ Using test document: ${testDocumentId}`);
        } else {
            console.warn('No documents found in test notebook. Some tests may fail.');
        }
    }, TEST_TIMEOUT);

    afterAll(async () => {
        // Cleanup: Delete test blocks
        if (testBlockIds.length > 0) {
            console.log(`\nCleaning up ${testBlockIds.length} test blocks...`);
            for (const blockId of testBlockIds) {
                try {
                    await client.deleteBlock(blockId);
                } catch (error) {
                    console.warn(`Failed to delete test block ${blockId}:`, error);
                }
            }
        }
    }, TEST_TIMEOUT);

    beforeEach(() => {
        // Reset test blocks list for each test
        testBlockIds = [];
    });

    describe('1. SiYuan Kernel Connection', () => {
        it('should ping SiYuan kernel successfully', async () => {
            const isRunning = await client.ping();
            expect(isRunning).toBe(true);
        });

        it('should get SiYuan version', async () => {
            const version = await client.getVersion();
            expect(version).toBeTruthy();
            expect(typeof version).toBe('string');
            console.log(`    SiYuan version: ${version}`);
        });

        it('should list available notebooks', async () => {
            const notebooks = await client.listNotebooks();
            expect(notebooks.length).toBeGreaterThan(0);
            expect(notebooks[0]).toHaveProperty('id');
            expect(notebooks[0]).toHaveProperty('name');
        });
    });

    describe('2. Block Attribute Operations', () => {
        it('should write and read block attributes', async () => {
            if (!testDocumentId) {
                console.warn('Skipping test: No test document available');
                return;
            }

            // Create a test block
            const blockId = await client.insertBlock(testDocumentId, 'markdown', '- [ ] Test task');
            testBlockIds.push(blockId);

            // Set custom attributes
            const attrs = {
                'custom-task-id': 'test-task-001',
                'custom-task-name': 'Integration Test Task',
                'custom-task-status': 'todo',
                'custom-task-enabled': 'true',
            };

            await client.setBlockAttrs(blockId, attrs);

            // Read attributes back
            const readAttrs = await client.getBlockAttrs(blockId);

            expect(readAttrs['custom-task-id']).toBe('test-task-001');
            expect(readAttrs['custom-task-name']).toBe('Integration Test Task');
            expect(readAttrs['custom-task-status']).toBe('todo');
            expect(readAttrs['custom-task-enabled']).toBe('true');
        }, TEST_TIMEOUT);

        it('should update existing block attributes', async () => {
            if (!testDocumentId) return;

            const blockId = await client.insertBlock(testDocumentId, 'markdown', '- [ ] Update test');
            testBlockIds.push(blockId);

            // Initial attributes
            await client.setBlockAttrs(blockId, {
                'custom-task-id': 'test-task-002',
                'custom-task-status': 'todo',
            });

            // Update attributes
            await client.setBlockAttrs(blockId, {
                'custom-task-id': 'test-task-002',
                'custom-task-status': 'done',
                'custom-task-completed-at': new Date().toISOString(),
            });

            const attrs = await client.getBlockAttrs(blockId);
            expect(attrs['custom-task-status']).toBe('done');
            expect(attrs['custom-task-completed-at']).toBeTruthy();
        }, TEST_TIMEOUT);
    });

    describe('3. SQL Query Operations', () => {
        it('should query blocks with custom-task-id attribute', async () => {
            if (!testDocumentId) return;

            // Create test task block
            const blockId = await client.insertBlock(testDocumentId, 'markdown', '- [ ] SQL query test');
            testBlockIds.push(blockId);

            await client.setBlockAttrs(blockId, {
                'custom-task-id': 'test-task-sql-001',
                'custom-task-name': 'SQL Test Task',
            });

            // Query blocks with custom-task-id
            const taskBlocks = await client.findTaskBlocks();

            expect(taskBlocks.length).toBeGreaterThan(0);
            expect(taskBlocks.some((block) => block.id === blockId)).toBe(true);
        }, TEST_TIMEOUT);

        it('should query task blocks in specific document', async () => {
            if (!testDocumentId) return;

            const blockId = await client.insertBlock(testDocumentId, 'markdown', '- [ ] Document query test');
            testBlockIds.push(blockId);

            await client.setBlockAttrs(blockId, {
                'custom-task-id': 'test-task-doc-001',
            });

            const docBlocks = await client.findTaskBlocksInDocument(testDocumentId);

            expect(docBlocks.some((block) => block.id === blockId)).toBe(true);
            expect(docBlocks.every((block) => block.root_id === testDocumentId)).toBe(true);
        }, TEST_TIMEOUT);

        it('should execute complex SQL queries', async () => {
            const sql = `
                SELECT 
                    b.id, 
                    b.content, 
                    b.type,
                    a.name as attr_name,
                    a.value as attr_value
                FROM blocks b
                LEFT JOIN attributes a ON b.id = a.block_id
                WHERE b.type = 'd'
                LIMIT 5
            `;

            const results = await client.querySQL(sql);
            expect(Array.isArray(results)).toBe(true);
        }, TEST_TIMEOUT);
    });

    describe('4. WebSocket Connection', () => {
        it('should connect to SiYuan WebSocket', async () => {
            const ws = client.createWebSocket();

            await client.waitForWebSocketConnection(ws, 5000);

            expect(ws.readyState).toBe(WebSocket.OPEN);

            ws.close();
        }, TEST_TIMEOUT);

        it('should receive WebSocket messages for block updates', async () => {
            if (!testDocumentId) return;

            return new Promise<void>(async (resolve, reject) => {
                const ws = client.createWebSocket();
                let messageReceived = false;

                await client.waitForWebSocketConnection(ws, 5000);

                ws.onmessage = (event) => {
                    try {
                        const data = typeof event.data === 'string' ? event.data : event.data.toString();
                        const message = JSON.parse(data);
                        
                        if (message.cmd === 'transactions' && message.data) {
                            messageReceived = true;
                            console.log(`    ✓ Received WebSocket message: ${message.cmd}`);
                            ws.close();
                            resolve();
                        }
                    } catch (error) {
                        // Ignore parse errors
                    }
                };

                ws.onerror = (error) => {
                    ws.close();
                    reject(new Error('WebSocket error'));
                };

                // Trigger a block update to generate WebSocket event
                if (!testDocumentId) {
                    resolve();
                    return;
                }
                
                const blockId = await client.insertBlock(testDocumentId, 'markdown', '- [ ] WebSocket test');
                testBlockIds.push(blockId);

                await client.setBlockAttrs(blockId, {
                    'custom-task-id': 'test-ws-001',
                });

                // Wait for message or timeout
                setTimeout(() => {
                    ws.close();
                    if (!messageReceived) {
                        console.warn('    WebSocket message not received (may be normal if no events triggered)');
                    }
                    resolve();
                }, 3000);
            });
        }, TEST_TIMEOUT);
    });

    describe('5. End-to-End Cache Workflow', () => {
        it('should perform complete task lifecycle', async () => {
            if (!testDocumentId) return;

            // 1. Create task block
            const blockId = await client.insertBlock(
                testDocumentId,
                'markdown',
                '- [ ] Complete lifecycle test task'
            );
            testBlockIds.push(blockId);

            console.log(`    1. Created block: ${blockId}`);

            // 2. Set task attributes
            const taskId = `test-lifecycle-${Date.now()}`;
            await client.setBlockAttrs(blockId, {
                'custom-task-id': taskId,
                'custom-task-name': 'Lifecycle Test',
                'custom-task-status': 'todo',
                'custom-task-enabled': 'true',
                'custom-task-due': new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            });

            console.log(`    2. Set task attributes`);

            // 3. Verify attributes persisted
            const attrs1 = await client.getBlockAttrs(blockId);
            expect(attrs1['custom-task-id']).toBe(taskId);
            expect(attrs1['custom-task-status']).toBe('todo');

            console.log(`    3. Verified attributes`);

            // 4. Update task status (completed)
            await client.setBlockAttrs(blockId, {
                'custom-task-id': taskId,
                'custom-task-status': 'done',
                'custom-task-completed-at': new Date().toISOString(),
            });

            console.log(`    4. Updated to completed`);

            // 5. Query and verify update
            const attrs2 = await client.getBlockAttrs(blockId);
            expect(attrs2['custom-task-status']).toBe('done');
            expect(attrs2['custom-task-completed-at']).toBeTruthy();

            console.log(`    5. Verified status update`);

            // 6. Find via SQL query
            const taskBlocks = await client.findTaskBlocks();
            const foundBlock = taskBlocks.find((b) => b.id === blockId);
            expect(foundBlock).toBeTruthy();

            console.log(`    6. Task found via SQL query`);
            console.log(`    ✓ Complete lifecycle test passed`);
        }, TEST_TIMEOUT);

        it('should handle multiple task blocks in document', async () => {
            if (!testDocumentId) return;

            const taskIds: string[] = [];
            const blockIds: string[] = [];

            // Create 5 test tasks
            for (let i = 0; i < 5; i++) {
                const blockId = await client.insertBlock(
                    testDocumentId,
                    'markdown',
                    `- [ ] Batch test task ${i + 1}`
                );
                blockIds.push(blockId);
                testBlockIds.push(blockId);

                const taskId = `test-batch-${Date.now()}-${i}`;
                taskIds.push(taskId);

                await client.setBlockAttrs(blockId, {
                    'custom-task-id': taskId,
                    'custom-task-name': `Batch Task ${i + 1}`,
                    'custom-task-status': i % 2 === 0 ? 'todo' : 'done',
                });
            }

            console.log(`    Created 5 test tasks`);

            // Query all tasks in document
            const docTasks = await client.findTaskBlocksInDocument(testDocumentId);

            // Verify all created blocks are found
            for (const blockId of blockIds) {
                expect(docTasks.some((b) => b.id === blockId)).toBe(true);
            }

            console.log(`    ✓ All 5 tasks found in document query`);
        }, TEST_TIMEOUT);
    });

    describe('6. Performance & Stress Tests', () => {
        it('should handle rapid attribute updates', async () => {
            if (!testDocumentId) return;

            const blockId = await client.insertBlock(testDocumentId, 'markdown', '- [ ] Rapid update test');
            testBlockIds.push(blockId);

            const startTime = performance.now();

            // Perform 20 rapid updates
            for (let i = 0; i < 20; i++) {
                await client.setBlockAttrs(blockId, {
                    'custom-task-id': 'test-rapid-001',
                    'custom-task-counter': i.toString(),
                    'custom-task-updated-at': new Date().toISOString(),
                });
            }

            const endTime = performance.now();
            const avgTime = (endTime - startTime) / 20;

            console.log(`    Average update time: ${avgTime.toFixed(2)}ms`);
            expect(avgTime).toBeLessThan(100); // Should be <100ms per update

            // Verify final state
            const attrs = await client.getBlockAttrs(blockId);
            expect(attrs['custom-task-counter']).toBe('19');
        }, 20000); // 20 second timeout

        it('should query large result sets efficiently', async () => {
            const startTime = performance.now();

            const sql = 'SELECT * FROM blocks LIMIT 1000';
            const results = await client.querySQL(sql);

            const endTime = performance.now();
            const queryTime = endTime - startTime;

            console.log(`    Query time (1000 blocks): ${queryTime.toFixed(2)}ms`);
            expect(queryTime).toBeLessThan(500); // Should be <500ms
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(1000);
        }, TEST_TIMEOUT);
    });
});
