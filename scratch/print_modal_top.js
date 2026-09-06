import fs from 'fs';

const content = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');
const lines = content.split('\n');

for (let i = 15550; i <= 15660; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
