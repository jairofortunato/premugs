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

  // Localiza a coluna do papel pelo cabeçalho — a posição varia conforme o
  // formulário evolui (hoje é a 3ª coluna, depois de "Ano/ciclo avaliado").
  const papelIdx = header.findIndex((h) =>
    norm(h).startsWith("qual e o seu papel")
  );

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
    const papel = normalizePapel(cells[papelIdx >= 0 ? papelIdx : 1] ?? "");
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
          // A dimensão da matriz (via indicador) tem prioridade sobre o chute
          // por palavra-chave — assim a pergunta cai na dimensão correta.
          const dimensao =
            dimensaoDaPerguntaPorIndicador(h) ?? dimByHeader.get(h) ?? null;
          quantitativas.push({ pergunta: h, valor: likert, dimensao });
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

// Média de todas as notas quantitativas (1–4) por papel.
export function mediaPorPapel(
  respostas: Resposta[]
): { papel: string; media: number | null; n: number }[] {
  const acc: Record<string, { soma: number; n: number }> = {};
  for (const p of PAPEIS) acc[p] = { soma: 0, n: 0 };

  for (const r of respostas) {
    if (!acc[r.papel]) acc[r.papel] = { soma: 0, n: 0 };
    for (const q of r.quantitativas) {
      acc[r.papel].soma += q.valor;
      acc[r.papel].n += 1;
    }
  }

  return Object.entries(acc).map(([papel, { soma, n }]) => ({
    papel,
    media: n > 0 ? soma / n : null,
    n,
  }));
}

// Média por dimensão aberta por papel — uma linha por dimensão com uma chave
// por papel (formato esperado pelo gráfico de barras agrupadas).
export function mediaPorDimensaoEPapel(
  respostas: Resposta[]
): Record<string, string | number | null>[] {
  const acc: Record<string, Record<string, { soma: number; n: number }>> = {};
  for (const d of DIMENSOES) acc[d] = {};

  for (const r of respostas) {
    for (const q of r.quantitativas) {
      if (!q.dimensao) continue;
      const porPapel = acc[q.dimensao];
      if (!porPapel[r.papel]) porPapel[r.papel] = { soma: 0, n: 0 };
      porPapel[r.papel].soma += q.valor;
      porPapel[r.papel].n += 1;
    }
  }

  return DIMENSOES.map((dimensao) => {
    const row: Record<string, string | number | null> = { dimensao };
    for (const [papel, { soma, n }] of Object.entries(acc[dimensao])) {
      row[papel] = n > 0 ? Number((soma / n).toFixed(2)) : null;
    }
    return row;
  });
}

// Distribuição de todas as notas quantitativas (1–4) do filtro atual.
export function distribuicaoNotas(
  respostas: Resposta[]
): { nota: number; quantidade: number }[] {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of respostas) {
    for (const q of r.quantitativas) {
      const nota = Math.round(q.valor);
      dist[nota] = (dist[nota] ?? 0) + 1;
    }
  }
  return [1, 2, 3, 4].map((nota) => ({ nota, quantidade: dist[nota] ?? 0 }));
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
  // formato ISO-like da planilha: "yyyy/mm/dd hh:mm:ss"
  const iso = s.match(
    /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/
  );
  if (iso) {
    const [, y, mo, d, h, mi, se] = iso;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se || "0")
    ).getTime();
  }
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

// Formata um timestamp da planilha como "dd/mm/yyyy hh:mm" (padrão brasileiro).
export function formatarDataBR(s: string): string {
  const t = parseTimestamp(s);
  if (t === null) return s;
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Cor por score (vermelho < 2, amarelo 2–3, verde > 3).
export function corPorScore(score: number): string {
  if (score < 2) return "#dc2626"; // vermelho
  if (score <= 3) return "#d97706"; // amarelo/âmbar
  return "#057a55"; // verde institucional
}

// ---------------------------------------------------------------------------
// 7) Indicadores avaliativos (pergunta-chave -> indicador)
// ---------------------------------------------------------------------------
// Cada *indicador* (ex.: "Índice de Evolução de Aprendizado") agrupa, dentro de
// uma dimensão, as variações da pergunta-chave por público (residente,
// preceptor, tutor, coordenador). Aqui mapeamos cada texto de pergunta ao nome
// do indicador correspondente, para exibi-lo acima da pergunta no painel.
//
// Para adicionar um indicador, basta listar todas as variações da pergunta
// (uma por público). A comparação ignora acentos, maiúsculas, pontuação e
// espaços extras, então pequenas diferenças de formatação não quebram o mapa.
export const INDICADORES_AVALIATIVOS: { indicador: string; perguntas: string[] }[] =
  [
    // ----- Dimensão Pedagógica -----
    {
      indicador: "Índice de Evolução de Aprendizado (teoria-prática)",
      perguntas: [
        "Os conhecimentos adquiridos nas atividades teóricas aumentaram minha capacidade de atuar e resolver situações encontradas na prática do serviço?",
        "Os residentes conseguem aplicar, na prática, os conhecimentos desenvolvidos nas atividades teóricas do programa?",
        "As atividades pedagógicas favorecem a articulação entre teoria e prática na formação dos residentes?",
        "O programa promove integração adequada entre conteúdos teóricos e práticas desenvolvidas nos serviços de saúde?",
      ],
    },
    {
      indicador: "Índice de Desenvolvimento de Competências em Gestão",
      perguntas: [
        "O programa contribui para o desenvolvimento de competências em gestão em saúde?",
        "Os residentes demonstram evolução em competências relacionadas à gestão em saúde?",
        "As atividades pedagógicas desenvolvidas favorecem competências de gestão em saúde?",
        "O programa desenvolve competências compatíveis com as demandas de gestão no SUS?",
      ],
    },
    {
      indicador: "Índice de Qualidade Pedagógica",
      perguntas: [
        "As atividades formativas são planejadas e conduzidas de forma clara, organizada e adequada para promover a aprendizagem?",
        "As atividades formativas contribuem para a atuação prática dos residentes?",
        "As estratégias pedagógicas utilizadas favorecem o desenvolvimento profissional dos residentes?",
        "O plano pedagógico está alinhado com as demandas de gestão no SUS?",
      ],
    },
    {
      indicador: "Índice de Estratégias Pedagógicas",
      perguntas: [
        "O trabalho e os projetos desenvolvidos pelos residentes trouxeram melhorias para a rotina e os processos da prática profissional?",
        "As atividades e projetos desenvolvidos pelos residentes contribuem para melhorias no serviço?",
        "As estratégias pedagógicas estimulam reflexão crítica e resolução de problemas na prática profissional do residente?",
        "O programa utiliza estratégias pedagógicas alinhadas às necessidades dos serviços e da formação multiprofissional?",
      ],
    },
    {
      indicador: "Índice de Acompanhamento Pedagógico",
      perguntas: [
        "O acompanhamento pedagógico no programa é adequado para o desenvolvimento dos residentes?",
      ],
    },
    {
      indicador: "Índice Qualitativo Pedagógico (Pergunta Aberta)",
      perguntas: [
        "Quais aspectos pedagógicos do PREMUGS contribuem positivamente para a formação dos residentes e quais poderiam ser melhorados ou fortalecidos?",
      ],
    },

    // ----- Dimensão Relacional -----
    {
      indicador: "Índice de Relação Preceptor-Residente",
      perguntas: [
        "Os preceptores mantêm uma relação respeitosa, acessível e colaborativa com os residentes?",
        "Os residentes mantêm uma relação respeitosa, colaborativa e participativa com a preceptoria?",
      ],
    },
    {
      indicador: "Índice de Relação Tutor-Residente",
      perguntas: [
        "Os tutores demonstram disponibilidade, escuta e apoio no acompanhamento pedagógico?",
        "Os tutores demonstram disponibilidade, escuta e apoio no acompanhamento pedagógico quando necessário?",
        "Os residentes participam de forma colaborativa do acompanhamento pedagógico realizado pelos tutores?",
      ],
    },
    {
      indicador: "Índice Relação Multiprofissional",
      perguntas: [
        "O ambiente do programa favorece relações respeitosas e colaborativas entre as diferentes categorias profissionais (integração multiprofissional)?",
        "O ambiente do programa favorece relações respeitosas e colaborativas entre os diferentes participantes (integração multiprofissional)?",
      ],
    },
    {
      indicador: "Índice de Integração Ensino-Serviço",
      perguntas: [
        "O programa promove integração entre a formação dos residentes e os serviços de saúde do SUS?",
      ],
    },
    {
      indicador: "Índice de Regularidade do Feedback",
      perguntas: [
        "A frequência que recebo feedbacks é considerada:",
        "Recebo feedbacks de forma periódica?",
        "Os processos de feedback ocorrem de forma periódica?",
      ],
    },
    {
      indicador: "Índice de Qualidade do Feedback",
      perguntas: [
        "Os feedbacks recebidos contribuem para meu desenvolvimento profissional?",
        "Os feedbacks realizados contribuem para o desenvolvimento dos residentes?",
      ],
    },
    {
      indicador: "Índice de Acolhimento Institucional",
      perguntas: [
        "Sinto-me integrado(a) e apoiado(a) institucionalmente no programa?",
      ],
    },
    {
      indicador: "Índice Qualitativo Relacional (Pergunta Aberta)",
      perguntas: [
        "Quais aspectos das relações interpessoais no PREMUGS poderiam ser fortalecidos ou melhorados?",
      ],
    },

    // ----- Dimensão Organizacional -----
    {
      indicador: "Índice de Comunicação Institucional",
      perguntas: [
        "As informações institucionais são comunicadas de forma clara, compreensível e no tempo oportuno?",
        "As informações institucionais são comunicadas de forma clara, tempestiva e compreensível?",
      ],
    },
    {
      indicador: "Índice de Organização do Programa",
      perguntas: [
        "O cronograma de atividades do programa é organizado e executado conforme planejado?",
      ],
    },
    {
      indicador: "Índice de Clareza dos Fluxos",
      perguntas: [
        "Os fluxos de comunicação e tomada de decisão no programa são claros, bem definidos e compreendidos pelos participantes?",
      ],
    },
    {
      indicador: "Índice de Suporte Institucional",
      perguntas: ["Existe abertura para diálogo e esclarecimento de dúvidas?"],
    },
    {
      indicador: "Índice de Clima Organizacional",
      perguntas: [
        "Você se sente seguro e confortável para expressar opiniões contrárias, sugerir melhorias operacionais ou relatar falhas sem receio de julgamentos?",
      ],
    },
    {
      indicador: "Índice Qualitativo Organizacional (Pergunta Aberta)",
      perguntas: [
        "Quais aspectos da cultura organizacional influenciam sua motivação e bem-estar no programa, e o que poderia ser melhorado?",
        "Quais aspectos da nossa cultura atual ou do nosso ambiente mais contribui para sua motivação e bem-estar institucional? Dê sugestões para melhoria.",
      ],
    },

    // ----- Dimensão Governança -----
    {
      indicador: "Índice de Transparência Institucional",
      perguntas: [
        "As informações sobre decisões, normas e processos do programa são disponibilizadas de forma clara, acessível e transparente pela coordenação?",
        "O programa assegura a transparência na divulgação de informações institucionais, relatórios e processos decisórios aos diferentes atores?",
        "Os processos do programa são conduzidos com clareza e transparência?",
      ],
    },
    {
      indicador: "Índice de Capacidade de Resposta",
      perguntas: [
        "As demandas relacionadas à execução das atividades no serviço recebem retorno adequado e em tempo oportuno da coordenação?",
        "Os residentes, preceptores e tutores estão repassando as demandas do PREMUGS com tempo hábil para os coordenadores?",
        "As demandas apresentadas recebem retorno adequado da coordenação?",
        "As demandas pedagógicas e operacionais são respondidas de forma adequada pela coordenação do programa?",
      ],
    },
    {
      indicador: "Índice de Monitoramento Institucional",
      perguntas: [
        "O programa utiliza dados e evidências para monitorar e aprimorar continuamente suas atividades formativas e assistenciais?",
        "O programa utiliza indicadores e evidências sistematicamente para apoiar decisões de gestão e melhoria contínua?",
        "O acompanhamento pedagógico do programa é orientado por dados, indicadores e evidências de desempenho?",
      ],
    },
    {
      indicador: "Índice de Cultura Avaliativa",
      perguntas: [
        "O quanto você percebe que a coordenação utiliza efetivamente os resultados das avaliações para promover melhorias reais no PREMUGS?",
        "Os resultados das avaliações são utilizados de forma sistemática e contínua na tomada de decisão do programa?",
        "Os resultados das avaliações do programa são efetivamente utilizados para promover melhorias nas práticas de ensino e serviço?",
      ],
    },
    {
      indicador: "Grau de participação coletiva na gestão",
      perguntas: [
        "O quanto você sente que as suas ideias, sugestões e vivências práticas são efetivamente levadas em consideração pela coordenação na hora de tomar decisões importantes para o programa?",
        "Os preceptores são consultados e participam das decisões importantes relacionadas ao funcionamento do programa?",
        "Os tutores participam ativamente dos processos de tomada de decisão do programa?",
        "O programa promove participação efetiva de residentes, preceptores e tutores nas decisões institucionais?",
      ],
    },
    {
      indicador: "Índice Qualitativo Governança (Pergunta Aberta)",
      perguntas: [
        "Como você avalia a governança do PREMUGS em relação à transparência, capacidade de resposta, uso de evidências e participação dos atores? O que poderia ser melhorado?",
      ],
    },

    // ----- Dimensão Sustentabilidade -----
    {
      indicador: "Índice de Impacto Formativo",
      perguntas: [
        "O PREMUGS contribui positivamente para sua formação profissional em gestão no SUS?",
        "As atividades do PREMUGS promovem o desenvolvimento consistente de competências em gestão em saúde?",
        "O PREMUGS contribui para o desenvolvimento de competências em gestão dos residentes sob sua supervisão?",
        "As atividades do PREMUGS promovem o desenvolvimento consistente de competências em gestão e organização do trabalho em saúde?",
        "O PREMUGS atinge seus objetivos formativos em gestão no SUS?",
      ],
    },
    {
      indicador: "Índice de Impacto nos Serviços",
      perguntas: [
        "Você conseguiu aplicar, na sua prática de gestão durante a residência, os conhecimentos adquiridos nas atividades formativas do PREMUGS?",
        "Você conseguiu aplicar, na sua prática clínica ou de gestão durante a residência, os conhecimentos adquiridos nas atividades formativas do PREMUGS?",
        "A atuação dos residentes contribui para melhorias nos processos de trabalho do serviço?",
        "Os conhecimentos aplicados pelos residentes geram melhorias nos processos de trabalho dos serviços de saúde?",
      ],
    },
    {
      indicador: "Índice de Potencial de Consolidação",
      perguntas: [
        "As iniciativas implantadas pelo PREMUGS na sua unidade continuam sendo realizadas de forma autônoma pela equipe, sem depender da presença contínua do programa?",
        "As práticas introduzidas pelo programa têm potencial de continuidade independente da presença do PREMUGS?",
        "O programa gera mudanças sustentáveis nos serviços que permanecem após o ciclo formativo?",
        "As melhorias implementadas pelos residentes são incorporadas de forma permanente à rotina do serviço?",
      ],
    },
    {
      indicador: "Índice de Aprendizagem Institucional",
      perguntas: [
        "Durante a sua residência, você percebeu mudanças na integração entre ensino, serviço e comunidade promovidas pelo PREMUGS?",
        "O programa promove aprendizagem institucional e melhoria contínua nos processos de formação e trabalho em saúde?",
        "O PREMUGS promove mudanças institucionais duradouras na integração entre ensino, serviço e gestão?",
        "O PREMUGS promove mudanças na organização do trabalho e na articulação ensino-serviço?",
      ],
    },
    {
      indicador: "Relação custo-efetividade operacional do PREMUGS",
      perguntas: [
        "Os recursos investidos no PREMUGS são proporcionais aos resultados formativos e operacionais alcançados pelo programa?",
        "Os recursos humanos, financeiros e estruturais investidos na operação do PREMUGS são proporcionais aos resultados alcançados nos serviços de saúde e na formação dos residentes?",
        "Os recursos humanos, financeiros e estruturais investidos no PREMUGS são proporcionais aos resultados formativos e operacionais alcançados pelo programa? (Verificar se fica só Coordenadores)",
        "Os recursos humanos, financeiros e estruturais investidos no PREMUGS são proporcionais aos resultados formativos e operacionais alcançados pelo programa? (Verificar se só coordenadores)",
      ],
    },
    {
      indicador: "Índice Qualitativo Sustentabilidade (Pergunta Aberta)",
      perguntas: [
        "Na sua visão, o que seria necessário para aumentar a sustentabilidade do PREMUGS em termos de recursos, apoio institucional, governança, parcerias ou mudanças organizacionais?",
      ],
    },
  ];

// Normalização mais agressiva para casar perguntas: remove acentos, pontuação
// e colapsa espaços (perguntas vêm com vírgulas/quebras de linha da planilha).
function normChave(s: string): string {
  return norm(s)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Dimensão a que cada indicador pertence. Usado para escopar o agrupamento: um
// indicador só rotula uma pergunta se ela estiver classificada na MESMA
// dimensão — evitando que perguntas reaproveitadas entre blocos (ex.: na
// Sustentabilidade) sejam rotuladas com um indicador de outra dimensão.
const INDICADOR_DIMENSAO: Record<string, Dimensao> = {
  // Pedagógica
  "Índice de Evolução de Aprendizado (teoria-prática)": "Pedagógica",
  "Índice de Desenvolvimento de Competências em Gestão": "Pedagógica",
  "Índice de Qualidade Pedagógica": "Pedagógica",
  "Índice de Estratégias Pedagógicas": "Pedagógica",
  "Índice de Acompanhamento Pedagógico": "Pedagógica",
  "Índice Qualitativo Pedagógico (Pergunta Aberta)": "Pedagógica",
  // Relacional
  "Índice de Relação Preceptor-Residente": "Relacional",
  "Índice de Relação Tutor-Residente": "Relacional",
  "Índice Relação Multiprofissional": "Relacional",
  "Índice de Integração Ensino-Serviço": "Relacional",
  "Índice de Regularidade do Feedback": "Relacional",
  "Índice de Qualidade do Feedback": "Relacional",
  "Índice de Acolhimento Institucional": "Relacional",
  "Índice Qualitativo Relacional (Pergunta Aberta)": "Relacional",
  // Organizacional
  "Índice de Comunicação Institucional": "Organizacional",
  "Índice de Organização do Programa": "Organizacional",
  "Índice de Clareza dos Fluxos": "Organizacional",
  "Índice de Suporte Institucional": "Organizacional",
  "Índice de Clima Organizacional": "Organizacional",
  "Índice Qualitativo Organizacional (Pergunta Aberta)": "Organizacional",
  // Governança
  "Índice de Transparência Institucional": "Governança",
  "Índice de Capacidade de Resposta": "Governança",
  "Índice de Monitoramento Institucional": "Governança",
  "Índice de Cultura Avaliativa": "Governança",
  "Grau de participação coletiva na gestão": "Governança",
  "Índice Qualitativo Governança (Pergunta Aberta)": "Governança",
  // Sustentabilidade
  "Índice de Impacto Formativo": "Sustentabilidade",
  "Índice de Impacto nos Serviços": "Sustentabilidade",
  "Índice de Potencial de Consolidação": "Sustentabilidade",
  "Índice de Aprendizagem Institucional": "Sustentabilidade",
  "Relação custo-efetividade operacional do PREMUGS": "Sustentabilidade",
  "Índice Qualitativo Sustentabilidade (Pergunta Aberta)": "Sustentabilidade",
};

const _indicadorPorPergunta = (() => {
  const m = new Map<string, string>();
  for (const { indicador, perguntas } of INDICADORES_AVALIATIVOS) {
    for (const p of perguntas) m.set(normChave(p), indicador);
  }
  return m;
})();

// Retorna o nome do indicador de uma pergunta-chave, ou null se não mapeada.
// Se `dimensao` for informada, só retorna o indicador quando ele pertence a
// essa dimensão.
export function indicadorDaPergunta(
  pergunta: string,
  dimensao?: Dimensao
): string | null {
  const ind = _indicadorPorPergunta.get(normChave(pergunta)) ?? null;
  if (!ind) return null;
  if (dimensao && INDICADOR_DIMENSAO[ind] !== dimensao) return null;
  return ind;
}

// Dimensão "oficial" de uma pergunta segundo a matriz de indicadores (a partir
// do indicador a que ela pertence). Tem prioridade sobre a classificação por
// palavra-chave, garantindo que a pergunta apareça na dimensão correta.
export function dimensaoDaPerguntaPorIndicador(
  pergunta: string
): Dimensao | null {
  const ind = _indicadorPorPergunta.get(normChave(pergunta));
  return ind ? INDICADOR_DIMENSAO[ind] ?? null : null;
}

// Agrupa as perguntas (IndicadorScore) por indicador, preservando a ordem
// canônica de INDICADORES_AVALIATIVOS. Perguntas sem indicador mapeado caem em
// um grupo final com indicador = null. A média do grupo é integrada (ponderada
// pelo nº de respostas de cada pergunta).
export interface IndicadorGrupo {
  indicador: string | null;
  media: number | null;
  n: number;
  itens: IndicadorScore[];
}

export function agruparPorIndicador(
  itens: IndicadorScore[],
  dimensao?: Dimensao
): IndicadorGrupo[] {
  const ordem = INDICADORES_AVALIATIVOS.map((i) => i.indicador);
  const grupos = new Map<string, IndicadorScore[]>();
  const SEM = "__sem_indicador__";

  for (const it of itens) {
    const chave = indicadorDaPergunta(it.pergunta, dimensao) ?? SEM;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(it);
  }

  const chaves = Array.from(grupos.keys()).sort((a, b) => {
    if (a === SEM) return 1;
    if (b === SEM) return -1;
    const ia = ordem.indexOf(a);
    const ib = ordem.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  return chaves.map((k) => {
    const arr = grupos.get(k)!;
    let soma = 0;
    let n = 0;
    for (const it of arr) {
      soma += it.media * it.n;
      n += it.n;
    }
    return {
      indicador: k === SEM ? null : k,
      media: n > 0 ? soma / n : null,
      n,
      itens: arr,
    };
  });
}
