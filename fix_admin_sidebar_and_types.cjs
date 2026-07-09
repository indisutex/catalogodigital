const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Update TabType
c = c.replace(
  `type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo' | 'pos' | 'clientes' | 'asesores' | 'mayoristas' | 'perfil_asesor' | 'resumen_asesor' | 'notificaciones_asesor' | 'material_apoyo' | 'material_asesor';`,
  `type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo' | 'pos' | 'clientes' | 'asesores' | 'mayoristas' | 'perfil_asesor' | 'resumen_asesor' | 'notificaciones_asesor' | 'material_apoyo' | 'material_asesor' | 'productos_asesor';`
);

// 2. Update allowedTabs
c = c.replace(
  `const allowedTabs: string[] = ['dashboard', 'productos', 'categorias', 'pedidos', 'clientes', 'asesores', 'mayoristas', 'pos', 'siigo', 'config', 'perfil_asesor', 'resumen_asesor', 'notificaciones_asesor', 'material_apoyo', 'material_asesor'];`,
  `const allowedTabs: string[] = ['dashboard', 'productos', 'categorias', 'pedidos', 'clientes', 'asesores', 'mayoristas', 'pos', 'siigo', 'config', 'perfil_asesor', 'resumen_asesor', 'notificaciones_asesor', 'material_apoyo', 'material_asesor', 'productos_asesor'];`
);

// 3. Update sidebar for mayorista
const OLD_MAY_NAV = `            <button className={\`nav-item \${activeTab === 'perfil_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('perfil_asesor')}>
              <span className="nav-icon"><Settings size={14} /></span> Mi Perfil
              {activeTab === 'perfil_asesor' && <span className="active-dot"></span>}
            </button>`;

const NEW_MAY_NAV = `            <button className={\`nav-item \${activeTab === 'productos_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('productos_asesor')}>
              <span className="nav-icon"><Package size={14} /></span> Mis Productos
              {activeTab === 'productos_asesor' && <span className="active-dot"></span>}
            </button>
            <button className={\`nav-item \${activeTab === 'perfil_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('perfil_asesor')}>
              <span className="nav-icon"><Settings size={14} /></span> Mi Perfil
              {activeTab === 'perfil_asesor' && <span className="active-dot"></span>}
            </button>`;

if (c.includes(OLD_MAY_NAV)) {
  c = c.replace(OLD_MAY_NAV, NEW_MAY_NAV);
  console.log('Sidebar mayorista updated (CRLF)');
} else {
  const oldLF = OLD_MAY_NAV.replace(/\r\n/g, '\n');
  const newLF = NEW_MAY_NAV.replace(/\r\n/g, '\n');
  if (c.replace(/\r\n/g, '\n').includes(oldLF)) {
    c = c.replace(/\r\n/g, '\n').replace(oldLF, newLF);
    console.log('Sidebar mayorista updated (LF)');
  } else {
    console.log('WARNING: Sidebar mayorista not found');
  }
}

// 4. Update sidebar for asesor
const OLD_ASE_NAV = `            <button className={\`nav-item \${activeTab === 'material_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('material_asesor')}>
              <span className="nav-icon"><Upload size={14} /></span> Material de Apoyo
              {activeTab === 'material_asesor' && <span className="active-dot"></span>}
            </button>`;

const NEW_ASE_NAV = `            <button className={\`nav-item \${activeTab === 'material_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('material_asesor')}>
              <span className="nav-icon"><Upload size={14} /></span> Material de Apoyo
              {activeTab === 'material_asesor' && <span className="active-dot"></span>}
            </button>
            <button className={\`nav-item \${activeTab === 'productos_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('productos_asesor')}>
              <span className="nav-icon"><Package size={14} /></span> Mis Productos
              {activeTab === 'productos_asesor' && <span className="active-dot"></span>}
            </button>`;

if (c.includes(OLD_ASE_NAV)) {
  c = c.replace(OLD_ASE_NAV, NEW_ASE_NAV);
  console.log('Sidebar asesor updated (CRLF)');
} else {
  const oldLF = OLD_ASE_NAV.replace(/\r\n/g, '\n');
  const newLF = NEW_ASE_NAV.replace(/\r\n/g, '\n');
  if (c.replace(/\r\n/g, '\n').includes(oldLF)) {
    c = c.replace(/\r\n/g, '\n').replace(oldLF, newLF);
    console.log('Sidebar asesor updated (LF)');
  } else {
    console.log('WARNING: Sidebar asesor not found');
  }
}

fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
console.log('Done types and sidebar');
