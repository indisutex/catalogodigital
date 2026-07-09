const fs = require('fs');

let content = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// Replace table header
content = content.replace(
  `                        <th>Producto</th>
                        <th>Precio Base</th>
                        {role === 'mayorista' && <th>Precio Final (Calculado)</th>}
                        {role === 'mayorista' && <th>Precio Especial (Manual)</th>}`,
  `                        <th>Producto</th>
                        <th>Precio Detal</th>
                        <th>Al por Mayor</th>
                        <th>50 Unid.</th>
                        {role === 'mayorista' && <th>Precio Detal Final</th>}
                        {role === 'mayorista' && <th>Precio Especial</th>}`
);

// Replace table body row
const oldBodyRow = `                            <td>\${p.precio.toLocaleString()}</td>
                            {role === 'mayorista' && (
                              <td style={{ fontWeight: hasOverride ? 'normal' : 'bold', color: hasOverride ? '#94a3b8' : '#10b981', textDecoration: hasOverride ? 'line-through' : 'none' }}>
                                \${Math.round(p.precio * (1 + (currentMayorista?.porcentaje_ganancia || 0) / 100)).toLocaleString()}
                              </td>
                            )}
                            {role === 'mayorista' && currentMayorista && (
                              <td>`;

const newBodyRow = `                            <td>\${p.precio?.toLocaleString()}</td>
                            <td style={{ color: '#64748b' }}>{p.precio_por_mayor ? \`\$\${p.precio_por_mayor.toLocaleString()}\` : '-'}</td>
                            <td style={{ color: '#64748b' }}>{p.precio_50_unidades ? \`\$\${p.precio_50_unidades.toLocaleString()}\` : '-'}</td>
                            {role === 'mayorista' && (
                              <td style={{ fontWeight: hasOverride ? 'normal' : 'bold', color: hasOverride ? '#94a3b8' : '#10b981', textDecoration: hasOverride ? 'line-through' : 'none' }}>
                                \${Math.round(p.precio * (1 + (currentMayorista?.porcentaje_ganancia || 0) / 100)).toLocaleString()}
                              </td>
                            )}
                            {role === 'mayorista' && currentMayorista && (
                              <td>`;

if (content.includes(oldBodyRow)) {
  content = content.replace(oldBodyRow, newBodyRow);
  fs.writeFileSync('src/pages/Admin.tsx', content, 'utf8');
  console.log("Tabla de productos actualizada con precios al por mayor y 50 unidades.");
} else {
  // Intentar con CRLF si falló con LF
  const oldBodyRowCRLF = oldBodyRow.replace(/\n/g, '\r\n');
  if (content.includes(oldBodyRowCRLF)) {
    content = content.replace(oldBodyRowCRLF, newBodyRow);
    fs.writeFileSync('src/pages/Admin.tsx', content, 'utf8');
    console.log("Tabla de productos actualizada (CRLF).");
  } else {
    console.log("No se pudo encontrar el bloque para reemplazar en la tabla.");
  }
}
