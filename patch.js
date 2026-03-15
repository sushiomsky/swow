// This script unpacks the compressed w.js, patches it for offline use, and saves the result
const fs = require('fs');

// Read the packed source
const packed = fs.readFileSync(__dirname + '/js/v5.0/w.js', 'utf8');

// The JS uses a custom packing scheme. The last line is the unpacker.
// We need to find and execute the unpacking to get the source, then patch it.

// Extract the packed data string and the unpacking code
// The format is: _='...packed...';for(Y in $='...keys...')with(_.split($[Y]))_=join(pop());eval(_)

// We'll modify it to not eval but return the unpacked string
let unpackCode = packed.replace('eval(_)', '');

// Execute the unpacking to get the source
let _ = '';
let $ = '';
let Y = '';
eval(unpackCode);

let source = _;

// Now patch the source for offline use:

// 1. Remove the domain check that redirects to the original site
// The code checks: document.location.host and redirects to https://wizardofwor.krissz.hu/
source = source.replace(/document\.location="https:\/\/wizardofwor\.krissz\.hu\/"/g, '');

// 2. Remove the host check condition that causes the redirect
// Look for the pattern that checks the host and bypasses it
source = source.replace(
    /\"wizardofwor\.krissz\.hu\"!=document\.location\.host/g,
    'false'
);

// Also handle alternative forms
source = source.replace(
    /\"wizardofwor\.krissz\.hu\"==document\.location\.host/g,
    'true'
);

// 3. Remove unsupported browser redirect
source = source.replace(
    /document\.location="\/unsupported-browser\.html"/g,
    ''
);

// Write the unpacked and patched source
fs.writeFileSync(__dirname + '/js/v5.0/w.js', source, 'utf8');
console.log('✅ Successfully unpacked and patched w.js for offline use!');
console.log(`   Source size: ${source.length} characters`);
