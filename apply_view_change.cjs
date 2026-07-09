const fs = require('fs');

let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// 1. Reorder Mayorista sidebar
const mayoristaSidebarOld = `            <button className={\`nav-item \${activeTab === 'resumen_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('resumen_asesor')}>
              <LayoutDashboard size={18} /> Resumen
            </button>
            <button className={\`nav-item \${activeTab === 'pedidos' ? 'active' : ''}\`} onClick={() => handleSelectTab('pedidos')}>
              <ShoppingBag size={18} /> Mis Pedidos
            </button>
            <button className={\`nav-item \${activeTab === 'notificaciones_asesor' ? 'active' : ''}\`} style={{ position: 'relative' }}
              onClick={() => handleSelectTab('notificaciones_asesor')}
            >
              <Bell size={18} /> Notificaciones
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            <button className={\`nav-item \${activeTab === 'material_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('material_asesor')}>
              <Upload size={18} /> Material de Apoyo
            </button>
            <button className={\`nav-item \${activeTab === 'productos_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('productos_asesor')}>
              <Package size={18} /> Mis Productos
            </button>
            <button className={\`nav-item \${activeTab === 'perfil_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('perfil_asesor')}>
              <User size={18} /> Mi Perfil
            </button>`;

const mayoristaSidebarNew = `            <button className={\`nav-item \${activeTab === 'resumen_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('resumen_asesor')}>
              <LayoutDashboard size={18} /> Resumen
            </button>
            <button className={\`nav-item \${activeTab === 'productos_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('productos_asesor')}>
              <Package size={18} /> Productos
            </button>
            <button className={\`nav-item \${activeTab === 'pedidos' ? 'active' : ''}\`} onClick={() => handleSelectTab('pedidos')}>
              <ShoppingBag size={18} /> Mis Pedidos
            </button>
            <button className={\`nav-item \${activeTab === 'notificaciones_asesor' ? 'active' : ''}\`} style={{ position: 'relative' }}
              onClick={() => handleSelectTab('notificaciones_asesor')}
            >
              <Bell size={18} /> Notificaciones
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            <button className={\`nav-item \${activeTab === 'material_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('material_asesor')}>
              <Upload size={18} /> Material de Apoyo
            </button>
            <button className={\`nav-item \${activeTab === 'perfil_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('perfil_asesor')}>
              <User size={18} /> Mi Perfil
            </button>`;

c = c.replace(mayoristaSidebarOld, mayoristaSidebarNew);
c = c.replace(mayoristaSidebarOld.replace(/\n/g, '\r\n'), mayoristaSidebarNew.replace(/\n/g, '\r\n'));

// 2. Reorder Asesor sidebar
const asesorSidebarOld = `            <button className={\`nav-item \${activeTab === 'resumen_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('resumen_asesor')}>
              <LayoutDashboard size={18} /> Resumen
            </button>
            <button className={\`nav-item \${activeTab === 'pedidos' ? 'active' : ''}\`} onClick={() => handleSelectTab('pedidos')}>
              <ShoppingBag size={18} /> Mis Pedidos
            </button>
            <button className={\`nav-item \${activeTab === 'notificaciones_asesor' ? 'active' : ''}\`} style={{ position: 'relative' }}
              onClick={() => handleSelectTab('notificaciones_asesor')}
            >
              <Bell size={18} /> Notificaciones
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            <button className={\`nav-item \${activeTab === 'material_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('material_asesor')}>
              <Upload size={18} /> Material de Apoyo
            </button>
            <button className={\`nav-item \${activeTab === 'productos_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('productos_asesor')}>
              <Package size={18} /> Productos
            </button>
            <button className={\`nav-item \${activeTab === 'perfil_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('perfil_asesor')}>
              <User size={18} /> Mi Perfil
            </button>`;

// Try renaming "Catálogo de Productos" to "Productos" (it was originally Mis Productos then I changed to Catálogo...)
const asesorSidebarOld2 = asesorSidebarOld.replace('Mis Productos', 'Catálogo de Productos');

const asesorSidebarNew = `            <button className={\`nav-item \${activeTab === 'resumen_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('resumen_asesor')}>
              <LayoutDashboard size={18} /> Resumen
            </button>
            <button className={\`nav-item \${activeTab === 'productos_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('productos_asesor')}>
              <Package size={18} /> Productos
            </button>
            <button className={\`nav-item \${activeTab === 'pedidos' ? 'active' : ''}\`} onClick={() => handleSelectTab('pedidos')}>
              <ShoppingBag size={18} /> Mis Pedidos
            </button>
            <button className={\`nav-item \${activeTab === 'notificaciones_asesor' ? 'active' : ''}\`} style={{ position: 'relative' }}
              onClick={() => handleSelectTab('notificaciones_asesor')}
            >
              <Bell size={18} /> Notificaciones
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            <button className={\`nav-item \${activeTab === 'material_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('material_asesor')}>
              <Upload size={18} /> Material de Apoyo
            </button>
            <button className={\`nav-item \${activeTab === 'perfil_asesor' ? 'active' : ''}\`} onClick={() => handleSelectTab('perfil_asesor')}>
              <User size={18} /> Mi Perfil
            </button>`;

c = c.replace(asesorSidebarOld, asesorSidebarNew);
c = c.replace(asesorSidebarOld.replace(/\n/g, '\r\n'), asesorSidebarNew.replace(/\n/g, '\r\n'));
c = c.replace(asesorSidebarOld2, asesorSidebarNew);
c = c.replace(asesorSidebarOld2.replace(/\n/g, '\r\n'), asesorSidebarNew.replace(/\n/g, '\r\n'));

// Rename tab title
c = c.replace(
  "{role === 'mayorista' ? 'Mis Precios y Productos' : 'Catálogo de Productos'}",
  "'Productos'"
);

// Replace the table with the grid
const startTag = '<div className="data-table-container">';
const endMarker = '</div>\\n              </div>\\n            </div>';
const endMarkerCRLF = '</div>\\r\\n              </div>\\r\\n            </div>';
let startIdx = c.indexOf(startTag);

if (startIdx !== -1) {
  let innerEndIdx = c.indexOf(endMarker, startIdx);
  if (innerEndIdx === -1) innerEndIdx = c.indexOf(endMarkerCRLF, startIdx);
  
  if (innerEndIdx !== -1) {
    const tableBlock = c.substring(startIdx, innerEndIdx);
    const newGrid = fs.readFileSync('new_grid.tsx', 'utf8');
    c = c.replace(tableBlock, newGrid);
  }
}

fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
console.log("Updated to grid layout and sidebar ordering");
