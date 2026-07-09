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

// Replace header title
c = c.replace(/\{role === 'mayorista' \? 'Mis Precios y Productos' : 'Catálogo de Productos'\}/g, "'Productos'");

// Replace table with grid
// Find the <div className="data-table-container"> block up to </div>
// It's a large block, so let's use a regex or string extraction
const startTag = '<div className="data-table-container">';
const endMarker = '</div>\n              </div>\n            </div>';
let startIdx = c.indexOf(startTag);
if (startIdx !== -1) {
  let innerEndIdx = c.indexOf(endMarker, startIdx);
  if (innerEndIdx !== -1) {
    const tableBlock = c.substring(startIdx, innerEndIdx);
    
    const newGrid = \`<div className="products-grid">
                  {productos.map(p => {
                    let hasOverride = false;
                    let overrideVal = '';
                    let finalPrice = p.precio;
                    
                    if (role === 'mayorista' && currentMayorista) {
                      const markup = currentMayorista.porcentaje_ganancia || 0;
                      const overrides = currentMayorista.ajustes_productos || {};
                      finalPrice = p.precio * (1 + markup / 100);
                      
                      if (overrides[p.id]) {
                        finalPrice = Number(overrides[p.id]);
                        hasOverride = true;
                        overrideVal = overrides[p.id];
                      }
                    }
                    
                    return (
                      <div key={p.id} className="product-card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div className="product-card-img" style={{ height: '200px' }}>
                          {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🖼️'}
                        </div>
                        <div className="product-card-body" style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{p.nombre}</h4>
                          <p className="p-cat">{p.referencia || p.categoria}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.8rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '8px' }}>
                            <div>
                              <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Detal</small>
                              <p className="p-price" style={{ fontSize: '0.9rem' }}>\$\${p.precio?.toLocaleString()}</p>
                            </div>
                            <div>
                              <small style={{ color: '#64748b', fontSize: '0.7rem' }}>Mayor</small>
                              <p className="p-price" style={{ fontSize: '0.9rem' }}>\$\${p.precio_por_mayor ? p.precio_por_mayor.toLocaleString() : '-'}</p>
                            </div>
                            <div>
                              <small style={{ color: '#64748b', fontSize: '0.7rem' }}>50 Unid.</small>
                              <p className="p-price" style={{ fontSize: '0.9rem' }}>\$\${p.precio_50_unidades ? p.precio_50_unidades.toLocaleString() : '-'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {role === 'mayorista' && currentMayorista && (
                          <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.75rem', background: '#fafafa', marginTop: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                               <small style={{ color: '#64748b', fontWeight: 600 }}>Tu Precio Final:</small>
                               <strong style={{ color: hasOverride ? '#94a3b8' : '#10b981', textDecoration: hasOverride ? 'line-through' : 'none' }}>
                                 \$\${Math.round(p.precio * (1 + (currentMayorista?.porcentaje_ganancia || 0) / 100)).toLocaleString()}
                               </strong>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                              <input 
                                type="number" 
                                placeholder="Precio Especial"
                                defaultValue={overrideVal}
                                id={\`override-\${p.id}\`}
                                style={{ width: '100%', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                              />
                              <button 
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                onClick={async () => {
                                  try {
                                    setLoading(true);
                                    const inputVal = (document.getElementById(\`override-\${p.id}\`) as HTMLInputElement).value;
                                    const currentOverrides = { ...(currentMayorista.ajustes_productos || {}) };
                                    
                                    if (!inputVal) {
                                      delete currentOverrides[p.id];
                                    } else {
                                      currentOverrides[p.id] = Number(inputVal);
                                    }
                                    
                                    const { error } = await supabase.from('mayoristas').update({ ajustes_productos: currentOverrides }).eq('id', currentMayorista.id);
                                    if (error) throw error;
                                    showToast(!inputVal ? 'Precio especial removido' : 'Precio especial guardado', 'success');
                                    setMayoristas(mayoristas.map(m => m.id === currentMayorista.id ? { ...m, ajustes_productos: currentOverrides } : m));
                                  } catch(e) {
                                    showToast(e?.message || 'Error al actualizar', 'error');
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                              >
                                OK
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>\`;
    
    c = c.replace(tableBlock, newGrid);
  }
}

fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
console.log("Updated to grid layout and sidebar ordering");
