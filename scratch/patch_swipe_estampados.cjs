const fs = require('fs');
const path = require('path');

const menuPath = path.join(__dirname, '..', 'src', 'pages', 'MenuDigital.tsx');
let content = fs.readFileSync(menuPath, 'utf8');

console.log('Original content length:', content.length);

// 1. Update lucide-react imports to include ChevronLeft
const oldImport = `import { Loader2, Search, Plus, ShoppingBag, X, ShoppingCart, Volume2, VolumeX, Package, HelpCircle, RefreshCw, Menu, Check, Filter, LayoutGrid, Users, Sparkles, Shirt, Baby, Moon, Layers, Tag, Heart, Gift, ChevronDown, Share2, Trash2, CreditCard, MessageCircle, ArrowLeft, ChevronRight, Truck } from 'lucide-react';`;
const newImport = `import { Loader2, Search, Plus, ShoppingBag, X, ShoppingCart, Volume2, VolumeX, Package, HelpCircle, RefreshCw, Menu, Check, Filter, LayoutGrid, Users, Sparkles, Shirt, Baby, Moon, Layers, Tag, Heart, Gift, ChevronDown, ChevronLeft, Share2, Trash2, CreditCard, MessageCircle, ArrowLeft, ChevronRight, Truck } from 'lucide-react';`;

if (content.includes(oldImport)) {
  content = content.replace(oldImport, newImport);
  console.log('1. Replaced lucide-react imports');
} else {
  console.error('Failed 1. Replaced lucide-react imports');
}

const normalize = (s) => s.replace(/\r\n/g, '\n');
let normContent = normalize(content);

// 2. Add touch and swipe handling methods around carousel state
const oldStateHook = `  // Product Detail Popup
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [selectedTalla, setSelectedTalla] = useState<string>('');
  const [selectedEstampado, setSelectedEstampado] = useState<string>('');
  const [selectedCantidad, setSelectedCantidad] = useState(1);
  const [selectedMiembroFamilia, setSelectedMiembroFamilia] = useState<string>('');
  const [famOptionQuantities, setFamOptionQuantities] = useState<Record<string, number>>({});`;

const newStateHook = `  // Product Detail Popup
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [selectedTalla, setSelectedTalla] = useState<string>('');
  const [selectedEstampado, setSelectedEstampado] = useState<string>('');
  const [selectedCantidad, setSelectedCantidad] = useState(1);
  const [selectedMiembroFamilia, setSelectedMiembroFamilia] = useState<string>('');
  const [famOptionQuantities, setFamOptionQuantities] = useState<Record<string, number>>({});

  // Swipe & Touch Refs for Product Detail Carousel
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);
  const isDraggingCarousel = useRef<boolean>(false);

  const handleCarouselTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleCarouselTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleCarouselTouchEnd = (allImagesList: any[], estampadosList: string[]) => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = (touchStartY.current || 0) - (touchEndY.current || 0);

    if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        handleNextDetailImage(allImagesList, estampadosList);
      } else {
        handlePrevDetailImage(allImagesList, estampadosList);
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
  };

  const handleCarouselMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX;
    touchEndX.current = e.clientX;
    isDraggingCarousel.current = true;
  };

  const handleCarouselMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCarousel.current) return;
    touchEndX.current = e.clientX;
  };

  const handleCarouselMouseUp = (allImagesList: any[], estampadosList: string[]) => {
    if (!isDraggingCarousel.current) return;
    isDraggingCarousel.current = false;
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diffX = touchStartX.current - touchEndX.current;
    if (Math.abs(diffX) > 30) {
      if (diffX > 0) {
        handleNextDetailImage(allImagesList, estampadosList);
      } else {
        handlePrevDetailImage(allImagesList, estampadosList);
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleNextDetailImage = (allImagesList: any[], estampadosList: string[]) => {
    if (allImagesList.length <= 1) return;
    setCarouselIdx(prev => {
      const nextIdx = prev + 1 >= allImagesList.length ? 0 : prev + 1;
      const targetImg = allImagesList[nextIdx];
      const estRaw = (targetImg?.estampado || targetImg?.ref)?.trim();
      if (estRaw) {
        const match = estampadosList.find(e => e.toLowerCase() === estRaw.toLowerCase());
        setSelectedEstampado(match || estRaw.toUpperCase());
      } else if (estampadosList.length > 0) {
        setSelectedEstampado(estampadosList[nextIdx % estampadosList.length]);
      }
      return nextIdx;
    });
  };

  const handlePrevDetailImage = (allImagesList: any[], estampadosList: string[]) => {
    if (allImagesList.length <= 1) return;
    setCarouselIdx(prev => {
      const nextIdx = prev - 1 < 0 ? allImagesList.length - 1 : prev - 1;
      const targetImg = allImagesList[nextIdx];
      const estRaw = (targetImg?.estampado || targetImg?.ref)?.trim();
      if (estRaw) {
        const match = estampadosList.find(e => e.toLowerCase() === estRaw.toLowerCase());
        setSelectedEstampado(match || estRaw.toUpperCase());
      } else if (estampadosList.length > 0) {
        setSelectedEstampado(estampadosList[nextIdx % estampadosList.length]);
      }
      return nextIdx;
    });
  };`;

if (normContent.includes(normalize(oldStateHook))) {
  normContent = normContent.replace(normalize(oldStateHook), normalize(newStateHook));
  console.log('2. Added touch and swipe hooks');
} else {
  console.error('Failed 2. Added touch and swipe hooks');
}

// 3. Update openDetail to initialize selectedEstampado from the first image
const oldOpenDetail = `  const openDetail = (producto: Producto) => {
    setDetailProduct(producto);
    setCarouselIdx(0);
    setSelectedTalla('');
    setSelectedEstampado('');
    setSelectedCantidad(1);`;

const newOpenDetail = `  const openDetail = (producto: Producto) => {
    setDetailProduct(producto);
    setCarouselIdx(0);
    setSelectedTalla('');
    const rawAllImages = (producto.imagenes_extra || []).map(u => decodeExtraImage(u)).filter(i => i.url);
    const firstImg = rawAllImages.length > 0 ? rawAllImages[0] : (producto.imagen_url ? { url: producto.imagen_url, ref: producto.referencia || '', estampado: '' } : null);
    const initialEst = (firstImg?.estampado || firstImg?.ref)?.trim() || producto.estampados?.split(',')[0]?.trim() || '';
    setSelectedEstampado(initialEst.toUpperCase());
    setSelectedCantidad(1);`;

if (normContent.includes(normalize(oldOpenDetail))) {
  normContent = normContent.replace(normalize(oldOpenDetail), normalize(newOpenDetail));
  console.log('3. Updated openDetail');
} else {
  console.error('Failed 3. Updated openDetail');
}

// 4. Update the carousel rendering inside detailProduct
const oldCarouselJSX = `              {/* ── CAROUSEL ── */}
              <div className="detail-carousel">
                {detailProduct.video_url ? (
                  <video src={detailProduct.video_url} autoPlay loop muted playsInline preload="metadata" className="detail-carousel-img" ref={el => { if (el && el.paused) el.play().catch(() => {}); }} />
                ) : allImages.length > 0 ? (
                  <img src={getOptimizedImageUrl(allImages[safeIdx].url, 800, 80)} alt={detailProduct.nombre} className="detail-carousel-img" loading="eager" fetchPriority="high" decoding="async" />
                ) : (
                  <div className="detail-carousel-placeholder" />
                )}

                {/* Share button (bottom-left INSIDE image frame) */}
                <button 
                  className="detail-share-btn" 
                  onClick={() => {
                    const shareUrl = window.location.href;
                    const shareData = {
                      title: detailProduct.nombre,
                      text: \`Mira este producto en el catálogo digital: \${detailProduct.nombre}\`,
                      url: shareUrl,
                    };
                    if (navigator.share) {
                      navigator.share(shareData).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      alert('¡Enlace del producto copiado al portapapeles!');
                    }
                  }}
                  title="Compartir producto"
                >
                  <Share2 size={16} color="#0f172a" />
                  <span>Compartir</span>
                </button>

                {/* ── LABELS REFERENCIA Y ESTAMPADO (ABAJO DERECHO - EFECTO GLASS) ── */}
                <div style={{ position: 'absolute', bottom: '0.65rem', right: '0.65rem', left: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', zIndex: 10, alignItems: 'flex-end', pointerEvents: 'none', maxWidth: '60%' }}>
                  <div style={{ fontSize: '0.72rem', padding: '0.28rem 0.65rem', background: 'rgba(255, 255, 255, 0.88)', color: '#0f172a', fontWeight: 500, borderRadius: '8px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, textAlign: 'right' }}>
                    Ref: {toTitleCase(detailProduct.nombre)} {(detailProduct.referencia || detailProduct.sku) ? \`(\${detailProduct.referencia || detailProduct.sku})\` : ''}
                  </div>
                  {currentImgRef && (
                    <div style={{ fontSize: '0.74rem', padding: '0.3rem 0.7rem', background: 'rgba(255, 255, 255, 0.88)', color: '#0f172a', fontWeight: 500, borderRadius: '8px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, textAlign: 'right' }}>
                      Estampado: {toTitleCase(currentImgRef)}
                    </div>
                  )}
                </div>
              </div>`;

const newCarouselJSX = `              {/* ── CAROUSEL INTERACTIVO CON SWIPE Y SINCRONIZACIÓN DE ESTAMPADOS ── */}
              {(() => {
                const imgEstampadosList = allImages.map(img => (img.estampado || img.ref)?.trim().toUpperCase()).filter(Boolean);
                const estampadosList = imgEstampadosList.length > 0 ? Array.from(new Set(imgEstampadosList)) : legacyEstampados;

                return (
                  <div 
                    className="detail-carousel"
                    onTouchStart={handleCarouselTouchStart}
                    onTouchMove={handleCarouselTouchMove}
                    onTouchEnd={() => handleCarouselTouchEnd(allImages, estampadosList)}
                    onMouseDown={handleCarouselMouseDown}
                    onMouseMove={handleCarouselMouseMove}
                    onMouseUp={() => handleCarouselMouseUp(allImages, estampadosList)}
                    onMouseLeave={() => handleCarouselMouseUp(allImages, estampadosList)}
                    style={{ 
                      cursor: allImages.length > 1 ? 'grab' : 'default', 
                      userSelect: 'none', 
                      touchAction: 'pan-y', 
                      position: 'relative', 
                      overflow: 'hidden' 
                    }}
                  >
                    {detailProduct.video_url ? (
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
                    )}

                    {/* Botones de navegación flecha izquierda y derecha */}
                    {allImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          className="carousel-btn carousel-btn-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrevDetailImage(allImages, estampadosList);
                          }}
                          style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.88)',
                            border: '1px solid rgba(255, 255, 255, 0.7)',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 20,
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            color: '#0f172a'
                          }}
                          title="Estampado anterior (O desliza hacia la derecha)"
                        >
                          <ChevronLeft size={20} />
                        </button>

                        <button
                          type="button"
                          className="carousel-btn carousel-btn-right"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNextDetailImage(allImages, estampadosList);
                          }}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.88)',
                            border: '1px solid rgba(255, 255, 255, 0.7)',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 20,
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            color: '#0f172a'
                          }}
                          title="Siguiente estampado (O desliza hacia la izquierda)"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </>
                    )}

                    {/* Contador de fotos en la parte superior izquierda */}
                    {allImages.length > 1 && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        background: 'rgba(15, 23, 42, 0.65)',
                        color: '#ffffff',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        zIndex: 15,
                        fontFamily: "'Poppins', sans-serif"
                      }}>
                        {safeIdx + 1} / {allImages.length}
                      </div>
                    )}

                    {/* Share button (bottom-left INSIDE image frame) */}
                    <button 
                      className="detail-share-btn" 
                      onClick={() => {
                        const shareUrl = window.location.href;
                        const shareData = {
                          title: detailProduct.nombre,
                          text: \`Mira este producto en el catálogo digital: \${detailProduct.nombre}\`,
                          url: shareUrl,
                        };
                        if (navigator.share) {
                          navigator.share(shareData).catch(() => {});
                        } else {
                          navigator.clipboard.writeText(shareUrl);
                          alert('¡Enlace del producto copiado al portapapeles!');
                        }
                      }}
                      title="Compartir producto"
                    >
                      <Share2 size={16} color="#0f172a" />
                      <span>Compartir</span>
                    </button>

                    {/* ── LABELS REFERENCIA Y ESTAMPADO (ABAJO DERECHO - EFECTO GLASS) ── */}
                    <div style={{ position: 'absolute', bottom: '0.65rem', right: '0.65rem', left: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', zIndex: 10, alignItems: 'flex-end', pointerEvents: 'none', maxWidth: '60%' }}>
                      <div style={{ fontSize: '0.72rem', padding: '0.28rem 0.65rem', background: 'rgba(255, 255, 255, 0.88)', color: '#0f172a', fontWeight: 500, borderRadius: '8px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, textAlign: 'right', fontFamily: "'Poppins', sans-serif" }}>
                        Ref: {toTitleCase(detailProduct.nombre)} {(detailProduct.referencia || detailProduct.sku) ? \`(\${detailProduct.referencia || detailProduct.sku})\` : ''}
                      </div>
                      {currentImgRef && (
                        <div style={{ fontSize: '0.74rem', padding: '0.3rem 0.7rem', background: 'rgba(255, 255, 255, 0.88)', color: '#0f172a', fontWeight: 600, borderRadius: '8px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.7)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: '100%', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.3, textAlign: 'right', fontFamily: "'Poppins', sans-serif" }}>
                          Estampado: {toTitleCase(currentImgRef)}
                        </div>
                      )}
                    </div>

                    {/* Dots indicators abajo al centro */}
                    {allImages.length > 1 && allImages.length <= 15 && (
                      <div className="carousel-dots" style={{ zIndex: 15, bottom: '8px' }}>
                        {allImages.map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            className={\`carousel-dot\${dotIdx === safeIdx ? ' active' : ''}\`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCarouselIdx(dotIdx);
                              const targetImg = allImages[dotIdx];
                              const estRaw = (targetImg?.estampado || targetImg?.ref)?.trim();
                              if (estRaw) {
                                const match = estampadosList.find(item => item.toLowerCase() === estRaw.toLowerCase());
                                setSelectedEstampado(match || estRaw.toUpperCase());
                              } else if (estampadosList.length > 0) {
                                setSelectedEstampado(estampadosList[dotIdx % estampadosList.length]);
                              }
                            }}
                            style={{
                              width: dotIdx === safeIdx ? '16px' : '6px',
                              height: '6px',
                              borderRadius: '4px',
                              background: dotIdx === safeIdx ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                              transition: 'all 0.25s ease',
                              cursor: 'pointer'
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}`;

if (normContent.includes(normalize(oldCarouselJSX))) {
  normContent = normContent.replace(normalize(oldCarouselJSX), normalize(newCarouselJSX));
  console.log('4. Replaced carousel JSX');
} else {
  console.error('Failed 4. Replaced carousel JSX');
}

fs.writeFileSync(menuPath, normContent, 'utf8');
console.log('MenuDigital.tsx patched successfully! New length:', normContent.length);
