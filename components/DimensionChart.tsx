"use client";

import { useState } from "react";
import {
  corPorScore,
  agruparPorIndicador,
  type Dimensao,
  type IndicadorScore,
} from "@/lib/parseSheets";

export interface DimScore {
  dimensao: Dimensao;
  media: number | null;
  n: number;
}

const DESCRICOES: Record<string, string> = {
  Pedagógica: "Teoria/prática, competências e atividades formativas",
  Relacional:
    "Preceptores, tutores, feedback e integração multiprofissional",
  Organizacional:
    "Comunicação, informações, cronograma e cultura organizacional",
  Governança: "Transparência, uso de evidências e participação",
  Sustentabilidade: "Impacto no serviço, continuidade e recursos",
};

function Barra({ score, fina }: { score: number; fina?: boolean }) {
  const pct = (score / 4) * 100;
  const cor = corPorScore(score);
  return (
    <div
      className={`${fina ? "h-1.5" : "h-3"} w-full overflow-hidden rounded-full bg-gray-100`}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: cor }}
      />
    </div>
  );
}

function Pergunta({ ind }: { ind: IndicadorScore }) {
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-xs leading-snug text-gray-600">
          {ind.pergunta}
        </p>
        <span
          className="shrink-0 text-xs font-bold tabular-nums"
          style={{ color: corPorScore(ind.media) }}
        >
          {ind.media.toFixed(1)}
          <span className="font-normal text-gray-400">/4.0 · {ind.n}</span>
        </span>
      </div>
      <Barra score={ind.media} fina />
    </li>
  );
}

function Indicadores({
  itens,
  dimensao,
}: {
  itens: IndicadorScore[];
  dimensao: Dimensao;
}) {
  if (itens.length === 0) {
    return (
      <p className="mt-2 rounded-md bg-gray-50 p-3 text-xs text-gray-400">
        Nenhum indicador quantitativo para o filtro selecionado.
      </p>
    );
  }
  const grupos = agruparPorIndicador(itens, dimensao);
  return (
    <div className="mt-2 space-y-3 rounded-md border border-gray-100 bg-gray-50/60 p-3">
      {grupos.map((g) => (
        <div
          key={g.indicador ?? "sem-indicador"}
          className="rounded-md border border-gray-100 bg-white p-3"
        >
          {/* cabeçalho do índice */}
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <p className="min-w-0 text-xs font-bold text-brand-blue">
              {g.indicador ?? "Outras perguntas"}
              <span className="ml-1 font-normal text-gray-400">
                · {g.itens.length}{" "}
                {g.itens.length === 1 ? "pergunta" : "perguntas"}
              </span>
            </p>
            {g.media !== null && (
              <span
                className="shrink-0 text-xs font-bold tabular-nums"
                style={{ color: corPorScore(g.media) }}
              >
                {g.media.toFixed(1)}
                <span className="font-normal text-gray-400">/4.0 · {g.n}</span>
              </span>
            )}
          </div>
          {/* perguntas do índice */}
          <ul className="space-y-3 border-l-2 border-gray-100 pl-3">
            {g.itens.map((ind) => (
              <Pergunta key={ind.pergunta} ind={ind} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function DimensionChart({
  scores,
  indicadores,
}: {
  scores: DimScore[];
  indicadores: Record<Dimensao, IndicadorScore[]>;
}) {
  const [aberta, setAberta] = useState<Dimensao | null>(null);

  return (
    <div className="space-y-5">
      {scores.map(({ dimensao, media, n }) => {
        const expandida = aberta === dimensao;
        return (
          <div key={dimensao}>
            <button
              onClick={() => setAberta(expandida ? null : dimensao)}
              className="block w-full rounded-md text-left hover:bg-gray-50"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    <span
                      className={`mr-1 inline-block text-[10px] text-gray-400 transition-transform ${
                        expandida ? "rotate-90" : ""
                      }`}
                    >
                      ▶
                    </span>
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
                {n} {n === 1 ? "resposta" : "respostas"} quantitativas ·{" "}
                {expandida ? "ocultar indicadores" : "ver indicadores"}
              </p>
            </button>
            {expandida && (
              <Indicadores
                itens={indicadores[dimensao] ?? []}
                dimensao={dimensao}
              />
            )}
          </div>
        );
      })}
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
