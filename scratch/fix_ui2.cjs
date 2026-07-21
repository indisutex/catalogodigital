const fs = require('fs');
const path = 'src/pages/Admin.tsx';
let content = fs.readFileSync(path, 'utf8');

let newContent = content;
const regex = /<div className="mc-label" style=\{\{\s*color:\s*'rgba\(255,255,255,0\.85\)'\s*\}\}>L(?:í|Ã\xad)nea \/ Asesor Estrella<\/div>[\s\S]*?COP<\/div>/;

const replacementBlock = `<div className="mc-label" style={{ color: 'rgba(255,255,255,0.85)' }}>Asesor Estrella</div>
                      <div className="mc-value" style={{ fontSize: '1.5rem', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{stats.asesoresRanking?.[0]?.nombre || 'Sin datos'}</div>
                      <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Ventas: \${(stats.asesoresRanking?.[0]?.total || 0).toLocaleString()} COP</div>
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
                      <div className="mc-sub" style={{ color: 'rgba(255,255,255,0.75)' }}>Ventas: \${(stats.mayoristasRanking?.[0]?.total || 0).toLocaleString()} COP</div>`;

if (regex.test(newContent)) {
  newContent = newContent.replace(regex, replacementBlock);
  console.log('Replaced card block!');
} else {
  console.log('Could not find card block!');
}

const asesorLogicRegex = /const bestAsesorObj = asesores\.find\(a => \{[\s\S]*?return phones\.some\(p => bestPhones\.includes\(p\)\);\s*\}\);/;
const newAsesorLogic = `const bestAsesorObj = stats.asesoresRanking?.[0];`;
if (asesorLogicRegex.test(newContent)) {
  newContent = newContent.replace(asesorLogicRegex, newAsesorLogic);
  console.log('Replaced asesor logic!');
} else {
  console.log('Could not find asesor logic!');
}

// Fixed Header Regex
const headerRegex = /<div style=\{\{\s*display:\s*'flex',\s*gap:\s*'0\.75rem',\s*alignItems:\s*'center',\s*flexWrap:\s*'wrap'\s*\}\}>\s*<button/;
const replaceHeader = `<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                      <button`;
if (headerRegex.test(newContent)) {
  newContent = newContent.replace(headerRegex, replaceHeader);
  console.log('Replaced header!');
} else {
  console.log('Could not find header!');
}

if (content !== newContent) {
  fs.writeFileSync(path, newContent, 'utf8');
  console.log('File updated!');
} else {
  console.log('No changes made.');
}
