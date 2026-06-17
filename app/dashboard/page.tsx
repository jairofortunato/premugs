import Image from "next/image";
import DashboardClient from "./DashboardClient";
import { csvToPayload, type SheetsPayload } from "@/lib/parseSheets";

export const revalidate = 60;

const SHEET_ID =
  process.env.SHEET_ID || "1teLW5gF4PnfTb0dTIIhjibGHBcC11_yJieaoXdnzPTk";
const SHEET_NAME = "Respostas do Formulário 1";

// Links exibidos no topo do painel.
const PLANILHA_URL =
  "https://docs.google.com/spreadsheets/d/1teLW5gF4PnfTb0dTIIhjibGHBcC11_yJieaoXdnzPTk/edit?usp=sharing";
// Preencha com a URL pública do formulário (Google Forms) para exibir o botão.
const FORMULARIO_URL = process.env.FORMULARIO_URL || "";

async function getData(): Promise<{ payload: SheetsPayload | null; erro: string | null }> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    SHEET_NAME
  )}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { "User-Agent": "Mozilla/5.0 (PREMUGS-Dashboard)" },
    });
    if (!res.ok) {
      return { payload: null, erro: `Falha ao buscar a planilha (HTTP ${res.status}).` };
    }
    const csv = await res.text();
    return { payload: csvToPayload(csv), erro: null };
  } catch (err) {
    return {
      payload: null,
      erro: err instanceof Error ? err.message : "Erro desconhecido ao buscar dados.",
    };
  }
}

export default async function DashboardPage() {
  const { payload, erro } = await getData();

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200">
            Avaliação Institucional
          </p>
          <h1 className="mt-2">
            <span className="inline-block rounded-lg bg-white px-4 py-3 shadow-sm">
              <Image
                src="/logo-premugs.svg"
                alt="PREMUGS Avalia — Secretaria Municipal de Saúde de Florianópolis"
                width={1400}
                height={360}
                priority
                className="h-14 w-auto sm:h-16"
              />
            </span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-blue-100">
            Programa de Residência Multiprofissional em Gestão em Saúde —
            resultados consolidados das respostas ao formulário.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={PLANILHA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-brand-blue shadow-sm transition-colors hover:bg-blue-50"
            >
              <span aria-hidden>📊</span>
              Planilha de respostas
              <span aria-hidden className="text-xs">↗</span>
            </a>
            {FORMULARIO_URL && (
              <a
                href={FORMULARIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-white/40 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <span aria-hidden>📝</span>
                Responder formulário
                <span aria-hidden className="text-xs">↗</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {erro || !payload ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
            <h2 className="font-semibold">Não foi possível carregar os dados</h2>
            <p className="mt-1 text-sm">{erro ?? "Resposta vazia da planilha."}</p>
            <p className="mt-3 text-xs text-red-600">
              Verifique se a planilha está pública e se o SHEET_ID está correto.
            </p>
          </div>
        ) : (
          <DashboardClient payload={payload} />
        )}
      </div>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-center text-xs text-gray-400 sm:px-6 lg:px-8">
        PREMUGS Avalia · Dados atualizados automaticamente a cada 60s.
      </footer>
    </main>
  );
}
