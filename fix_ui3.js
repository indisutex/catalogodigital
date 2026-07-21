const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<div className="mc-label"[^>]*>(?:L[^n]+nea \/ )?Asesor Estrella<\/div>\s*<div className="mc-value"[^>]*>\{getAsesorNameByPhone\(stats\.bestAdvisorPhone\)\}<\/div>\s*<div className="mc-sub"[^>]*>Ventas: \$\{stats\.bestAdvisorTotal\.toLocaleString\(\)\} COP<\/div>\s*<\/div>\s*<\/div>/;

const replacementBlock = <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Asesor Estrella</div>
                      <div className="mc-value" style={{ fontSize: '1.5rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{stats.asesoresRanking?.[0]?.nombre || 'Sin datos'}</div>
                      <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Ventas: \ COP</div>
                    </div>
                  </div>

                  <div className="metric-card" style={{ background: 'linear-gradient(135deg, #ec4899, #be185d)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                    {(() => {
                      const bestMayoristaObj = stats.mayoristasRanking?.[0];
                      const hasMayorista = !!bestMayoristaObj;
                      const hasPhoto = !!bestMayoristaObj?.foto_url;
                      return (
                        <>
                          <div style={{ position: 'absolute', right: '15px', top: '15px', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {hasPhoto ? (
                              <img src={bestMayoristaObj?.foto_url ?? ''} alt={bestMayoristaObj?.nombre ?? ''} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }} />
                            ) : hasMayorista ? (
                              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4338ca)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }}>
                                {bestMayoristaObj.nombre.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <span style={{ fontSize: '4rem', opacity: 0.25, marginRight: '10px' }}>🌟</span>
                            )}
                          </div>
                          {hasPhoto && <div className="party-particles"></div>}
                        </>
                      );
                    })()}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Mayorista Estrella</div>
                      <div className="mc-value" style={{ fontSize: '1.5rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{stats.mayoristasRanking?.[0]?.nombre || 'Sin datos'}</div>
                      <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Ventas: \ COP</div>
                    </div>
                  </div>;

if (regex.test(content)) {
  const newContent = content.replace(regex, replacementBlock);
  fs.writeFileSync(path, newContent, 'utf8');
  console.log('Replaced successfully!');
} else {
  console.log('Regex did not match.');
}
