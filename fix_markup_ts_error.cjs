const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// Remove unused 'markup' variable
c = c.replace(/const markup = currentMayorista\.porcentaje_ganancia \|\| 0;\n/g, '');
// Sometimes there could be CRLF
c = c.replace(/const markup = currentMayorista\.porcentaje_ganancia \|\| 0;\r\n/g, '');

fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
console.log("Unused markup variable removed.");
