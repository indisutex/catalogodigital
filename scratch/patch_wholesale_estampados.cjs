const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '..', 'src', 'pages', 'Admin.tsx');
let content = fs.readFileSync(adminPath, 'utf8');

const targetStr = `const imgRefs = Array.from(new Set(imgData.filter(d => d.estampado?.trim() && d.ref?.trim() && d.ref?.trim() !== d.estampado?.trim()).map(d => d.ref?.trim())));`;
const pos = content.indexOf(targetStr);
console.log('Position of targetStr:', pos);

if (pos !== -1) {
  const funcStart = content.lastIndexOf('{(() => {', pos);
  const funcEnd = content.indexOf('})()}', pos) + 5;
  
  console.log('funcStart:', funcStart, 'funcEnd:', funcEnd);
  const newFunc = `{(() => {
                                const imgData = (p.imagenes_extra || []).map((u: string) => decodeExtraImage(u));
                                const imgEstampados = Array.from(new Set(imgData.map(d => (d.estampado?.trim() || d.ref?.trim())).filter(Boolean)));
                                const legacyEst = p.estampados?.split(',').map((e: string) => e.trim()).filter(Boolean) || [];
                                const activeEstampados = imgEstampados.length > 0 ? imgEstampados : legacyEst;
                                if (activeEstampados.length === 0) return null;
                                return (
                                  <div style={{ marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: '1px dashed #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                      <small style={{ color: '#64748b', fontWeight: 500, fontSize: '0.72rem' }}>Estampados ({activeEstampados.length}):</small>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <select
                                        style={{
                                          width: '100%',
                                          padding: '0.32rem 0.55rem',
                                          paddingRight: '1.4rem',
                                          borderRadius: '8px',
                                          border: '1.5px solid #bfdbfe',
                                          background: '#eff6ff',
                                          color: '#1d4ed8',
                                          fontSize: '0.72rem',
                                          fontWeight: 500,
                                          cursor: 'pointer',
                                          outline: 'none',
                                          fontFamily: "'Poppins', sans-serif",
                                          appearance: 'none',
                                          WebkitAppearance: 'none'
                                        }}
                                        defaultValue=""
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <option value="" disabled>🎨 Ver {activeEstampados.length} estampados...</option>
                                        {activeEstampados.map((est, i) => (
                                          <option key={i} value={est}>
                                            {i + 1}. {est}
                                          </option>
                                        ))}
                                      </select>
                                      <ChevronDown size={13} style={{ position: 'absolute', right: '0.45rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#1d4ed8' }} />
                                    </div>
                                  </div>
                                );
                              })()}`;

  content = content.substring(0, funcStart) + newFunc + content.substring(funcEnd);
  fs.writeFileSync(adminPath, content, 'utf8');
  console.log('Successfully replaced wholesale estampados in Admin.tsx!');
}
