import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Trophy, Heart, ArrowLeft, Clock, Zap, Play } from 'lucide-react';
import './CortaRegalosGame.css';
import {
  DEFAULT_CONFIG,
  weightedRandom,
  segmentCircleIntersect,
} from './types';
import type {
  GameConfig,
  FlyingObject,
  Particle,
  SlicedHalf,
  TrailPoint,
  ScorePopup,
  Premio,
} from './types';

const GRAVITY = 0.32;
const TRAIL_DURATION = 160; // ms
const OBJECT_LIFETIME = 4000; // ms before auto-despawn

interface CortaRegalosGameProps {
  onClose: () => void;
  onRewardEarned: (premio: Premio) => void;
  tenantId?: string;
  config?: Partial<GameConfig>;
}

type GameStateType = 'intro' | 'instructions' | 'countdown' | 'playing' | 'gameover';

// ── Main Component ──────────────────────────────────────────────
export const CortaRegalosGame: React.FC<CortaRegalosGameProps> = ({
  onClose,
  onRewardEarned,
  tenantId = 'default',
  config: configOverride,
}) => {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...configOverride };

  // React UI state
  const [gameState, setGameState] = useState<GameStateType>('intro');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(config.vidas);
  const [displayTime, setDisplayTime] = useState(config.duracionSegundos);
  const [comboText, setComboText] = useState<string | null>(null);
  const [earnedPrize, setEarnedPrize] = useState<Premio | null>(null);
  const [highScore, setHighScore] = useState(0);
  const [countdownNum, setCountdownNum] = useState(3);
  const [isBombGame, setIsBombGame] = useState(false);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Game loop refs
  const scoreRef = useRef(0);
  const livesRef = useRef(config.vidas);
  const timeRef = useRef(config.duracionSegundos);
  const objectsRef = useRef<FlyingObject[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const halvesRef = useRef<SlicedHalf[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const popupsRef = useRef<ScorePopup[]>([]);
  const frameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastSpawnRef = useRef<number>(0);
  const timeSinceStartRef = useRef(0);
  const isPointerDownRef = useRef(false);
  const comboThisGestureRef = useRef(0);
  const shakeRef = useRef(0);
  const gameStateRef = useRef<GameStateType>('intro');
  const objIdRef = useRef(0);
  const halfIdRef = useRef(0);
  const popupIdRef = useRef(0);
  const lastTimeUpdateRef = useRef(0);
  const canvasSizeRef = useRef({ w: 400, h: 580 });

  // Load highscore
  useEffect(() => {
    try {
      const hs = localStorage.getItem(`corta_highscore_${tenantId}`);
      if (hs) setHighScore(parseInt(hs, 10) || 0);
    } catch (_) {}
  }, [tenantId]);

  // ── Canvas setup ──
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrapper.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    canvasSizeRef.current = { w, h };
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // ── Spawn helper ──
  const spawnObject = useCallback((now: number) => {
    const { w, h } = canvasSizeRef.current;
    const difficulty = Math.min(timeSinceStartRef.current / 1000 * config.incrementoDificultad, 3);
    const spd = (config.velocidadInicial + difficulty) * 1.8;

    const cfg = weightedRandom(config.objetos);
    const x = w * 0.1 + Math.random() * w * 0.8;
    const vy = -(spd * 7 + Math.random() * 3);
    const vx = (Math.random() - 0.5) * spd * 3.5;
    const radius = 30 - difficulty * 1.5;
    const clampedRadius = Math.max(18, Math.min(34, radius));
    const fontSize = clampedRadius * 1.45;

    objectsRef.current.push({
      id: objIdRef.current++,
      config: cfg,
      x,
      y: h + 20,
      vx,
      vy,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.12,
      radius: clampedRadius,
      sliced: false,
      fontSize,
      spawnedAt: now,
    });
  }, [config]);

  // ── Particle spawn ──
  const spawnParticles = useCallback((x: number, y: number, color: string, count = 14) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 5;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        radius: 2 + Math.random() * 4,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.4,
      });
    }
  }, []);

  // ── Slice an object ──
  const sliceObject = useCallback((obj: FlyingObject, sliceDx: number, sliceDy: number) => {
    if (obj.sliced) return false;
    obj.sliced = true;

    spawnParticles(obj.x, obj.y, obj.config.color, obj.config.tipo === 'negativo' ? 8 : 16);

    // Spawn two halves
    const perpX = -sliceDy;
    const perpY = sliceDx;
    const norm = Math.sqrt(perpX * perpX + perpY * perpY) || 1;

    for (const flip of [1, -1] as const) {
      halvesRef.current.push({
        id: halfIdRef.current++,
        emoji: obj.config.emoji,
        x: obj.x,
        y: obj.y,
        vx: obj.vx + (perpX / norm) * 2.5 * flip,
        vy: obj.vy + (perpY / norm) * 2.5 * flip,
        rotation: obj.rotation + Math.PI * 0.25 * flip,
        rotationSpeed: obj.rotationSpeed + 0.06 * flip,
        alpha: 1,
        life: 1,
        fontSize: obj.fontSize * 0.75,
        flip,
      });
    }

    return true;
  }, [spawnParticles]);

  // ── Slice detection ──
  const detectSlice = useCallback((trail: TrailPoint[]) => {
    if (trail.length < 2) return;
    const { h } = canvasSizeRef.current;
    const now = Date.now();
    const freshTrail = trail.filter(p => now - p.t < TRAIL_DURATION);
    if (freshTrail.length < 2) return;

    let comboCount = 0;
    const totalTrail = freshTrail.length;

    for (const obj of objectsRef.current) {
      if (obj.sliced) continue;

      let intersected = false;
      for (let i = 1; i < totalTrail; i++) {
        const p1 = freshTrail[i - 1];
        const p2 = freshTrail[i];
        if (segmentCircleIntersect(p1.x, p1.y, p2.x, p2.y, obj.x, obj.y, obj.radius)) {
          intersected = true;
          break;
        }
      }

      if (!intersected) continue;

      const last = freshTrail[freshTrail.length - 1];
      const prev = freshTrail[freshTrail.length - 2];
      const dx = (last.x - prev.x) || 1;
      const dy = (last.y - prev.y) || 0;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;

      sliceObject(obj, dx / len, dy / len);
      comboCount++;

      if (obj.config.tipo === 'negativo') {
        // Handle negative effect
        if (obj.config.efectoNegativo === 'game_over') {
          setIsBombGame(true);
          shakeRef.current = 25;
          spawnParticles(obj.x, obj.y, '#ff0000', 30);
          gameStateRef.current = 'gameover';
          setGameState('gameover');
          if (frameRef.current) cancelAnimationFrame(frameRef.current);
          const finalScore = scoreRef.current;
          try { localStorage.setItem(`corta_highscore_${tenantId}`, String(Math.max(finalScore, highScore))); } catch (_) {}
          const prize = [...config.premios].reverse().find(p => finalScore >= p.puntosMinimos) ?? null;
          setEarnedPrize(prize);
          if (prize) onRewardEarned(prize);
          return;
        } else if (obj.config.efectoNegativo === 'quitar_vida') {
          shakeRef.current = 15;
          livesRef.current = Math.max(0, livesRef.current - 1);
          setDisplayLives(livesRef.current);
          if (livesRef.current <= 0) {
            gameStateRef.current = 'gameover';
            setIsBombGame(false);
            setGameState('gameover');
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            const finalScore = scoreRef.current;
            try { localStorage.setItem(`corta_highscore_${tenantId}`, String(Math.max(finalScore, highScore))); } catch (_) {}
            const prize = [...config.premios].reverse().find(p => finalScore >= p.puntosMinimos) ?? null;
            setEarnedPrize(prize);
            if (prize) onRewardEarned(prize);
            return;
          }
          popupsRef.current.push({ id: popupIdRef.current++, text: '-1 ❤️', x: obj.x, y: obj.y, color: '#ef4444', life: 1, maxLife: 0.9 });
        } else if (obj.config.efectoNegativo === 'restar_puntos') {
          const penalty = obj.config.puntosNegativo ?? 50;
          scoreRef.current = Math.max(0, scoreRef.current - penalty);
          setDisplayScore(scoreRef.current);
          popupsRef.current.push({ id: popupIdRef.current++, text: `-${penalty}`, x: obj.x, y: obj.y, color: '#f97316', life: 1, maxLife: 0.9 });
        }
      } else {
        // Positive object
        const pts = obj.config.puntos;
        scoreRef.current += pts;
        setDisplayScore(scoreRef.current);
        popupsRef.current.push({ id: popupIdRef.current++, text: `+${pts}`, x: obj.x, y: obj.y, color: '#4ade80', life: 1, maxLife: 0.9 });
      }
    }

    // Combo feedback
    if (comboCount >= 2 && config.combosActivos) {
      const mult = comboCount >= 10 ? 'x10' : comboCount >= 5 ? 'x5' : comboCount >= 3 ? 'x3' : 'x2';
      setComboText(mult);
      const bonus = scoreRef.current * (comboCount - 1) * 0.1;
      scoreRef.current += Math.round(bonus);
      setDisplayScore(scoreRef.current);
      setTimeout(() => setComboText(null), 800);
    }
  }, [config, sliceObject, spawnParticles, tenantId, highScore, onRewardEarned]);

  // ── Main game loop ──
  const startGameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const loop = (timestamp: number) => {
      if (gameStateRef.current !== 'playing') return;

      const dt = lastTimestampRef.current ? Math.min((timestamp - lastTimestampRef.current) / 1000, 0.05) : 0.016;
      lastTimestampRef.current = timestamp;
      timeSinceStartRef.current += dt * 1000;

      const { w, h } = canvasSizeRef.current;

      // Update timer
      timeRef.current -= dt;
      if (Date.now() - lastTimeUpdateRef.current > 400) {
        lastTimeUpdateRef.current = Date.now();
        setDisplayTime(Math.max(0, Math.ceil(timeRef.current)));
      }
      if (timeRef.current <= 0) {
        gameStateRef.current = 'gameover';
        setIsBombGame(false);
        setGameState('gameover');
        const finalScore = scoreRef.current;
        try { localStorage.setItem(`corta_highscore_${tenantId}`, String(Math.max(finalScore, highScore))); } catch (_) {}
        const prize = [...config.premios].reverse().find(p => finalScore >= p.puntosMinimos) ?? null;
        setEarnedPrize(prize);
        if (prize) onRewardEarned(prize);
        return;
      }

      // Difficulty level
      const difficulty = Math.min(timeSinceStartRef.current / 1000 * config.incrementoDificultad, 3);

      // Spawn logic
      const now = Date.now();
      const spawnInterval = Math.max(500, 1400 - difficulty * 180);
      const maxObjects = Math.min(3 + Math.floor(difficulty * 1.5), 8);
      if (now - lastSpawnRef.current > spawnInterval && objectsRef.current.filter(o => !o.sliced).length < maxObjects) {
        spawnObject(now);
        lastSpawnRef.current = now;
      }

      // Occasionally spawn second object
      if (difficulty > 1 && Math.random() < 0.015) {
        spawnObject(now);
      }

      // Update objects
      objectsRef.current = objectsRef.current.filter(obj => {
        if (obj.sliced) return false;
        obj.vy += GRAVITY;
        obj.x += obj.vx;
        obj.y += obj.vy;
        obj.rotation += obj.rotationSpeed;
        const age = now - obj.spawnedAt;
        return obj.y < h + 80 && age < OBJECT_LIFETIME;
      });

      // Update halves
      halvesRef.current = halvesRef.current.filter(h_ => {
        h_.vy += GRAVITY * 0.7;
        h_.x += h_.vx;
        h_.y += h_.vy;
        h_.rotation += h_.rotationSpeed;
        h_.life -= dt * 1.8;
        h_.alpha = Math.max(0, h_.life);
        return h_.life > 0 && h_.y < h + 100;
      });

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.vx *= 0.94;
        p.vy = p.vy * 0.94 + GRAVITY * 0.5;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= dt / p.maxLife;
        p.radius *= 0.97;
        return p.life > 0;
      });

      // Update popups
      popupsRef.current = popupsRef.current.filter(p => {
        p.y -= 1.2;
        p.life -= dt / p.maxLife;
        return p.life > 0;
      });

      // Camera shake decay
      shakeRef.current *= 0.82;

      // ── RENDER ──
      ctx.save();
      if (shakeRef.current > 0.5) {
        const sx = (Math.random() - 0.5) * shakeRef.current;
        const sy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(sx, sy);
      }

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, config.colorFondo1);
      grad.addColorStop(1, config.colorFondo2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const starPositions = [[0.1,0.08],[0.3,0.15],[0.6,0.05],[0.8,0.12],[0.45,0.2],[0.9,0.18],[0.2,0.25],[0.7,0.3],[0.05,0.35]];
      for (const [sx_, sy_] of starPositions) {
        ctx.beginPath();
        ctx.arc(w * sx_, h * sy_, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw sliced halves
      for (const half of halvesRef.current) {
        ctx.save();
        ctx.globalAlpha = half.alpha;
        ctx.translate(half.x, half.y);
        ctx.rotate(half.rotation);
        ctx.scale(half.flip, 1);
        ctx.font = `${half.fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(half.emoji, 0, 0);
        ctx.restore();
      }

      // Draw objects
      for (const obj of objectsRef.current) {
        if (obj.sliced) continue;
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.rotation);

        // Glow effect for positive, dark for negative
        if (obj.config.tipo === 'positivo') {
          ctx.shadowBlur = 18;
          ctx.shadowColor = obj.config.color;
        } else {
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#ff0000';
        }
        ctx.font = `${obj.fontSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.config.emoji, 0, 0);
        ctx.restore();
      }

      // Draw particles
      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw slice trail
      const freshTrail = trailRef.current.filter(pt => Date.now() - pt.t < TRAIL_DURATION);
      if (freshTrail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < freshTrail.length; i++) {
          const alpha = i / freshTrail.length;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.lineWidth = alpha * 5;
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(120, 220, 255, 0.9)';
          ctx.beginPath();
          ctx.moveTo(freshTrail[i - 1].x, freshTrail[i - 1].y);
          ctx.lineTo(freshTrail[i].x, freshTrail[i].y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw score popups
      for (const popup of popupsRef.current) {
        ctx.save();
        ctx.globalAlpha = popup.life;
        ctx.font = 'bold 22px Outfit, system-ui';
        ctx.fillStyle = popup.color;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 8;
        ctx.shadowColor = popup.color;
        ctx.fillText(popup.text, popup.x, popup.y);
        ctx.restore();
      }

      ctx.restore(); // camera shake

      frameRef.current = requestAnimationFrame(loop);
    };

    lastTimestampRef.current = null;
    frameRef.current = requestAnimationFrame(loop);
  }, [config, spawnObject, tenantId, highScore, onRewardEarned]);

  // ── Pointer events ──
  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'playing') return;
    e.preventDefault();
    isPointerDownRef.current = true;
    comboThisGestureRef.current = 0;
    trailRef.current = [];
    const pos = getPos(e);
    trailRef.current.push({ ...pos, t: Date.now() });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDownRef.current || gameStateRef.current !== 'playing') return;
    e.preventDefault();
    const pos = getPos(e);
    trailRef.current.push({ ...pos, t: Date.now() });
    // Keep trail bounded
    if (trailRef.current.length > 40) trailRef.current.shift();
    detectSlice(trailRef.current);
  }, [detectSlice]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameStateRef.current !== 'playing') return;
    e.preventDefault();
    isPointerDownRef.current = false;
    comboThisGestureRef.current = 0;
    setTimeout(() => { trailRef.current = []; }, TRAIL_DURATION);
  }, []);

  // ── Start game ──
  const startGame = useCallback(() => {
    // Reset all state
    scoreRef.current = 0;
    livesRef.current = config.vidas;
    timeRef.current = config.duracionSegundos;
    timeSinceStartRef.current = 0;
    objectsRef.current = [];
    particlesRef.current = [];
    halvesRef.current = [];
    trailRef.current = [];
    popupsRef.current = [];
    lastSpawnRef.current = 0;
    lastTimestampRef.current = null;
    shakeRef.current = 0;
    objIdRef.current = 0;
    halfIdRef.current = 0;
    popupIdRef.current = 0;

    setDisplayScore(0);
    setDisplayLives(config.vidas);
    setDisplayTime(config.duracionSegundos);
    setComboText(null);
    setEarnedPrize(null);
    setIsBombGame(false);

    // Countdown 3..2..1
    setCountdownNum(3);
    setGameState('countdown');
    let n = 3;
    const tick = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(tick);
        gameStateRef.current = 'playing';
        setGameState('playing');
        setupCanvas();
        startGameLoop();
      } else {
        setCountdownNum(n);
      }
    }, 900);
  }, [config, setupCanvas, startGameLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Setup canvas when playing
  useEffect(() => {
    if (gameState === 'playing') {
      setupCanvas();
    }
  }, [gameState, setupCanvas]);

  // ── Computed prize info ──
  const bestPrize = earnedPrize;
  const nextPrize = config.premios.find(p => p.puntosMinimos > displayScore) ?? null;
  const timePercent = (displayTime / config.duracionSegundos) * 100;

  // ── Render ──
  return (
    <div className="corta-game-container">
      {/* ── CANVAS (always mounted, hidden when not playing) ── */}
      <div
        ref={wrapperRef}
        className="corta-canvas-wrapper"
        style={{ display: gameState === 'playing' || gameState === 'countdown' ? 'block' : 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="corta-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none', cursor: 'crosshair' }}
        />

        {/* HUD overlay */}
        {gameState === 'playing' && (
          <div className="corta-hud">
            <div className="corta-hud-left">
              <div className="corta-score-badge">⭐ {displayScore.toLocaleString()}</div>
              {nextPrize && (
                <div className="corta-next-prize">
                  {nextPrize.emoji} {nextPrize.puntosMinimos - displayScore} pts
                </div>
              )}
            </div>

            <div className="corta-hud-center">
              <div className="corta-timer-bar">
                <div className="corta-timer-fill" style={{
                  width: `${timePercent}%`,
                  background: timePercent < 25 ? '#ef4444' : timePercent < 50 ? '#f97316' : '#4ade80'
                }} />
              </div>
              <div className="corta-timer-label">
                <Clock size={12} /> {displayTime}s
              </div>
            </div>

            <div className="corta-hud-right">
              {Array.from({ length: config.vidas }).map((_, i) => (
                <span key={i} className={`corta-life-icon ${i < displayLives ? 'alive' : 'dead'}`}>❤️</span>
              ))}
            </div>
          </div>
        )}

        {/* Combo display */}
        {comboText && (
          <div className="corta-combo-display">
            <Zap size={24} className="corta-combo-zap" />
            COMBO {comboText}!
          </div>
        )}

        {/* Countdown overlay */}
        {gameState === 'countdown' && (
          <div className="corta-countdown-overlay">
            <div className="corta-countdown-num">{countdownNum}</div>
          </div>
        )}
      </div>

      {/* ── INTRO SCREEN ── */}
      {gameState === 'intro' && (
        <div className="corta-overlay corta-intro">
          <div className="corta-intro-emoji">✂️🎁</div>
          <h2 className="corta-title">{config.nombre}</h2>
          <p className="corta-subtitle">
            Desliza para cortar los regalos y acumula puntos. ¡Cuidado con las bombas!
          </p>

          <div className="corta-prizes-panel">
            <div className="corta-prizes-title">🏆 PREMIOS</div>
            {config.premios.map(p => (
              <div key={p.id} className="corta-prize-row">
                <span>{p.emoji} {p.nombre}</span>
                <span className="corta-prize-pts">{p.puntosMinimos.toLocaleString()} pts</span>
              </div>
            ))}
          </div>

          {highScore > 0 && (
            <div className="corta-highscore-badge">
              🏅 Mi récord: {highScore.toLocaleString()} pts
            </div>
          )}

          <button className="corta-btn-primary" onClick={() => setGameState('instructions')}>
            📖 Ver instrucciones
          </button>
          <button className="corta-btn-secondary" onClick={startGame}>
            <Play size={18} fill="white" /> ¡Jugar ahora!
          </button>
        </div>
      )}

      {/* ── INSTRUCTIONS SCREEN ── */}
      {gameState === 'instructions' && (
        <div className="corta-overlay corta-instructions">
          <div style={{ fontSize: '2.4rem' }}>📖</div>
          <h2 className="corta-title" style={{ fontSize: '1.4rem' }}>¿Cómo jugar?</h2>

          <div className="corta-steps-card">
            <div className="corta-step">
              <div className="corta-step-num">1</div>
              <div className="corta-step-text">
                <strong>Desliza el dedo</strong> (o el mouse) para cortar los objetos que salen volando.
              </div>
            </div>
            <div className="corta-step">
              <div className="corta-step-num">2</div>
              <div className="corta-step-text">
                <strong>Corta varios</strong> de un mismo movimiento para activar combos con multiplicadores.
              </div>
            </div>
            <div className="corta-step">
              <div className="corta-step-num">3</div>
              <div className="corta-step-text">
                <strong>¡Evita la 💣 bomba!</strong> Cortarla termina el juego inmediatamente.
              </div>
            </div>
            <div className="corta-step">
              <div className="corta-step-num">4</div>
              <div className="corta-step-text">
                La ⏰ alarma te quita una vida. El ❌ error te resta puntos.
              </div>
            </div>
          </div>

          <div className="corta-objects-preview">
            {config.objetos.map(o => (
              <span key={o.id} title={`${o.nombre} ${o.tipo === 'positivo' ? '+' + o.puntos : o.efectoNegativo === 'game_over' ? '💀' : o.tipo === 'negativo' ? '⚠️' : ''}`}
                className={`corta-obj-chip ${o.tipo}`}>
                {o.emoji}
              </span>
            ))}
          </div>

          <button className="corta-btn-primary" onClick={startGame}>
            <Play size={18} fill="white" /> ¡Entendido, a jugar!
          </button>
          <button className="corta-btn-ghost" onClick={() => setGameState('intro')}>
            <ArrowLeft size={16} /> Volver
          </button>
        </div>
      )}

      {/* ── GAME OVER SCREEN ── */}
      {gameState === 'gameover' && (
        <div className="corta-overlay corta-gameover">
          <div style={{ fontSize: '3.8rem' }}>{isBombGame ? '💣💥' : '⏱️🎮'}</div>
          <h2 className="corta-title">{isBombGame ? '¡BOOM! Cortaste la bomba' : '¡Tiempo terminado!'}</h2>

          <div className="corta-final-score">
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>TU PUNTAJE</div>
            <div style={{ fontSize: '2.6rem', fontWeight: 900, color: '#fff' }}>{displayScore.toLocaleString()}</div>
            {displayScore > highScore && <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 800 }}>🏅 ¡Nuevo récord personal!</div>}
          </div>

          {bestPrize ? (
            <div className="corta-won-prize">
              <div style={{ fontSize: '2.2rem' }}>{bestPrize.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: '1rem', color: '#fef08a' }}>🎉 ¡GANASTE: {bestPrize.nombre}!</div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                Premio aplicado automáticamente a tu carrito.
              </div>
            </div>
          ) : (
            <div className="corta-no-prize">
              <p>Necesitas <strong>{(config.premios[0]?.puntosMinimos ?? 300) - displayScore > 0
                ? (config.premios[0]?.puntosMinimos ?? 300) - displayScore
                : 0} pts más</strong> para ganar tu primer premio.</p>
              <p style={{ fontSize: '0.8rem' }}>¡El mínimo es {config.premios[0]?.puntosMinimos ?? 300} pts!</p>
            </div>
          )}

          <button className="corta-btn-primary" onClick={startGame}>
            🔄 Volver a intentar
          </button>
          <button className="corta-btn-secondary" onClick={onClose}>
            <Trophy size={16} /> Usar mi premio en el carrito
          </button>
          <button className="corta-btn-ghost" onClick={() => setGameState('intro')}>
            <ArrowLeft size={16} /> Menú principal
          </button>
        </div>
      )}
    </div>
  );
};

export default CortaRegalosGame;
