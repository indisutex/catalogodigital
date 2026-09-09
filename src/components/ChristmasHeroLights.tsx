import React from 'react';
import './ChristmasHeroLights.css';

// Colores festivos de bombillos navideños
type BulbColor = 'red' | 'gold' | 'green' | 'blue' | 'pink' | 'white';

interface BulbProps {
  cx: number;
  cy: number;
  angle?: number;
  color: BulbColor;
  scale?: number;
}

const XmasBulb: React.FC<BulbProps> = ({ cx, cy, angle = 0, color, scale = 1 }) => {
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${angle}) scale(${scale})`}>
      {/* Casquillo / base del bombillo */}
      <rect x="-2.5" y="0" width="5" height="4" rx="1" className="xmas-socket" />
      
      {/* Bombillo con forma de gota navideña clásica */}
      <g className={`xmas-bulb xmas-bulb-${color}`}>
        <path
          d="M 0,3 C -4.5,6 -6,11 -4.5,15 C -3,19 0,22 0,23 C 0,22 3,19 4.5,15 C 6,11 4.5,6 0,3 Z"
          fill={`url(#xmasGrad_${color})`}
        />
        {/* Reflejo de cristal blanco para darle efecto 3D brillante */}
        <ellipse cx="-1.5" cy="10" rx="1.2" ry="3.5" transform="rotate(-15, -1.5, 10)" fill="#ffffff" opacity="0.65" />
      </g>
    </g>
  );
};

export const ChristmasHeroLights: React.FC = () => {
  return (
    <div className="christmas-hero-lights-container" aria-hidden="true">
      {/* SVG con gradientes y filtros de resplandor */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {/* Gradientes para cada color de bombillo con centro brillante */}
          <radialGradient id="xmasGrad_red" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#ff4d6d" />
            <stop offset="85%" stopColor="#d90429" />
            <stop offset="100%" stopColor="#7a0014" />
          </radialGradient>

          <radialGradient id="xmasGrad_gold" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#fff3b0" />
            <stop offset="70%" stopColor="#ffb703" />
            <stop offset="100%" stopColor="#d48b00" />
          </radialGradient>

          <radialGradient id="xmasGrad_green" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#80ed99" />
            <stop offset="75%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#046c4e" />
          </radialGradient>

          <radialGradient id="xmasGrad_blue" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#a0c4ff" />
            <stop offset="75%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0369a1" />
          </radialGradient>

          <radialGradient id="xmasGrad_pink" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#fbcfe8" />
            <stop offset="70%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#9d174d" />
          </radialGradient>

          <radialGradient id="xmasGrad_white" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#fef08a" />
            <stop offset="80%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#eab308" />
          </radialGradient>
        </defs>
      </svg>

      {/* ── 1. GUIRNALDA SUPERIOR (Drapes a lo largo del borde superior) ── */}
      <svg
        className="xmas-top-garland"
        viewBox="0 0 1000 65"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ramitas de pino enredándose a lo largo del cable */}
        {[50, 150, 250, 350, 450, 550, 650, 750, 850, 950].map((px, idx) => (
          <g key={`pine-top-${idx}`} transform={`translate(${px}, ${15 + Math.sin(idx) * 6})`}>
            <line x1="-8" y1="-3" x2="-14" y2="7" className="xmas-pine-needle" />
            <line x1="8" y1="-3" x2="14" y2="7" className="xmas-pine-needle" />
            <line x1="-5" y1="2" x2="-11" y2="10" className="xmas-pine-needle-light" />
            <line x1="5" y1="2" x2="11" y2="10" className="xmas-pine-needle-light" />
            <circle cx="0" cy="1" r="2.2" fill="#dc2626" opacity="0.9" /> {/* Bayas rojas de acebo */}
          </g>
        ))}

        {/* Cable secundario enroscado / entrelazado ("se van enredando") */}
        <path
          d="M 0,12 Q 50,28 100,14 T 200,16 T 300,14 T 400,17 T 500,13 T 600,16 T 700,14 T 800,17 T 900,13 T 1000,15"
          className="xmas-wire-secondary"
        />

        {/* Cable principal en ondas elegantes */}
        <path
          d="M -10,8 Q 50,38 100,20 Q 150,42 200,22 Q 250,44 300,24 Q 350,43 400,21 Q 450,44 500,22 Q 550,42 600,23 Q 650,45 700,21 Q 750,43 800,23 Q 850,44 900,22 Q 950,40 1010,10"
          className="xmas-wire"
        />

        {/* Bombillos colgantes en las ondas del cable */}
        {[
          { cx: 30, cy: 22, angle: -6, color: 'gold' },
          { cx: 75, cy: 34, angle: 4, color: 'red' },
          { cx: 125, cy: 26, angle: -5, color: 'green' },
          { cx: 175, cy: 37, angle: 6, color: 'blue' },
          { cx: 225, cy: 28, angle: -7, color: 'pink' },
          { cx: 275, cy: 38, angle: 5, color: 'white' },
          { cx: 325, cy: 29, angle: -4, color: 'gold' },
          { cx: 375, cy: 37, angle: 6, color: 'red' },
          { cx: 425, cy: 28, angle: -6, color: 'green' },
          { cx: 475, cy: 38, angle: 5, color: 'blue' },
          { cx: 525, cy: 27, angle: -5, color: 'white' },
          { cx: 575, cy: 37, angle: 6, color: 'gold' },
          { cx: 625, cy: 28, angle: -7, color: 'pink' },
          { cx: 675, cy: 39, angle: 5, color: 'green' },
          { cx: 725, cy: 27, angle: -6, color: 'red' },
          { cx: 775, cy: 38, angle: 7, color: 'blue' },
          { cx: 825, cy: 29, angle: -5, color: 'gold' },
          { cx: 875, cy: 38, angle: 6, color: 'white' },
          { cx: 925, cy: 27, angle: -7, color: 'pink' },
          { cx: 970, cy: 22, angle: 5, color: 'green' }
        ].map((b, i) => (
          <XmasBulb
            key={`top-bulb-${i}`}
            cx={b.cx}
            cy={b.cy}
            angle={b.angle}
            color={b.color as BulbColor}
            scale={0.9}
          />
        ))}

        {/* Bayas y hojas en esquinas donde se unen los cables */}
        <g transform="translate(15, 12)">
          <path d="M 0,0 C -6,-8 -12,-4 -10,4 C -4,6 4,2 0,0 Z" fill="#15803d" />
          <path d="M 0,0 C 6,-8 12,-4 10,4 C 4,6 -4,2 0,0 Z" fill="#166534" />
          <circle cx="-2" cy="-1" r="3.2" fill="#ef4444" />
          <circle cx="3" cy="1" r="2.8" fill="#dc2626" />
          <circle cx="0" cy="4" r="2.5" fill="#b91c1c" />
        </g>
        <g transform="translate(985, 12)">
          <path d="M 0,0 C -6,-8 -12,-4 -10,4 C -4,6 4,2 0,0 Z" fill="#15803d" />
          <path d="M 0,0 C 6,-8 12,-4 10,4 C 4,6 -4,2 0,0 Z" fill="#166534" />
          <circle cx="-2" cy="-1" r="3.2" fill="#ef4444" />
          <circle cx="3" cy="1" r="2.8" fill="#dc2626" />
          <circle cx="0" cy="4" r="2.5" fill="#b91c1c" />
        </g>

        {/* Destellos mágicos en el borde */}
        <path d="M 200,10 L 202,15 L 207,17 L 202,19 L 200,24 L 198,19 L 193,17 L 198,15 Z" fill="#ffffff" className="xmas-sparkle" />
        <path d="M 600,12 L 602,16 L 606,18 L 602,20 L 600,24 L 598,20 L 594,18 L 598,16 Z" fill="#fff7b2" className="xmas-sparkle" style={{ animationDelay: '1.2s' }} />
        <path d="M 850,9 L 852,13 L 856,15 L 852,17 L 850,21 L 848,17 L 844,15 L 848,13 Z" fill="#ffffff" className="xmas-sparkle" style={{ animationDelay: '2.1s' }} />
      </svg>

      {/* ── 2. GUIRNALDA LATERAL IZQUIERDA (Se va enredando verticalmente) ── */}
      <svg
        className="xmas-left-garland"
        viewBox="0 0 50 400"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cable en espiral entrelazándose */}
        <path
          d="M 6,0 C 22,40 -2,80 18,120 C 34,160 2,200 16,240 C 32,280 4,320 18,360 C 26,385 10,400 12,410"
          className="xmas-wire"
        />
        <path
          d="M 12,0 C -4,35 24,75 8,115 C -4,155 24,195 9,235 C -5,275 22,315 8,355"
          className="xmas-wire-secondary"
        />

        {/* Hojas de pino y bayas en los lazos */}
        {[60, 140, 220, 300, 380].map((py, idx) => (
          <g key={`pine-left-${idx}`} transform={`translate(14, ${py})`}>
            <line x1="-3" y1="-6" x2="8" y2="-10" className="xmas-pine-needle" />
            <line x1="-3" y1="6" x2="8" y2="10" className="xmas-pine-needle" />
            <line x1="2" y1="-2" x2="10" y2="-4" className="xmas-pine-needle-light" />
            <circle cx="2" cy="0" r="2.2" fill="#ef4444" opacity="0.9" />
          </g>
        ))}

        {/* Bombillos enredados en el lateral izquierdo */}
        {[
          { cx: 18, cy: 35, angle: 65, color: 'gold' },
          { cx: 12, cy: 95, angle: -60, color: 'red' },
          { cx: 20, cy: 160, angle: 70, color: 'green' },
          { cx: 10, cy: 220, angle: -65, color: 'blue' },
          { cx: 22, cy: 280, angle: 60, color: 'pink' },
          { cx: 14, cy: 345, angle: -55, color: 'white' },
          { cx: 20, cy: 390, angle: 45, color: 'gold' }
        ].map((b, i) => (
          <XmasBulb
            key={`left-bulb-${i}`}
            cx={b.cx}
            cy={b.cy}
            angle={b.angle}
            color={b.color as BulbColor}
            scale={0.85}
          />
        ))}
      </svg>

      {/* ── 3. GUIRNALDA LATERAL DERECHA (Se va enredando verticalmente) ── */}
      <svg
        className="xmas-right-garland"
        viewBox="0 0 50 400"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cable en espiral entrelazándose al lado derecho */}
        <path
          d="M 44,0 C 28,40 52,80 32,120 C 16,160 48,200 34,240 C 18,280 46,320 32,360 C 24,385 40,400 38,410"
          className="xmas-wire"
        />
        <path
          d="M 38,0 C 54,35 26,75 42,115 C 54,155 26,195 41,235 C 55,275 28,315 42,355"
          className="xmas-wire-secondary"
        />

        {/* Hojas de pino y bayas */}
        {[60, 140, 220, 300, 380].map((py, idx) => (
          <g key={`pine-right-${idx}`} transform={`translate(36, ${py})`}>
            <line x1="3" y1="-6" x2="-8" y2="-10" className="xmas-pine-needle" />
            <line x1="3" y1="6" x2="-8" y2="10" className="xmas-pine-needle" />
            <line x1="-2" y1="-2" x2="-10" y2="-4" className="xmas-pine-needle-light" />
            <circle cx="-2" cy="0" r="2.2" fill="#ef4444" opacity="0.9" />
          </g>
        ))}

        {/* Bombillos enredados en el lateral derecho */}
        {[
          { cx: 32, cy: 35, angle: -65, color: 'blue' },
          { cx: 38, cy: 95, angle: 60, color: 'pink' },
          { cx: 30, cy: 160, angle: -70, color: 'gold' },
          { cx: 40, cy: 220, angle: 65, color: 'green' },
          { cx: 28, cy: 280, angle: -60, color: 'red' },
          { cx: 36, cy: 345, angle: 55, color: 'white' },
          { cx: 30, cy: 390, angle: -45, color: 'blue' }
        ].map((b, i) => (
          <XmasBulb
            key={`right-bulb-${i}`}
            cx={b.cx}
            cy={b.cy}
            angle={b.angle}
            color={b.color as BulbColor}
            scale={0.85}
          />
        ))}
      </svg>

      {/* ── 4. GUIRNALDA INFERIOR (Enmarca suavemente la base del hero) ── */}
      <svg
        className="xmas-bottom-garland"
        viewBox="0 0 1000 50"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cable curvo en las esquinas inferiores envolviendo hacia el centro */}
        <path
          d="M 0,35 Q 120,46 240,25 Q 360,8 440,15"
          className="xmas-wire"
        />
        <path
          d="M 1000,35 Q 880,46 760,25 Q 640,8 560,15"
          className="xmas-wire"
        />

        {/* Pequeños bombillos en la base */}
        {[
          { cx: 60, cy: 32, angle: -15, color: 'red' },
          { cx: 150, cy: 38, angle: 10, color: 'gold' },
          { cx: 240, cy: 25, angle: -12, color: 'green' },
          { cx: 330, cy: 16, angle: 8, color: 'blue' },
          { cx: 670, cy: 16, angle: -8, color: 'blue' },
          { cx: 760, cy: 25, angle: 12, color: 'pink' },
          { cx: 850, cy: 38, angle: -10, color: 'white' },
          { cx: 940, cy: 32, angle: 15, color: 'gold' }
        ].map((b, i) => (
          <XmasBulb
            key={`bottom-bulb-${i}`}
            cx={b.cx}
            cy={b.cy}
            angle={b.angle}
            color={b.color as BulbColor}
            scale={0.8}
          />
        ))}
      </svg>
    </div>
  );
};
