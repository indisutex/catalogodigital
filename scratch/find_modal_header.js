import fs from 'fs';

const content = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('selectedPedido.cliente_nombre') && line.includes('<h')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
