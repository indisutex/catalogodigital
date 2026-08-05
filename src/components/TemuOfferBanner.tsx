import { useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { Trophy, X } from 'lucide-react';
import './TemuOfferBanner.css';

export function HotFlameIcon({ size = 34 }: { size?: number }) {
  return (
    <div className="hot-flame-container" style={{ width: size, height: size }}>
      {/* Floating ember particles */}
      <span className="fire-spark spark-1" />
      <span className="fire-spark spark-2" />
      <span className="fire-spark spark-3" />
      
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="hot-flame-svg"
      >
        <defs>
          <linearGradient id="hotFireOuterGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="45%" stopColor="#ea580c" />
            <stop offset="80%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="hotFireInnerGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>

        {/* Outer Dancing Flame */}
        <path
          className="flame-body-outer"
          d="M12 23C16.4183 23 20 19.4183 20 15C20 11.5 17.5 8 15 5.5C15 8.5 13.5 9.5 12 9.5C10.5 9.5 9.5 8 9.5 5.5C7 8 4 11.5 4 15C4 19.4183 7.58172 23 12 23Z"
          fill="url(#hotFireOuterGradient)"
        />
        
        {/* Inner Core Intense Flame */}
        <path
          className="flame-body-inner"
          d="M12 21C14.2091 21 16 19.2091 16 17C16 14.8 14.5 13 13 11.5C13 13 12.2 13.5 11.5 13.5C10.8 13.5 10 12.5 10 11.5C8.8 13 8 14.8 8 17C8 19.2091 9.79086 21 12 21Z"
          fill="url(#hotFireInnerGradient)"
        />
      </svg>
    </div>
  );
}

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
          <div className={`temu-toast-icon ${isUnlocked ? 'icon-bounce' : 'icon-hot-flame'}`}>
            {isUnlocked ? <Trophy size={30} color="#fbbf24" /> : <HotFlameIcon size={36} />}
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
              className={`temu-toast-progress-fill ${isUnlocked ? 'fill-gold' : 'fill-fiery'}`}
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
              <span className="badge-flame">
                <HotFlameIcon size={15} /> OFERTA MAYORISTA
              </span>
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
              className={`temu-sticky-progress-fill ${isUnlocked50 ? 'fill-gold' : isBulkDiscountApplied ? 'fill-green' : 'fill-fiery'}`}
              style={{ width: `${Math.min(100, Math.max(5, tierProgressPercent))}%` }}
            />
          </div>
          <span className="temu-sticky-count">{totalUnits}/{nextTierTarget}</span>
        </div>
      </div>
    </div>
  );
}

