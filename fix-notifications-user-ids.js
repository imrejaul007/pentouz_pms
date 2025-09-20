import fs from 'fs';

const filePath = './src/routes/notifications.js';

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Replace all instances of req.user.id with req.user._id
content = content.replace(/req\.user\.id/g, 'req.user._id');

// Write back to file
fs.writeFileSync(filePath, content);

console.log('✅ Fixed all instances of req.user.id to req.user._id in notifications.js');
