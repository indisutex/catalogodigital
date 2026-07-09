const fs = require('fs');

const PANEL_CODE = `
          {/* ── PRODUCTOS ASESOR / MAYORISTA TAB ── */}
          {activeTab === 'productos_asesor' && (
            <div className="admin-panel">
              <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={18} /> {role === 'mayorista' ? 'Mis Precios y Productos' : 'Catálogo de Productos'}</h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  {role === 'mayorista' ? 'Configura tu porcentaje de ganancia general o precios especiales por producto.' : 'Visualiza los productos disponibles en el catálogo de la empresa.'}
                </p>
              </div>
              <div className="panel-body">
                {role === 'mayorista' && currentMayorista && (
                  <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a' }}>Ganancia Global</h4>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-field" style={{ margin: 0, flex: 1, minWidth: '250px' }}>
                        <label>Porcentaje de incremento (%) sobre el precio base de todos los productos</label>
                        <input 
                          type="number" 
                          id="mayorista-markup"
                          defaultValue={currentMayorista.porcentaje_ganancia || 0}
                          min="0"
                          step="0.1"
                        />
                      </div>
                      <button 
                        className="btn-primary"
                        onClick={async () => {
                          try {
                            setLoading(true);
                            const val = Number((document.getElementById('mayorista-markup') as HTMLInputElement).value);
                            const { error } = await supabase.from('mayoristas').update({ porcentaje_ganancia: val }).eq('id', currentMayorista.id);
                            if (error) throw error;
                            showToast('Porcentaje global actualizado correctamente', 'success');
                            // Fallback if setMayoristas doesn't work, wait 1 sec and reload or rely on state
                            setMayoristas(mayoristas.map(m => m.id === currentMayorista.id ? { ...m, porcentaje_ganancia: val } : m));
                          } catch(e: any) {
                            showToast(e.message || 'Error al actualizar', 'error');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Guardar Porcentaje
                      </button>
                    </div>
                  </div>
                )}

                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Precio Base</th>
                        {role === 'mayorista' && <th>Precio Final (Calculado)</th>}
                        {role === 'mayorista' && <th>Precio Especial (Manual)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map(p => {
                        let finalPrice = p.precio;
                        let hasOverride = false;
                        let overrideVal = '';
                        
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
                          <tr key={p.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {p.imagenes && p.imagenes[0] ? (
                                  <img src={p.imagenes[0]} alt={p.nombre} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '8px' }} />
                                ) : (
                                  <div style={{ width: '40px', height: '40px', background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Package size={20} color="#94a3b8" />
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.codigo}</div>
                                </div>
                              </div>
                            </td>
                            <td>\${p.precio.toLocaleString()}</td>
                            {role === 'mayorista' && (
                              <td style={{ fontWeight: hasOverride ? 'normal' : 'bold', color: hasOverride ? '#94a3b8' : '#10b981', textDecoration: hasOverride ? 'line-through' : 'none' }}>
                                \${Math.round(p.precio * (1 + (currentMayorista?.porcentaje_ganancia || 0) / 100)).toLocaleString()}
                              </td>
                            )}
                            {role === 'mayorista' && currentMayorista && (
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <input 
                                    type="number" 
                                    placeholder="Ej: 50000"
                                    defaultValue={overrideVal}
                                    id={\`override-\${p.id}\`}
                                    style={{ width: '100px', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
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
                                      } catch(e: any) {
                                        showToast(e.message || 'Error al actualizar', 'error');
                                      } finally {
                                        setLoading(false);
                                      }
                                    }}
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

`;

let content = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

// The marker where we will insert the code.
// We will insert it just before the material_asesor tab.
const MARKER = "{/* ── MATERIAL DE APOYO ASESOR / MAYORISTA TAB ── */}";

if (content.includes("activeTab === 'productos_asesor' && (")) {
    console.log("Panel ya existe.");
} else if (content.includes(MARKER)) {
    content = content.replace(MARKER, PANEL_CODE + MARKER);
    fs.writeFileSync('src/pages/Admin.tsx', content, 'utf8');
    console.log("Panel agregado exitosamente.");
} else {
    console.log("No se encontro el marcador para insertar el panel.");
}
