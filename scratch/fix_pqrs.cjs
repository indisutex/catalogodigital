const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

const oldStr = `    // 3. PQRS pendientes
    const pendingPqrs = listaPqrs.filter(p => p.estado === 'pendiente');
    pendingPqrs.forEach(pq => {
      list.push({
        id: \`admin-pqrs-\${pq.id}\`,
        type: 'warning',
        title: \`📩 PQRS: \${(pq.tipo || '').toUpperCase()}\`,
        message: \`Cliente \${pq.nombre_cliente} (\${pq.telefono}) radicó un \${pq.tipo}. Requiere respuesta.\`,
        actionTab: 'pqrs',
        time: pq.created_at
      });
    });`;

const newStr = `    // 3. PQRS pendientes
    const pendingPqrs = listaPqrs.filter(p => p.estado === 'pendiente');
    pendingPqrs.forEach(pq => {
      list.push({
        id: \`admin-pqrs-\${pq.id}\`,
        type: 'warning',
        title: \`📩 PQRS: \${(pq.motivo || 'Solicitud').toUpperCase()}\`,
        message: \`Cliente \${pq.nombre_cliente} (\${pq.telefono_cliente || 'Sin teléfono'}) radicó: "\${pq.motivo}". Requiere respuesta.\`,
        actionTab: 'pqrs',
        time: pq.created_at
      });
    });`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(adminPath, content, 'utf8');
  console.log('Fixed PQRS properties in Admin.tsx');
} else {
  console.error('Could not find PQRS block to replace');
}
