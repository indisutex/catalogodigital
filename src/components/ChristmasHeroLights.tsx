import React from 'react';
import './ChristmasHeroLights.css';

// Colores festivos de bombillos navideños
type BulbColor = 'red' | 'gold' | 'green' | 'blue' | 'pink' | 'white';

const BULB_COLORS: Record<BulbColor, string> = {
  red: '#ff2a4b',
  gold: '#ffbe0b',
  green: '#10b981',
  blue: '#38bdf8',
  pink: '#ec4899',
  white: '#fff875',
};

interface BulbProps {
  cx: number;
  cy: number;
  angle?: number;
  color: BulbColor;
  scale?: number;
  twinkleGroup?: number;
}

const XmasBulb: React.FC<BulbProps> = ({
  cx,
  cy,
  angle = 0,
  color,
  scale = 1,
  twinkleGroup = 0,
}) => {
  const colorHex = BULB_COLORS[color];

  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${angle}) scale(${scale})`}>
      {/* Casquillo / base del bombillo */}
      <rect x="-2" y="0" width="4" height="3" rx="0.8" className="xmas-socket" />

      {/* Bombillo con animación ultra liviana por compositor GPU */}
      <g className={`xmas-bulb xmas-twinkle-${twinkleGroup}`}>
        {/* Halo de luz suave (resplandor estático sin filtros pesados) */}
        <circle cx="0" cy="11" r="8" fill={colorHex} opacity="0.32" />

        {/* Cuerpo del bombillo en forma de gota navideña clásica */}
        <path
          d="M 0,2 C -3.2,4.8 -4.2,8.5 -3.2,12 C -2,15.5 0,18 0,18.5 C 0,18 2,15.5 3.2,12 C 4.2,8.5 3.2,4.8 0,2 Z"
          fill={colorHex}
        />

        {/* Reflejo de brillo cristalino */}
        <ellipse
          cx="-1"
          cy="7.5"
          rx="0.8"
          ry="2.2"
          transform="rotate(-15, -1, 7.5)"
          fill="#ffffff"
          opacity="0.75"
        />
      </g>
    </g>
  );
};

export const ChristmasHeroLights: React.FC = () => {
  return (
    <div className="christmas-hero-lights-container" aria-hidden="true">
      {/* ── 1. GUIRNALDA SUPERIOR (Ondas festivas ligeras que enmarcan la parte superior) ── */}
      <svg
        className="xmas-top-garland"
        viewBox="0 0 1000 50"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cable festivo único, limpio y estilizado */}
        <path
          d="M 0,8 Q 83,30 166,10 Q 250,30 333,10 Q 416,30 500,10 Q 583,30 666,10 Q 750,30 833,10 Q 916,30 1000,8"
          className="xmas-wire"
        />

        {/* 12 bombillos distribuidos armoniosamente a lo largo de las curvas */}
        {[
          { cx: 50, cy: 21, angle: -6, color: 'gold' as BulbColor, twinkleGroup: 0 },
          { cx: 116, cy: 21, angle: 6, color: 'red' as BulbColor, twinkleGroup: 1 },
          { cx: 215, cy: 21, angle: -6, color: 'green' as BulbColor, twinkleGroup: 2 },
          { cx: 285, cy: 21, angle: 6, color: 'blue' as BulbColor, twinkleGroup: 3 },
          { cx: 380, cy: 21, angle: -6, color: 'pink' as BulbColor, twinkleGroup: 0 },
          { cx: 450, cy: 21, angle: 6, color: 'gold' as BulbColor, twinkleGroup: 1 },
          { cx: 550, cy: 21, angle: -6, color: 'white' as BulbColor, twinkleGroup: 2 },
          { cx: 620, cy: 21, angle: 6, color: 'red' as BulbColor, twinkleGroup: 3 },
          { cx: 715, cy: 21, angle: -6, color: 'green' as BulbColor, twinkleGroup: 0 },
          { cx: 785, cy: 21, angle: 6, color: 'blue' as BulbColor, twinkleGroup: 1 },
          { cx: 880, cy: 21, angle: -6, color: 'pink' as BulbColor, twinkleGroup: 2 },
          { cx: 950, cy: 21, angle: 6, color: 'gold' as BulbColor, twinkleGroup: 3 },
        ].map((b, i) => (
          <XmasBulb
            key={`top-bulb-${i}`}
            cx={b.cx}
            cy={b.cy}
            angle={b.angle}
            color={b.color}
            twinkleGroup={b.twinkleGroup}
            scale={0.9}
          />
        ))}

        {/* Detalle sutil en esquinas superiores */}
        <g transform="translate(8, 8)">
          <path d="M 0,0 C -4,-6 -8,-3 -6,3 C -2,5 3,1 0,0 Z" fill="#15803d" />
          <circle cx="0" cy="2" r="2.2" fill="#ef4444" />
        </g>
        <g transform="translate(992, 8)">
          <path d="M 0,0 C 4,-6 8,-3 6,3 C 2,5 -3,1 0,0 Z" fill="#15803d" />
          <circle cx="0" cy="2" r="2.2" fill="#ef4444" />
        </g>
      </svg>

      {/* ── 2. GUIRNALDA LATERAL IZQUIERDA (Solo parte alta, termina bien arriba de la barra rosada) ── */}
      <svg
        className="xmas-left-garland"
        viewBox="0 0 35 180"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 10,0 Q 24,45 12,90 Q 24,135 15,180"
          className="xmas-wire"
        />
        {[
          { cx: 18, cy: 45, angle: 45, color: 'blue' as BulbColor, twinkleGroup: 1 },
          { cx: 13, cy: 95, angle: -40, color: 'red' as BulbColor, twinkleGroup: 3 },
          { cx: 19, cy: 145, angle: 40, color: 'green' as BulbColor, twinkleGroup: 0 },
        ].map((b, i) => (
          <XmasBulb
            key={`left-bulb-${i}`}
            cx={b.cx}
            cy={b.cy}
            angle={b.angle}
            color={b.color}
            twinkleGroup={b.twinkleGroup}
            scale={0.85}
          />
        ))}
      </svg>

      {/* ── 3. GUIRNALDA LATERAL DERECHA (Solo parte alta, termina bien arriba de la barra rosada) ── */}
      <svg
        className="xmas-right-garland"
        viewBox="0 0 35 180"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 25,0 Q 11,45 23,90 Q 11,135 20,180"
          className="xmas-wire"
        />
        {[
          { cx: 17, cy: 45, angle: -45, color: 'gold' as BulbColor, twinkleGroup: 2 },
          { cx: 22, cy: 95, angle: 40, color: 'pink' as BulbColor, twinkleGroup: 0 },
          { cx: 16, cy: 145, angle: -40, color: 'white' as BulbColor, twinkleGroup: 3 },
        ].map((b, i) => (
          <XmasBulb
            key={`right-bulb-${i}`}
            cx={b.cx}
            cy={b.cy}
            angle={b.angle}
            color={b.color}
            twinkleGroup={b.twinkleGroup}
            scale={0.85}
          />
        ))}
      </svg>
    </div>
  );
};
