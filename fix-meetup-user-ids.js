import fs from 'fs';
import path from 'path';

const filePath = './src/routes/meetUpRequests.js';

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Replace all instances of req.user.id with req.user._id
content = content.replace(/req\.user\.id/g, 'req.user._id');

// Write back to file
fs.writeFileSync(filePath, content);

console.log('✅ Fixed all instances of req.user.id to req.user._id in meetUpRequests.js');
