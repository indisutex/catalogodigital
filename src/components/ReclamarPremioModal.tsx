import React, { useState } from 'react';
import { X, Trophy, CheckCircle, Sparkles } from 'lucide-react';
import { registrarGanadorJuego } from '../lib/ganadoresService';
import './ReclamarPremioModal.css';

interface ReclamarPremioModalProps {
  isOpen: boolean;
  onClose: () => void;
  juegoNombre: string;
  premioNombre: string;
  tipoPremio: 'producto_gratis' | 'cupon_descuento' | 'envio_gratis';
  onClaimSuccess?: () => void;
  tenantId?: string;
}

export const ReclamarPremioModal: React.FC<ReclamarPremioModalProps> = ({
  isOpen,
  onClose,
  juegoNombre,
  premioNombre,
  tipoPremio,
  onClaimSuccess,
  tenantId
}) => {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !telefono.trim()) return;

    setSubmitting(true);
    try {
      await registrarGanadorJuego({
        nombre_cliente: nombre.trim(),
        telefono_cliente: telefono.trim(),
        ciudad: ciudad.trim(),
        direccion: direccion.trim(),
        juego: juegoNombre,
        premio: premioNombre,
        tipo_premio: tipoPremio,
        tenantId
      });

      setSubmitted(true);
      if (onClaimSuccess) onClaimSuccess();
    } catch (err) {
      console.error('Error registrando ganador:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reclamar-overlay" onClick={onClose}>
      <div className="reclamar-card" onClick={e => e.stopPropagation()}>
        <button className="reclamar-close-btn" onClick={onClose} title="Cerrar">
          <X size={18} />
        </button>

        {!submitted ? (
          <>
            <div className="reclamar-header-icon">🏆🎁</div>
            <h2 className="reclamar-title">¡Reclamar Tu Premio!</h2>
            <p className="reclamar-subtitle">
              ¡Ganaste en <strong>{juegoNombre}</strong>!
            </p>

            <div className="reclamar-prize-badge">
              <Sparkles size={18} />
              <span>{premioNombre}</span>
            </div>

            <p className="reclamar-instructions">
              Déjanos tus datos a continuación para contactarte por WhatsApp y enviarte tu premio:
            </p>

            <form onSubmit={handleSubmit} className="reclamar-form">
              <div className="reclamar-field">
                <label>👤 Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: María Rodríguez"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                />
              </div>

              <div className="reclamar-field">
                <label>📱 Teléfono / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  placeholder="Ej: 300 123 4567"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                />
              </div>

              <div className="reclamar-field">
                <label>🏙️ Ciudad de Envío *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Medellín"
                  value={ciudad}
                  onChange={e => setCiudad(e.target.value)}
                />
              </div>

              <div className="reclamar-field">
                <label>🏠 Dirección de Entrega *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Calle 50 #12-34 Apto 302"
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="reclamar-submit-btn"
              >
                <Trophy size={18} />
                {submitting ? 'Guardando...' : '🎁 ¡GUARDAR MIS DATOS Y RECLAMAR!'}
              </button>
            </form>
          </>
        ) : (
          <div className="reclamar-success-view">
            <div className="success-icon"><CheckCircle size={64} color="#10b981" /></div>
            <h2 className="reclamar-title" style={{ color: '#10b981' }}>
              ¡DATOS REGISTRADOS CON ÉXITO!
            </h2>
            <p className="reclamar-subtitle">
              Nos contactaremos contigo vía WhatsApp al <strong>{telefono}</strong> para enviarte tu premio:
            </p>
            <div className="reclamar-prize-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: '#10b981', color: '#10b981' }}>
              🎉 {premioNombre}
            </div>

            <button className="reclamar-submit-btn" onClick={onClose} style={{ marginTop: '1.2rem', background: '#10b981' }}>
              ¡Entendido, Ir al Catálogo!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
