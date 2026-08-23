const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
const content = fs.readFileSync(adminPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('activeNotifications') || (line.includes('Pedidos') && line.includes('span') && line.includes('badge')) || (line.includes('Pedidos') && line.includes('h3')) || (line.includes('Pedidos') && line.includes('h2'))) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
