// Test script for automation API
// Run with: node test-automation-api.js

const puppeteer = require('puppeteer');

(async () => {
    console.log('🧪 Testing Automation API...\n');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        // Test 1: Page loads and engine exists
        console.log('Test 1: Loading page...');
        await page.goto('https://wizardofwor.duckdns.org/play', {
            waitUntil: 'networkidle0',
            timeout: 10000
        });
        
        const engineExists = await page.evaluate(() => {
            return typeof window.engine !== 'undefined' && typeof window.swowDebug !== 'undefined';
        });
        
        if (engineExists) {
            console.log('✅ Test 1 PASSED: window.engine and window.swowDebug exist');
        } else {
            console.log('❌ Test 1 FAILED: APIs not found');
            throw new Error('APIs not found');
        }
        
        // Test 2: Wait for engine ready
        console.log('\nTest 2: Waiting for engine ready...');
        await page.evaluate(() => window.swowDebug.waitReady());
        
        const isReady = await page.evaluate(() => window.swowDebug.isReady());
        if (isReady) {
            console.log('✅ Test 2 PASSED: Engine is ready');
        } else {
            console.log('❌ Test 2 FAILED: Engine not ready');
        }
        
        // Test 3: Get initial state
        console.log('\nTest 3: Getting initial state...');
        const initialState = await page.evaluate(() => window.swowDebug.getState());
        console.log('State:', JSON.stringify(initialState, null, 2));
        
        if (initialState.state === 'menu') {
            console.log('✅ Test 3 PASSED: Initial state is "menu"');
        } else {
            console.log('❌ Test 3 FAILED: Expected state "menu", got:', initialState.state);
        }
        
        // Test 4: Start game via API
        console.log('\nTest 4: Starting game via swowDebug.start()...');
        const gameState = await page.evaluate(() => window.swowDebug.start(1));
        console.log('Game started:', JSON.stringify(gameState, null, 2));
        
        await page.waitForTimeout(2000); // Let game initialize
        
        const playingState = await page.evaluate(() => window.swowDebug.getState());
        if (playingState.state === 'playing') {
            console.log('✅ Test 4 PASSED: Game started successfully');
        } else {
            console.log('❌ Test 4 FAILED: Expected state "playing", got:', playingState.state);
        }
        
        // Test 5: Reset
        console.log('\nTest 5: Resetting to menu...');
        await page.evaluate(() => window.swowDebug.reset());
        await page.waitForTimeout(1000);
        
        const resetState = await page.evaluate(() => window.swowDebug.getState());
        if (resetState.state === 'menu') {
            console.log('✅ Test 5 PASSED: Reset successful');
        } else {
            console.log('❌ Test 5 FAILED: Expected state "menu", got:', resetState.state);
        }
        
        console.log('\n🎉 All tests passed!');
        
    } catch (err) {
        console.error('\n❌ Test failed:', err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
