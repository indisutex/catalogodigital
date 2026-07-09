const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

const tableStart = '<div className="data-table-container">';
const tableEnd = '</div>\n              </div>\n            </div>';
const tableEndCRLF = '</div>\r\n              </div>\r\n            </div>';

let startIdx = c.indexOf(tableStart);
if (startIdx !== -1) {
  let innerEndIdx = c.indexOf('</table>\n                </div>', startIdx);
  if (innerEndIdx === -1) innerEndIdx = c.indexOf('</table>\r\n                </div>', startIdx);
  
  if (innerEndIdx !== -1) {
    const endOffset = innerEndIdx + '</table>\n                </div>'.length;
    const tableBlock = c.substring(startIdx, endOffset);
    
    const newGrid = `<div className="products-grid">
                      {productos.map(p => {
                        let hasOverride = false;
                        let overrideVal = '';
                        if (role === 'mayorista' && currentMayorista) {
                          const overrides = currentMayorista.ajustes_productos || {};
                          if (overrides[p.id]) {
                            hasOverride = true;
                            overrideVal = overrides[p.id];
                          }
                        }
                        
                        return (
                        <div key={p.id} className="product-card">
                          <div className="product-card-img">
                            {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} /> : <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#f1f5f9'}}><Package size={24} color="#94a3b8" /></div>}
                          </div>
                          <div className="product-card-body">
                            <h4>{p.nombre}</h4>
                            <p className="p-cat" style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.referencia}</p>
                            
                            <div style={{ marginTop: '0.8rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                 <small style={{ color: '#64748b' }}>Detal:</small>
                                 <strong style={{ color: '#0f172a' }}>\${p.precio?.toLocaleString()}</strong>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                 <small style={{ color: '#64748b' }}>Mayor:</small>
                                 <strong>{p.precio_por_mayor ? \`\$\${p.precio_por_mayor.toLocaleString()}\` : '-'}</strong>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                 <small style={{ color: '#64748b' }}>50 Unid:</small>
                                 <strong>{p.precio_50_unidades ? \`\$\${p.precio_50_unidades.toLocaleString()}\` : '-'}</strong>
                               </div>
                               
                               {role === 'mayorista' && currentMayorista && (
                                 <div style={{ borderTop: '1px dashed #cbd5e1', margin: '0.5rem 0 0 0', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <small style={{ color: '#64748b', fontWeight: 600 }}>Tu Precio Final:</small>
                                   <strong style={{ color: hasOverride ? '#94a3b8' : '#10b981', textDecoration: hasOverride ? 'line-through' : 'none' }}>
                                     \${Math.round(p.precio * (1 + (currentMayorista?.porcentaje_ganancia || 0) / 100)).toLocaleString()}
                                   </strong>
                                 </div>
                               )}
                            </div>
                          </div>
                          
                          {role === 'mayorista' && currentMayorista && (
                            <div className="product-card-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem 0.9rem', background: '#fafafa', borderTop: '1px solid #f1f5f9' }}>
                               <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Fijar Precio Especial Manual:</label>
                               <div style={{ display: 'flex', gap: '0.4rem' }}>
                                 <input 
                                   type="number" 
                                   placeholder="Ej: 50000"
                                   defaultValue={overrideVal}
                                   id={\`override-\${p.id}\`}
                                   style={{ flex: 1, padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
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
                               {hasOverride && (
                                 <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Check size={12} /> Aplicando precio de: \${Number(overrideVal).toLocaleString()}
                                 </div>
                               )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>`;

    c = c.replace(tableBlock, newGrid);
    fs.writeFileSync('src/pages/Admin.tsx', c, 'utf8');
    console.log('Replaced table with grid successfully');
  } else {
    console.log('Could not find the end of the table block');
  }
} else {
  console.log('Could not find start of table block');
}
