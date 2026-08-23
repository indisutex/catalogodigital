const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
const content = fs.readFileSync(adminPath, 'utf8');

// Find all places where the bell counter or pedidos badge is rendered
const lines = content.split('\n');
console.log('Total lines in Admin.tsx:', lines.length);

lines.forEach((line, i) => {
  if (line.includes('Bell') || line.includes('pedidos') && line.includes('badge') || line.includes('notificaciones') || line.includes('activeNotifications')) {
    if (i < 3000) {
      console.log(`L${i+1}: ${line.trim()}`);
    }
  }
});
