"use client";

import { corPorScore, type Dimensao } from "@/lib/parseSheets";

export interface DimScore {
  dimensao: Dimensao;
  media: number | null;
  n: number;
}

const DESCRICOES: Record<string, string> = {
  Pedagógica: "Teoria/prática, competências e atividades formativas",
  "Relações interpessoais":
    "Preceptores, tutores e integração multiprofissional",
  Feedback: "Frequência e contribuição dos feedbacks",
  "Comunicação e cultura organizacional":
    "Informações, cronograma e abertura ao diálogo",
  Governança: "Transparência, uso de evidências e participação",
  "Resultados e sustentabilidade":
    "Impacto no serviço, continuidade e recursos",
};

function Barra({ score }: { score: number }) {
  const pct = (score / 4) * 100;
  const cor = corPorScore(score);
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: cor }}
      />
    </div>
  );
}

export default function DimensionChart({ scores }: { scores: DimScore[] }) {
  return (
    <div className="space-y-5">
      {scores.map(({ dimensao, media, n }) => (
        <div key={dimensao}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">
                {dimensao}
              </p>
              <p className="truncate text-xs text-gray-400">
                {DESCRICOES[dimensao]}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {media !== null ? (
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: corPorScore(media) }}
                >
                  {media.toFixed(1)}
                  <span className="text-gray-400">/4.0</span>
                </span>
              ) : (
                <span className="text-sm text-gray-300">sem dados</span>
              )}
            </div>
          </div>
          {media !== null ? (
            <Barra score={media} />
          ) : (
            <div className="h-3 w-full rounded-full bg-gray-50" />
          )}
          <p className="mt-1 text-right text-[10px] text-gray-300">
            {n} {n === 1 ? "resposta" : "respostas"} quantitativas
          </p>
        </div>
      ))}
      <div className="flex flex-wrap gap-4 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" /> &lt; 2 crítico
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d97706]" /> 2–3 atenção
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#057a55]" /> &gt; 3 bom
        </span>
      </div>
    </div>
  );
}
