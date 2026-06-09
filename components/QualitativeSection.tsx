"use client";

import { useState } from "react";

export interface QualGroup {
  pergunta: string;
  itens: { papel: string; nome: string; texto: string }[];
}

const PAPEL_COR: Record<string, string> = {
  "Residente(a)": "bg-blue-50 text-blue-700",
  "Preceptor(a)": "bg-green-50 text-green-700",
  "Tutor(a)": "bg-amber-50 text-amber-700",
  "Coordenador(a)": "bg-purple-50 text-purple-700",
};

function CartaoPergunta({ grupo }: { grupo: QualGroup }) {
  const [verTodas, setVerTodas] = useState(false);
  const itens = verTodas ? grupo.itens : grupo.itens.slice(0, 5);

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-card">
      <h3 className="text-sm font-semibold text-gray-800">{grupo.pergunta}</h3>
      <p className="mt-0.5 text-xs text-gray-400">
        {grupo.itens.length}{" "}
        {grupo.itens.length === 1 ? "resposta" : "respostas"}
      </p>

      <ul className="mt-3 space-y-3">
        {itens.map((it, i) => (
          <li
            key={i}
            className="rounded-md border border-gray-100 bg-gray-50/60 p-3"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  PAPEL_COR[it.papel] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {it.papel}
              </span>
              <span className="text-[11px] text-gray-400">{it.nome}</span>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {it.texto}
            </p>
          </li>
        ))}
      </ul>

      {grupo.itens.length > 5 && (
        <button
          onClick={() => setVerTodas((v) => !v)}
          className="mt-3 text-xs font-medium text-brand-blue hover:underline"
        >
          {verTodas
            ? "Ver menos"
            : `Ver todas (${grupo.itens.length})`}
        </button>
      )}
    </div>
  );
}

export default function QualitativeSection({ grupos }: { grupos: QualGroup[] }) {
  if (grupos.length === 0) {
    return (
      <p className="rounded-lg border border-gray-100 bg-white p-5 text-sm text-gray-400 shadow-card">
        Nenhuma resposta qualitativa para o filtro selecionado.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {grupos.map((g) => (
        <CartaoPergunta key={g.pergunta} grupo={g} />
      ))}
    </div>
  );
}
