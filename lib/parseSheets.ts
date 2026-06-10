// ---------------------------------------------------------------------------
// PREMUGS Avalia — parsing e agregação dos dados da planilha do Google Forms
// ---------------------------------------------------------------------------
// A planilha é um formulário multi-perfil: a coluna B ("papel") determina em
// qual bloco de colunas a pessoa respondeu. Os demais blocos ficam vazios para
// aquela linha. Por isso o parsing é *data-driven*: para cada respondente
// olhamos apenas as células não-vazias, em vez de assumir índices fixos de
// coluna (que mudam conforme o formulário evolui).
// ---------------------------------------------------------------------------

export const PAPEIS = [
  "Residente(a)",
  "Preceptor(a)",
  "Tutor(a)",
  "Coordenador(a)",
] as const;

export type Papel = (typeof PAPEIS)[number];

export const DIMENSOES = [
  "Pedagógica",
  "Relacional",
  "Organizacional",
  "Governança",
  "Sustentabilidade",
] as const;

export type Dimensao = (typeof DIMENSOES)[number];

// Uma resposta individual (uma linha da planilha) já normalizada.
export interface Resposta {
  raw: Record<string, string>; // todas as colunas (cabeçalho -> valor)
  papel: string; // papel normalizado
  papelRaw: string; // papel como veio na planilha
  nome: string; // "Anônimo" quando em branco
  ano: string; // ano/ciclo avaliado
  timestamp: string; // carimbo de data/hora
  // respostas válidas (não-vazias) deste respondente, já classificadas:
  quantitativas: { pergunta: string; valor: number; dimensao: Dimensao | null }[];
  qualitativas: { pergunta: string; valor: string }[];
}

export interface SheetsPayload {
  total: number;
  porPapel: Record<string, number>;
  respostas: Record<string, string>[];
  // cabeçalho na ordem original (com nomes repetidos entre blocos). Necessário
  // porque o objeto `respostas` deduplica nomes de coluna iguais — perderíamos
  // a ordem usada para classificar as colunas "Quantitativa 0X" por contexto.
  header: string[];
}

// ---------------------------------------------------------------------------
// 1) Parser de CSV — respeita campos entre aspas com vírgulas E quebras de linha
// ---------------------------------------------------------------------------
export function parseCSV(text: string): string[][] {
  // Remove BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // aspas escapadas ""
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // último campo/linha (se houver conteúdo pendente)
  if (field.length > 0 || row.length > 0) pushRow();

  return rows;
}

// ---------------------------------------------------------------------------
// 2) Normalização de texto e papéis
// ---------------------------------------------------------------------------
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Mapeia as variações que aparecem na planilha real para os rótulos canônicos.
export function normalizePapel(raw: string): string {
  const n = norm(raw);
  if (n.startsWith("residente")) return "Residente(a)";
  if (n.startsWith("preceptor")) return "Preceptor(a)";
  if (n.startsWith("tutor")) return "Tutor(a)";
  if (n.startsWith("coorden")) return "Coordenador(a)";
  return raw.trim() || "Não informado";
}

// ---------------------------------------------------------------------------
// 3) Classificação de colunas
// ---------------------------------------------------------------------------
// Cabeçalhos que são metadados (não são perguntas avaliativas).
function isMeta(header: string): boolean {
  const h = norm(header);
  return (
    h.startsWith("carimbo") ||
    h.startsWith("qual e o seu papel") ||
    h.startsWith("nome") ||
    h.startsWith("ano/") ||
    h.startsWith("ano ") ||
    h.startsWith("enfase") ||
    h.startsWith("area") ||
    h.startsWith("funcao") ||
    h.startsWith("tempo") ||
    h.startsWith("cenario")
  );
}

// Perguntas da seção "Avaliação Geral" (comuns a todos os perfis).
type Geral = "geral" | "recomenda" | "ferramenta" | null;
function classifyGeral(header: string): Geral {
  const h = norm(header);
  if (h.includes("de forma geral") && h.includes("avalia")) return "geral";
  if (h.includes("recomendaria")) return "recomenda";
  if (h.includes("quao util") || h.includes("ferramenta de avaliacao"))
    return "ferramenta";
  return null;
}

// Ordem importa: a primeira dimensão cujas palavras-chave casarem vence.
const DIM_KEYWORDS: { dim: Dimensao; keys: string[] }[] = [
  { dim: "Relacional", keys: ["feedback"] },
  {
    dim: "Organizacional",
    keys: [
      "informacoes institucionais",
      "cronograma",
      "fluxos de comunicacao",
      "abertura para dialogo",
      "expressar opinioes",
      "seguro e confortavel",
      "cultura organizacional",
      "cultura atual",
    ],
  },
  {
    dim: "Governança",
    keys: [
      "transparencia",
      "demandas",
      "dados e evidencias",
      "indicadores e evidencias",
      "evidencias para",
      "resultados das avaliacoes",
      "resultados da avaliacao",
      "consultados e participam",
      "participam das decisoes",
      "participam ativamente dos processos",
      "participacao efetiva",
      "tomada de decisao do programa",
      "decisoes, normas e processos",
      "decisoes importantes",
      "governanca",
      "retorno adequado",
      "repassando as demandas",
    ],
  },
  {
    dim: "Relacional",
    keys: [
      "preceptor",
      "tutor",
      "relacao respeitosa",
      "relacoes respeitosas",
      "colaborativ",
      "integracao multiprofissional",
      "integracao entre a formacao",
      "integrado(a) e apoiado",
      "integrado e apoiado",
      "participam de forma colaborativa",
    ],
  },
  {
    dim: "Sustentabilidade",
    keys: [
      "sustentabilidade",
      "recursos humanos",
      "recursos investidos",
      "recursos",
      "continuidade",
      "praticas introduzidas",
      "praticas implantadas",
      "iniciativas implantadas",
      "mudancas sustentaveis",
      "mudancas institucionais",
      "mudancas na organizacao",
      "objetivos formativos",
      "atinge seus objetivos",
      "atuacao dos residentes contribui",
      "melhorias nos processos de trabalho",
      "melhorias no servico",
      "melhorias para a rotina",
      "aprendizagem institucional",
      "incorporadas de forma permanente",
      "continuam sendo realizadas",
      "impacto",
      "proporcionais aos resultados",
      "contribui positivamente para sua formacao",
      "aplicar",
    ],
  },
  {
    dim: "Pedagógica",
    keys: [
      "pedagog",
      "teoric",
      "teoria e pratica",
      "atividades formativas",
      "atividades pedagogicas",
      "estrategias pedagogicas",
      "plano pedagogico",
      "competencias",
      "conhecimentos adquiridos",
      "conhecimentos desenvolvidos",
      "articulacao entre teoria",
      "reflexao critica",
      "qualidade e relevancia",
    ],
  },
];

function classifyDimensao(header: string): Dimensao | null {
  const h = norm(header);
  for (const { dim, keys } of DIM_KEYWORDS) {
    if (keys.some((k) => h.includes(k))) return dim;
  }
  return null;
}

// Constrói um mapa estável índice-de-coluna -> dimensão a partir do cabeçalho.
// Colunas genéricas "Quantitativa 0X" herdam a dimensão da última coluna
// classificada (contexto posicional dentro do bloco).
function buildColumnDimensionMap(header: string[]): (Dimensao | null)[] {
  const map: (Dimensao | null)[] = [];
  let last: Dimensao | null = null;
  for (const col of header) {
    const h = norm(col);
    if (h.startsWith("quantitativa")) {
      map.push(last);
      continue;
    }
    if (isMeta(col) || classifyGeral(col)) {
      map.push(null);
      continue;
    }
    const dim = classifyDimensao(col);
    if (dim) last = dim;
    map.push(dim);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 4) Conversão de valores
// ---------------------------------------------------------------------------
// true se o valor é numérico (independente da faixa) — usado para distinguir
// perguntas quantitativas de qualitativas (texto livre).
function isNumeric(v: string): boolean {
  const s = (v || "").trim();
  if (!s) return false;
  return !Number.isNaN(Number(s.replace(",", ".")));
}

// Likert 1–4. Aceita "3", "3.0", "4" etc. Retorna null para texto OU para
// números fora da faixa esperada (que são ignorados, não viram qualitativos).
function toLikert(v: string): number | null {
  const s = (v || "").trim();
  if (!s) return null;
  const num = Number(s.replace(",", "."));
  if (Number.isNaN(num)) return null;
  if (num < 1 || num > 4) return null;
  return num;
}

function isQuantitativaHeader(header: string): boolean {
  return norm(header).startsWith("quantitativa");
}

// ---------------------------------------------------------------------------
// 5) API de alto nível
// ---------------------------------------------------------------------------

// A partir do texto CSV, produz o payload da rota /api/sheets.
export function csvToPayload(csv: string): SheetsPayload {
  const rows = parseCSV(csv);
  if (rows.length === 0)
    return { total: 0, porPapel: {}, respostas: [], header: [] };

  const header = rows[0].map((h) => h.trim());
  const respostas: Record<string, string>[] = [];
  const porPapel: Record<string, number> = {};

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    // ignora linhas completamente vazias
    if (!cells || !cells.some((c) => c && c.trim())) continue;

    // Nomes de coluna se repetem entre os blocos de cada perfil. Como cada
    // respondente preenche apenas um bloco, fazemos um merge "não-destrutivo":
    // mantemos o primeiro valor não-vazio para cada nome de coluna, evitando
    // que uma coluna duplicada vazia (de outro bloco) apague a resposta real.
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c];
      const val = (cells[c] ?? "").trim();
      if (!(key in obj) || (val && !obj[key])) obj[key] = val;
    }
    const papel = normalizePapel(cells[1] ?? "");
    obj["__papel"] = papel;
    respostas.push(obj);
    porPapel[papel] = (porPapel[papel] ?? 0) + 1;
  }

  return { total: respostas.length, porPapel, respostas, header };
}

// Constrói as respostas normalizadas a partir do payload da API (client-side).
export function buildRespostas(payload: SheetsPayload): Resposta[] {
  const { respostas } = payload;
  if (respostas.length === 0) return [];

  // Usa o cabeçalho ORIGINAL (ordenado, com duplicatas) para classificar as
  // dimensões — em especial as colunas "Quantitativa 0X", que herdam a
  // dimensão da coluna anterior pelo contexto posicional dentro do bloco.
  const ordered =
    payload.header && payload.header.length > 0
      ? payload.header
      : Object.keys(respostas[0]).filter((k) => !k.startsWith("__"));
  const dimMap = buildColumnDimensionMap(ordered);
  const dimByHeader = new Map<string, Dimensao | null>();
  ordered.forEach((h, i) => {
    if (!dimByHeader.has(h)) dimByHeader.set(h, dimMap[i]);
  });

  // chaves distintas presentes em cada objeto de resposta (nomes de coluna)
  const header = Object.keys(respostas[0]).filter((k) => !k.startsWith("__"));

  return respostas.map((raw) => {
    const papel = raw["__papel"] || normalizePapel(raw["Qual é o seu papel no PREMUGS?"] || "");

    let nome = "";
    let ano = "";
    const quantitativas: Resposta["quantitativas"] = [];
    const qualitativas: Resposta["qualitativas"] = [];

    for (const h of header) {
      const valor = raw[h];
      if (!valor || !valor.trim()) continue;

      // metadados
      if (isMeta(h)) {
        const nh = norm(h);
        if (nh.startsWith("nome") && !nome) nome = valor.trim();
        if ((nh.startsWith("ano/") || nh.startsWith("ano ")) && !ano)
          ano = valor.trim();
        continue;
      }

      // perguntas da "Avaliação Geral" são tratadas à parte (avaliacaoGeral)
      if (classifyGeral(h)) continue;

      // perguntas: quantitativa (numérica 1-4) ou qualitativa (texto livre).
      // Números fora da faixa 1-4 são ignorados (não viram texto).
      if (isNumeric(valor)) {
        const likert = toLikert(valor);
        if (likert !== null) {
          quantitativas.push({
            pergunta: h,
            valor: likert,
            dimensao: dimByHeader.get(h) ?? null,
          });
        }
      } else if (!isQuantitativaHeader(h)) {
        qualitativas.push({ pergunta: h, valor: valor.trim() });
      }
    }

    return {
      raw,
      papel,
      papelRaw: raw["Qual é o seu papel no PREMUGS?"] || papel,
      nome: nome || "Anônimo",
      ano: ano || "—",
      timestamp: raw["Carimbo de data/hora"] || "",
      quantitativas,
      qualitativas,
    };
  });
}

// ---------------------------------------------------------------------------
// 6) Agregações para os gráficos
// ---------------------------------------------------------------------------

// Média por dimensão (escala 1–4) sobre um conjunto de respostas filtrado.
export function scorePorDimensao(
  respostas: Resposta[]
): { dimensao: Dimensao; media: number | null; n: number }[] {
  const acc: Record<string, { soma: number; n: number }> = {};
  for (const d of DIMENSOES) acc[d] = { soma: 0, n: 0 };

  for (const r of respostas) {
    for (const q of r.quantitativas) {
      if (q.dimensao) {
        acc[q.dimensao].soma += q.valor;
        acc[q.dimensao].n += 1;
      }
    }
  }

  return DIMENSOES.map((dimensao) => {
    const { soma, n } = acc[dimensao];
    return { dimensao, media: n > 0 ? soma / n : null, n };
  });
}

// Média por indicador (pergunta) dentro de cada dimensão — alimenta o
// detalhamento exibido ao clicar em uma dimensão no gráfico.
export interface IndicadorScore {
  pergunta: string;
  media: number;
  n: number;
}

export function indicadoresPorDimensao(
  respostas: Resposta[]
): Record<Dimensao, IndicadorScore[]> {
  const acc = new Map<
    string,
    { dimensao: Dimensao; pergunta: string; soma: number; n: number }
  >();

  for (const r of respostas) {
    for (const q of r.quantitativas) {
      if (!q.dimensao) continue;
      const key = `${q.dimensao}|${norm(q.pergunta)}`;
      const cur = acc.get(key);
      if (cur) {
        cur.soma += q.valor;
        cur.n += 1;
      } else {
        acc.set(key, { dimensao: q.dimensao, pergunta: q.pergunta, soma: q.valor, n: 1 });
      }
    }
  }

  const out = Object.fromEntries(
    DIMENSOES.map((d) => [d, [] as IndicadorScore[]])
  ) as Record<Dimensao, IndicadorScore[]>;

  for (const { dimensao, pergunta, soma, n } of Array.from(acc.values())) {
    out[dimensao].push({ pergunta, media: soma / n, n });
  }
  return out;
}

// Agrupa perguntas qualitativas por texto (mesclando todos os blocos/perfis).
export function agruparQualitativas(
  respostas: Resposta[]
): { pergunta: string; itens: { papel: string; nome: string; texto: string }[] }[] {
  const mapa = new Map<
    string,
    { pergunta: string; itens: { papel: string; nome: string; texto: string }[] }
  >();

  for (const r of respostas) {
    for (const q of r.qualitativas) {
      // ignora a avaliação geral qualitativa? Não — mantemos todas as abertas.
      const key = norm(q.pergunta);
      if (!mapa.has(key)) mapa.set(key, { pergunta: q.pergunta, itens: [] });
      mapa.get(key)!.itens.push({
        papel: r.papel,
        nome: r.nome,
        texto: q.valor,
      });
    }
  }

  return Array.from(mapa.values()).filter((g) => g.itens.length > 0);
}

// Avaliação geral: score médio "de forma geral", recomendação Sim/Não, utilidade.
export interface AvaliacaoGeral {
  geralMedia: number | null;
  geralN: number;
  geralDistribuicao: { nota: number; quantidade: number }[];
  recomenda: { sim: number; nao: number; total: number };
  ferramentaMedia: number | null;
  ferramentaN: number;
}

export function avaliacaoGeral(respostas: Resposta[]): AvaliacaoGeral {
  let geralSoma = 0;
  let geralN = 0;
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let sim = 0;
  let nao = 0;
  let recomendaTotal = 0;
  let fSoma = 0;
  let fN = 0;

  for (const r of respostas) {
    for (const [pergunta, valor] of Object.entries(r.raw)) {
      if (pergunta.startsWith("__")) continue;
      if (!valor || !valor.trim()) continue;
      const tipo = classifyGeral(pergunta);
      if (!tipo) continue;

      if (tipo === "geral") {
        const v = toLikert(valor);
        if (v !== null) {
          geralSoma += v;
          geralN += 1;
          dist[Math.round(v)] = (dist[Math.round(v)] ?? 0) + 1;
        }
      } else if (tipo === "recomenda") {
        const n = norm(valor);
        if (n.startsWith("sim")) {
          sim += 1;
          recomendaTotal += 1;
        } else if (n.startsWith("nao") || n.startsWith("não")) {
          nao += 1;
          recomendaTotal += 1;
        }
      } else if (tipo === "ferramenta") {
        const v = toLikert(valor);
        if (v !== null) {
          fSoma += v;
          fN += 1;
        }
      }
    }
  }

  return {
    geralMedia: geralN > 0 ? geralSoma / geralN : null,
    geralN,
    geralDistribuicao: [1, 2, 3, 4].map((nota) => ({
      nota,
      quantidade: dist[nota] ?? 0,
    })),
    recomenda: { sim, nao, total: recomendaTotal },
    ferramentaMedia: fN > 0 ? fSoma / fN : null,
    ferramentaN: fN,
  };
}

// Lista de anos/ciclos distintos presentes nos dados (para o filtro).
export function anosDisponiveis(respostas: Resposta[]): string[] {
  const set = new Set<string>();
  for (const r of respostas) {
    if (r.ano && r.ano !== "—") set.add(r.ano);
  }
  return Array.from(set).sort();
}

// Resposta mais recente (parse do timestamp pt-BR dd/mm/yyyy hh:mm:ss).
export function respostaMaisRecente(respostas: Resposta[]): string | null {
  let best: { t: number; s: string } | null = null;
  for (const r of respostas) {
    const t = parseTimestamp(r.timestamp);
    if (t === null) continue;
    if (!best || t > best.t) best = { t, s: r.timestamp };
  }
  return best ? best.s : null;
}

export function parseTimestamp(s: string): number | null {
  if (!s) return null;
  // formato Google Forms pt-BR: "dd/mm/yyyy hh:mm:ss"
  const m = s.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/
  );
  if (m) {
    const [, d, mo, y, h, mi, se] = m;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se || "0")
    ).getTime();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

// Cor por score (vermelho < 2, amarelo 2–3, verde > 3).
export function corPorScore(score: number): string {
  if (score < 2) return "#dc2626"; // vermelho
  if (score <= 3) return "#d97706"; // amarelo/âmbar
  return "#057a55"; // verde institucional
}
