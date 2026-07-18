const fs = require('fs');
const code = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('getMotivationalPhrase')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
