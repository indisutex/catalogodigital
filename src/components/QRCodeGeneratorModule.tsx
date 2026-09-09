import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, Check, QrCode, Sparkles, ExternalLink, Image as ImageIcon, Palette, Printer } from 'lucide-react';
import type { Configuracion } from '../types';
import { getTenantId } from '../lib/supabase';

interface QRCodeGeneratorModuleProps {
  configuracion: Configuracion | null;
  mayoristas?: any[];
}

export const QRCodeGeneratorModule: React.FC<QRCodeGeneratorModuleProps> = ({
  configuracion,
  mayoristas = []
}) => {
  const currentTenant = configuracion?.tenant_id || getTenantId();
  
  // URL base del catálogo
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pijamasalmayor.com';
  const defaultUrl = `${origin}/${currentTenant}`;

  const [targetUrl, setTargetUrl] = useState<string>(defaultUrl);
  const [selectedTenant, setSelectedTenant] = useState<string>(currentTenant);
  const [qrColor, setQrColor] = useState<string>(configuracion?.color_primario || '#6366f1');
  const [qrBgColor, setQrBgColor] = useState<string>('#ffffff');
  const [includeLogo, setIncludeLogo] = useState<boolean>(true);
  const [customLogoUrl, setCustomLogoUrl] = useState<string>(configuracion?.logo_url || '');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Lista de negocios para selección rápida
  const knownStores = [
    { id: currentTenant, name: configuracion?.nombre_negocio || 'Tienda Principal', slug: currentTenant, logo: configuracion?.logo_url },
    { id: 'sublimados_majestic', name: 'Sublimados Majestic', slug: 'sublimados_majestic', logo: configuracion?.logo_url },
    { id: 'lucerito', name: 'Pijamas Lucerito', slug: 'lucerito', logo: '' },
    { id: 'saramantha', name: 'Saramantha', slug: 'saramantha', logo: '' },
    ...mayoristas.map(m => ({
      id: m.id,
      name: m.nombre_negocio || m.nombre || 'Mayorista',
      slug: (m.nombre_negocio || m.nombre || m.id).toLowerCase().replace(/\s+/g, '_'),
      logo: m.foto_url || m.logo
    }))
  ];

  // Actualizar cuando cambie el negocio seleccionado
  const handleStoreChange = (slug: string) => {
    setSelectedTenant(slug);
    const newUrl = `${origin}/${slug}`;
    setTargetUrl(newUrl);
    const match = knownStores.find(s => s.slug === slug);
    if (match?.logo) {
      setCustomLogoUrl(match.logo);
    }
  };

  // Función para dibujar el QR en el canvas con el logo en el centro
  const renderQRCode = async () => {
    if (!canvasRef.current || !targetUrl.trim()) return;
    setIsGenerating(true);

    try {
      const canvas = canvasRef.current;
      
      // 1. Generar código QR con nivel de corrección H (30% de redundancia para soportar logo central)
      await QRCode.toCanvas(canvas, targetUrl.trim(), {
        width: 480,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: qrColor || '#000000',
          light: qrBgColor || '#ffffff'
        }
      });

      // 2. Si tiene logo, dibujarlo en el centro con un marco circular blanco nítido
      const logoToUse = customLogoUrl || configuracion?.logo_url;
      if (includeLogo && logoToUse) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.crossOrigin = 'anonymous';

          img.onload = () => {
            const size = canvas.width;
            const logoBoxSize = size * 0.25; // 25% del tamaño del QR
            const center = size / 2;
            const radius = logoBoxSize / 2;

            ctx.save();

            // Fondo blanco circular para que el logo no interfiera con los módulos QR
            ctx.beginPath();
            ctx.arc(center, center, radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 8;
            ctx.fill();

            // Borde con el color temático del negocio
            ctx.lineWidth = 3;
            ctx.strokeStyle = qrColor || '#6366f1';
            ctx.stroke();

            // Recorte circular para el logo
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.clip();

            // Dibujar imagen centrada
            ctx.drawImage(img, center - radius, center - radius, logoBoxSize, logoBoxSize);
            ctx.restore();
            setIsGenerating(false);
          };

          img.onerror = () => {
            console.warn('No se pudo cargar la imagen del logo en el QR.');
            setIsGenerating(false);
          };

          img.src = logoToUse;
        }
      } else {
        setIsGenerating(false);
      }
    } catch (err) {
      console.error('Error generando QR:', err);
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    renderQRCode();
  }, [targetUrl, qrColor, qrBgColor, includeLogo, customLogoUrl]);

  // Copiar URL al portapapeles
  const handleCopyLink = () => {
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Descargar imagen PNG en alta resolución (1024x1024 px)
  const handleDownloadPNG = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Crear canvas temporal en alta definición (1024px)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1024;
    exportCanvas.height = 1024;
    const expCtx = exportCanvas.getContext('2d');
    if (!expCtx) return;

    // Dibujar el QR escalado nítidamente
    expCtx.imageSmoothingEnabled = false;
    expCtx.drawImage(canvas, 0, 0, 1024, 1024);

    const link = document.createElement('a');
    const safeName = (configuracion?.nombre_negocio || selectedTenant || 'catalogo').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.download = `QR_${safeName}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  // Imprimir tarjeta de mostrador con el QR
  const handlePrintCard = () => {
    if (!canvasRef.current) return;
    const qrDataUrl = canvasRef.current.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const storeTitle = configuracion?.nombre_negocio || 'Catálogo Digital';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir QR - ${storeTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
            body {
              font-family: 'Poppins', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f8fafc;
            }
            .qr-print-card {
              background: #ffffff;
              border: 2px solid ${qrColor};
              border-radius: 24px;
              padding: 2.5rem;
              text-align: center;
              box-shadow: 0 10px 30px rgba(0,0,0,0.08);
              max-width: 380px;
              width: 100%;
            }
            .store-name {
              font-size: 1.4rem;
              font-weight: 600;
              color: #0f172a;
              margin-bottom: 0.25rem;
            }
            .tagline {
              font-size: 0.88rem;
              font-weight: 400;
              color: #64748b;
              margin-bottom: 1.5rem;
            }
            .qr-image {
              width: 260px;
              height: 260px;
              border-radius: 16px;
              margin: 0 auto;
              display: block;
            }
            .cta-scan {
              margin-top: 1.5rem;
              font-size: 0.95rem;
              font-weight: 600;
              color: ${qrColor};
            }
            .cta-sub {
              font-size: 0.78rem;
              font-weight: 400;
              color: #94a3b8;
              margin-top: 0.25rem;
            }
            @media print {
              body { background: transparent; }
              .qr-print-card { box-shadow: none; border-width: 2px; }
            }
          </style>
        </head>
        <body>
          <div class="qr-print-card">
            <div class="store-name">${storeTitle}</div>
            <div class="tagline">¡Escanea con tu celular y haz tu pedido!</div>
            <img src="${qrDataUrl}" class="qr-image" alt="Código QR" />
            <div class="cta-scan">📱 Catálogo Digital Interactivo</div>
            <div class="cta-sub">${targetUrl}</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="config-section" style={{ padding: '0.5rem 0' }}>
      {/* ── ENCABEZADO DE LA SECCIÓN ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div className="config-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <QrCode size={20} color="var(--primary-color, #6366f1)" />
            Generador de Códigos QR para el Negocio
          </div>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.84rem', color: '#64748b', fontWeight: 400, fontFamily: "'Poppins', sans-serif" }}>
            Genera códigos QR personalizados con los colores y logo de tu tienda para colocar en empaques, tarjetas, mostradores o redes sociales.
          </p>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#ecfdf5', color: '#059669', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 500 }}>
          <Sparkles size={14} /> Alta Calidad (100% Escaneable)
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL EN DOS COLUMNAS (CONTROLES + PREVIEW) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        
        {/* COLUMNA 1: CONTROLES DE PERSONALIZACIÓN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Selección de Negocio */}
          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500, fontSize: '0.85rem' }}>
              🏪 Negocio / Tienda Destino
            </label>
            <select
              value={selectedTenant}
              onChange={(e) => handleStoreChange(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '0.86rem',
                fontFamily: "'Poppins', sans-serif",
                background: '#ffffff'
              }}
            >
              {knownStores.map((store, i) => (
                <option key={`${store.slug}-${i}`} value={store.slug}>
                  {store.name} (/{store.slug})
                </option>
              ))}
            </select>
          </div>

          {/* Enlace Destino del QR */}
          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500, fontSize: '0.85rem' }}>
              🔗 Enlace Destino (URL)
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://pijamasalmayor.com/tu_tienda"
                style={{
                  flex: 1,
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.84rem',
                  fontFamily: "'Poppins', sans-serif"
                }}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: copied ? '#ecfdf5' : '#f8fafc',
                  color: copied ? '#059669' : '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif"
                }}
                title="Copiar enlace"
              >
                {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
              Los clientes que escaneen el código QR serán redirigidos exactamente a esta dirección.
            </span>
          </div>

          {/* Opciones de Color */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500, fontSize: '0.85rem' }}>
                <Palette size={14} /> Color de los Módulos QR
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="color"
                  value={qrColor}
                  onChange={(e) => setQrColor(e.target.value)}
                  style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', padding: 0 }}
                />
                <input
                  type="text"
                  value={qrColor}
                  onChange={(e) => setQrColor(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div className="form-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 500, fontSize: '0.85rem' }}>
                Fondo del QR
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="color"
                  value={qrBgColor}
                  onChange={(e) => setQrBgColor(e.target.value)}
                  style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', padding: 0 }}
                />
                <input
                  type="text"
                  value={qrBgColor}
                  onChange={(e) => setQrBgColor(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontFamily: 'monospace' }}
                />
              </div>
            </div>
          </div>

          {/* Paleta rápida de colores temáticos */}
          <div>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500, display: 'block', marginBottom: '0.4rem' }}>
              Colores temáticos sugeridos:
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { name: 'Negocio', color: configuracion?.color_primario || '#6366f1' },
                { name: 'Negro Clásico', color: '#0f172a' },
                { name: 'Majestic Pink', color: '#ec4899' },
                { name: 'Azul Real', color: '#2563eb' },
                { name: 'Verde Esmeralda', color: '#059669' },
                { name: 'Rojo Pasión', color: '#dc2626' },
                { name: 'Dorado', color: '#d97706' }
              ].map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQrColor(p.color)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '8px',
                    border: qrColor === p.color ? '2px solid #0f172a' : '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Configuración de Logo en el Centro */}
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500, fontSize: '0.86rem' }}>
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={(e) => setIncludeLogo(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Integrar logo en el centro del código QR</span>
            </label>

            {includeLogo && (
              <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                  URL de la imagen del logo:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {customLogoUrl ? (
                    <img src={customLogoUrl} alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon size={16} color="#94a3b8" />
                    </div>
                  )}
                  <input
                    type="url"
                    value={customLogoUrl}
                    onChange={(e) => setCustomLogoUrl(e.target.value)}
                    placeholder="https://.../logo.png"
                    style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA 2: VISTA PREVIA Y ACCIONES DE DESCARGA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          
          {/* Tarjeta de visualización moderna */}
          <div
            style={{
              background: '#ffffff',
              border: `2px solid ${qrColor}25`,
              borderRadius: '24px',
              padding: '1.75rem',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: '340px',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            {/* Cabecera de la tarjeta con nombre del negocio */}
            <div style={{ marginBottom: '1rem', width: '100%' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: qrColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Catálogo Oficial
              </span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {configuracion?.nombre_negocio || selectedTenant}
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>
                Escanea para ver productos y precios
              </p>
            </div>

            {/* Canvas contenedor del QR */}
            <div
              style={{
                background: qrBgColor,
                padding: '0.75rem',
                borderRadius: '18px',
                border: '1px solid #f1f5f9',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  width: '240px',
                  height: '240px',
                  borderRadius: '12px',
                  display: 'block',
                  opacity: isGenerating ? 0.6 : 1,
                  transition: 'opacity 0.2s ease'
                }}
              />
            </div>

            {/* Pie de tarjeta con URL recortada */}
            <div style={{ marginTop: '1rem', width: '100%' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {targetUrl}
              </div>
            </div>
          </div>

          {/* Botones de Descarga e Impresión */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%', maxWidth: '340px' }}>
            <button
              type="button"
              onClick={handleDownloadPNG}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: 'none',
                background: qrColor || 'var(--primary-color, #6366f1)',
                color: '#ffffff',
                fontSize: '0.86rem',
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={16} /> Descargar Imagen PNG (Alta Resolución)
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handlePrintCard}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  fontFamily: "'Poppins', sans-serif",
                  cursor: 'pointer'
                }}
              >
                <Printer size={15} /> Imprimir Tarjeta
              </button>

              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                <ExternalLink size={15} /> Abrir Enlace
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
