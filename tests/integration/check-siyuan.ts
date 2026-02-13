/**
 * Integration Test Setup Script
 * 
 * Checks if SiYuan is running and ready for integration tests.
 * Run before executing integration tests: npm run test:check-siyuan
 */

import { SiYuanTestClient } from './SiYuanTestClient';

const SIYUAN_URL = 'http://127.0.0.1:6806';
const REQUIRED_PORT = 6806;

async function checkSiYuanConnection(): Promise<void> {
    console.log('🔍 Checking SiYuan kernel connection...\n');

    const client = new SiYuanTestClient(SIYUAN_URL);

    try {
        // Test connection
        const isRunning = await client.ping();

        if (!isRunning) {
            throw new Error('SiYuan kernel did not respond');
        }

        // Get version
        const version = await client.getVersion();
        console.log(`✅ SiYuan is running`);
        console.log(`   Version: ${version}`);
        console.log(`   URL: ${SIYUAN_URL}\n`);

        // List notebooks
        const notebooks = await client.listNotebooks();
        console.log(`📚 Found ${notebooks.length} notebook(s):`);
        notebooks.forEach((nb, i) => {
            console.log(`   ${i + 1}. ${nb.name} (${nb.id})`);
        });
        console.log();

        // Count documents
        const docs = await client.querySQL("SELECT COUNT(*) as count FROM blocks WHERE type='d'");
        const docCount = docs[0]?.count || 0;
        console.log(`📄 Total documents: ${docCount}\n`);

        // Check for existing test tasks
        const testTasks = await client.querySQL(`
            SELECT COUNT(*) as count FROM blocks WHERE id IN (
                SELECT block_id FROM attributes 
                WHERE name = 'custom-task-id' AND value LIKE 'test-%'
            )
        `);
        const testTaskCount = testTasks[0]?.count || 0;
        
        if (testTaskCount > 0) {
            console.log(`⚠️  Warning: Found ${testTaskCount} existing test task block(s)`);
            console.log(`   These may be from previous failed tests.\n`);
        }

        // Test WebSocket
        console.log('🔌 Testing WebSocket connection...');
        const ws = client.createWebSocket();
        
        try {
            await client.waitForWebSocketConnection(ws, 3000);
            console.log('✅ WebSocket connection successful');
            ws.close();
        } catch (error) {
            console.log('❌ WebSocket connection failed');
            console.log(`   This may affect real-time update tests\n`);
        }

        console.log('\n✨ SiYuan is ready for integration tests!\n');
        console.log('Run tests with: npm run test:integration\n');

    } catch (error) {
        console.error('❌ SiYuan is NOT running or not accessible\n');
        console.error('Please ensure:');
        console.error(`  1. SiYuan application is running`);
        console.error(`  2. SiYuan is listening on port ${REQUIRED_PORT}`);
        console.error(`  3. No firewall is blocking localhost connections\n`);
        console.error('To start SiYuan:');
        console.error('  - Windows: Launch SiYuan.exe');
        console.error('  - macOS: Open SiYuan.app');
        console.error('  - Linux: Run ./SiYuan.AppImage\n');
        
        if (error instanceof Error) {
            console.error(`Error details: ${error.message}\n`);
        }
        
        process.exit(1);
    }
}

checkSiYuanConnection();
