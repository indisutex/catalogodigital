import { useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { Flame, Trophy, X } from 'lucide-react';
import './TemuOfferBanner.css';

export function TemuOfferToast() {
  const { offerNotification, dismissOfferNotification, totalUnits, nextTierTarget, tierProgressPercent } = useCart();

  useEffect(() => {
    if (offerNotification?.show) {
      const timer = setTimeout(() => {
        dismissOfferNotification();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [offerNotification, dismissOfferNotification]);

  if (!offerNotification?.show) return null;

  const isUnlocked = offerNotification.type === 'unlocked';

  return (
    <div className={`temu-toast-overlay ${isUnlocked ? 'unlocked-mode' : ''}`}>
      <div className="temu-toast-card">
        <button className="temu-toast-close" onClick={dismissOfferNotification} aria-label="Cerrar">
          <X size={16} />
        </button>

        <div className="temu-toast-header">
          <div className={`temu-toast-icon ${isUnlocked ? 'icon-bounce' : 'icon-pulse'}`}>
            {isUnlocked ? <Trophy size={28} color="#fbbf24" /> : <Flame size={28} color="#ef4444" />}
          </div>
          <div className="temu-toast-title-area">
            <h4 className="temu-toast-title">{offerNotification.message}</h4>
            {offerNotification.submessage && (
              <p className="temu-toast-sub">{offerNotification.submessage}</p>
            )}
          </div>
        </div>

        {/* Progress Bar inside Toast */}
        <div className="temu-toast-progress-wrapper">
          <div className="temu-toast-progress-labels">
            <span>{totalUnits} {totalUnits === 1 ? 'prenda' : 'prendas'} en carrito</span>
            <span>Meta: {nextTierTarget} prendas</span>
          </div>
          <div className="temu-toast-progress-bar">
            <div 
              className={`temu-toast-progress-fill ${isUnlocked ? 'fill-gold' : ''}`}
              style={{ width: `${Math.min(100, Math.max(8, tierProgressPercent))}%` }}
            >
              <div className="progress-sparkle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TemuStickyHeaderBar() {
  const { totalUnits, unitsNeededForNextTier, nextTierTarget, tierProgressPercent, isBulkDiscountApplied } = useCart();

  const isUnlocked50 = totalUnits >= 50;

  return (
    <div className="temu-sticky-bar">
      <div className="temu-sticky-content">
        <div className="temu-sticky-left">
          {totalUnits < 6 ? (
            <>
              <span className="badge-flame">🔥 OFERTA MAYORISTA</span>
              <span className="temu-sticky-msg">
                ¡Agrega <strong>{unitsNeededForNextTier}</strong> {unitsNeededForNextTier === 1 ? 'prenda' : 'prendas'} más para <strong>PRECIO POR MAYOR</strong>!
              </span>
            </>
          ) : totalUnits < 50 ? (
            <>
              <span className="badge-success">🎉 MAYORISTA ACTIVO</span>
              <span className="temu-sticky-msg">
                ¡Agrega <strong>{unitsNeededForNextTier}</strong> prendas más para el <strong>PRECIO DISTRIBUIDOR 50+</strong>!
              </span>
            </>
          ) : (
            <>
              <span className="badge-gold">🏆 MÁXIMO DESCUENTO</span>
              <span className="temu-sticky-msg">
                ¡Tienes activa la mejor tarifa de 50+ prendas!
              </span>
            </>
          )}
        </div>

        <div className="temu-sticky-progress-container">
          <div className="temu-sticky-progress-bar">
            <div 
              className={`temu-sticky-progress-fill ${isUnlocked50 ? 'fill-gold' : isBulkDiscountApplied ? 'fill-green' : ''}`}
              style={{ width: `${Math.min(100, Math.max(5, tierProgressPercent))}%` }}
            />
          </div>
          <span className="temu-sticky-count">{totalUnits}/{nextTierTarget}</span>
        </div>
      </div>
    </div>
  );
}
