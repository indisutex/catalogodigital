const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

const normalize = s => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

// Col 0: Cancelados
const oldCol0Bg = `style={{ background: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px', boxShadow: '0 4px 16px rgba(220,38,38,0.02)' }}`;
const newCol0Bg = `style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}`;

// Col 2: Contra Entrega
const oldCol2Bg = `style={{ background: '#fff7ed', borderRadius: '16px', border: '1px solid #ffedd5', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px', boxShadow: '0 4px 16px rgba(234,88,12,0.03)' }}`;
const newCol2Bg = `style={{ background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '500px', boxShadow: '0 4px 16px rgba(15,23,42,0.02)' }}`;

let count = 0;
if (normContent.includes(oldCol0Bg)) {
  normContent = normContent.replace(oldCol0Bg, newCol0Bg);
  count++;
}
if (normContent.includes(oldCol2Bg)) {
  normContent = normContent.replace(oldCol2Bg, newCol2Bg);
  count++;
}

console.log('Replaced', count, 'column backgrounds');

fs.writeFileSync(adminPath, normContent, 'utf8');
