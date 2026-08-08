import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageCompression';

interface PagoNequiProps {
  mode?: 'pago' | 'guia';
}

export default function PagoNequi({ mode: propMode }: PagoNequiProps) {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const location = useLocation();
  const isGuiaRoute = propMode === 'guia' || location.pathname.startsWith('/guia');

  const [pedido, setPedido] = useState<any>(null);
  const [configuracion, setConfiguracion] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [copiedGuia, setCopiedGuia] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!pedidoId) return;
      const cleanId = pedidoId.trim();
      let query = supabase.from('pedidos').select('*');
      if (cleanId.length === 36) {
        query = query.eq('id', cleanId);
      } else {
        query = query.or(`id.eq.${cleanId},id.ilike.${cleanId}%`);
      }
      const { data } = await query.limit(1).maybeSingle();
      setPedido(data);
      if (data?.pantallazo_url) setEnviado(true);

      // Cargar configuración de negocio si existe
      if (data?.tenant_id) {
        const { data: conf } = await supabase.from('configuracion').select('*').eq('tenant_id', data.tenant_id).maybeSingle();
        setConfiguracion(conf);
      }
      setCargando(false);
    }
    cargar();
  }, [pedidoId]);

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubir = async () => {
    if (!file || !pedido || !pedido.id) return;
    setSubiendo(true);
    setError('');
    try {
      const compressedFile = await compressImage(file, 1000, 0.7);
      const ext = compressedFile.name.split('.').pop() || 'jpg';
      const fileName = `pago_${pedido.id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('archivos')
        .upload(fileName, compressedFile);
      if (uploadErr) {
        console.error('Storage upload error:', uploadErr);
        throw new Error(`Error de Storage: ${uploadErr.message}`);
      }
      
      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(fileName);
      const { error: updateErr } = await supabase
        .from('pedidos')
        .update({ pantallazo_url: urlData.publicUrl })
        .eq('id', pedido.id);
      if (updateErr) {
        console.error('Database update error:', updateErr);
        throw new Error(`Error de Base de Datos: ${updateErr.message}`);
      }
      setEnviado(true);
    } catch (e: any) {
      console.error('Submit error:', e);
      setError(e.message || 'Error al subir la imagen. Intenta de nuevo.');
    } finally {
      setSubiendo(false);
    }
  };

  if (cargando) return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>⏳</div>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.75rem', fontFamily: 'Poppins, sans-serif' }}>Cargando información del pedido...</p>
      </div>
    </div>
  );

  if (!pedido) return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ fontSize: '3rem' }}>❌</div>
        <h2 style={{ color: '#ef4444', fontFamily: 'Poppins, sans-serif' }}>Pedido no encontrado</h2>
        <p style={{ color: '#64748b', fontFamily: 'Poppins, sans-serif', fontSize: '0.88rem' }}>El enlace puede ser inválido o el pedido ya fue removido.</p>
        <Link to="/" style={styles.secondaryBtn}>
          🏪 Ir al catálogo
        </Link>
      </div>
    </div>
  );

  // Determinar si debemos mostrar la vista de GUÍA (Despacho / Contra entrega) o la vista de PAGO (Transferencia)
  const isContraEntrega = (pedido.origen === 'contra_entrega' || pedido.metodo_pago === 'contra_entrega' || pedido.linea_whatsapp === 'contra_entrega');
  const showGuiaMode = isGuiaRoute || isContraEntrega;

  // ═════════════════════════════════════════════════════════════════════
  // VISTA 1: CONSULTA DE GUÍA / EVIDENCIA DE ENVÍO (Pago contra entrega o Despacho)
  // ═════════════════════════════════════════════════════════════════════
  if (showGuiaMode) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <div style={{ fontSize: '2.5rem' }}>🚚</div>
            <h1 style={styles.title}>Guía y Evidencia de Envío</h1>
            <p style={styles.subtitle}>Consulta los detalles y el estado del despacho de tu pedido</p>
          </div>

          {/* Pedido summary card */}
          <div style={styles.orderBox}>
            <div style={styles.orderRow}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Cliente</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{pedido.cliente_nombre}</span>
            </div>
            <div style={styles.orderRow}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Pedido</span>
              <span style={{ fontWeight: 600, color: '#6366f1', fontSize: '0.85rem' }}>#{pedidoId?.slice(0, 8).toUpperCase()}</span>
            </div>
            <div style={styles.orderRow}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Modalidad</span>
              <span style={{ fontWeight: 600, color: '#059669', fontSize: '0.82rem', background: '#d1fae5', padding: '2px 8px', borderRadius: '10px' }}>
                🚚 Pago Contra Entrega
              </span>
            </div>
            <div style={{ ...styles.orderRow, borderBottom: 'none', paddingBottom: 0 }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Total a pagar al recibir</span>
              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '1.2rem' }}>
                ${pedido.total?.toLocaleString('es-CO')} COP
              </span>
            </div>
          </div>

          {/* Sección Evidencia / Guía de envío cargada por la empresa */}
          <div style={{ margin: '1.25rem 0 0.5rem 0', textAlign: 'left' }}>
            {pedido.evidencia_despacho_url ? (
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '16px', padding: '1rem', textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>
                  📸 Evidencia de Despacho / Guía de Envío
                </h4>
                <div 
                  onClick={() => setModalImage(pedido.evidencia_despacho_url)}
                  style={{ cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff', display: 'inline-block', maxWidth: '100%' }}
                >
                  <img
                    src={pedido.evidencia_despacho_url}
                    alt="Evidencia de despacho"
                    style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', display: 'block' }}
                  />
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.76rem', color: '#16a34a', fontWeight: 500 }}>
                  ✅ Comprobante cargado por la empresa · Toca la imagen para ampliar
                </p>
              </div>
            ) : null}

            {pedido.numero_guia ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '0.9rem 1rem', marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 500, textTransform: 'uppercase', display: 'block' }}>Número de Guía / Rastreo</span>
                  <strong style={{ fontSize: '1.1rem', color: '#14532d', fontWeight: 600 }}>{pedido.numero_guia}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pedido.numero_guia || '');
                    setCopiedGuia(true);
                    setTimeout(() => setCopiedGuia(false), 2000);
                  }}
                  style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
                >
                  {copiedGuia ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
            ) : null}

            {!pedido.evidencia_despacho_url && !pedido.numero_guia && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '16px', padding: '1.1rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>⏳</div>
                <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.92rem', color: '#c2410c', fontWeight: 600 }}>
                  Despacho en preparación
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#9a3412', lineHeight: 1.45 }}>
                  Tu pedido se encuentra en alistamiento. Tan pronto el equipo de despacho asigne la guía o evidencia de envío, podrás consultarla en este mismo enlace.
                </p>
              </div>
            )}
          </div>

          <Link to="/" style={{ ...styles.secondaryBtn, marginTop: '1.25rem' }}>
            🛍️ Volver al catálogo
          </Link>
        </div>

        {/* Modal de imagen completa */}
        {modalImage && (
          <div 
            onClick={() => setModalImage(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem', cursor: 'zoom-out' }}
          >
            <img src={modalImage} alt="Evidencia en pantalla completa" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // VISTA 2: SUBIR COMPROBANTE DE PAGO (Pago anticipado / Transferencia)
  // ═════════════════════════════════════════════════════════════════════
  if (enviado) return (
    <div style={styles.page}>
      <style>{`
        .checkmark-svg {
          width: 80px; height: 80px; border-radius: 50%; display: block;
          stroke-width: 4; stroke: #10b981; stroke-miterlimit: 10; margin: 0 auto 1.5rem;
          box-shadow: inset 0px 0px 0px #10b981;
          animation: fillAnimation .4s ease-in-out .4s forwards, scaleUp .3s ease-in-out .9s both;
        }
        .checkmark-circle {
          stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 4; stroke-miterlimit: 10; stroke: #10b981; fill: none;
          animation: strokeAnimation .6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .checkmark-check {
          transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; stroke: white;
          animation: strokeAnimation .3s cubic-bezier(0.65, 0, 0.45, 1) .8s forwards;
        }
        @keyframes strokeAnimation { 100% { stroke-dashoffset: 0; } }
        @keyframes scaleUp { 0%, 100% { transform: none; } 50% { transform: scale3d(1.15, 1.15, 1); } }
        @keyframes fillAnimation { 100% { box-shadow: inset 0px 0px 0px 40px #10b981; } }
      `}</style>
      <div style={styles.card}>
        <div style={{ textAlign: 'center' }}>
          <svg className="checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
        <h2 style={{ color: '#10b981', marginBottom: '0.5rem', textAlign: 'center', fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
          ¡Comprobante de pago recibido!
        </h2>
        <p style={{ color: '#475569', textAlign: 'center', lineHeight: 1.5, margin: '0.5rem 0 1rem', fontSize: '0.88rem', fontFamily: 'Poppins, sans-serif' }}>
          Hemos asociado tu comprobante al pedido.<br />
          El equipo lo verificará para proceder con el despacho. <strong>¡Gracias por tu compra!</strong>
        </p>
        <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '0.85rem 1.25rem', marginTop: '1rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <span style={{ fontSize: '0.88rem', color: '#15803d', fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
            📦 Pedido #{pedidoId?.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <Link to="/" style={{ ...styles.secondaryBtn, marginTop: '1.5rem' }}>
          🛍️ ¿Quieres seguir comprando?
        </Link>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ fontSize: '2.5rem' }}>💳</div>
          <h1 style={styles.title}>Subir comprobante de pago</h1>
          <p style={styles.subtitle}>Carga el pantallazo de tu transferencia bancaria</p>
        </div>

        {/* Order summary */}
        <div style={styles.orderBox}>
          <div style={styles.orderRow}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Cliente</span>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{pedido.cliente_nombre}</span>
          </div>
          <div style={styles.orderRow}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Pedido</span>
            <span style={{ fontWeight: 600, color: '#6366f1', fontSize: '0.85rem' }}>#{pedidoId?.slice(0, 8).toUpperCase()}</span>
          </div>
          <div style={{ ...styles.orderRow, borderBottom: 'none', paddingBottom: 0 }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Total a pagar</span>
            <span style={{ fontWeight: 600, color: '#10b981', fontSize: '1.25rem' }}>
              ${pedido.total?.toLocaleString('es-CO')} COP
            </span>
          </div>
        </div>

        {/* Upload area */}
        <label style={preview ? styles.previewLabel : styles.uploadLabel}>
          {preview ? (
            <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px' }} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📷</div>
              <p style={{ margin: 0, fontWeight: 500, color: '#0f172a', fontFamily: 'Poppins, sans-serif' }}>Toca para seleccionar el comprobante</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'Poppins, sans-serif' }}>JPG, PNG, WEBP — captura de pantalla</p>
            </div>
          )}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </label>

        {preview && (
          <label style={{ display: 'block', textAlign: 'center', marginTop: '0.5rem', cursor: 'pointer', color: '#6366f1', fontWeight: 500, fontSize: '0.84rem', fontFamily: 'Poppins, sans-serif' }}>
            Cambiar imagen
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
        )}

        {error && <p style={{ color: '#ef4444', textAlign: 'center', fontSize: '0.85rem', marginTop: '0.75rem', fontFamily: 'Poppins, sans-serif' }}>{error}</p>}

        <button
          style={{
            ...styles.btn,
            background: file ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#e2e8f0',
            color: file ? 'white' : '#94a3b8',
            cursor: file ? 'pointer' : 'not-allowed',
            boxShadow: file ? '0 6px 20px rgba(16,185,129,0.35)' : 'none',
          }}
          disabled={!file || subiendo}
          onClick={handleSubir}
        >
          {subiendo ? '⏳ Subiendo...' : '✅ Enviar Comprobante de Pago'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8', marginTop: '1rem', fontFamily: 'Poppins, sans-serif' }}>
          Tu comprobante quedará asociado al pedido y será verificado por el equipo.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem 1rem',
    fontFamily: "'Poppins', sans-serif"
  },
  card: {
    background: '#ffffff',
    borderRadius: '24px',
    border: '1px solid #e8edf5',
    boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
    padding: '2rem 1.5rem',
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center'
  },
  header: {
    marginBottom: '1.25rem'
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#0f172a',
    margin: '0.5rem 0 0.25rem'
  },
  subtitle: {
    fontSize: '0.82rem',
    color: '#64748b',
    margin: 0,
    fontWeight: 400
  },
  orderBox: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '0.9rem 1.1rem',
    marginBottom: '1.25rem',
    textAlign: 'left'
  },
  orderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0',
    borderBottom: '1px dashed #e2e8f0'
  },
  uploadLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px dashed #cbd5e1',
    borderRadius: '18px',
    padding: '2rem 1rem',
    background: '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  previewLabel: {
    display: 'block',
    height: '200px',
    borderRadius: '18px',
    overflow: 'hidden',
    border: '2px dashed #6366f1',
    background: '#f5f3ff',
    cursor: 'pointer',
    position: 'relative'
  },
  btn: {
    width: '100%',
    padding: '0.88rem',
    borderRadius: '14px',
    border: 'none',
    fontSize: '0.92rem',
    fontWeight: 600,
    marginTop: '1.25rem',
    transition: 'all 0.2s ease',
    fontFamily: "'Poppins', sans-serif"
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '0.82rem',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#334155',
    textDecoration: 'none',
    fontSize: '0.88rem',
    fontWeight: 500,
    fontFamily: "'Poppins', sans-serif"
  }
};
