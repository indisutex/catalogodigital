import fs from 'fs';

const content = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');
const lines = content.split('\n');

for (let i = 15470; i <= 15550; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
