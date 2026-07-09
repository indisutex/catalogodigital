const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Remove finalPrice
c = c.replace(/let finalPrice = p.precio;\n(.*?)let hasOverride = false;/g, 'let hasOverride = false;');
c = c.replace(/finalPrice = p.precio \* \(1 \+ markup \/ 100\);/g, '');
c = c.replace(/finalPrice = Number\(overrides\[p.id\]\);/g, '');

// 2. Fix p.imagenes and p.codigo
c = c.replace(/p\.imagenes && p\.imagenes\[0\]/g, 'p.imagen_url');
c = c.replace(/p\.imagenes\[0\]/g, 'p.imagen_url');
c = c.replace(/\{p\.codigo\}/g, '{p.referencia}');

fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
console.log("Fixes applied to Admin.tsx");
