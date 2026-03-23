# Automation API Test Guide

## Manual Console Tests

Open https://wizardofwor.duckdns.org/play in your browser and run these commands in the console:

### Test 1: Check APIs exist
```javascript
console.assert(window.engine !== undefined, 'window.engine should exist');
console.assert(window.swowDebug !== undefined, 'window.swowDebug should exist');
console.log('✅ APIs loaded');
```

### Test 2: Check engine is ready
```javascript
console.log('Ready:', window.swowDebug.isReady());
// Should return: true (after ~500ms page load)
```

### Test 3: Get initial state
```javascript
const state = window.swowDebug.getState();
console.log('State:', state);
// Expected: { state: 'menu', mode: null, ... }
```

### Test 4: Start single-player game
```javascript
await window.swowDebug.start();
console.log('Game started:', window.swowDebug.getState());
// Expected: { state: 'playing', mode: 'sp', ... }
```

### Test 5: Start 2-player game
```javascript
await window.swowDebug.start(2);
// Should start local 2P game
```

### Test 6: Reset to menu
```javascript
await window.swowDebug.reset();
console.log('Reset:', window.swowDebug.getState());
// Expected: { state: 'menu', mode: null, ... }
```

### Test 7: Create multiplayer room
```javascript
const state = await window.swowDebug.createRoom();
console.log('Room created:', state.roomCode);
// Should return room code (e.g., "ABC123")
```

### Test 8: Join room (in second tab)
```javascript
await window.swowDebug.join('ABC123');
console.log('Joined:', window.swowDebug.getState());
// Expected: { state: 'playing', mode: 'mp', roomCode: 'ABC123', ... }
```

---

## URL-Based Autoplay Tests

### Test 9: Autoplay single-player
```
https://wizardofwor.duckdns.org/play?autoplay=1
```
Expected: Game starts automatically

### Test 10: Autoplay 2-player
```
https://wizardofwor.duckdns.org/play?autoplay=1&players=2
```
Expected: 2P game starts automatically

### Test 11: Autoplay create room
```
https://wizardofwor.duckdns.org/play?autoplay=create
```
Expected: MP room created automatically

### Test 12: Autoplay join room
```
https://wizardofwor.duckdns.org/play?room=ABC123&autoplay=1
```
Expected: Joins room ABC123 automatically

---

## Playwright Example

```javascript
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Navigate to page
    await page.goto('https://wizardofwor.duckdns.org/play');
    
    // Wait for engine ready
    await page.waitForFunction(() => window.swowDebug?.isReady());
    
    // Start game
    await page.evaluate(() => window.swowDebug.start());
    
    // Wait for playing state
    await page.waitForFunction(() => 
        window.swowDebug.getState().state === 'playing'
    );
    
    // Get state
    const state = await page.evaluate(() => window.swowDebug.getState());
    console.log('State:', state);
    
    await browser.close();
})();
```

---

## Success Criteria

✅ window.engine exists on page load  
✅ window.swowDebug exists on page load  
✅ engine.getState() returns valid JSON  
✅ swowDebug.start() starts game  
✅ swowDebug.createRoom() creates MP room  
✅ swowDebug.join(code) joins room  
✅ swowDebug.reset() returns to menu  
✅ ?autoplay=1 starts game automatically  
✅ ?autoplay=create creates room automatically  
✅ No breaking changes to UI  

---

*Generated: 2026-03-23*
