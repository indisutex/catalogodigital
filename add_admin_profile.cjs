const fs = require('fs');
let c = fs.readFileSync('src/pages/Admin.tsx', 'utf8');

c = c.replace(
  "type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo' | 'pos' | 'clientes' | 'asesores' | 'perfil_asesor';",
  "type TabType = 'dashboard' | 'productos' | 'categorias' | 'config' | 'pedidos' | 'siigo' | 'pos' | 'clientes' | 'asesores' | 'perfil_asesor' | 'perfil_admin';"
);

const adminSidebarBtn = `
          {role !== 'asesor' && (
            <button className={\`nav-item \${activeTab === 'perfil_admin' ? 'active' : ''}\`} onClick={() => handleSelectTab('perfil_admin')}>
              <span className="nav-icon"><Settings size={14} /></span> Mi Perfil
              {activeTab === 'perfil_admin' && <span className="active-dot"></span>}
            </button>
          )}
          {role !== 'asesor' && (
            <>
              <button className={\`nav-item \${activeTab === 'clientes' ? 'active' : ''}\`} onClick={() => handleSelectTab('clientes')}>`;

c = c.replace(
  `          {role !== 'asesor' && (
            <>
              <button className={\`nav-item \${activeTab === 'clientes' ? 'active' : ''}\`} onClick={() => handleSelectTab('clientes')}>`,
  adminSidebarBtn
);

const adminTabContent = `
          {/* ── PERFIL ADMIN TAB ── */}
          {activeTab === 'perfil_admin' && (
            <div className="admin-panel">
              <div className="panel-header">
                <div>
                  <h3><User size={16} /> Mi Perfil (Administrador)</h3>
                  <p>Configura tus datos personales</p>
                </div>
              </div>
              <div className="panel-body">
                {configuracion ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    
                    const updateData = {
                      admin_nombre: configuracion.admin_nombre,
                      admin_foto_url: configuracion.admin_foto_url
                    };
                    
                    const { error } = await supabase.from('configuracion').update(updateData).eq('id', configuracion.id);
                    
                    if (error) {
                      showToast('Error: ' + error.message, 'error');
                    } else {
                      showToast('Perfil guardado ✓');
                    }
                    
                    setLoading(false);
                  }}>
                    <div className="config-section">
                      <div className="form-grid">
                        <div className="form-field">
                          <label>Nombre del Administrador</label>
                          <input 
                            value={configuracion.admin_nombre || ''} 
                            onChange={e => setConfiguracion({ ...configuracion, admin_nombre: e.target.value })} 
                            placeholder="Ej. Juan Pérez" 
                          />
                        </div>
                        <div className="form-field">
                          <label>Foto de Perfil</label>
                          <div className="img-input-row">
                            {configuracion.admin_foto_url && <img src={configuracion.admin_foto_url} className="img-preview-thumb" alt="Admin" />}
                            <input 
                              type="url" 
                              value={configuracion.admin_foto_url || ''} 
                              onChange={e => setConfiguracion({ ...configuracion, admin_foto_url: e.target.value })} 
                              placeholder="https://..." 
                              style={{ flex: 1 }} 
                            />
                            <label className="btn-upload-img" style={{ flexShrink: 0, cursor: 'pointer' }}>
                              <Upload size={12} /> Subir
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setLoading(true);
                                try {
                                  const compFile = await compressImage(file);
                                  const fileName = \`admin_foto_\${Date.now()}.\${compFile.name.split('.').pop()}\`;
                                  await supabase.storage.from('archivos').upload(fileName, compFile);
                                  const { data } = supabase.storage.from('archivos').getPublicUrl(fileName);
                                  setConfiguracion({ ...configuracion, admin_foto_url: data.publicUrl });
                                  showToast('Foto subida ✓');
                                } catch { showToast('Error subiendo foto', 'error'); }
                                setLoading(false);
                              }} />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="form-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.6rem 2rem' }}>
                        {loading ? 'Guardando...' : 'Guardar Perfil'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="empty-state">
                    <div className="loading-dot" />
                    <p style={{ marginTop: '1rem' }}>Cargando perfil...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CONFIG TAB ── */}
`;

c = c.replace("          {/* ── CONFIG TAB ── */}", adminTabContent);

// Remove the admin profile section from config tab
const startIndex = c.indexOf('<div className="config-section" style={{ marginTop: \'1.5rem\' }}>');
if (startIndex !== -1) {
  const endIndex = c.indexOf('<div style={{ marginTop: \'2rem\'', startIndex);
  if (endIndex !== -1) {
    const before = c.substring(0, startIndex);
    const after = c.substring(endIndex);
    c = before + after;
  }
}

fs.writeFileSync('src/pages/Admin.tsx', c);
console.log('Admin profile tab added successfully');
