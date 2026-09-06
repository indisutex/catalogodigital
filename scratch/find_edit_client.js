import fs from 'fs';

const content = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Editar Cliente') || line.includes('editar_telefono') || line.includes('editandoCliente') || line.includes('isEditingCustomer')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
