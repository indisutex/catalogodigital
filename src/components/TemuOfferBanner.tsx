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
  const unitsNeeded = Math.max(0, (nextTierTarget || 6) - totalUnits);

  return (
    <div className={`temu-toast-overlay ${isUnlocked ? 'unlocked-mode' : ''}`}>
      <div className="temu-toast-card" style={{ border: '2.5px solid #f97316', borderRadius: '22px', padding: '1.1rem 1.25rem', background: '#ffffff', boxShadow: '0 12px 35px rgba(249, 115, 22, 0.25)' }}>
        <button className="temu-toast-close" onClick={dismissOfferNotification} aria-label="Cerrar">
          <X size={16} />
        </button>

        <div className="temu-toast-header" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.85rem' }}>
          <div className={`temu-toast-icon ${isUnlocked ? 'icon-bounce' : 'icon-hot-flame'}`}>
            {isUnlocked ? <Trophy size={32} color="#fbbf24" /> : <HotFlameIcon size={36} />}
          </div>
          <div className="temu-toast-title-area" style={{ flex: 1, paddingRight: '1rem' }}>
            <h4 className="temu-toast-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
              ¡Agregado al carrito! 🛍️
            </h4>
            <p className="temu-toast-sub" style={{ margin: '0.25rem 0 0 0', fontSize: '0.86rem', color: '#475569', fontWeight: 600, lineHeight: '1.3' }}>
              {isUnlocked ? (
                <span>¡Desbloqueaste el <strong>PRECIO POR MAYOR</strong>! 🎉</span>
              ) : (
                <span>Te faltan solo <strong>{unitsNeeded} prendas</strong> para desbloquear el <strong>PRECIO POR MAYOR</strong> 🔥</span>
              )}
            </p>
          </div>
        </div>

        {/* Progress Bar inside Toast */}
        <div className="temu-toast-progress-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div className="temu-toast-progress-labels" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
            <span>{totalUnits} prendas en carrito</span>
            <span>Meta: {nextTierTarget || 6} prendas</span>
          </div>
          <div className="temu-toast-progress-bar" style={{ height: '10px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', padding: 0 }}>
            <div 
              className={`temu-toast-progress-fill ${isUnlocked ? 'fill-gold' : 'fill-fiery'}`}
              style={{ width: `${Math.min(100, Math.max(6, tierProgressPercent))}%`, height: '100%', borderRadius: '10px', background: 'linear-gradient(90deg, #ff3d00 0%, #ff9100 100%)', transition: 'width 0.4s ease' }}
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
  const { totalUnits, unitsNeededForNextTier, nextTierTarget, tierProgressPercent } = useCart();

  const isUnlocked = totalUnits >= 6;

  return (
    <div className="temu-sticky-bar" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '0.6rem 0.9rem', marginBottom: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
          <span>🔥</span>
          {isUnlocked ? (
            <span>¡PRECIO POR MAYOR DESBLOQUEADO! 🎉</span>
          ) : (
            <span>
              Te faltan <span style={{ color: '#00a6f9', fontWeight: 900 }}>{unitsNeededForNextTier} prendas</span> para <strong>POR MAYOR</strong>
            </span>
          )}
        </div>
        <div style={{ background: '#00a6f9', color: '#ffffff', padding: '0.25rem 0.75rem', borderRadius: '20px', fontWeight: 900, fontSize: '0.78rem', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 2px 6px rgba(0, 166, 249, 0.3)' }}>
          {totalUnits}/{nextTierTarget || 6} unds
        </div>
      </div>

      {/* Progress Line Bar */}
      <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
        <div 
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(5, tierProgressPercent))}%`,
            background: isUnlocked ? '#10b981' : '#00a6f9',
            borderRadius: '6px',
            transition: 'width 0.4s ease'
          }}
        />
      </div>
    </div>
  );
}

