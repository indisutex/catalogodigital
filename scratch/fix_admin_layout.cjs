const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. renderLeadOrOrderCard: Replace status-badges-block
const headerBadge1 = /<div className="status-badges-block">[\s\S]*?(?=<\/div>\s*<\/div>\s*<div className="card-body-row">)/;
content = content.replace(headerBadge1, `<div className="status-badges-block">
            <div className="advisor-badge">
              <div className="advisor-avatar">
                {adv.foto_url ? (
                  <img src={adv.foto_url} alt="" />
                ) : (
                  adv.nombre.charAt(0).toUpperCase()
                )}
              </div>
              <div className="advisor-meta">
                <h5>{adv.nombre}</h5>
                <span className="advisor-role">{adv.role}</span>
              </div>
            </div>`);

// 2. renderLeadOrOrderCard: Remove old advisor block
const oldAdvisor1 = /<div className="advisor-info-block">[\s\S]*?<span className="block-title">Asesor asignado<\/span>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;
content = content.replace(oldAdvisor1, `</div>\n        </div>`);

// 3. renderLeadOrOrderCard: Update footer quick-actions
const quickActions1 = /<div className="quick-actions">[\s\S]*?<button type="button" className="btn-details-action" onClick=\{\(\) => setSelectedPedido\(ped\)\}>\s*Ver detalles\s*<\/button>\s*<\/div>/;
content = content.replace(quickActions1, `<div className="quick-actions" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {telefonoCliente && (
              <button 
                type="button" 
                className="btn-circle-action"
                onClick={() => {
                  const cleanPhone = telefonoCliente.replace(/\\D/g, '');
                  const target = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                  window.open(\`https://wa.me/\${target}\`, '_blank');
                }}
              >
                <MessageSquare size={13} />
              </button>
            )}
            <button type="button" className="btn-details-action" onClick={() => setSelectedPedido(ped)}>
              Ver detalles
            </button>
            {isLead && (
              <select 
                className="lead-status-dropdown" 
                value={ped.retargeting_estado || ''}
                onChange={(e) => handleUpdateLeadStatus(ped.id, e.target.value)}
                style={{ fontSize: '0.75rem', padding: '0.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
              >
                <option value="">Estado...</option>
                <option value="contactado">Contactado</option>
                <option value="descartado">Descartado</option>
              </select>
            )}
          </div>`);

// 4. combinedList.map: Replace status-badges-block
const headerBadge2 = /<div className="status-badges-block">[\s\S]*?(?=<\/div>\s*<\/div>\s*\{\/\* Body Row)/;
content = content.replace(headerBadge2, `<div className="status-badges-block">
                                  <div className="advisor-badge">
                                    <div className="advisor-avatar">
                                      {adv.foto_url ? (
                                        <img src={adv.foto_url} alt="" />
                                      ) : (
                                        adv.nombre.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="advisor-meta">
                                      <h5>{adv.nombre}</h5>
                                      <span className="advisor-role">{adv.role}</span>
                                    </div>
                                  </div>`);

// 5. combinedList.map: Remove old advisor block
const oldAdvisor2 = /<div className="advisor-info-block">[\s\S]*?<span className="block-title">Asesor asignado<\/span>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;
content = content.replace(oldAdvisor2, `</div>\n                              </div>`);

// 6. combinedList.map: Update footer quick-actions
const quickActions2 = /<div className="quick-actions">[\s\S]*?<button type="button" className="btn-details-action" onClick=\{\(\) => setSelectedPedido\(ped\)\}>\s*Ver detalles\s*<\/button>\s*<\/div>/;
content = content.replace(quickActions2, `<div className="quick-actions" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  {ped.cliente_telefono && (
                                    <button 
                                      type="button" 
                                      className="btn-circle-action"
                                      onClick={() => {
                                        const cleanPhone = ped.cliente_telefono.replace(/\\D/g, '');
                                        const target = cleanPhone.length === 10 ? '57' + cleanPhone : cleanPhone;
                                        window.open(\`https://wa.me/\${target}\`, '_blank');
                                      }}
                                    >
                                      <MessageSquare size={13} />
                                    </button>
                                  )}
                                  <button type="button" className="btn-details-action" onClick={() => setSelectedPedido(ped)}>
                                    Ver detalles
                                  </button>
                                  {isLead && (
                                    <select 
                                      className="lead-status-dropdown" 
                                      value={ped.retargeting_estado || ''}
                                      onChange={(e) => handleUpdateLeadStatus(ped.id, e.target.value)}
                                      style={{ fontSize: '0.75rem', padding: '0.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
                                    >
                                      <option value="">Estado...</option>
                                      <option value="contactado">Contactado</option>
                                      <option value="descartado">Descartado</option>
                                    </select>
                                  )}
                                </div>`);

// 7. Change "Recuperados" to "Ventas Exitosas" in the desktop tabs and mobile pills
// Only matching >Recuperado< or Recuperados
content = content.replace(/>Recuperado</g, '>Venta Exitosa<');
content = content.replace(/Recuperados <span/g, 'Ventas Exitosas <span');

fs.writeFileSync(adminPath, content);
console.log("Admin.tsx fixed!");

// Admin.css fix
const cssPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const cssTarget = /\.modal-overlay \{\s*align-items: center !important;\s*\}/;
const cssRepl = `.modal-overlay {
      align-items: flex-start !important;
      padding-top: 5vh;
    }`;
cssContent = cssContent.replace(cssTarget, cssRepl);

fs.writeFileSync(cssPath, cssContent);
console.log("Admin.css fixed!");
