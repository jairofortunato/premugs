import Image from "next/image";
import DashboardClient from "./DashboardClient";
import { csvToPayload, type SheetsPayload } from "@/lib/parseSheets";

export const revalidate = 60;

const SHEET_ID =
  process.env.SHEET_ID || "1teLW5gF4PnfTb0dTIIhjibGHBcC11_yJieaoXdnzPTk";
const SHEET_NAME = "Respostas do Formulário 1";

// Link do formulário (Google Forms) exibido no topo do painel.
const FORMULARIO_URL =
  process.env.FORMULARIO_URL || "https://forms.gle/1XRJrt14KaM5Qq6T7";

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
      <header className="relative overflow-hidden bg-gradient-to-br from-brand-blue via-brand-blue to-[#0f3aa8] text-white">
        {/* brilho decorativo sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-50 ring-1 ring-inset ring-white/20">
                Avaliação Institucional
              </span>
              <h1 className="mt-4">
                <span className="inline-flex rounded-xl bg-white px-5 py-3 shadow-lg ring-1 ring-black/5">
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
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-blue-100">
                Programa de Residência Multiprofissional em Gestão em Saúde —
                resultados consolidados das respostas ao formulário.
              </p>
            </div>

            {FORMULARIO_URL && (
              <a
                href={FORMULARIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-blue shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-lg sm:self-auto"
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
