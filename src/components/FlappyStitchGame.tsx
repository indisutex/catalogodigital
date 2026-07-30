import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, ArrowLeft, HelpCircle, Play } from 'lucide-react';
import './FlappyStitchGame.css';

export interface RewardTier {
  pts: number;
  label: string;
  type: 'discount' | 'shipping' | 'special';
  val: number;
}

export const REWARD_TIERS: RewardTier[] = [
  { pts: 50, label: '5% DE DESCUENTO', type: 'discount', val: 5 },
  { pts: 100, label: 'ENVÍO GRATIS', type: 'shipping', val: 0 },
  { pts: 200, label: '10% DE DESCUENTO', type: 'discount', val: 10 },
  { pts: 500, label: '20% DE DESCUENTO', type: 'discount', val: 20 },
  { pts: 1000, label: '🎁 PREMIO ESPECIAL (PIJAMA PREMIUM)', type: 'special', val: 100 }
];

export const StitchAvatarSVG: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 48,
  className = '',
  style = {}
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))', ...style }}
  >
    {/* Left Ear */}
    <path d="M32 45 C15 35 2 20 5 8 C7 0 22 10 35 32 Z" fill="#2563eb" stroke="#1d4ed8" strokeWidth="2" />
    <path d="M30 42 C18 34 8 22 10 12 C12 6 22 14 32 32 Z" fill="#ec4899" opacity="0.88" />
    {/* Ear Notch */}
    <path d="M12 22 L7 25 L14 28 Z" fill="#0f172a" />

    {/* Right Ear */}
    <path d="M68 45 C85 35 98 20 95 8 C93 0 78 10 65 32 Z" fill="#2563eb" stroke="#1d4ed8" strokeWidth="2" />
    <path d="M70 42 C82 34 92 22 90 12 C88 6 78 14 68 32 Z" fill="#ec4899" opacity="0.88" />

    {/* Stitch Head */}
    <ellipse cx="50" cy="52" rx="26" ry="22" fill="#2563eb" stroke="#1e40af" strokeWidth="2.5" />

    {/* Muzzle / Light Blue Patch */}
    <ellipse cx="50" cy="58" rx="17" ry="12" fill="#bae6fd" />

    {/* Left Eye Patch & Eye */}
    <ellipse cx="40" cy="48" rx="7.5" ry="9" fill="#1e3a8a" />
    <ellipse cx="40.5" cy="48" rx="5.5" ry="7" fill="#0f172a" />
    <circle cx="39" cy="45" r="2.2" fill="#ffffff" />
    <circle cx="42" cy="51" r="1" fill="#ffffff" />

    {/* Right Eye Patch & Eye */}
    <ellipse cx="60" cy="48" rx="7.5" ry="9" fill="#1e3a8a" />
    <ellipse cx="59.5" cy="48" rx="5.5" ry="7" fill="#0f172a" />
    <circle cx="58" cy="45" r="2.2" fill="#ffffff" />
    <circle cx="61" cy="51" r="1" fill="#ffffff" />

    {/* Cute Dark Nose */}
    <path d="M46 54 Q50 51 54 54 Q50 58 46 54 Z" fill="#1e1b4b" />

    {/* Grin / Mouth with fangs */}
    <path d="M42 63 Q50 69 58 63" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
    <polygon points="44,63 45.5,65 47,63" fill="#ffffff" />
    <polygon points="53,63 54.5,65 56,63" fill="#ffffff" />

    {/* Sleeping Cap / Nightcap */}
    <path d="M38 34 Q50 20 62 34 Q50 30 38 34 Z" fill="#6366f1" />
    <path d="M60 30 Q72 32 78 44 Q70 42 60 30 Z" fill="#4f46e5" />
    <circle cx="79" cy="45" r="4.5" fill="#fef08a" />
    <path d="M48 27 A3 3 0 1 0 52 30 A2.5 2.5 0 1 1 48 27 Z" fill="#fef08a" />
  </svg>
);

interface PillowObstacle {
  id: number;
  x: number; // px from left
  topHeight: number; // px height of top pillow
  bottomHeight: number; // px height of bottom pillow
  passed: boolean;
}

interface FlappyStitchGameProps {
  onClose: () => void;
  onRewardEarned: (reward: RewardTier) => void;
  tenantId?: string;
}

export const FlappyStitchGame: React.FC<FlappyStitchGameProps> = ({
  onClose,
  onRewardEarned,
  tenantId = 'default'
}) => {
  const [gameState, setGameState] = useState<'intro' | 'instructions' | 'ready' | 'playing' | 'gameover' | 'cooldown'>('intro');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);

  // Physics state (in px)
  const WORLD_HEIGHT = 460;
  const WORLD_WIDTH = 380;
  const GRAVITY = 0.42;
  const JUMP_IMPULSE = -7.5;
  const STITCH_SIZE = 44;
  const GAP_SIZE = 150; // clearance gap between pillows
  const PILLOW_WIDTH = 54;

  const [stitchY, setStitchY] = useState<number>(180);
  const velocityYRef = useRef<number>(0);
  const stitchYRef = useRef<number>(180);
  const [pillows, setPillows] = useState<PillowObstacle[]>([]);
  const pillowsRef = useRef<PillowObstacle[]>([]);

  const animationFrameRef = useRef<number | null>(null);
  const lastPillowIdRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);

  const lastPlayedKey = `stitch_game_last_played_${tenantId}`;
  const highScoreKey = `stitch_game_highscore_${tenantId}`;
  const [cooldownRemainingStr, setCooldownRemainingStr] = useState<string>('');

  // Load Highscore
  useEffect(() => {
    try {
      const saved = localStorage.getItem(highScoreKey);
      if (saved) setHighScore(parseInt(saved, 10) || 0);
    } catch (e) {}
  }, [highScoreKey]);

  // Cooldown Check
  const checkCooldown = useCallback(() => {
    try {
      const lastPlayed = localStorage.getItem(lastPlayedKey);
      if (lastPlayed) {
        const diff = Date.now() - parseInt(lastPlayed, 10);
        const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
        if (diff < TWO_DAYS_MS) {
          const remainingMs = TWO_DAYS_MS - diff;
          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((remainingMs % (1000 * 60)) / 1000);
          setCooldownRemainingStr(`${hours}h ${mins}m ${secs}s`);
          return true;
        }
      }
    } catch (e) {}
    return false;
  }, [lastPlayedKey]);

  // Forward ref for Game Loop
  const gameLoopRef = useRef<() => void>(() => {});

  // Jump Action
  const jump = useCallback(() => {
    if (gameState === 'ready') {
      setGameState('playing');
      velocityYRef.current = JUMP_IMPULSE;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(gameLoopRef.current);
      return;
    }
    if (gameState === 'playing') {
      velocityYRef.current = JUMP_IMPULSE;
    }
  }, [gameState]);

  // Handle Keyboard (Space / ArrowUp)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  const handleGameOverRef = useRef<() => void>(() => {});

  const handleGameOver = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setGameState('gameover');

    const finalScore = scoreRef.current;
    try {
      localStorage.setItem(lastPlayedKey, Date.now().toString());
      if (finalScore > highScore) {
        setHighScore(finalScore);
        localStorage.setItem(highScoreKey, finalScore.toString());
      }
    } catch (e) {}

    // Find highest unlocked reward
    const unlocked = [...REWARD_TIERS].reverse().find(t => finalScore >= t.pts);
    if (unlocked) {
      onRewardEarned(unlocked);
    }
  }, [highScore, highScoreKey, lastPlayedKey, onRewardEarned]);

  useEffect(() => {
    handleGameOverRef.current = handleGameOver;
  }, [handleGameOver]);

  // Game Loop
  const gameLoop = useCallback(() => {
    // Apply gravity to Stitch
    velocityYRef.current += GRAVITY;
    stitchYRef.current += velocityYRef.current;
    setStitchY(stitchYRef.current);

    // Collision check ground or ceiling
    if (stitchYRef.current <= 0 || stitchYRef.current >= WORLD_HEIGHT - STITCH_SIZE) {
      handleGameOverRef.current();
      return;
    }

    // Move Pillows leftward (speed increases slightly with score)
    const speed = Math.min(2.2 + Math.floor(scoreRef.current / 50) * 0.3, 4.5);
    const updatedPillows: PillowObstacle[] = [];
    const stitchX = 60; // Stitch's fixed horizontal position

    let newScore = scoreRef.current;

    for (const p of pillowsRef.current) {
      const nextX = p.x - speed;

      // Check if Stitch passed pillow set
      if (!p.passed && nextX + PILLOW_WIDTH < stitchX) {
        p.passed = true;
        newScore += 1;
      }

      // Collision Detection Box with Pillows
      const inXRange = stitchX + STITCH_SIZE > nextX && stitchX < nextX + PILLOW_WIDTH;
      if (inXRange) {
        const topCollision = stitchYRef.current < p.topHeight;
        const bottomCollision = stitchYRef.current + STITCH_SIZE > WORLD_HEIGHT - p.bottomHeight;
        if (topCollision || bottomCollision) {
          handleGameOverRef.current();
          return;
        }
      }

      if (nextX > -PILLOW_WIDTH - 20) {
        updatedPillows.push({ ...p, x: nextX });
      }
    }

    // Spawn new pillow if needed
    const lastPillow = updatedPillows[updatedPillows.length - 1];
    const spawnDistance = Math.max(170, 220 - Math.floor(scoreRef.current / 100) * 10);
    if (!lastPillow || lastPillow.x < WORLD_WIDTH - spawnDistance) {
      const minPillow = 45;
      const maxPillow = WORLD_HEIGHT - GAP_SIZE - minPillow;
      const topH = Math.floor(Math.random() * (maxPillow - minPillow + 1)) + minPillow;
      const bottomH = WORLD_HEIGHT - GAP_SIZE - topH;

      lastPillowIdRef.current += 1;
      updatedPillows.push({
        id: lastPillowIdRef.current,
        x: WORLD_WIDTH + 20,
        topHeight: topH,
        bottomHeight: bottomH,
        passed: false
      });
    }

    pillowsRef.current = updatedPillows;
    setPillows(updatedPillows);

    if (newScore !== scoreRef.current) {
      scoreRef.current = newScore;
      setScore(newScore);
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    gameLoopRef.current = gameLoop;
  }, [gameLoop]);

  // Setup ready state with initial pillow and hovering position
  const prepareReadyState = () => {
    if (checkCooldown()) {
      setGameState('cooldown');
      return;
    }
    setScore(0);
    scoreRef.current = 0;
    stitchYRef.current = 180;
    velocityYRef.current = 0;
    setStitchY(180);

    const initialTopH = 110;
    const initialBottomH = WORLD_HEIGHT - GAP_SIZE - initialTopH;
    const initialPillow: PillowObstacle = {
      id: 1,
      x: WORLD_WIDTH + 40,
      topHeight: initialTopH,
      bottomHeight: initialBottomH,
      passed: false
    };
    lastPillowIdRef.current = 1;
    pillowsRef.current = [initialPillow];
    setPillows([initialPillow]);
    setGameState('ready');
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Determine current highest unlocked tier
  const bestRewardUnlocked = [...REWARD_TIERS].reverse().find(t => score >= t.pts);
  const nextRewardTarget = REWARD_TIERS.find(t => t.pts > score) || REWARD_TIERS[REWARD_TIERS.length - 1];

  return (
    <div className="stitch-game-container">
      {/* ── HUD ── */}
      <div className="stitch-hud">
        <div className="stitch-score-badge">
          ⭐ {score} <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>PTS</span>
        </div>
        <div className="stitch-next-milestone">
          🎯 Siguiente: {nextRewardTarget.pts} pts
        </div>
      </div>

      {/* ── WORLD CANVAS ── */}
      <div className="stitch-world" onPointerDown={(e) => { e.preventDefault(); jump(); }}>
        {/* Background stars */}
        <div className="stitch-star" style={{ top: '15%', left: '20%', width: '4px', height: '4px' }} />
        <div className="stitch-star" style={{ top: '40%', left: '70%', width: '6px', height: '6px' }} />
        <div className="stitch-star" style={{ top: '65%', left: '35%', width: '3px', height: '3px' }} />
        <div className="stitch-star" style={{ top: '25%', left: '85%', width: '5px', height: '5px' }} />

        {/* Stitch Avatar */}
        <div 
          className={`stitch-character ${gameState === 'ready' ? 'stitch-hovering' : ''}`}
          style={{
            top: `${stitchY}px`,
            left: '60px',
            transform: gameState === 'ready' 
              ? 'rotate(-5deg)'
              : `rotate(${Math.min(Math.max(velocityYRef.current * 3.5, -25), 65)}deg)`
          }}
        >
          <StitchAvatarSVG size={50} />
        </div>

        {/* Pillow Obstacles */}
        {pillows.map(p => (
          <React.Fragment key={p.id}>
            {/* Top Pillow */}
            <div 
              className="pillow-obstacle pillow-top"
              style={{
                left: `${p.x}px`,
                top: 0,
                height: `${p.topHeight}px`
              }}
            >
              <span className="pillow-texture">☁️</span>
            </div>
            {/* Bottom Pillow */}
            <div 
              className="pillow-obstacle pillow-bottom"
              style={{
                left: `${p.x}px`,
                bottom: '20px',
                height: `${p.bottomHeight}px`
              }}
            >
              <span className="pillow-texture">☁️</span>
            </div>
          </React.Fragment>
        ))}

        {/* Ground */}
        <div className="stitch-ground" />

        {/* Ready Overlay Banner */}
        {gameState === 'ready' && (
          <div className="stitch-ready-banner">
            <div className="stitch-pulse-finger">👆</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ¡Toca la pantalla para empezar a volar!
            </div>
            <div style={{ fontSize: '0.78rem', color: '#93c5fd', marginTop: '0.2rem' }}>
              (O presiona la barra ESPACIO en PC)
            </div>
          </div>
        )}
      </div>

      {/* ── INTRO SCREEN ── */}
      {gameState === 'intro' && (
        <div className="stitch-screen-overlay">
          <div style={{ margin: '0.5rem 0' }}>
            <StitchAvatarSVG size={90} />
          </div>
          <h2 className="stitch-title">Supervivencia Stitch</h2>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0.2rem 0 0.6rem', lineHeight: '1.4' }}>
            Ayuda a Stitch en pijama a volar entre las almohadas para ganar premios en tu compra.
          </p>

          <div className="stitch-rewards-list">
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fef08a', textAlign: 'center', marginBottom: '0.3rem' }}>
              🎁 ESCALA DE PREMIOS
            </div>
            {REWARD_TIERS.map(t => (
              <div key={t.pts} className={`reward-row ${score >= t.pts ? 'unlocked' : ''}`}>
                <span>{t.pts} pts</span>
                <span>{t.label}</span>
              </div>
            ))}
          </div>

          <button className="stitch-btn-tap" onClick={() => setGameState('instructions')}>
            <HelpCircle size={20} /> ¡VER INSTRUCCIONES Y EMPEZAR!
          </button>
        </div>
      )}

      {/* ── INSTRUCTIONS SCREEN ── */}
      {gameState === 'instructions' && (
        <div className="stitch-screen-overlay" style={{ padding: '1.2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.2rem' }}>📖</div>
          <h2 className="stitch-title" style={{ fontSize: '1.4rem' }}>¿Cómo se juega?</h2>
          
          <div className="stitch-instructions-card">
            <div className="instruction-step">
              <div className="step-num">1</div>
              <div className="step-text">
                <strong>Controla el vuelo:</strong> Toca la pantalla o presiona <strong>ESPACIO</strong> para dar cada aletazo y subir.
              </div>
            </div>

            <div className="instruction-step">
              <div className="step-num">2</div>
              <div className="step-text">
                <strong>Esquiva las almohadas:</strong> Pasa libremente por el centro. No toques las almohadas ni caigas al suelo.
              </div>
            </div>

            <div className="instruction-step">
              <div className="step-num">3</div>
              <div className="step-text">
                <strong>Inicio seguro:</strong> Al tocar iniciar, Stitch <em>flotará en el aire</em> sin caer hasta que des tu primer salto.
              </div>
            </div>
          </div>

          <button className="stitch-btn-tap" onClick={prepareReadyState} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <Play size={20} fill="#ffffff" /> ¡ENTENDIDO, LISTO PARA VOLAR!
          </button>
        </div>
      )}

      {/* ── COOLDOWN SCREEN ── */}
      {gameState === 'cooldown' && (
        <div className="stitch-screen-overlay">
          <div style={{ fontSize: '3.5rem' }}>⏳</div>
          <h2 className="stitch-title">¡Ya jugaste tu turno!</h2>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
            Puedes volver a volar con Stitch en:
          </p>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8', margin: '0.8rem 0' }}>
            {cooldownRemainingStr}
          </div>
          <button className="stitch-btn-tap" onClick={onClose} style={{ background: '#334155' }}>
            <ArrowLeft size={18} /> Volver al Catálogo
          </button>

          <button 
            onClick={() => {
              try {
                localStorage.removeItem(lastPlayedKey);
                setGameState('intro');
              } catch(e){}
            }} 
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.78rem',
              cursor: 'pointer',
              marginTop: '1.2rem',
              textDecoration: 'underline'
            }}
          >
            🔄 Reiniciar tiempo de espera (Modo Pruebas)
          </button>
        </div>
      )}

      {/* ── GAME OVER SCREEN ── */}
      {gameState === 'gameover' && (
        <div className="stitch-screen-overlay">
          <div style={{ fontSize: '3.8rem' }}>💥😵</div>
          <h2 className="stitch-title">¡JUEGO TERMINADO!</h2>
          <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
            Lograste <strong>{score} puntos</strong> en este vuelo.
          </p>

          {bestRewardUnlocked ? (
            <div className="stitch-rewards-list" style={{ background: 'rgba(56, 189, 248, 0.2)', border: '1.5px solid #38bdf8' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fef08a' }}>
                🎉 ¡RECOMPENSA GANADA!
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', margin: '0.2rem 0' }}>
                {bestRewardUnlocked.label}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                Tu premio ha sido aplicado automáticamente a tu carrito.
              </p>
            </div>
          ) : (
            <div className="stitch-rewards-list">
              <p style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                Alcanza al menos <strong>50 puntos</strong> para desbloquear tu primer descuento del 5%. ¡Vuelve a intentarlo!
              </p>
            </div>
          )}

          <button className="stitch-btn-tap" onClick={onClose}>
            <Trophy size={18} /> ¡IR A USAR MI PREMIO EN EL CARRITO!
          </button>
        </div>
      )}
    </div>
  );
};

