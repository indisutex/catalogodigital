import fs from 'fs';

const content = fs.readFileSync('src/pages/Admin.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Cobrar por WhatsApp') || line.includes('Cobrar') || line.includes('api.whatsapp.com') || line.includes('wa.me')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
