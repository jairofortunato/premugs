import Image from "next/image";
import DashboardClient from "./DashboardClient";
import { csvToPayload, type SheetsPayload } from "@/lib/parseSheets";

export const revalidate = 60;

const SHEET_ID =
  process.env.SHEET_ID || "1teLW5gF4PnfTb0dTIIhjibGHBcC11_yJieaoXdnzPTk";
const SHEET_NAME = "Respostas do Formulário 1";

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
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <Image
            src="/logo-premugs.svg"
            alt="PREMUGS Avalia — Secretaria Municipal de Saúde de Florianópolis"
            width={1400}
            height={360}
            priority
            className="h-16 w-auto sm:h-20"
          />
        </div>
      </div>

      <header className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-200">
            Avaliação Institucional
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            PREMUGS Avalia
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-blue-100">
            Programa de Residência Multiprofissional em Gestão em Saúde —
            resultados consolidados das respostas ao formulário.
          </p>
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
