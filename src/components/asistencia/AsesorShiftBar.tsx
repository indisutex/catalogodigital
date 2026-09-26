import React, { useState, useEffect } from 'react';
import { LogOut, AlertTriangle, Check } from 'lucide-react';
import type { RegistroAsistencia } from '../../types';
import { asistenciaService } from '../../lib/asistenciaService';

interface AsesorShiftBarProps {
  jornadaActiva: RegistroAsistencia;
  tenantId: string;
  onCheckOutSuccess: (registro: RegistroAsistencia) => void;
  // Optional flag to trigger the check-out modal externally (e.g. when attempting to logout)
  isLogoutAttemptModalOpen?: boolean;
  onCancelLogoutAttempt?: () => void;
  onConfirmLogoutWithoutCheckOut?: () => void;
}

export const AsesorShiftBar: React.FC<AsesorShiftBarProps> = ({
  jornadaActiva,
  tenantId,
  onCheckOutSuccess,
  isLogoutAttemptModalOpen = false,
  onCancelLogoutAttempt,
  onConfirmLogoutWithoutCheckOut
}) => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [observaciones, setObservaciones] = useState('');
  const [elapsedText, setElapsedText] = useState('');

  // Actualizar el tiempo transcurrido en vivo
  useEffect(() => {
    const updateElapsed = () => {
      if (jornadaActiva?.hora_entrada) {
        setElapsedText(asistenciaService.calcularTiempoTranscurrido(jornadaActiva.hora_entrada));
      }
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 30000); // Cada 30 seg
    return () => clearInterval(interval);
  }, [jornadaActiva]);

  const horaEntradaStr = asistenciaService.formatearHora12(jornadaActiva?.hora_entrada);
  const horaActualStr = asistenciaService.formatearHora12(new Date().toISOString());

  const handleConfirmarSalida = async (thenLogout: boolean = false) => {
    try {
      setLoading(true);
      const updated = await asistenciaService.marcarSalida(
        jornadaActiva.id,
        tenantId,
        observaciones.trim() || undefined
      );
      setShowModal(false);
      onCheckOutSuccess(updated);
      if (thenLogout && onConfirmLogoutWithoutCheckOut) {
        onConfirmLogoutWithoutCheckOut();
      }
    } catch (err) {
      console.error('Error al marcar salida:', err);
      alert('Error al registrar la salida. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── BARRA O PILL ENCABEZADO: JORNADA ACTIVA ── */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.65rem',
          background: '#f0fdf4',
          border: '1.5px solid #bbf7d0',
          borderRadius: '12px',
          padding: '0.35rem 0.65rem',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
          fontFamily: "'Poppins', sans-serif"
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.25)',
              display: 'inline-block'
            }}
          />
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#166534' }}>
                Jornada activa
              </span>
              <span style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 500 }}>
                • Entrada: {horaEntradaStr}
              </span>
            </div>
            <span style={{ fontSize: '0.65rem', color: '#047857', fontWeight: 400, display: 'block' }}>
              ⏱️ {elapsedText}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{
            background: '#ffffff',
            border: '1px solid #86efac',
            color: '#15803d',
            borderRadius: '8px',
            padding: '0.35rem 0.65rem',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#dcfce7';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#ffffff';
          }}
        >
          <LogOut size={13} />
          <span>MARCAR SALIDA</span>
        </button>
      </div>

      {/* ── MODAL: CONFIRMAR SALIDA NORMAL ── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
            fontFamily: "'Poppins', sans-serif"
          }}
          onClick={() => !loading && setShowModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '440px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #f1f5f9'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <LogOut size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                  Finalizar Jornada Laboral
                </h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 400 }}>
                  ¿Estás listo para registrar la salida de tu turno?
                </p>
              </div>
            </div>

            {/* Resumen de la Jornada */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Hora de entrada:</span>
                <strong style={{ color: '#0f172a', fontWeight: 600 }}>{horaEntradaStr}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Hora de salida (ahora):</span>
                <strong style={{ color: '#0f172a', fontWeight: 600 }}>{horaActualStr}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '0.88rem'
                }}
              >
                <span style={{ color: '#047857', fontWeight: 500 }}>Tiempo laborado:</span>
                <strong style={{ color: '#047857', fontWeight: 600 }}>{elapsedText}</strong>
              </div>
            </div>

            {/* Campo Opcional de Observaciones */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: '#334155', marginBottom: '0.35rem' }}>
                Observaciones o novedades (Opcional):
              </label>
              <input
                type="text"
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Ej. Cumplí turno completo sin novedades"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontFamily: "'Poppins', sans-serif",
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Botones de Acción */}
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                Seguir Trabajando
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleConfirmarSalida(false)}
                style={{
                  flex: 1.3,
                  padding: '0.75rem',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
              >
                <Check size={16} />
                <span>{loading ? 'Finalizando...' : 'Confirmar Salida'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: INTENTO DE CERRAR SESIÓN CON JORNADA ACTIVA ── */}
      {isLogoutAttemptModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
            fontFamily: "'Poppins', sans-serif"
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '22px',
              maxWidth: '460px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #fee2e2'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                  border: '2px solid #fecaca'
                }}
              >
                <AlertTriangle size={28} />
              </div>

              <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.2rem', fontWeight: 600, color: '#0f172a' }}>
                ¿Deseas cerrar sesión sin marcar salida?
              </h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b', lineHeight: 1.4 }}>
                Tienes una <strong style={{ color: '#16a34a' }}>jornada activa</strong> iniciada a las{' '}
                <strong>{horaEntradaStr}</strong> ({elapsedText}).
              </p>
            </div>

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '0.85rem',
                fontSize: '0.78rem',
                color: '#92400e',
                marginBottom: '1.5rem',
                lineHeight: 1.4
              }}
            >
              ⚠️ Para registrar tus horas laboradas con exactitud, se recomienda marcar tu salida antes de retirarte.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleConfirmarSalida(true)}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  fontFamily: "'Poppins', sans-serif",
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                <LogOut size={16} />
                <span>Marcar Salida y Cerrar Sesión</span>
              </button>

              <button
                type="button"
                onClick={onConfirmLogoutWithoutCheckOut}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  color: '#ef4444',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  fontWeight: 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                Mantener Jornada Activa y Cerrar Sesión
              </button>

              <button
                type="button"
                onClick={onCancelLogoutAttempt}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  background: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                Cancelar y Seguir en la Plataforma
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
