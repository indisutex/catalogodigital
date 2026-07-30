import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Trophy, ArrowLeft } from 'lucide-react';
import './FlappyStitchGame.css';

interface RewardTier {
  pts: number;
  label: string;
  type: 'discount' | 'shipping' | 'special';
  val: number;
}

const REWARD_TIERS: RewardTier[] = [
  { pts: 50, label: '5% DE DESCUENTO', type: 'discount', val: 5 },
  { pts: 100, label: 'ENVÍO GRATIS', type: 'shipping', val: 0 },
  { pts: 200, label: '10% DE DESCUENTO', type: 'discount', val: 10 },
  { pts: 500, label: '20% DE DESCUENTO', type: 'discount', val: 20 },
  { pts: 1000, label: '🎁 PREMIO ESPECIAL (PIJAMA PREMIUM)', type: 'special', val: 100 }
];

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
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'gameover' | 'cooldown'>('intro');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);

  // Physics state (in px)
  const WORLD_HEIGHT = 460;
  const WORLD_WIDTH = 380;
  const GRAVITY = 0.42;
  const JUMP_IMPULSE = -7.5;
  const STITCH_SIZE = 42;
  const GAP_SIZE = 145; // clearance gap between pillows
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

  // Jump Action
  const jump = useCallback(() => {
    if (gameState !== 'playing') return;
    velocityYRef.current = JUMP_IMPULSE;
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

  // Game Loop
  const gameLoop = useCallback(() => {
    // Apply gravity to Stitch
    velocityYRef.current += GRAVITY;
    stitchYRef.current += velocityYRef.current;
    setStitchY(stitchYRef.current);

    // Collision check ground or ceiling
    if (stitchYRef.current <= 0 || stitchYRef.current >= WORLD_HEIGHT - STITCH_SIZE) {
      handleGameOver();
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
          handleGameOver();
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
      const minPillow = 50;
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

  const handleGameOver = () => {
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
  };

  const startGame = () => {
    if (checkCooldown()) {
      setGameState('cooldown');
      return;
    }
    setScore(0);
    scoreRef.current = 0;
    stitchYRef.current = 180;
    velocityYRef.current = -3;
    setStitchY(180);
    pillowsRef.current = [];
    setPillows([]);
    setGameState('playing');

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(gameLoop);
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
      <div className="stitch-world" onClick={jump} onTouchStart={jump}>
        {/* Background stars */}
        <div className="stitch-star" style={{ top: '15%', left: '20%', width: '4px', height: '4px' }} />
        <div className="stitch-star" style={{ top: '40%', left: '70%', width: '6px', height: '6px' }} />
        <div className="stitch-star" style={{ top: '65%', left: '35%', width: '3px', height: '3px' }} />
        <div className="stitch-star" style={{ top: '25%', left: '85%', width: '5px', height: '5px' }} />

        {/* Stitch Avatar */}
        <div 
          className="stitch-character"
          style={{
            top: `${stitchY}px`,
            left: '60px',
            transform: `rotate(${Math.min(Math.max(velocityYRef.current * 3.5, -25), 65)}deg)`
          }}
        >
          <div className="stitch-avatar-box">
            👾
            <span className="stitch-pyjama-cap">🌙</span>
          </div>
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
      </div>

      {/* ── INTRO SCREEN ── */}
      {gameState === 'intro' && (
        <div className="stitch-screen-overlay">
          <div style={{ fontSize: '3.6rem', animation: 'star-twinkle 1.5s infinite alternate' }}>👾🌙</div>
          <h2 className="stitch-title">Supervivencia Stitch</h2>
          <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0.2rem 0 0.6rem', lineHeight: '1.4' }}>
            Ayuda a Stitch en pijama a volar entre las almohadas. ¡Cada almohada esquivada te otorga 1 punto!
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

          <button className="stitch-btn-tap" onClick={startGame}>
            <Sparkles size={20} /> ¡VOLAR Y JUGAR AHORA!
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
