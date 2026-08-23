const fs = require('fs');
const path = require('path');

const menuPath = path.join(__dirname, '..', 'src', 'pages', 'MenuDigital.tsx');
const content = fs.readFileSync(menuPath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('isCartOpen') || line.includes('cart-footer') || line.includes('Pedir Contra Entrega') || line.includes('Total estimado')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
