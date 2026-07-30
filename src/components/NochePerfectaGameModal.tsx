import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trophy, Sparkles } from 'lucide-react';
import './NochePerfectaGameModal.css';

interface NochePerfectaGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCoupon: (descuentoPorcentaje: number) => void;
  tenantId?: string;
}

interface Obstacle {
  id: string;
  emoji: string;
  name: string;
  x: number; // porcentaje 10% - 80%
  y: number; // porcentaje 15% - 65%
  duration: number; // ms antes de explotar
  createdAt: number;
}

const OBSTACLES_CONFIG = [
  { emoji: '⏰', name: 'Despertador' },
  { emoji: '📱', name: 'Celular sonando' },
  { emoji: '🐶', name: 'Perro ladrando' },
  { emoji: '⚡', name: 'Trueno' },
  { emoji: '👶', name: 'Bebé llorando' },
  { emoji: '☕', name: 'Café caliente' },
];

const COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000; // 2 días (48 horas)
const TOTAL_GAME_SECONDS = 60; // 60 segundos total

export const NochePerfectaGameModal: React.FC<NochePerfectaGameModalProps> = ({
  isOpen,
  onClose,
  onApplyCoupon,
  tenantId = 'default'
}) => {
  const [gameState, setGameState] = useState<'intro' | 'cooldown' | 'playing' | 'gameover' | 'won'>('intro');
  const [timeLeft, setTimeLeft] = useState<number>(TOTAL_GAME_SECONDS);
  const [level, setLevel] = useState<number>(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [cooldownRemainingStr, setCooldownRemainingStr] = useState<string>('');
  const [hasActiveCoupon, setHasActiveCoupon] = useState<boolean>(false);

  const lastPlayedKey = `noche_perfecta_last_played_${tenantId}`;
  const couponWonKey = `noche_perfecta_coupon_won_${tenantId}`;

  const lastSpawnRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Verificación de Cooldown al abrir
  const checkCooldown = useCallback(() => {
    const lastPlayed = localStorage.getItem(lastPlayedKey);
    const wonCoupon = localStorage.getItem(couponWonKey);
    setHasActiveCoupon(!!wonCoupon);

    if (lastPlayed) {
      const elapsed = Date.now() - parseInt(lastPlayed, 10);
      if (elapsed < COOLDOWN_MS) {
        const diff = COOLDOWN_MS - elapsed;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setCooldownRemainingStr(`${hours}h ${mins}m ${secs}s`);
        setGameState('cooldown');
        return true;
      }
    }
    return false;
  }, [lastPlayedKey, couponWonKey]);

  useEffect(() => {
    if (isOpen) {
      const isInCooldown = checkCooldown();
      if (!isInCooldown) {
        setGameState('intro');
      }
    }
  }, [isOpen, checkCooldown]);

  // Actualizar temporizador de cooldown en tiempo real
  useEffect(() => {
    if (gameState === 'cooldown' && isOpen) {
      const interval = setInterval(() => {
        checkCooldown();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState, isOpen, checkCooldown]);

  // Configuración de dificultad por nivel (1 a 10)
  const getLevelConfig = (currentLevel: number) => {
    // spawnInterval en ms y duration en ms
    const configs: Record<number, { spawnInterval: number; duration: number }> = {
      1: { spawnInterval: 2200, duration: 2200 },
      2: { spawnInterval: 1900, duration: 2000 },
      3: { spawnInterval: 1700, duration: 1800 },
      4: { spawnInterval: 1500, duration: 1600 },
      5: { spawnInterval: 1250, duration: 1400 }, // Inicio de zona difícil
      6: { spawnInterval: 1050, duration: 1250 },
      7: { spawnInterval: 900,  duration: 1100 },
      8: { spawnInterval: 750,  duration: 950 },
      9: { spawnInterval: 620,  duration: 820 },
      10: { spawnInterval: 500, duration: 700 }, // Casi imposible
    };
    return configs[Math.min(currentLevel, 10)] || configs[10];
  };

  // Iniciar partida
  const startGame = () => {
    localStorage.setItem(lastPlayedKey, Date.now().toString());
    setTimeLeft(TOTAL_GAME_SECONDS);
    setLevel(1);
    setObstacles([]);
    setGameState('playing');
    startTimeRef.current = Date.now();
    lastSpawnRef.current = Date.now();
  };

  // Tap en obstáculo (eliminarlo antes de que expire)
  const handleTapObstacle = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setObstacles(prev => prev.filter(o => o.id !== id));
  };

  // Bucle principal del juego
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTimeRef.current) / 1000);
      const remainingSecs = Math.max(0, TOTAL_GAME_SECONDS - elapsedSeconds);
      setTimeLeft(remainingSecs);

      // Nivel según tiempo (Nivel 1 al 10, cada 6 segundos aumenta un nivel)
      const currentLevel = Math.min(10, Math.floor(elapsedSeconds / 6) + 1);
      setLevel(currentLevel);

      // Victoria al llegar a 0s
      if (remainingSecs <= 0) {
        clearInterval(interval);
        localStorage.setItem(couponWonKey, 'true');
        onApplyCoupon(30);
        setGameState('won');
        return;
      }

      const levelConfig = getLevelConfig(currentLevel);

      // 1. Verificar si algún obstáculo expiró (Derrota!)
      setObstacles(prev => {
        const expired = prev.some(obs => now - obs.createdAt >= obs.duration);
        if (expired) {
          clearInterval(interval);
          setGameState('gameover');
          return [];
        }
        return prev;
      });

      // 2. Generar nuevo obstáculo si corresponde el tiempo
      if (now - lastSpawnRef.current >= levelConfig.spawnInterval) {
        lastSpawnRef.current = now;
        const randomObstacle = OBSTACLES_CONFIG[Math.floor(Math.random() * OBSTACLES_CONFIG.length)];
        
        // Coordenadas aleatorias seguras dentro del área de juego
        const randomX = Math.floor(Math.random() * 68) + 12; // 12% - 80%
        const randomY = Math.floor(Math.random() * 45) + 15; // 15% - 60%

        const newObs: Obstacle = {
          id: Math.random().toString(36).substring(2, 9),
          emoji: randomObstacle.emoji,
          name: randomObstacle.name,
          x: randomX,
          y: randomY,
          duration: levelConfig.duration,
          createdAt: now,
        };

        setObstacles(prev => [...prev, newObs]);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [gameState, couponWonKey, onApplyCoupon]);

  if (!isOpen) return null;

  return (
    <div className="noche-game-overlay" onClick={onClose}>
      <div className="noche-game-card" onClick={e => e.stopPropagation()}>
        <div className="noche-stars" />
        
        <button className="noche-game-close" onClick={onClose} title="Cerrar">
          <X size={18} />
        </button>

        {/* ── Pantalla INTRO / INICIO ── */}
        {gameState === 'intro' && (
          <div className="noche-screen-intro">
            <div style={{ fontSize: '3.8rem', animation: 'sleeping-float 2.5s ease-in-out infinite' }}>😴</div>
            <h2 className="noche-title">La Noche Perfecta</h2>
            <p className="noche-subtitle">
              ¡Mantén al personaje dormido durante 60 segundos y gana una <strong>PIJAMA SHORT TIRA GRATIS 🎁</strong> en tu compra!
            </p>

            <div className="noche-rules-box">
              <div className="noche-rules-title">🎮 ¿Cómo jugar?</div>
              <div className="noche-rules-list">
                <span style={{ fontWeight: 700, color: '#fef08a' }}>• Toca estos 6 obstáculos antes de que despierten al personaje:</span>
                
                <div className="noche-obstacles-preview-grid">
                  <div className="obs-chip"><span className="obs-icon">⏰</span> Despertador</div>
                  <div className="obs-chip"><span className="obs-icon">📱</span> Celular</div>
                  <div className="obs-chip"><span className="obs-icon">🐶</span> Perro</div>
                  <div className="obs-chip"><span className="obs-icon">⚡</span> Trueno</div>
                  <div className="obs-chip"><span className="obs-icon">👶</span> Bebé</div>
                  <div className="obs-chip"><span className="obs-icon">☕</span> Café</div>
                </div>

                <span>• Cada nivel (1 al 10) aumenta la velocidad de reacción.</span>
                <span>• ¡Solo si completas el <strong>Nivel 10 (60s)</strong> ganas la Pijama Short Tira!</span>
                <span>• Tienes 1 intento cada 2 días.</span>
              </div>
            </div>

            <button className="noche-btn-start" onClick={startGame}>
              <Sparkles size={20} /> ¡EMPEZAR A JUGAR!
            </button>
          </div>
        )}

        {/* ── Pantalla COOLDOWN (2 días) ── */}
        {gameState === 'cooldown' && (
          <div className="noche-screen-cooldown">
            <div style={{ fontSize: '3.5rem' }}>⏳</div>
            <h2 className="noche-title">¡Ya jugaste tu turno!</h2>
            <p className="noche-subtitle">
              Puedes volver a jugar nuevamente en:
            </p>

            <div className="noche-cooldown-timer">
              {cooldownRemainingStr}
            </div>

            {hasActiveCoupon && (
              <div className="noche-coupon-box">
                <div style={{ fontSize: '0.85rem', color: '#a7f3d0', fontWeight: 800 }}>
                  🎉 ¡CUPÓN DEL 30% ACTIVO!
                </div>
                <div className="noche-coupon-code">NOCHEPERFECTA30</div>
                <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                  Ya está aplicado en tu catálogo y carrito de compras.
                </p>
              </div>
            )}

            <button className="noche-btn-action" onClick={onClose} style={{ background: '#334155' }}>
              Volver al Catálogo
            </button>

            <button 
              onClick={() => {
                try {
                  localStorage.removeItem(lastPlayedKey);
                  localStorage.removeItem(couponWonKey);
                  setGameState('intro');
                } catch(e){}
              }} 
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '1.2rem',
                textDecoration: 'underline',
                opacity: 0.8
              }}
              title="Borrar contador para volver a probar el juego"
            >
              🔄 Reiniciar tiempo de espera (Modo Pruebas)
            </button>
          </div>
        )}

        {/* ── Pantalla JUGANDO (HUD + Área de Juego) ── */}
        {gameState === 'playing' && (
          <>
            <div className="noche-hud">
              <div className="noche-hud-row">
                <span className="noche-badge-level">NIVEL {level} / 10</span>
                <span className="noche-timer-text">⏳ {timeLeft}s</span>
              </div>
              <div className="noche-stamina-bar-bg">
                <div 
                  className="noche-stamina-bar-fill"
                  style={{ width: `${(timeLeft / TOTAL_GAME_SECONDS) * 100}%` }}
                />
              </div>
            </div>

            <div className="noche-play-area">
              {/* Personaje Durmiendo */}
              <div className="noche-character-wrap">
                <div className="noche-zzz-container">
                  <span className="noche-zzz">Z</span>
                  <span className="noche-zzz">Z</span>
                  <span className="noche-zzz">Z</span>
                </div>
                <div className="noche-character-emoji">😴</div>
              </div>

              {/* Obstáculos generados en pantalla */}
              {obstacles.map(obs => (
                <div
                  key={obs.id}
                  className="noche-obstacle"
                  style={{ left: `${obs.x}%`, top: `${obs.y}%` }}
                  onPointerDown={e => handleTapObstacle(obs.id, e)}
                >
                  <div className="noche-obstacle-bubble">
                    <span className="noche-obs-emoji">{obs.emoji}</span>
                    <span className="noche-obs-name">{obs.name}</span>
                    <div
                      className="noche-obstacle-ring"
                      style={{ animationDuration: `${obs.duration}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Pantalla GAME OVER (Perdió) ── */}
        {gameState === 'gameover' && (
          <div className="noche-screen-result">
            <div style={{ fontSize: '4rem', animation: 'obstacle-pop 0.3s ease' }}>💥😱</div>
            <h2 className="noche-title" style={{ background: 'linear-gradient(135deg, #f87171 0%, #f43f5e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ¡SE DESPERTÓ!
            </h2>
            <p className="noche-subtitle">
              ¡Llegaste hasta el <strong>Nivel {level}</strong>! La velocidad te venció esta vez.
            </p>

            <div className="noche-rules-box" style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                Tu próximo intento estará disponible en <strong>2 días (48 horas)</strong>.
              </p>
            </div>

            <button className="noche-btn-action" onClick={onClose}>
              Entendido, Ir al Catálogo
            </button>
          </div>
        )}

        {/* ── Pantalla VICTORIA (Llegó a Nivel 10) ── */}
        {gameState === 'won' && (
          <div className="noche-screen-result">
            <div style={{ fontSize: '4rem' }}>🏆🎉</div>
            <h2 className="noche-title" style={{ background: 'linear-gradient(135deg, #34d399 0%, #a7f3d0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              ¡NOCHE PERFECTA!
            </h2>
            <p className="noche-subtitle">
              ¡Increíble! Lograste mantenerlo dormido los 60 segundos y superar el <strong>Nivel 10</strong>.
            </p>

            <div className="noche-coupon-box">
              <div style={{ fontSize: '0.9rem', color: '#a7f3d0', fontWeight: 800 }}>
                🎁 GANASTE UNA PIJAMA SHORT TIRA (GRATIS)
              </div>
              <div className="noche-coupon-code" style={{ fontSize: '1.15rem' }}>🎁 REGALO AÑADIDO AL CARRITO</div>
              <p style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.3rem' }}>
                Se ha añadido automáticamente tu Pijama Short Tira a tu carrito sin costo.
              </p>
            </div>

            <button className="noche-btn-start" onClick={onClose} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <Trophy size={20} /> ¡VER MI REGALO EN EL CARRITO!
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

interface PromoWelcomeBannerProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: () => void;
}

export const PromoWelcomeBanner: React.FC<PromoWelcomeBannerProps> = ({
  isOpen,
  onClose,
  onStartGame
}) => {
  if (!isOpen) return null;

  return (
    <div className="promo-welcome-overlay" onClick={onClose}>
      <div className="promo-welcome-card" onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.8rem',
            right: '0.8rem',
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#fff',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="promo-banner-badge">
          🎁 REGALO DE BIENVENIDA 🎁
        </div>

        <h2 className="promo-welcome-title">
          ¡Juega y Gana Tu Pijama Gratis!
        </h2>

        <p style={{ fontSize: '0.86rem', color: '#cbd5e1', margin: '0.2rem 0 0.6rem', lineHeight: '1.4' }}>
          Demuestra tu habilidad en el juego 😴 <strong>"La Noche Perfecta"</strong> y gana una <strong>Pijama Short Tira GRATIS</strong> con tu compra hoy.
        </p>

        <div className="promo-discount-tag" style={{ fontSize: '1.65rem' }}>
          🎁 PIJAMA SHORT TIRA
        </div>

        <button className="promo-glow-btn" onClick={onStartGame}>
          <Sparkles size={22} /> 🔥 ¡JUGAR Y GANAR MI PIJAMA! 🔥
        </button>

        <button className="promo-dismiss-btn" onClick={onClose}>
          Continuar al catálogo sin jugar
        </button>
      </div>
    </div>
  );
};

export const TemuWelcomeBanner = PromoWelcomeBanner;
