const fs = require('fs');

const tsxContent = `
          {/* ── SIIGO TAB ── */}
          {activeTab === 'siigo' && (
            <div className="admin-panel">
              <div className="panel-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem' }}>
                <div>
                  <h3><Code size={18} style={{ color: '#6366f1' }} /> Panel del Desarrollador</h3>
                  <p>Configura las integraciones de API de Siigo Nube y 99 Envíos</p>
                </div>
              </div>
              <div className="panel-body">
                {configuracion ? (
                  <div>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setLoading(true);
                      const { error } = await supabase.from('configuracion').update({
                        siigo_username: configuracion.siigo_username,
                        siigo_access_key: configuracion.siigo_access_key,
                        envios_99_api_key: configuracion.envios_99_api_key,
                        google_analytics_id: configuracion.google_analytics_id,
                        meta_pixel_id: configuracion.meta_pixel_id,
                        clarity_project_id: configuracion.clarity_project_id
                      }).eq('id', configuracion.id);
                      setLoading(false);
                      if (error) showToast('Error al guardar credenciales: ' + error.message, 'error');
                      else showToast('Configuración del desarrollador guardada ✓');
                    }}>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                          
                          {/* SIIGO COMPLETO */}
                          <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1.5rem', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                            <h4 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem', color: '#0369a1', fontWeight: 800 }}>
                              ☁️ Integración Completa con Siigo Nube
                            </h4>
                            
                            {/* Credenciales */}
                            <div className="form-grid" style={{ marginBottom: '1.5rem' }}>
                              <div className="form-field full">
                                <label>Usuario (Correo de Siigo Nube)</label>
                                <input 
                                  type="email" 
                                  value={configuracion.siigo_username || ''} 
                                  onChange={e => setConfiguracion({ ...configuracion, siigo_username: e.target.value })} 
                                  placeholder="ejemplo@correo.com"
                                />
                              </div>
                              <div className="form-field full">
                                <label>Access Key (Llave de API generada en Siigo)</label>
                                <input 
                                  type="password" 
                                  value={configuracion.siigo_access_key || ''} 
                                  onChange={e => setConfiguracion({ ...configuracion, siigo_access_key: e.target.value })} 
                                  placeholder="Ingresa tu access key de Siigo"
                                />
                              </div>
                            </div>
                            
                            {/* Botón Sincronizar y Estado */}
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                              <button 
                                type="button" 
                                className="btn-primary" 
                                style={{ padding: '0.6rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#0284c7' }}
                                disabled={siigoLoading || !configuracion.siigo_username || !configuracion.siigo_access_key}
                                onClick={async () => {
                                  setSiigoLoading(true);
                                  setSiigoLogs([]);
                                  const addLog = (msg) => setSiigoLogs(prev => [...prev, \`\${new Date().toLocaleTimeString()}: \${msg}\`]);
                                  
                                  try {
                                    const creds = {
                                      username: configuracion.siigo_username || '',
                                      accessKey: configuracion.siigo_access_key || ''
                                    };
                                    const tenantId = getTenantId() || '';
                                    
                                    const result = await SiigoService.fetchAndCompare(tenantId, creds, addLog);
                                    setSyncPending(result);
                                    setShowSyncConfirm(true);
                                    addLog(\`Comparación completada. Esperando confirmación para aplicar cambios...\`);
                                  } catch (err) {
                                    addLog(\`❌ Error: \${err.message}\`);
                                    showToast('Error al conectar con Siigo: ' + err.message, 'error');
                                  } finally {
                                    setSiigoLoading(false);
                                  }
                                }}
                              >
                                <RefreshCw size={14} style={{ animation: siigoLoading ? 'spin 1s linear infinite' : 'none' }} /> {siigoLoading ? 'Conectando...' : 'Sincronizar Catálogo Ahora'}
                              </button>
                              
                              <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                                <strong>Última Sincronización Exitosa:</strong>{' '}
                                {configuracion.siigo_sincronizado_at ? (
                                  <span style={{ color: '#059669', fontWeight: 600 }}>
                                    {new Date(configuracion.siigo_sincronizado_at).toLocaleString()}
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b' }}>Nunca se ha sincronizado</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Webhooks / Sincronización Automática */}
                            <div style={{ marginTop: '2rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.35rem' }}>⚡ Sincronización Automática (Tiempo Real)</div>
                              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                                Activa las notificaciones en tiempo real para que Siigo Nube nos notifique automáticamente cada vez que crees, edites precios o cambies el stock de un producto.
                              </p>
                              
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '300px' }}>
                                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>URL del Webhook de Supabase</label>
                                  <input 
                                    type="text" 
                                    value={webhookUrl}
                                    onChange={e => setWebhookUrl(e.target.value)}
                                    placeholder="URL de la Edge Function en Supabase"
                                    style={{ 
                                      width: '100%', 
                                      padding: '0.5rem 0.75rem', 
                                      border: '1px solid #cbd5e1', 
                                      borderRadius: '8px', 
                                      fontSize: '0.85rem' 
                                    }}
                                  />
                                </div>
                                <button 
                                  type="button" 
                                  className="btn-primary" 
                                  style={{ padding: '0.55rem 1.5rem', background: '#0284c7', fontSize: '0.85rem' }}
                                  disabled={siigoLoading || !webhookUrl}
                                  onClick={async () => {
                                    setSiigoLoading(true);
                                    setSiigoLogs([]);
                                    const addLog = (msg) => setSiigoLogs(prev => [...prev, \`\${new Date().toLocaleTimeString()}: \${msg}\`]);
                                    
                                    try {
                                      const creds = {
                                        username: configuracion.siigo_username || '',
                                        accessKey: configuracion.siigo_access_key || ''
                                      };
                                      await SiigoService.registerWebhooks(creds, webhookUrl, addLog);
                                      showToast('Suscripción a Webhooks completada ✓');
                                    } catch (err) {
                                      addLog(\`❌ Error: \${err.message}\`);
                                      showToast('Error al registrar Webhooks: ' + err.message, 'error');
                                    } finally {
                                      setSiigoLoading(false);
                                    }
                                  }}
                                >
                                  Activar en Siigo Nube
                                </button>
                              </div>
                            </div>
                            
                            {/* LOGS */}
                            {siigoLogs.length > 0 && (
                              <div style={{ marginTop: '1.5rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.5rem' }}>Registro de Actividad (Logs):</label>
                                <div style={{ 
                                  background: '#0f172a', 
                                  color: '#38bdf8', 
                                  fontFamily: 'monospace', 
                                  padding: '1rem', 
                                  borderRadius: '8px', 
                                  fontSize: '0.8rem', 
                                  maxHeight: '200px', 
                                  overflowY: 'auto',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.35rem'
                                }}>
                                  {siigoLogs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Modal de confirmación de sincronización */}
                            {showSyncConfirm && syncPending && (
                              <div style={{
                                marginTop: '2rem',
                                padding: '1.5rem',
                                background: '#f8fafc',
                                border: '1px solid #bfdbfe',
                                borderRadius: '16px',
                                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.05)'
                              }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  📢 Resumen de Cambios Detectados en Siigo Nube
                                </h4>
                                <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
                                  Por favor confirma si deseas aplicar los siguientes cambios de categorías, productos e inventarios en tu Catálogo Digital:
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                  <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <h5 style={{ margin: '0 0 0.75rem 0', color: '#16a34a', fontWeight: 700 }}>
                                      🆕 Productos Nuevos para Crear ({syncPending.toCreate.length})
                                    </h5>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      {syncPending.toCreate.map((p, i) => (
                                        <div key={i} style={{ fontSize: '0.78rem', padding: '0.4rem', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                          <strong>Ref: {p.referencia}</strong> - {p.nombre} (\${p.precio.toLocaleString()} COP | Stock: {p.stock})
                                        </div>
                                      ))}
                                      {syncPending.toCreate.length === 0 && (
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Ningún producto nuevo detectado.</p>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <h5 style={{ margin: '0 0 0.75rem 0', color: '#2563eb', fontWeight: 700 }}>
                                      🔄 Productos para Actualizar ({syncPending.toUpdate.length})
                                    </h5>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      {syncPending.toUpdate.map((p, i) => (
                                        <div key={i} style={{ fontSize: '0.78rem', padding: '0.4rem', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                          <strong>Ref: {p.referencia}</strong> - {p.nombre}
                                          <div style={{ color: '#475569', marginTop: '0.2rem', display: 'flex', gap: '1rem' }}>
                                            <span>Precio: \${p.precioViejo.toLocaleString()} ➔ <strong>\${p.precioNuevo.toLocaleString()}</strong></span>
                                            <span>Stock: {p.stockViejo} ➔ <strong>{p.stockNuevo}</strong></span>
                                          </div>
                                        </div>
                                      ))}
                                      {syncPending.toUpdate.length === 0 && (
                                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Ningún cambio de precio o stock detectado en productos existentes.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                  <button 
                                    type="button" 
                                    className="btn-secondary" 
                                    disabled={siigoLoading}
                                    style={{ padding: '0.5rem 1.5rem' }}
                                    onClick={() => {
                                      setShowSyncConfirm(false);
                                      setSyncPending(null);
                                    }}
                                  >
                                    Descartar Sincronización
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn-primary" 
                                    disabled={siigoLoading || (syncPending.toCreate.length === 0 && syncPending.toUpdate.length === 0)}
                                    style={{ padding: '0.5rem 1.5rem', background: '#16a34a' }}
                                    onClick={async () => {
                                      setSiigoLoading(true);
                                      const addLog = (msg) => setSiigoLogs(prev => [...prev, \`\${new Date().toLocaleTimeString()}: \${msg}\`]);
                                      
                                      try {
                                        const tenantId = getTenantId() || '';
                                        await SiigoService.applySync(tenantId, syncPending.toCreate, syncPending.toUpdate, addLog);
                                        showToast('¡Sincronización finalizada con éxito! ✓');
                                        setConfiguracion(prev => prev ? { ...prev, siigo_sincronizado_at: new Date().toISOString() } : null);
                                        cargarDatos();
                                        setShowSyncConfirm(false);
                                        setSyncPending(null);
                                      } catch (err) {
                                        addLog(\`❌ Error aplicando cambios: \${err.message}\`);
                                        showToast('Error al guardar datos de Siigo', 'error');
                                      } finally {
                                        setSiigoLoading(false);
                                      }
                                    }}
                                  >
                                    {siigoLoading ? 'Aplicando...' : 'Confirmar e Importar'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
                            
                            {/* 99 Envíos integration */}
                            <div className="config-section" style={{ margin: 0 }}>
                              <div className="config-section-title">🚚 Integración 99 Envíos</div>
                              <div className="form-grid">
                                <div className="form-field full">
                                  <label>API Key / Token de 99 Envíos</label>
                                  <input 
                                    type="password" 
                                    value={configuracion.envios_99_api_key || ''} 
                                    onChange={e => setConfiguracion({ ...configuracion, envios_99_api_key: e.target.value })} 
                                    placeholder="Ingresa tu API Key de 99 Envíos"
                                  />
                                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem', lineHeight: '1.4' }}>
                                    Esta llave permite conectar la tienda con el servicio de logística y distribución de 99 Envíos para generar guías de despacho.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Analítica y Tracking */}
                            <div className="config-section" style={{ margin: 0 }}>
                              <div className="config-section-title">📊 Analítica y Tracking</div>
                              <div className="form-grid">
                                <div className="form-field full">
                                  <label>Google Analytics 4 (Measurement ID)</label>
                                  <input 
                                    type="text" 
                                    value={configuracion.google_analytics_id || ''} 
                                    onChange={e => setConfiguracion({ ...configuracion, google_analytics_id: e.target.value })} 
                                    placeholder="Ej. G-XXXXXXXXXX"
                                  />
                                </div>
                                <div className="form-field full">
                                  <label>Meta (Facebook) Pixel ID</label>
                                  <input 
                                    type="text" 
                                    value={configuracion.meta_pixel_id || ''} 
                                    onChange={e => setConfiguracion({ ...configuracion, meta_pixel_id: e.target.value })} 
                                    placeholder="Ej. 123456789012345"
                                  />
                                </div>
                                <div className="form-field full">
                                  <label>Microsoft Clarity Project ID</label>
                                  <input 
                                    type="text" 
                                    value={configuracion.clarity_project_id || ''} 
                                    onChange={e => setConfiguracion({ ...configuracion, clarity_project_id: e.target.value })} 
                                    placeholder="Ej. 5abc123xyz"
                                  />
                                </div>
                              </div>
                            </div>

                          </div>
                          
                          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
                            <button type="submit" className="btn-secondary" disabled={loading} style={{ padding: '0.8rem 3rem', fontSize: '1rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600 }}>
                              Guardar Todas las Credenciales
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="loading-dot" />
                    <p style={{ marginTop: '1rem' }}>Cargando configuración...</p>
                  </div>
                )}
              </div>
            </div>
          )}
`;

let content = fs.readFileSync('src/pages/Admin.tsx', 'utf8');
const startIndex = content.indexOf('{/* ── SIIGO TAB ── */}');
const endIndex = content.indexOf('{/* ── CLIENTES TAB ── */}');

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    fs.writeFileSync('src/pages/Admin.tsx', before + tsxContent + '\n\n          ' + after);
    console.log('Success');
} else {
    console.log('Failed');
}
