const fs = require('fs');
const path = require('path');

const menuPath = path.join(__dirname, '..', 'src', 'pages', 'MenuDigital.tsx');
let content = fs.readFileSync(menuPath, 'utf8');

const normalize = s => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

// Locate the carousel track in MenuDigital.tsx
const oldTrack = `                    {detailProduct.video_url ? (
                      <video src={detailProduct.video_url} autoPlay loop muted playsInline preload="metadata" className="detail-carousel-img" ref={el => { if (el && el.paused) el.play().catch(() => {}); }} />
                    ) : allImages.length > 0 ? (
                      <div style={{
                        display: 'flex',
                        width: \`\${allImages.length * 100}%\`,
                        height: '100%',
                        transform: \`translateX(-\${(safeIdx * 100) / allImages.length}%)\`,
                        transition: 'transform 0.32s cubic-bezier(0.25, 1, 0.5, 1)'
                      }}>
                        {allImages.map((img, i) => (
                          <div key={i} style={{ width: \`\${100 / allImages.length}%\`, height: '100%', flexShrink: 0, position: 'relative' }}>
                            <img 
                              src={getOptimizedImageUrl(img.url, 800, 80)} 
                              alt={\`\${detailProduct.nombre} \${img.estampado || img.ref || i}\`} 
                              className="detail-carousel-img" 
                              loading={i === safeIdx ? "eager" : "lazy"} 
                              fetchPriority={i === safeIdx ? "high" : "low"} 
                              decoding="async" 
                              draggable={false}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', pointerEvents: 'none' }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="detail-carousel-placeholder" />
                    )}`;

const newTrack = `                    {detailProduct.video_url ? (
                      <video src={detailProduct.video_url} autoPlay loop muted playsInline preload="metadata" className="detail-carousel-img" ref={el => { if (el && el.paused) el.play().catch(() => {}); }} />
                    ) : allImages.length > 0 ? (
                      <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                        <img 
                          key={safeIdx}
                          src={getOptimizedImageUrl(allImages[safeIdx].url, 800, 80)} 
                          alt={\`\${detailProduct.nombre} \${allImages[safeIdx].estampado || allImages[safeIdx].ref || safeIdx}\`} 
                          className="detail-carousel-img" 
                          loading="eager" 
                          decoding="async" 
                          draggable={false}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            userSelect: 'none', 
                            pointerEvents: 'none',
                            animation: 'fadeIn 0.2s ease'
                          }} 
                        />
                      </div>
                    ) : (
                      <div className="detail-carousel-placeholder" />
                    )}`;

if (normContent.includes(normalize(oldTrack))) {
  normContent = normContent.replace(normalize(oldTrack), normalize(newTrack));
  fs.writeFileSync(menuPath, normContent, 'utf8');
  console.log('Successfully updated carousel in MenuDigital.tsx to single-image full-width swipe!');
} else {
  console.error('Could not find oldTrack in MenuDigital.tsx');
}
