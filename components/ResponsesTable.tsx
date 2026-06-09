"use client";

import { Fragment, useMemo, useState } from "react";
import type { Resposta } from "@/lib/parseSheets";

const PAGE_SIZE = 10;

const PAPEL_COR: Record<string, string> = {
  "Residente(a)": "bg-blue-50 text-blue-700",
  "Preceptor(a)": "bg-green-50 text-green-700",
  "Tutor(a)": "bg-amber-50 text-amber-700",
  "Coordenador(a)": "bg-purple-50 text-purple-700",
};

function LinhaDetalhe({ r }: { r: Resposta }) {
  return (
    <tr className="bg-gray-50/70">
      <td colSpan={5} className="px-4 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {r.quantitativas.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Respostas quantitativas
              </h4>
              <ul className="space-y-1.5">
                {r.quantitativas.map((q, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-gray-600">{q.pergunta}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                      {q.valor}/4
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.qualitativas.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Respostas qualitativas
              </h4>
              <ul className="space-y-2">
                {r.qualitativas.map((q, i) => (
                  <li key={i} className="text-sm">
                    <p className="text-xs font-medium text-gray-500">{q.pergunta}</p>
                    <p className="whitespace-pre-line text-gray-700">{q.valor}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ResponsesTable({ respostas }: { respostas: Resposta[] }) {
  const [page, setPage] = useState(0);
  const [aberta, setAberta] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(respostas.length / PAGE_SIZE));
  // clampa a página caso um filtro reduza a lista (sem setState durante render)
  const safePage = Math.min(page, totalPages - 1);
  const pagina = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return respostas.slice(start, start + PAGE_SIZE);
  }, [respostas, safePage]);

  if (respostas.length === 0) {
    return (
      <p className="rounded-lg border border-gray-100 bg-white p-5 text-sm text-gray-400 shadow-card">
        Nenhuma resposta para o filtro selecionado.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Data/hora</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Ano/ciclo</th>
              <th className="px-4 py-3 text-right">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagina.map((r, idx) => {
              const globalIdx = safePage * PAGE_SIZE + idx;
              const aberto = aberta === globalIdx;
              return (
                <Fragment key={globalIdx}>
                  <tr
                    onClick={() => setAberta(aberto ? null : globalIdx)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-600">
                      {r.timestamp || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          PAPEL_COR[r.papel] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {r.papel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{r.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{r.ano}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-medium text-brand-blue">
                        {aberto ? "Fechar ▲" : "Ver ▼"}
                      </span>
                    </td>
                  </tr>
                  {aberto && <LinhaDetalhe r={r} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
        <p className="text-gray-500">
          {respostas.length}{" "}
          {respostas.length === 1 ? "resposta" : "respostas"} · página{" "}
          {safePage + 1} de {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPage(Math.max(0, safePage - 1));
              setAberta(null);
            }}
            disabled={safePage === 0}
            className="rounded-md border border-gray-200 px-3 py-1 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            Anterior
          </button>
          <button
            onClick={() => {
              setPage(Math.min(totalPages - 1, safePage + 1));
              setAberta(null);
            }}
            disabled={safePage >= totalPages - 1}
            className="rounded-md border border-gray-200 px-3 py-1 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
