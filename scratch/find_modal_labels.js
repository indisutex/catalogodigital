import fs from 'fs';

const content = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Productos Solicitados') || line.includes('DIRECCIÓN DE ENTREGA') || line.includes('LÍNEA / ASESOR')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
