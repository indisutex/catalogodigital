const { execSync } = require('child_process');
const output = execSync('git show 7b9ee6b~1:src/pages/MenuDigital.tsx', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const lines = output.split('\n');

const btnIdx = lines.findIndex(l => l.includes('className="checkout-btn"'));
console.log('Button context:');
for (let i = btnIdx - 10; i < btnIdx + 30; i++) {
  if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
}
