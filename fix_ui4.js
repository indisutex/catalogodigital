const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetRegex = /(<div className="mc-sub" style=\{\{\s*color:\s*'rgba\(255,255,255,0\.75\)'\s*\}\}>Únicamente pagos verificados<\/div>\s*<\/div>)[\s\S]*?(<div className="metric-card" style=\{\{\s*background:\s*'linear-gradient\(135deg,\s*rgba\(var\(--primary-rgb,\s*99,\s*102,\s*241\),\s*0\.7\),\s*rgba\(var\(--primary-rgb,\s*99,\s*102,\s*241\),\s*0\.45\)\)'[^>]*>\s*<div style=\{\{\s*position:\s*'absolute',\s*right:\s*'-10px',\s*top:\s*'-10px',\s*fontSize:\s*'5rem',\s*opacity:\s*0\.15\s*\}\}>⏳<\/div>)/u;

const replacement = \\

                  <div className="metric-card" style={{ background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 99, 102, 241), 0.85), rgba(var(--primary-rgb, 99, 102, 241), 0.6))', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
                    <style>{\\\
                      .party-particles {
                        position: absolute;
                        top: -50%;
                        left: -50%;
                        width: 200%;
                        height: 200%;
                        background-image: radial-gradient(circle at 50% 50%, #ffeb3b 2%, transparent 3%), radial-gradient(circle at 30% 70%, #ff9800 2%, transparent 3%), radial-gradient(circle at 70% 30%, #e91e63 2%, transparent 3%), radial-gradient(circle at 40% 40%, #00bcd4 2%, transparent 3%), radial-gradient(circle at 80% 80%, #4caf50 2%, transparent 3%);
                        background-size: 100px 100px;
                        animation: party-spin 10s linear infinite;
                        opacity: 0.6;
                        pointer-events: none;
                        z-index: 0;
                      }
                      @keyframes party-spin {
                        0% { transform: rotate(0deg) scale(1); }
                        50% { transform: rotate(180deg) scale(1.2); }
                        100% { transform: rotate(360deg) scale(1); }
                      }
                      @keyframes float-party {
                        0% { transform: translateY(0px) rotate(0deg); }
                        50% { transform: translateY(-5px) rotate(3deg); }
                        100% { transform: translateY(0px) rotate(0deg); }
                      }
                    \\\}</style>
                    {(() => {
                      const bestAsesorObj = stats.asesoresRanking?.[0];
                      const hasAdvisor = !!bestAsesorObj;
                      const hasPhoto = !!bestAsesorObj?.foto_url;
                      return (
                        <>
                          <div style={{ position: 'absolute', right: '15px', top: '15px', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {hasPhoto ? (
                              <img src={bestAsesorObj?.foto_url ?? ''} alt={bestAsesorObj?.nombre ?? ''} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }} />
                            ) : hasAdvisor ? (
                              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 800, border: '4px solid rgba(255,255,255,0.4)', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))', animation: 'float-party 3s ease-in-out infinite' }}>
                                {bestAsesorObj.nombre.charAt(0).toUpperCase()}
                              </div>
                            ) : (
                              <span style={{ fontSize: '4rem', opacity: 0.25, marginRight: '10px' }}>⭐</span>
                            )}
                          </div>
                          {hasPhoto && <div className="party-particles"></div>}
                        </>
                      );
                    })()}
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Asesor Estrella</div>
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
                  </div>

                  \\;

if (targetRegex.test(content)) {
  const newContent = content.replace(targetRegex, replacement);
  fs.writeFileSync(path, newContent, 'utf8');
  console.log('Replaced successfully!');
} else {
  console.log('Regex did not match.');
}
