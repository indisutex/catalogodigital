import React from 'react';
import './ChristmasLogoWreath.css';

// Colores de bombillos para la corona del logo
type WreathBulbColor = 'gold' | 'red' | 'green' | 'blue' | 'pink' | 'white';

const WREATH_BULB_COLORS: Record<WreathBulbColor, string> = {
  gold: '#ffbe0b',
  red: '#ff2a4b',
  green: '#10b981',
  blue: '#38bdf8',
  pink: '#ec4899',
  white: '#fff875',
};

// 8 bombillos distribuidos uniformemente alrededor del círculo (Radio = 41)
const WREATH_BULBS: Array<{
  angleDeg: number;
  color: WreathBulbColor;
  twinkleGroup: number;
}> = [
  { angleDeg: 22.5, color: 'gold', twinkleGroup: 0 },
  { angleDeg: 67.5, color: 'red', twinkleGroup: 1 },
  { angleDeg: 112.5, color: 'green', twinkleGroup: 2 },
  { angleDeg: 157.5, color: 'blue', twinkleGroup: 3 },
  { angleDeg: 202.5, color: 'pink', twinkleGroup: 0 },
  { angleDeg: 247.5, color: 'gold', twinkleGroup: 1 },
  { angleDeg: 292.5, color: 'red', twinkleGroup: 2 },
  { angleDeg: 337.5, color: 'blue', twinkleGroup: 3 },
];

// 8 acentos de pino y bayas entre cada bombillo
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
          <filter id="wreathGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#064e3b" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* ── 1. GUIRNALDA BASE VERDE PINO ── */}
        {/* Cable principal de soporte */}
        <circle
          cx={center}
          cy={center}
          r={R}
          className="wreath-wire-main"
          filter="url(#wreathGlow)"
        />

        {/* Cable secundario entrelazado estilo corona festiva */}
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
          const rot = deg;

          return (
            <g
              key={`pine-${idx}`}
              transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)}) rotate(${rot})`}
            >
              {/* Hojas de pino orientadas a lo largo de la circunferencia */}
              <line x1="-5" y1="-1" x2="5" y2="1" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="-3" y1="2" x2="4" y2="-1" stroke="#22c55e" strokeWidth="1.1" strokeLinecap="round" />
              {/* Bayas rojas navideñas */}
              <circle cx="-1" cy="0" r="1.6" fill="#ef4444" />
              <circle cx="1.5" cy="1" r="1.3" fill="#dc2626" />
            </g>
          );
        })}

        {/* ── 3. BOMBILLOS CON LUZ ALUMBRANDO (GPU ACCELERATED) ── */}
        {WREATH_BULBS.map((bulb, idx) => {
          const rad = (bulb.angleDeg * Math.PI) / 180;
          const x = center + R * Math.sin(rad);
          const y = center - R * Math.cos(rad);
          const rot = bulb.angleDeg - 180; // Apunta hacia afuera del logo
          const colorHex = WREATH_BULB_COLORS[bulb.color];

          return (
            <g
              key={`wreath-bulb-${idx}`}
              transform={`translate(${x.toFixed(2)}, ${y.toFixed(2)}) rotate(${rot})`}
            >
              {/* Casquillo verde oscuro sobre el cable */}
              <rect x="-1.5" y="0" width="3" height="2.2" rx="0.5" fill="#064e3b" />

              {/* Bombillo con titileo ultra fluido */}
              <g className={`wreath-bulb wreath-twinkle-${bulb.twinkleGroup}`}>
                {/* Halo de luz suave circular */}
                <circle cx="0" cy="7" r="6" fill={colorHex} opacity="0.35" />

                {/* Bombillito gota de navidad */}
                <path
                  d="M 0,1.5 C -2.4,3.6 -3.2,6.5 -2.4,9 C -1.5,11.5 0,13.5 0,14 C 0,13.5 1.5,11.5 2.4,9 C 3.2,6.5 2.4,3.6 0,1.5 Z"
                  fill={colorHex}
                />

                {/* Brillo de cristal */}
                <ellipse
                  cx="-0.8"
                  cy="5.5"
                  rx="0.6"
                  ry="1.6"
                  transform="rotate(-15, -0.8, 5.5)"
                  fill="#ffffff"
                  opacity="0.8"
                />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
