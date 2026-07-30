// ── CORTA LOS REGALOS ── Types & Default Config

export interface SliceableObjectConfig {
  id: string;
  emoji: string;
  nombre: string;
  puntos: number;
  probabilidad: number; // 0-100 weight
  tipo: 'positivo' | 'negativo';
  efectoNegativo?: 'quitar_vida' | 'restar_puntos' | 'game_over';
  puntosNegativo?: number;
  color: string; // particle burst color
}

export interface Premio {
  id: string;
  nombre: string;
  emoji: string;
  tipo: 'descuento' | 'envio_gratis' | 'producto_gratis' | 'cupon';
  valor: number;
  codigo?: string;
  puntosMinimos: number;
}

export interface GameConfig {
  nombre: string;
  duracionSegundos: number;
  vidas: number;
  velocidadInicial: number;
  incrementoDificultad: number;
  puntajeParaGanar: number;
  objetos: SliceableObjectConfig[];
  premios: Premio[];
  combosActivos: boolean;
  rankingActivo: boolean;
  cuponesActivos: boolean;
  colorFondo1: string;
  colorFondo2: string;
}

// ── Runtime objects (in-game state) ──

export interface FlyingObject {
  id: number;
  config: SliceableObjectConfig;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  sliced: boolean;
  fontSize: number;
  spawnedAt: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  life: number;
  maxLife: number;
}

export interface SlicedHalf {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  life: number;
  fontSize: number;
  flip: 1 | -1;
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export interface ScorePopup {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

// ── DEFAULT CONFIG ── (Indisutex theme)

export const DEFAULT_CONFIG: GameConfig = {
  nombre: 'Corta los Regalos',
  duracionSegundos: 60,
  vidas: 3,
  velocidadInicial: 1,
  incrementoDificultad: 0.12,
  puntajeParaGanar: 500,
  combosActivos: true,
  rankingActivo: true,
  cuponesActivos: true,
  colorFondo1: '#0f0c29',
  colorFondo2: '#24243e',
  objetos: [
    { id: 'regalo',   emoji: '🎁', nombre: 'Regalo',         puntos: 100, probabilidad: 28, tipo: 'positivo', color: '#ff6b6b' },
    { id: 'pijama',   emoji: '🌙', nombre: 'Pijama Premium',  puntos: 150, probabilidad: 22, tipo: 'positivo', color: '#a855f7' },
    { id: 'estrella', emoji: '⭐', nombre: 'Oferta Especial', puntos: 80,  probabilidad: 18, tipo: 'positivo', color: '#fbbf24' },
    { id: 'bolsa',    emoji: '🛍️', nombre: 'Compra',          puntos: 60,  probabilidad: 16, tipo: 'positivo', color: '#34d399' },
    { id: 'diamante', emoji: '💎', nombre: 'Diamante',        puntos: 300, probabilidad: 4,  tipo: 'positivo', color: '#60a5fa' },
    { id: 'corazon',  emoji: '❤️', nombre: 'Amor',            puntos: 120, probabilidad: 12, tipo: 'positivo', color: '#f43f5e' },
    { id: 'bomba',    emoji: '💣', nombre: 'Bomba',           puntos: 0,   probabilidad: 14, tipo: 'negativo', efectoNegativo: 'game_over',     color: '#0f172a' },
    { id: 'alarma',   emoji: '⏰', nombre: 'Alarma',          puntos: 0,   probabilidad: 8,  tipo: 'negativo', efectoNegativo: 'quitar_vida',   color: '#ef4444' },
    { id: 'virus',    emoji: '❌', nombre: 'Error',           puntos: 0,   probabilidad: 6,  tipo: 'negativo', efectoNegativo: 'restar_puntos', puntosNegativo: 50, color: '#f97316' },
  ],
  premios: [
    { id: 'p1', nombre: '5% de Descuento',  emoji: '🏷️', tipo: 'descuento',     valor: 5,  puntosMinimos: 300  },
    { id: 'p2', nombre: '10% de Descuento', emoji: '🎊', tipo: 'descuento',     valor: 10, puntosMinimos: 800  },
    { id: 'p3', nombre: 'Envío Gratis',     emoji: '🚚', tipo: 'envio_gratis',  valor: 0,  puntosMinimos: 1500 },
    { id: 'p4', nombre: '20% de Descuento', emoji: '👑', tipo: 'descuento',     valor: 20, puntosMinimos: 2500 },
  ],
};

// ── Helpers ──

export function weightedRandom(items: SliceableObjectConfig[]): SliceableObjectConfig {
  const total = items.reduce((s, i) => s + i.probabilidad, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.probabilidad;
    if (r <= 0) return item;
  }
  return items[0];
}

export function segmentCircleIntersect(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  radius: number
): boolean {
  const dx = bx - ax, dy = by - ay;
  const fx = ax - cx, fy = ay - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) {
    return (fx * fx + fy * fy) < radius * radius;
  }
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}
