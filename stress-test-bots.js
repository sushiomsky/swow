/**
 * Multi-Bot Stress Test for Wizard of Wor
 * 
 * This script spawns:
 * - 1 host (creates MP room)
 * - N clients (join the room)
 * - All clients run bot AI
 * 
 * Purpose:
 * - Test multiplayer under load
 * - Verify event system reliability
 * - Discover sync/desync bugs
 * - Measure server capacity
 * 
 * Usage:
 *   npm install playwright
 *   node stress-test-bots.js [num_bots]
 * 
 * Example:
 *   node stress-test-bots.js 10   # 1 host + 10 bot clients
 */

const { chromium } = require('playwright');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:8888';
const NUM_BOTS = parseInt(process.argv[2]) || 5; // Default: 5 bots
const HEADLESS = process.env.HEADLESS !== 'false'; // Set HEADLESS=false to see browsers
const TIMEOUT = 30000; // 30 second timeout

console.log('🤖 Multi-Bot Stress Test');
console.log('========================');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Number of bots: ${NUM_BOTS}`);
console.log(`Headless: ${HEADLESS}`);
console.log('');

async function createHost(browser) {
    console.log('👑 Creating host...');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Capture console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Autoplay]') || text.includes('[Bot]')) {
            console.log(`[Host] ${text}`);
        }
    });
    
    // Navigate with autoplay=create
    await page.goto(`${BASE_URL}/play?autoplay=create`, {
        waitUntil: 'networkidle',
        timeout: TIMEOUT,
    });
    
    // Wait for room to be created
    console.log('⏳ Waiting for room creation...');
    
    const roomCode = await page.evaluate(() => {
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                window.removeEventListener('autoplay:ready', handleReady);
                window.removeEventListener('autoplay:error', handleError);
            };
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout waiting for room creation'));
            }, 10000);

            const handleReady = (e) => {
                clearTimeout(timeout);
                cleanup();
                resolve(e.detail.roomCode);
            };

            const handleError = (e) => {
                clearTimeout(timeout);
                cleanup();
                reject(new Error(e.detail.error));
            };

            window.addEventListener('autoplay:ready', handleReady);
            window.addEventListener('autoplay:error', handleError);
        });
    });
    
    console.log(`✅ Host created room: ${roomCode}`);
    
    return { context, page, roomCode };
}

async function createBot(browser, botId, roomCode) {
    console.log(`🤖 Creating bot ${botId}...`);
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Capture console logs (only important ones)
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Bot]') || text.includes('ERROR') || text.includes('Error')) {
            console.log(`[Bot ${botId}] ${text}`);
        }
    });
    
    // Navigate with room + autoplay=bot
    await page.goto(`${BASE_URL}/play?room=${roomCode}&autoplay=bot`, {
        waitUntil: 'networkidle',
        timeout: TIMEOUT,
    });
    
    // Wait for bot to start
    const botStarted = await page.evaluate(() => {
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                window.removeEventListener('autoplay:ready', handleReady);
                window.removeEventListener('autoplay:error', handleError);
            };
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout waiting for bot to start'));
            }, 10000);

            const handleReady = () => {
                clearTimeout(timeout);
                cleanup();

                // Check if bot is running
                const running = window.bot && window.bot.isRunning;
                resolve(running);
            };

            const handleError = (e) => {
                clearTimeout(timeout);
                cleanup();
                reject(new Error(e.detail.error));
            };

            window.addEventListener('autoplay:ready', handleReady);
            window.addEventListener('autoplay:error', handleError);
        });
    });
    
    if (botStarted) {
        console.log(`✅ Bot ${botId} started successfully`);
    } else {
        console.warn(`⚠️  Bot ${botId} joined but bot AI not running`);
    }
    
    return { context, page, botId };
}

async function runStressTest() {
    console.log('🚀 Starting stress test...\n');
    
    // Launch browser
    const browser = await chromium.launch({
        headless: HEADLESS,
        args: ['--no-sandbox'], // Required for some environments
    });
    
    try {
        // Step 1: Create host
        const host = await createHost(browser);
        console.log('');
        
        // Step 2: Create bots
        console.log(`🤖 Spawning ${NUM_BOTS} bots...\n`);
        
        const bots = [];
        const startTime = Date.now();
        
        // Spawn bots in parallel
        const botPromises = [];
        for (let i = 1; i <= NUM_BOTS; i++) {
            botPromises.push(createBot(browser, i, host.roomCode));
        }
        
        const results = await Promise.allSettled(botPromises);
        
        // Check results
        let successCount = 0;
        let failCount = 0;
        
        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                bots.push(result.value);
                successCount++;
            } else {
                console.error(`❌ Bot ${i + 1} failed:`, result.reason.message);
                failCount++;
            }
        });
        
        const spawnTime = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('');
        console.log('📊 Stress Test Results');
        console.log('======================');
        console.log(`✅ Successful bots: ${successCount}/${NUM_BOTS}`);
        console.log(`❌ Failed bots: ${failCount}/${NUM_BOTS}`);
        console.log(`⏱️  Spawn time: ${spawnTime}s`);
        console.log(`🎮 Room code: ${host.roomCode}`);
        console.log('');
        
        // Keep running for observation
        if (successCount > 0) {
            console.log('🎮 Test running... Press Ctrl+C to stop');
            console.log('');
            
            // Monitor for 30 seconds
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            console.log('\n⏰ 30 seconds elapsed');
            
            // Get final stats from host
            const hostState = await host.page.evaluate(() => {
                return window.swowDebug?.getState();
            });
            
            console.log('\n📊 Final State:');
            console.log(JSON.stringify(hostState, null, 2));
        }
        
    } catch (err) {
        console.error('\n❌ Stress test failed:', err);
        throw err;
    } finally {
        console.log('\n🧹 Cleaning up...');
        await browser.close();
        console.log('✅ Browser closed');
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Interrupted by user');
    process.exit(0);
});

// Run the test
runStressTest()
    .then(() => {
        console.log('\n✅ Stress test complete!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ Stress test error:', err);
        process.exit(1);
    });
