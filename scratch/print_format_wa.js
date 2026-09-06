import fs from 'fs';

const content = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');
const lines = content.split('\n');

for (let i = 15; i <= 30; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
