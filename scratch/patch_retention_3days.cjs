const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

console.log('Original content length:', content.length);

// Replace 7 days in ms with 3 days in ms
const oldMs = 'const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;';
const newMs = 'const RETENTION_MS = 3 * 24 * 60 * 60 * 1000;';

let countMs = 0;
while (content.includes(oldMs)) {
  content = content.replace(oldMs, newMs);
  countMs++;
}
console.log(`Replaced RETENTION_MS occurrences: ${countMs}`);

// Replace text references
const oldTimerText = "let timerText = '7 días';";
const newTimerText = "let timerText = '3 días';";
if (content.includes(oldTimerText)) {
  content = content.replace(oldTimerText, newTimerText);
  console.log('Replaced timerText');
}

const oldAutoText = "<span>Autoborrado tras <strong style={{ fontWeight: 600, color: '#dc2626' }}>7 días</strong></span>";
const newAutoText = "<span>Autoborrado tras <strong style={{ fontWeight: 600, color: '#dc2626' }}>3 días</strong></span>";
if (content.includes(oldAutoText)) {
  content = content.replace(oldAutoText, newAutoText);
  console.log('Replaced autoText');
}

const oldModalText = "<span>Esta tarjeta se eliminará automáticamente en: <strong style={{ fontWeight: 600, color: '#dc2626' }}>${remText}</strong> (retención de 7 días).</span>";
const newModalText = "<span>Esta tarjeta se eliminará automáticamente en: <strong style={{ fontWeight: 600, color: '#dc2626' }}>${remText}</strong> (retención de 3 días).</span>";
if (content.includes(oldModalText)) {
  content = content.replace(oldModalText, newModalText);
  console.log('Replaced modalText');
}

fs.writeFileSync(adminPath, content, 'utf8');
console.log('Updated Admin.tsx retention to 3 days successfully!');
