import { NextResponse } from "next/server";
import { csvToPayload } from "@/lib/parseSheets";

const SHEET_ID =
  process.env.SHEET_ID || "1teLW5gF4PnfTb0dTIIhjibGHBcC11_yJieaoXdnzPTk";
const SHEET_NAME = "Respostas do Formulário 1";

function csvUrl() {
  const sheet = encodeURIComponent(SHEET_NAME);
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheet}`;
}

export async function GET() {
  try {
    const res = await fetch(csvUrl(), {
      next: { revalidate: 60 },
      headers: { "User-Agent": "Mozilla/5.0 (PREMUGS-Dashboard)" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Falha ao buscar a planilha (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    const csv = await res.text();
    const payload = csvToPayload(csv);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Erro ao processar a planilha",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
