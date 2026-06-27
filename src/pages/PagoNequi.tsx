import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PagoNequi() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const [pedido, setPedido] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargar() {
      if (!pedidoId) return;
      const { data } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single();
      setPedido(data);
      if (data?.pantallazo_url) setEnviado(true);
      setCargando(false);
    }
    cargar();
  }, [pedidoId]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubir = async () => {
    if (!file || !pedidoId) return;
    setSubiendo(true);
    setError('');
    try {
      const ext = file.name.split('.').pop();
      const fileName = `pago_${pedidoId}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('archivos')
        .upload(fileName, file);
      if (uploadErr) {
        console.error('Storage upload error:', uploadErr);
        throw new Error(`Error de Storage: ${uploadErr.message}`);
      }
      
      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(fileName);
      const { error: updateErr } = await supabase
        .from('pedidos')
        .update({ pantallazo_url: urlData.publicUrl })
        .eq('id', pedidoId);
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
        <div style={styles.spinner}>⏳</div>
        <p>Cargando pedido...</p>
      </div>
    </div>
  );

  if (!pedido) return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ fontSize: '3rem' }}>❌</div>
        <h2 style={{ color: '#ef4444' }}>Pedido no encontrado</h2>
        <p style={{ color: '#64748b' }}>El enlace puede ser inválido o ya expiró.</p>
      </div>
    </div>
  );

  if (enviado) return (
    <div style={styles.page}>
      <style>{`
        .checkmark-svg {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: block;
          stroke-width: 4;
          stroke: #10b981;
          stroke-miterlimit: 10;
          margin: 0 auto 1.5rem;
          box-shadow: inset 0px 0px 0px #10b981;
          animation: fillAnimation .4s ease-in-out .4s forwards, scaleUp .3s ease-in-out .9s both;
        }

        .checkmark-circle {
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          stroke-width: 4;
          stroke-miterlimit: 10;
          stroke: #10b981;
          fill: none;
          animation: strokeAnimation .6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }

        .checkmark-check {
          transform-origin: 50% 50%;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          stroke: white;
          animation: strokeAnimation .3s cubic-bezier(0.65, 0, 0.45, 1) .8s forwards;
        }

        @keyframes strokeAnimation {
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes scaleUp {
          0%, 100% {
            transform: none;
          }
          50% {
            transform: scale3d(1.15, 1.15, 1);
          }
        }

        @keyframes fillAnimation {
          100% {
            box-shadow: inset 0px 0px 0px 40px #10b981;
          }
        }

        .fade-in-up {
          opacity: 0;
          transform: translateY(15px);
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .delay-1 { animation-delay: 0.2s; }
        .delay-2 { animation-delay: 0.4s; }
        .delay-3 { animation-delay: 0.6s; }

        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div style={styles.card}>
        <div style={{ textAlign: 'center' }}>
          <svg className="checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
        <h2 className="fade-in-up delay-1" style={{ color: '#10b981', marginBottom: '0.5rem', textAlign: 'center', fontWeight: 800 }}>
          ¡Pantallazo recibido!
        </h2>
        <p className="fade-in-up delay-2" style={{ color: '#475569', textAlign: 'center', lineHeight: 1.6, margin: '0.5rem 0 1rem' }}>
          Hemos recibido tu comprobante de pago.<br />
          Tu pedido será procesado en breve. <strong>¡Gracias por tu compra!</strong>
        </p>
        <div className="fade-in-up delay-3" style={{ background: '#f0fdf4', borderRadius: '12px', padding: '1rem 1.5rem', marginTop: '1rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 700 }}>
            📦 Pedido #{pedidoId?.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <Link 
          to="/" 
          className="fade-in-up delay-3"
          style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.9rem',
            background: 'linear-gradient(135deg, #f36b8e 0%, #e85d95 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: 800,
            marginTop: '1.5rem',
            boxShadow: '0 6px 20px rgba(243,107,142,0.3)',
            textAlign: 'center',
            transition: 'opacity 0.2s'
          }}
        >
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
          <h1 style={styles.title}>Enviar comprobante de pago</h1>
          <p style={styles.subtitle}>Sube el pantallazo de tu pago por Nequi o Bancolombia</p>
        </div>

        {/* Order summary */}
        <div style={styles.orderBox}>
          <div style={styles.orderRow}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Cliente</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{pedido.cliente_nombre}</span>
          </div>
          <div style={styles.orderRow}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Pedido</span>
            <span style={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>#{pedidoId?.slice(0, 8).toUpperCase()}</span>
          </div>
          <div style={{ ...styles.orderRow, borderBottom: 'none', paddingBottom: 0 }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Total a pagar</span>
            <span style={{ fontWeight: 800, color: '#10b981', fontSize: '1.3rem' }}>
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
              <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>Toca para seleccionar imagen</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>JPG, PNG, WEBP — máx. 10 MB</p>
            </div>
          )}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </label>

        {preview && (
          <label style={{ display: 'block', textAlign: 'center', marginTop: '0.5rem', cursor: 'pointer', color: '#6366f1', fontWeight: 600, fontSize: '0.85rem' }}>
            Cambiar imagen
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
        )}

        {error && <p style={{ color: '#ef4444', textAlign: 'center', fontSize: '0.9rem', marginTop: '0.75rem' }}>{error}</p>}

        <button
          style={{
            ...styles.btn,
            background: file ? 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' : '#e2e8f0',
            color: file ? 'white' : '#94a3b8',
            cursor: file ? 'pointer' : 'not-allowed',
            boxShadow: file ? '0 6px 20px rgba(37,211,102,0.35)' : 'none',
          }}
          disabled={!file || subiendo}
          onClick={handleSubir}
        >
          {subiendo ? '⏳ Enviando...' : '✅ Enviar Pantallazo'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', marginTop: '1rem' }}>
          Tu pago será verificado manualmente por nuestro equipo.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: 'white',
    borderRadius: '24px',
    padding: '2rem 1.5rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    margin: '0.5rem 0 0.25rem',
    fontSize: '1.3rem',
    fontWeight: 800,
    color: '#0f172a',
  },
  subtitle: {
    margin: 0,
    color: '#64748b',
    fontSize: '0.9rem',
  },
  orderBox: {
    background: '#f8fafc',
    borderRadius: '16px',
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  orderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid #f1f5f9',
  },
  uploadLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '160px',
    border: '2px dashed #cbd5e1',
    borderRadius: '16px',
    cursor: 'pointer',
    background: '#f8fafc',
    transition: 'border-color 0.2s',
    marginBottom: '0.5rem',
  },
  previewLabel: {
    display: 'block',
    height: '220px',
    borderRadius: '16px',
    overflow: 'hidden',
    cursor: 'pointer',
    border: '2px solid #e2e8f0',
    marginBottom: '0.5rem',
  },
  btn: {
    width: '100%',
    padding: '1rem',
    border: 'none',
    borderRadius: '50px',
    fontSize: '1rem',
    fontWeight: 800,
    marginTop: '1.25rem',
    transition: 'opacity 0.2s',
  },
  spinner: {
    fontSize: '2rem',
    marginBottom: '1rem',
  },
};
