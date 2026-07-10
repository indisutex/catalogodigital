const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

// Fix TypeScript errors with `any` cast
content = content.replace(/\{selectedPedido\.cliente_nombre \|\| selectedPedido\.nombre \|\| 'Borrador Anónimo'\}/g, "{selectedPedido.cliente_nombre || (selectedPedido as any).nombre || 'Borrador Anónimo'}");
content = content.replace(/\{selectedPedido\.cliente_telefono \|\| selectedPedido\.telefono \|\| 'Sin teléfono'\}/g, "{selectedPedido.cliente_telefono || (selectedPedido as any).telefono || 'Sin teléfono'}");

fs.writeFileSync(adminPath, content);
console.log("Admin.tsx fixed TypeScript `any` cast!");
