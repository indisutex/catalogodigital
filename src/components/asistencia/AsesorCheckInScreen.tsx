import React, { useState, useEffect } from 'react';
import { LogIn, CheckCircle2, Clock, Calendar, ShieldCheck, Sparkles, Building2 } from 'lucide-react';
import type { Asesor, RegistroAsistencia } from '../../types';
import { asistenciaService } from '../../lib/asistenciaService';

interface AsesorCheckInScreenProps {
  asesor: Asesor;
  tenantId: string;
  tenantName?: string;
  tenantLogo?: string;
  onCheckInSuccess: (registro: RegistroAsistencia) => void;
  onLogout: () => void;
}

export const AsesorCheckInScreen: React.FC<AsesorCheckInScreenProps> = ({
  asesor,
  tenantId,
  tenantName,
  tenantLogo,
  onCheckInSuccess,
  onLogout
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [checkedInRegistro, setCheckedInRegistro] = useState<RegistroAsistencia | null>(null);
  const observacion = '';

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const formattedDate = currentTime.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedTime = currentTime.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const primerNombre = asesor?.nombre ? asesor.nombre.split(' ')[0] : 'Asesor';

  const handleMarcarEntrada = async () => {
    try {
      setLoading(true);
      const reg = await asistenciaService.marcarEntrada({
        tenantId,
        asesorId: asesor.id,
        asesorNombre: asesor.nombre,
        asesorTelefono: asesor.telefono,
        observaciones: observacion.trim() || undefined
      });
      setCheckedInRegistro(reg);
    } catch (err: any) {
      console.error('Error al registrar entrada:', err);
      alert('Hubo un error al registrar la entrada. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'radial-gradient(circle at 50% 15%, #f8fafc 0%, #e2e8f0 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem',
        boxSizing: 'border-box',
        fontFamily: "'Poppins', sans-serif"
      }}
    >
      {/* Contenedor Principal */}
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '24px',
          padding: '2.25rem 2rem',
          boxShadow: '0 20px 45px -12px rgba(15, 23, 42, 0.12)',
          border: '1px solid #f1f5f9',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Barra superior decorativa */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #10b981 0%, #0ea5e9 100%)'
          }}
        />

        {/* Encabezado con logo de la marca */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {tenantLogo ? (
              <img
                src={tenantLogo}
                alt={tenantName || 'Tienda'}
                style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
              />
            ) : (
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Building2 size={20} />
              </div>
            )}
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Sistema de Asistencia
              </span>
              <span style={{ fontSize: '0.92rem', color: '#0f172a', fontWeight: 600, display: 'block', textTransform: 'capitalize' }}>
                {tenantName || 'Indisutex Cloud'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              padding: '0.4rem 0.75rem',
              borderRadius: '10px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 500,
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.15s ease'
            }}
            title="Cambiar de usuario o salir"
          >
            Salir / Cambiar PIN
          </button>
        </div>

        {/* Estado 1: Pantalla de Registro de Entrada */}
        {!checkedInRegistro ? (
          <div>
            {/* Saludo Personalizado con Avatar */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '0.85rem' }}>
                {asesor?.foto_url ? (
                  <img
                    src={asesor.foto_url}
                    alt={asesor.nombre}
                    style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #10b981',
                      boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      fontWeight: 600,
                      boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    {asesor?.nombre ? asesor.nombre.charAt(0).toUpperCase() : 'A'}
                  </div>
                )}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    background: '#10b981',
                    color: 'white',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid white'
                  }}
                  title="Asesor verificado"
                >
                  <ShieldCheck size={14} />
                </div>
              </div>

              <h2
                style={{
                  fontSize: '1.45rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  margin: '0 0 0.35rem 0',
                  letterSpacing: '-0.3px'
                }}
              >
                {getGreeting()}, {primerNombre} 👋
              </h2>
              <p
                style={{
                  fontSize: '0.86rem',
                  color: '#64748b',
                  margin: 0,
                  fontWeight: 400
                }}
              >
                Inicia tu jornada para acceder a las funciones de la tienda.
              </p>
            </div>

            {/* Tarjeta de Fecha y Reloj en Vivo */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                border: '1.5px solid #a7f3d0',
                borderRadius: '18px',
                padding: '1.25rem',
                marginBottom: '1.75rem',
                textAlign: 'center',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.06)'
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#047857',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  marginBottom: '0.4rem',
                  textTransform: 'capitalize'
                }}
              >
                <Calendar size={15} />
                <span>{formattedDate}</span>
              </div>

              <div
                style={{
                  fontSize: '2.1rem',
                  fontWeight: 600,
                  color: '#065f46',
                  letterSpacing: '-0.5px',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.15
                }}
              >
                {formattedTime}
              </div>

              <span
                style={{
                  fontSize: '0.74rem',
                  color: '#059669',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  marginTop: '0.35rem'
                }}
              >
                <Clock size={12} /> Hora oficial en tiempo real
              </span>
            </div>

            {/* Botón Principal: MARCAR ENTRADA */}
            <button
              type="button"
              disabled={loading}
              onClick={handleMarcarEntrada}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '16px',
                padding: '1.1rem 1.5rem',
                fontSize: '1.02rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.65rem',
                boxShadow: '0 10px 25px -4px rgba(16, 185, 129, 0.45)',
                transition: 'all 0.2s ease',
                fontFamily: "'Poppins', sans-serif",
                opacity: loading ? 0.75 : 1
              }}
            >
              <LogIn size={20} />
              <span>{loading ? 'Registrando entrada...' : 'MARCAR ENTRADA'}</span>
            </button>

            {/* Aviso informativo de política */}
            <div
              style={{
                marginTop: '1.5rem',
                padding: '0.75rem 1rem',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#64748b',
                fontSize: '0.75rem'
              }}
            >
              <Sparkles size={16} color="#0ea5e9" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 400 }}>
                El registro de horario es obligatorio. Al finalizar tu turno, recuerda pulsar <strong>Marcar Salida</strong>.
              </span>
            </div>
          </div>
        ) : (
          /* Estado 2: Confirmación Exitosa */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div
              style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: '#ecfdf5',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                border: '2px solid #a7f3d0',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)'
              }}
            >
              <CheckCircle2 size={44} />
            </div>

            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 600,
                color: '#0f172a',
                margin: '0 0 0.5rem 0'
              }}
            >
              ¡Jornada iniciada correctamente! ✓
            </h2>

            <p
              style={{
                fontSize: '0.9rem',
                color: '#475569',
                margin: '0 0 1.5rem 0',
                fontWeight: 400
              }}
            >
              Entrada registrada a las{' '}
              <strong style={{ color: '#047857', fontWeight: 600 }}>
                {asistenciaService.formatearHora12(checkedInRegistro.hora_entrada)}
              </strong>
              .
            </p>

            <button
              type="button"
              onClick={() => onCheckInSuccess(checkedInRegistro)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '16px',
                padding: '1.05rem 1.5rem',
                fontSize: '0.98rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 10px 25px -4px rgba(14, 165, 233, 0.4)',
                fontFamily: "'Poppins', sans-serif"
              }}
            >
              <span>INGRESAR A LA PLATAFORMA</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
