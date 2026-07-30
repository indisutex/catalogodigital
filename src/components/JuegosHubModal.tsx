import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { NochePerfectaGameModal } from './NochePerfectaGameModal';
import { FlappyStitchGame, StitchAvatarSVG } from './FlappyStitchGame';
import { CortaRegalosGame } from './CortaRegalosGame/CortaRegalosGame';
import type { Premio } from './CortaRegalosGame/types';
import './JuegosHubModal.css';

interface JuegosHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCoupon: (porcentaje: number) => void;
  onApplyFreeShipping: () => void;
  onAddFreeGift: (nombre: string) => void;
  tenantId?: string;
  initialGame?: 'hub' | 'noche' | 'stitch' | 'corta';
}

export const JuegosHubModal: React.FC<JuegosHubModalProps> = ({
  isOpen,
  onClose,
  onApplyCoupon,
  onApplyFreeShipping,
  onAddFreeGift,
  tenantId = 'default',
  initialGame = 'hub'
}) => {
  const [activeScreen, setActiveScreen] = useState<'hub' | 'noche' | 'stitch' | 'corta'>(initialGame);

  if (!isOpen) return null;

  const handleStitchReward = (reward: { pts: number; label: string; type: 'discount' | 'shipping' | 'special'; val: number }) => {
    if (reward.type === 'discount') {
      onApplyCoupon(reward.val);
    } else if (reward.type === 'shipping') {
      onApplyFreeShipping();
    } else if (reward.type === 'special') {
      onAddFreeGift('🎁 PREMIO ESPECIAL: Pijama Premium Stitch');
    }
  };

  const handleCortaReward = (premio: Premio) => {
    if (premio.tipo === 'descuento') {
      onApplyCoupon(premio.valor);
    } else if (premio.tipo === 'envio_gratis') {
      onApplyFreeShipping();
    } else if (premio.tipo === 'producto_gratis' || premio.tipo === 'cupon') {
      onAddFreeGift(`🎁 ${premio.nombre}`);
    }
  };

  return (
    <div className="juegos-modal-overlay" onClick={onClose}>
      <div className="juegos-hub-card" onClick={e => e.stopPropagation()}>
        {/* Botón Volver a la lista de juegos */}
        {activeScreen !== 'hub' && (
          <button 
            onClick={() => setActiveScreen('hub')}
            style={{
              position: 'absolute',
              top: '0.9rem',
              left: '0.9rem',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              borderRadius: '20px',
              padding: '0.3rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              zIndex: 60,
              fontSize: '0.8rem',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
            title="Volver al menú de juegos"
          >
            ← Cambiar de Juego
          </button>
        )}

        {/* Botón Cerrar */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.9rem',
            right: '0.9rem',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#fff',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 60
          }}
          title="Cerrar"
        >
          <X size={18} />
        </button>

        {/* ── SCREEN: HUB (SELECTOR DE JUEGOS) ── */}
        {activeScreen === 'hub' && (
          <>
            <div className="juegos-hub-header">
              <div style={{ fontSize: '3rem' }}>🎮✨</div>
              <h2 className="juegos-hub-title">Zona de Juegos & Premios</h2>
              <p style={{ fontSize: '0.86rem', color: '#cbd5e1', margin: '0.2rem 0' }}>
                Selecciona tu juego favorito, demuestra tu destreza y gana premios exclusivos hoy.
              </p>
            </div>

            <div className="juegos-cards-grid">
              {/* Card Juego 1: La Noche Perfecta */}
              <div className="juego-card-item" onClick={() => setActiveScreen('noche')}>
                <div className="juego-card-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)' }}>
                  😴
                </div>
                <div className="juego-card-info">
                  <div className="juego-card-name">1. La Noche Perfecta</div>
                  <div className="juego-card-desc">Mantén al personaje dormido durante 60s esquivando 6 obstáculos.</div>
                  <div className="juego-card-prize-badge">
                    🎁 Pijama Short Tira Gratis
                  </div>
                </div>
                <ArrowRight size={20} color="#a855f7" />
              </div>

              {/* Card Juego 2: Supervivencia Stitch */}
              <div className="juego-card-item" onClick={() => setActiveScreen('stitch')}>
                <div className="juego-card-icon" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StitchAvatarSVG size={36} />
                </div>
                <div className="juego-card-info">
                  <div className="juego-card-name">2. 🌙 Supervivencia Stitch</div>
                  <div className="juego-card-desc">Vuela entre almohadas estilo Flappy Bird y acumula puntos.</div>
                  <div className="juego-card-prize-badge" style={{ borderColor: '#38bdf8', color: '#38bdf8' }}>
                    🏆 Premios de 5% a 20% + Envío Gratis
                  </div>
                </div>
                <ArrowRight size={20} color="#38bdf8" />
              </div>

              {/* Card Juego 3: Corta los Regalos ✂️ (NEW) */}
              <div className="juego-card-item juego-card-new" onClick={() => setActiveScreen('corta')}>
                <div className="juego-card-icon" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✂️
                </div>
                <div className="juego-card-info">
                  <div className="juego-card-name">
                    3. ✂️ Corta los Regalos
                    <span className="juego-new-badge">NUEVO</span>
                  </div>
                  <div className="juego-card-desc">Desliza para cortar regalos al vuelo estilo Fruit Ninja. ¡Evita las bombas!</div>
                  <div className="juego-card-prize-badge" style={{ borderColor: '#f472b6', color: '#f472b6' }}>
                    🎊 Descuentos hasta 20% + Envío Gratis
                  </div>
                </div>
                <ArrowRight size={20} color="#f472b6" />
              </div>
            </div>
          </>
        )}

        {/* ── SCREEN: JUEGO LA NOCHE PERFECTA ── */}
        {activeScreen === 'noche' && (
          <NochePerfectaGameModal
            isOpen={true}
            onClose={() => setActiveScreen('hub')}
            onApplyCoupon={() => {
              onAddFreeGift('🎁 REGALO: Pijama Short Tira');
            }}
            tenantId={tenantId}
          />
        )}

        {/* ── SCREEN: JUEGO SUPERVIVENCIA STITCH ── */}
        {activeScreen === 'stitch' && (
          <FlappyStitchGame
            onClose={() => setActiveScreen('hub')}
            onRewardEarned={handleStitchReward}
            tenantId={tenantId}
          />
        )}

        {/* ── SCREEN: JUEGO CORTA LOS REGALOS ── */}
        {activeScreen === 'corta' && (
          <CortaRegalosGame
            onClose={() => setActiveScreen('hub')}
            onRewardEarned={handleCortaReward}
            tenantId={tenantId}
          />
        )}
      </div>
    </div>
  );
};
