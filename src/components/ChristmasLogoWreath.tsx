import React from 'react';
import './ChristmasLogoWreath.css';

// Colores festivos de bombillos para la corona del logo
type WreathBulbColor = 'gold' | 'red' | 'green' | 'blue' | 'pink' | 'white';

interface BulbConfig {
  angleDeg: number;
  color: WreathBulbColor;
  twinkleGroup: number;
}

// 8 bombillos distribuidos uniformemente alrededor del círculo (Radio = 41)
const WREATH_BULBS: BulbConfig[] = [
  { angleDeg: 22.5, color: 'gold', twinkleGroup: 0 },
  { angleDeg: 67.5, color: 'red', twinkleGroup: 1 },
  { angleDeg: 112.5, color: 'green', twinkleGroup: 2 },
  { angleDeg: 157.5, color: 'blue', twinkleGroup: 3 },
  { angleDeg: 202.5, color: 'pink', twinkleGroup: 0 },
  { angleDeg: 247.5, color: 'gold', twinkleGroup: 1 },
  { angleDeg: 292.5, color: 'red', twinkleGroup: 2 },
  { angleDeg: 337.5, color: 'blue', twinkleGroup: 3 },
];

// 8 racimos de pino y bayas entre cada bombillo
const PINE_ACCENTS = [0, 45, 90, 135, 180, 225, 270, 315];

export const ChristmasLogoWreath: React.FC = () => {
  const R = 41; // Radio del cable alrededor del logo
  const center = 50; // Centro en viewBox 0 0 100 100

  return (
    <div className="christmas-logo-wreath" aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        className="wreath-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradientes radiales vivos con centro incandescente para efecto de bombillo encendido */}
          <radialGradient id="wreathGrad_gold" cx="40%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#ffe600" />
            <stop offset="85%" stopColor="#ff9900" />
            <stop offset="100%" stopColor="#cc6600" />
          </radialGradient>

          <radialGradient id="wreathGrad_red" cx="40%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#ff3366" />
            <stop offset="85%" stopColor="#e60026" />
            <stop offset="100%" stopColor="#990014" />
          </radialGradient>

          <radialGradient id="wreathGrad_green" cx="40%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#33ff88" />
            <stop offset="85%" stopColor="#00cc55" />
            <stop offset="100%" stopColor="#00772e" />
          </radialGradient>

          <radialGradient id="wreathGrad_blue" cx="40%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#66e0ff" />
            <stop offset="85%" stopColor="#00b4d8" />
            <stop offset="100%" stopColor="#006699" />
          </radialGradient>

          <radialGradient id="wreathGrad_pink" cx="40%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#ff66b2" />
            <stop offset="85%" stopColor="#ff1493" />
            <stop offset="100%" stopColor="#b30059" />
          </radialGradient>

          <radialGradient id="wreathGrad_white" cx="40%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#fff7a0" />
            <stop offset="85%" stopColor="#ffdd44" />
            <stop offset="100%" stopColor="#e6a800" />
          </radialGradient>

          {/* Sombra suave de soporte para la guirnalda */}
          <filter id="wreathPineShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#042f1a" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* ── 1. GUIRNALDA CIRCULAR VERDE PINO ── */}
        <circle
          cx={center}
          cy={center}
          r={R}
          className="wreath-wire-main"
          filter="url(#wreathPineShadow)"
        />

        <circle
          cx={center}
          cy={center}
          r={R}
          className="wreath-wire-accent"
        />

        {/* ── 2. RAMITAS DE PINO Y BAYAS DE ACEBO ── */}
        {PINE_ACCENTS.map((deg, idx) => {
          const rad = (deg * Math.PI) / 180;
          const x = center + R * Math.sin(rad);
          const y = center - R * Math.cos(rad);

          return (
            <g
              key={`pine-${idx}`}
              transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)}) rotate(${deg})`}
            >
              <line x1="-5" y1="-1" x2="5" y2="1" stroke="#166534" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="-3" y1="2" x2="4" y2="-1" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="-1" cy="0" r="1.7" fill="#ef4444" />
              <circle cx="1.5" cy="1.2" r="1.4" fill="#dc2626" />
            </g>
          );
        })}

        {/* ── 3. BOMBILLOS ALUMBRANDO BRILLANTEMENTE (60FPS GPU) ── */}
        {WREATH_BULBS.map((bulb, idx) => {
          const rad = (bulb.angleDeg * Math.PI) / 180;
          const x = center + R * Math.sin(rad);
          const y = center - R * Math.cos(rad);
          const rot = bulb.angleDeg - 180; // Apunta hacia afuera del logo

          return (
            <g
              key={`wreath-bulb-${idx}`}
              transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)}) rotate(${rot})`}
            >
              {/* Casquillo verde oscuro */}
              <rect x="-1.8" y="0" width="3.6" height="2.4" rx="0.6" fill="#04381a" />

              {/* Bombillo titilando con alumbrado vivo */}
              <g className={`wreath-bulb wreath-bulb-${bulb.color} wreath-twinkle-${bulb.twinkleGroup}`}>
                {/* Halo de luz difusa ambiental (alumbrado exterior) */}
                <circle cx="0" cy="7.5" r="9.5" className={`wreath-halo-${bulb.color}`} />

                {/* Halo de luz intensa cercano */}
                <circle cx="0" cy="7.5" r="6" className={`wreath-halo-intense-${bulb.color}`} />

                {/* Cuerpo del bombillo con gradiente incandescente */}
                <path
                  d="M 0,1.8 C -2.8,4.2 -3.6,7.5 -2.8,10.5 C -1.8,13.2 0,15.2 0,15.8 C 0,15.2 1.8,13.2 2.8,10.5 C 3.6,7.5 2.8,4.2 0,1.8 Z"
                  fill={`url(#wreathGrad_${bulb.color})`}
                />

                {/* Reflejo de cristal brillante */}
                <ellipse
                  cx="-1"
                  cy="6.5"
                  rx="0.75"
                  ry="2.2"
                  transform="rotate(-15, -1, 6.5)"
                  fill="#ffffff"
                  opacity="0.9"
                />

                {/* Núcleo de filamento incandescente blanco en la punta */}
                <circle cx="0" cy="9" r="1.3" fill="#ffffff" opacity="0.9" />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
