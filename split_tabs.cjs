const fs = require('fs');

let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Add to TabType
c = c.replace(
  "type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo' | 'pos' | 'clientes' | 'asesores' | 'mayoristas' | 'perfil_asesor' | 'resumen_asesor' | 'notificaciones_asesor' | 'material_apoyo' | 'material_asesor' | 'productos_asesor';",
  "type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo' | 'pos' | 'clientes' | 'asesores' | 'mayoristas' | 'perfil_asesor' | 'resumen_asesor' | 'notificaciones_asesor' | 'material_apoyo' | 'material_asesor' | 'productos_asesor' | 'productos_mayorista';"
);

// 2. Add to allowedTabs
c = c.replace(
  "const allowedTabs: string[] = ['dashboard', 'productos', 'categorias', 'pedidos', 'clientes', 'asesores', 'mayoristas', 'pos', 'siigo', 'config', 'perfil_asesor', 'resumen_asesor', 'notificaciones_asesor', 'material_apoyo', 'material_asesor', 'productos_asesor'];",
  "const allowedTabs: string[] = ['dashboard', 'productos', 'categorias', 'pedidos', 'clientes', 'asesores', 'mayoristas', 'pos', 'siigo', 'config', 'perfil_asesor', 'resumen_asesor', 'notificaciones_asesor', 'material_apoyo', 'material_asesor', 'productos_asesor', 'productos_mayorista'];"
);

// 3. Update Sidebar for Mayorista
c = c.replace(
  /onClick=\{\(\) => handleSelectTab\('productos_asesor'\)\}\>\s*<span className="nav-icon"\><Package size=\{14\} \/\><\/span\> Productos\s*\{activeTab === 'productos_asesor' && <span className="active-dot"\><\/span\>\}\s*<\/button\>/,
  `onClick={() => handleSelectTab('productos_mayorista')}>
              <span className="nav-icon"><Package size={14} /></span> Productos
              {activeTab === 'productos_mayorista' && <span className="active-dot"></span>}
            </button>`
);

// 4. Split the block
const startIdx = c.indexOf("{/* ── PRODUCTOS ASESOR / MAYORISTA TAB ── */}");
const nextTabIdx = c.indexOf("{/* ── MATERIAL DE APOYO ASESOR / MAYORISTA TAB ── */}");

if (startIdx !== -1 && nextTabIdx !== -1) {
  const block = c.substring(startIdx, nextTabIdx);
  
  // Asesor block (clean)
  let asesorBlock = block.replace("{/* ── PRODUCTOS ASESOR / MAYORISTA TAB ── */}", "{/* ── PRODUCTOS ASESOR TAB ── */}");
  // Remove mayorista markup logic from top
  asesorBlock = asesorBlock.replace(
    /\{role === 'mayorista' && \([\s\S]*?\)\s*\)\}/, 
    ""
  );
  // Simplify description
  asesorBlock = asesorBlock.replace(
    /\{role === 'mayorista' \? 'Configura tu porcentaje de ganancia general o precios especiales por producto.' : 'Visualiza los productos disponibles en el catálogo de la empresa.'\}/,
    "'Visualiza los productos disponibles en el catálogo de la empresa.'"
  );
  // Remove mayorista overrides logic from map
  asesorBlock = asesorBlock.replace(
    /let hasOverride = false;\s*let overrideVal = '';\s*if \(role === 'mayorista' && currentMayorista\) \{[\s\S]*?\}\s*\}\s*return \(/,
    "return ("
  );
  // Remove final price logic
  asesorBlock = asesorBlock.replace(
    /\{role === 'mayorista' && currentMayorista && \([\s\S]*?\)\}/,
    ""
  );
  // Remove action logic
  asesorBlock = asesorBlock.replace(
    /\{role === 'mayorista' && currentMayorista && \([\s\S]*?<\/[ \t]*div>\s*\)\}/g,
    ""
  );
  // For any remaining single cases
  asesorBlock = asesorBlock.replace(/\{role === 'mayorista' && currentMayorista && \([\s\S]*?\}\s*\)\}/, "");

  // Mayorista block (clean)
  let mayoristaBlock = block.replace("{/* ── PRODUCTOS ASESOR / MAYORISTA TAB ── */}", "{/* ── PRODUCTOS MAYORISTA TAB ── */}");
  mayoristaBlock = mayoristaBlock.replace(/activeTab === 'productos_asesor'/g, "activeTab === 'productos_mayorista'");
  
  // Simplify description
  mayoristaBlock = mayoristaBlock.replace(
    /\{role === 'mayorista' \? 'Configura tu porcentaje de ganancia general o precios especiales por producto.' : 'Visualiza los productos disponibles en el catálogo de la empresa.'\}/,
    "'Configura tu porcentaje de ganancia general o precios especiales por producto.'"
  );
  
  // Replace the old combined block with the two new blocks
  c = c.substring(0, startIdx) + asesorBlock + "\n\n" + mayoristaBlock + "\n\n" + c.substring(nextTabIdx);
}

fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
console.log('Tabs split successfully');
