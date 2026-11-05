import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase, getTenantId, setTenantId } from '../lib/supabase';
import type { Pedido, Asesor, Configuracion } from '../types';
import { InformeAsesorasDiario } from '../components/InformeAsesorasDiario';
import { Lock, RefreshCw, ShieldCheck } from 'lucide-react';

const EXPECTED_PIN = '1107';

export default function ReporteEjecutivo() {
  const params = useParams<{ tenant?: string }>();
  const [searchParams] = useSearchParams();

  const effectiveTenant = useMemo(() => {
    const raw = (params.tenant || searchParams.get('tenant') || getTenantId() || 'saramantha').toLowerCase().trim();
    return raw;
  }, [params.tenant, searchParams]);

  // Si el tenant viene en la URL, aseguramos que getTenantId() esté alineado
  useEffect(() => {
    if (effectiveTenant && effectiveTenant !== getTenantId()) {
      setTenantId(effectiveTenant);
    }
  }, [effectiveTenant]);

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Comprobar si ya está desbloqueado o viene con ?pin=1107 en la URL
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    const queryPin = searchParams.get('pin');
    if (queryPin === EXPECTED_PIN) {
      sessionStorage.setItem(`reporte_ejecutivo_unlocked_${effectiveTenant}`, 'true');
      return true;
    }
    return sessionStorage.getItem(`reporte_ejecutivo_unlocked_${effectiveTenant}`) === 'true';
  });

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      const [pedidosRes, leadsRes, asesoresRes, configRes] = await Promise.all([
        supabase
          .from('pedidos')
          .select('*')
          .eq('tenant_id', effectiveTenant)
          .order('created_at', { ascending: false }),
        supabase
          .from('leads')
          .select('*')
          .eq('tenant_id', effectiveTenant)
          .order('created_at', { ascending: false }),
        supabase
          .from('asesores')
          .select('*')
          .eq('tenant_id', effectiveTenant)
          .order('nombre', { ascending: true }),
        supabase
          .from('configuracion')
          .select('*')
          .eq('tenant_id', effectiveTenant)
          .maybeSingle()
      ]);

      if (pedidosRes.data) setPedidos(pedidosRes.data as Pedido[]);
      if (leadsRes.data) setLeads(leadsRes.data);
      if (asesoresRes.data) setAsesores(asesoresRes.data as Asesor[]);
      if (configRes.data) setConfiguracion(configRes.data as Configuracion);
    } catch (err) {
      console.error('Error cargando datos del reporte ejecutivo:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [effectiveTenant]);

  useEffect(() => {
    if (isUnlocked) {
      cargarDatos();

      // Suscripción en tiempo real
      const channel = supabase
        .channel(`realtime_reporte_ejecutivo_${effectiveTenant}_${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `tenant_id=eq.${effectiveTenant}` }, () => {
          cargarDatos();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `tenant_id=eq.${effectiveTenant}` }, () => {
          cargarDatos();
        })
        .subscribe();

      const interval = setInterval(cargarDatos, 8000);

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }, [isUnlocked, effectiveTenant, cargarDatos]);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPin = (configuracion as any)?.pin_informe_asesoras || EXPECTED_PIN;
    if (pinInput.trim() === targetPin || pinInput.trim() === EXPECTED_PIN) {
      setIsUnlocked(true);
      sessionStorage.setItem(`reporte_ejecutivo_unlocked_${effectiveTenant}`, 'true');
      setPinError('');
    } else {
      setPinError('PIN incorrecto. Inténtalo de nuevo.');
      setPinInput('');
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem(`reporte_ejecutivo_unlocked_${effectiveTenant}`);
    setPinInput('');
    setPinError('');
  };

  const handleManualReload = async () => {
    setIsRefreshing(true);
    await cargarDatos();
  };

  // ── PANTALLA DE ACCESO CON PIN SI ESTÁ BLOQUEADO ──
  if (!isUnlocked) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        fontFamily: "'Poppins', sans-serif"
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: '#ffffff',
          borderRadius: '24px',
          padding: '2.5rem 2rem',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
          border: '1.5px solid #fbcfe8',
          textAlign: 'center'
        }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: '#fdf2f8',
            color: '#db2777',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
            boxShadow: '0 8px 18px rgba(219, 39, 119, 0.2)'
          }}>
            <Lock size={32} />
          </div>

          <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '1.35rem', fontWeight: 600, color: '#0f172a' }}>
            Informe Ejecutivo de Auditoría
          </h2>
          <p style={{ margin: '0 0 1.6rem 0', fontSize: '0.84rem', color: '#64748b', lineHeight: 1.45 }}>
            Acceso exclusivo para propietarios y directores. Ingresa el PIN <strong>1107</strong> para consultar chats, tiempos y ventas en vivo.
          </p>

          <form onSubmit={handleVerifyPin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                value={pinInput}
                onChange={e => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="••••"
                style={{
                  width: '190px',
                  padding: '0.75rem 1rem',
                  textAlign: 'center',
                  fontSize: '1.75rem',
                  letterSpacing: '0.6rem',
                  fontWeight: 600,
                  borderRadius: '14px',
                  border: pinError ? '2px solid #ef4444' : '2px solid #cbd5e1',
                  outline: 'none',
                  background: '#f8fafc',
                  fontFamily: "'Poppins', sans-serif",
                  margin: '0 auto',
                  display: 'block'
                }}
              />
              {pinError && (
                <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.5rem', fontWeight: 500 }}>
                  {pinError}
                </div>
              )}
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.85rem 1.25rem',
                borderRadius: '14px',
                border: 'none',
                background: '#db2777',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.94rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(219, 39, 119, 0.35)',
                fontFamily: "'Poppins', sans-serif",
                transition: 'transform 0.15s ease'
              }}
            >
              Ingresar al Informe
            </button>
          </form>

          <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.74rem' }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Datos 100% sincronizados en tiempo real</span>
          </div>
        </div>
      </div>
    );
  }

  // ── PANTALLA PRINCIPAL DEL REPORTE EJECUTIVO DESBLOQUEADO ──
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Poppins', sans-serif",
      padding: '1.25rem'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Topbar Ejecutivo */}
        <div style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '0.9rem 1.25rem',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {configuracion?.logo_url ? (
              <img
                src={configuracion.logo_url}
                alt="Logo"
                style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #e2e8f0' }}
              />
            ) : (
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1.1rem' }}>
                📊
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#0f172a' }}>
                  {configuracion?.nombre_negocio || 'Indisutex'} — Informe Ejecutivo
                </h1>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0'
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
                  En Vivo
                </span>
              </div>
              <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Auditoría en tiempo real de chats, efectividad de asesoras y ventas en riesgo
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleManualReload}
              disabled={isRefreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isRefreshing ? 'Actualizando...' : 'Refrescar'}</span>
            </button>

            <button
              type="button"
              onClick={handleLock}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #fbcfe8',
                background: '#fdf2f8',
                color: '#db2777',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer'
              }}
              title="Bloquear acceso con PIN"
            >
              <Lock size={13} />
              <span>Bloquear</span>
            </button>
          </div>
        </div>

        {/* Componente del Informe */}
        {loading ? (
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            padding: '4rem 1rem',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ width: '42px', height: '42px', border: '3px solid #cbd5e1', borderTopColor: '#db2777', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem auto' }} />
            <h4 style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Cargando datos en vivo de Supabase...</h4>
          </div>
        ) : (
          <InformeAsesorasDiario
            pedidos={pedidos}
            leads={leads}
            asesores={asesores}
            configuracion={configuracion}
            tenantId={effectiveTenant}
            onReloadData={cargarDatos}
          />
        )}
      </div>
    </div>
  );
}

