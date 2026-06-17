"use client";

import { corPorScore } from "@/lib/parseSheets";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

// Arco de `startDeg` (maior) até `endDeg` (menor), sentido horário na tela.
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = Math.abs(startDeg - endDeg) > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

export default function GaugeChart({
  value,
  min = 1,
  max = 4,
  label,
  sub,
}: {
  value: number | null;
  min?: number;
  max?: number;
  label?: string;
  sub?: string;
}) {
  const cx = 100;
  const cy = 100;
  const r = 78;
  const has = value !== null && !Number.isNaN(value);
  const v = has ? Math.min(max, Math.max(min, value as number)) : min;
  const ang = (val: number) => 180 - ((val - min) / (max - min)) * 180;
  const angle = ang(v);
  const needle = polar(cx, cy, r - 16, angle);
  const cor = has ? corPorScore(v) : "#d1d5db";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[280px]">
        {/* segmentos coloridos */}
        <path
          d={arcPath(cx, cy, r, ang(min), ang(2))}
          stroke="#dc2626"
          strokeWidth="15"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={arcPath(cx, cy, r, ang(2), ang(3))}
          stroke="#d97706"
          strokeWidth="15"
          fill="none"
        />
        <path
          d={arcPath(cx, cy, r, ang(3), ang(max))}
          stroke="#057a55"
          strokeWidth="15"
          fill="none"
          strokeLinecap="round"
        />

        {/* marcas 2 e 3 */}
        {[2, 3].map((t) => {
          const p1 = polar(cx, cy, r + 8, ang(t));
          const p2 = polar(cx, cy, r - 8, ang(t));
          return (
            <line
              key={t}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#ffffff"
              strokeWidth="2"
            />
          );
        })}

        {/* ponteiro */}
        {has && (
          <>
            <line
              x1={cx}
              y1={cy}
              x2={needle.x}
              y2={needle.y}
              stroke="#374151"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r="6.5" fill="#374151" />
          </>
        )}

        {/* limites da escala */}
        <text x="16" y="112" fontSize="10" fill="#9ca3af">
          {min}
        </text>
        <text x="178" y="112" fontSize="10" fill="#9ca3af">
          {max}
        </text>
      </svg>

      <div className="-mt-2 text-center">
        <span
          className="text-4xl font-extrabold tabular-nums"
          style={{ color: cor }}
        >
          {has ? v.toFixed(1) : "—"}
        </span>
        <span className="text-sm text-gray-400"> / {max}.0</span>
      </div>
      {label && (
        <p className="mt-1 text-sm font-semibold text-gray-800">{label}</p>
      )}
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
