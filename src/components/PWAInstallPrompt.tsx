import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share2, PlusSquare } from 'lucide-react';

interface PWAInstallPromptProps {
  storeName: string;
  storeLogo?: string;
  primaryColor?: string;
  tenantSlug?: string;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  storeName,
  storeLogo,
  primaryColor = '#6366f1',
  tenantSlug = ''
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Detect if already in standalone / installed PWA
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandaloneMode) {
      setIsInstalled(true);
      return;
    }

    // 2. Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // 3. Check if user dismissed recently
    const dismissKey = `pwa_dismiss_${tenantSlug || 'default'}`;
    const dismissed = sessionStorage.getItem(dismissKey);
    if (dismissed) return;

    // 4. Capture beforeinstallprompt (Android / Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait 3.5s before displaying prompt for high engagement
      setTimeout(() => {
        setIsVisible(true);
      }, 3500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If iOS, show after 4s (since iOS does not fire beforeinstallprompt)
    let iosTimer: any = null;
    if (isIOSDevice) {
      iosTimer = setTimeout(() => {
        setIsVisible(true);
      }, 4000);
    }

    // Check if app was installed
    const handleAppInstalled = () => {
      setIsVisible(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [tenantSlug]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback for browsers that support PWA but didn't fire event immediately
      alert(`Para instalar la app de ${storeName}:\n1. Abre el menú (⋮) de tu navegador.\n2. Toca "Instalar aplicación" o "Agregar a pantalla principal".`);
      return;
    }

    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error('Error triggering PWA install:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIOSGuide(false);
    const dismissKey = `pwa_dismiss_${tenantSlug || 'default'}`;
    sessionStorage.setItem(dismissKey, 'true');
  };

  if (isInstalled || !isVisible) return null;

  const displayLogo = storeLogo || '/indisutex-logo.png';

  return (
    <>
      <div 
        className="pwa-install-banner-wrap"
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1rem',
          right: '1rem',
          maxWidth: '430px',
          margin: '0 auto',
          zIndex: 9999,
          fontFamily: "'Poppins', sans-serif",
          animation: 'pwaSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        <div 
          style={{
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '20px',
            border: '1px solid rgba(226, 232, 240, 0.85)',
            boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.05)',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div 
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1.5px solid #f1f5f9',
                  padding: '3px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                <img 
                  src={displayLogo} 
                  alt={storeName} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '9px' }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Smartphone size={14} color={primaryColor} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 500, color: primaryColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Aplicación Móvil
                  </span>
                </div>
                <h4 style={{ margin: '0.1rem 0 0 0', fontSize: '0.94rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  ¿Instalar app de {storeName}?
                </h4>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar"
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                flexShrink: 0,
                transition: 'background 0.2s ease'
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Description */}
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontWeight: 400, lineHeight: 1.45 }}>
            Accede más rápido al catálogo, guarda tus favoritos y realiza tus compras en segundos directamente desde tu pantalla de inicio.
          </p>

          {/* iOS Guide if toggled */}
          {showIOSGuide && (
            <div 
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                fontSize: '0.76rem',
                color: '#334155',
                fontWeight: 400
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Share2 size={16} color="#0284c7" />
                <span>1. Toca el botón <strong>Compartir</strong> en Safari (barra inferior).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <PlusSquare size={16} color="#0284c7" />
                <span>2. Selecciona <strong>"Agregar a pantalla de inicio"</strong>.</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                flex: '0 0 auto',
                padding: '0.55rem 0.85rem',
                background: 'transparent',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                color: '#64748b',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
                transition: 'all 0.2s ease'
              }}
            >
              Ahora no
            </button>

            <button
              type="button"
              onClick={handleInstallClick}
              style={{
                flex: 1,
                padding: '0.55rem 1rem',
                background: `linear-gradient(135deg, ${primaryColor}, #4338ca)`,
                border: 'none',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                boxShadow: `0 4px 14px ${primaryColor}40`,
                fontFamily: "'Poppins', sans-serif",
                transition: 'transform 0.15s ease'
              }}
            >
              <Download size={15} />
              <span>Instalar Aplicación</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pwaSlideUp {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
};
