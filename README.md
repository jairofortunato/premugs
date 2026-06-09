# PREMUGS Avalia — Painel de Resultados

Dashboard **Next.js** que consome em tempo real as respostas do formulário
**PREMUGS Avalia** (Google Forms → Google Sheets) e apresenta KPIs, scores por
dimensão, respostas qualitativas e a tabela bruta com filtros por papel e ciclo.

- **Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts
- **Fonte de dados:** planilha pública do Google Sheets (CSV via `gviz`)
- **Hospedagem:** Vercel
- **Públicos avaliados:** Residentes, Preceptores, Tutores e Coordenação

---

## 📁 Estrutura

```
.
├── app/
│   ├── layout.tsx                 ← layout raiz (fonte Inter)
│   ├── page.tsx                   ← redireciona para /dashboard
│   ├── api/sheets/route.ts        ← fetch + parse do CSV (revalidate 60s)
│   └── dashboard/
│       ├── page.tsx               ← Server Component (busca os dados)
│       └── DashboardClient.tsx    ← filtros + gráficos (Client Component)
├── components/
│   ├── KPICard.tsx                ← card de métrica
│   ├── DimensionChart.tsx         ← barras de score por dimensão
│   ├── QualitativeSection.tsx     ← respostas abertas agrupadas
│   └── ResponsesTable.tsx         ← tabela paginada com expansão
├── lib/parseSheets.ts             ← parsing do CSV e agregações
├── data/                          ← CSV de exemplo (referência do formato)
└── legacy/index.html              ← versão estática anterior (arquivada)
```

---

## 🚀 Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000  →  /dashboard
```

## 🔌 Fonte de dados

A planilha precisa estar **pública** (qualquer pessoa com o link pode ver). O
CSV é lido de:

```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=Respostas%20do%20Formul%C3%A1rio%201
```

### Como o parsing funciona

O formulário é **multi-perfil**: a coluna *"Qual é o seu papel no PREMUGS?"*
define em qual bloco de colunas a pessoa respondeu — os demais blocos ficam
vazios naquela linha. Por isso o parser é *data-driven*:

1. Lê o CSV respeitando campos entre aspas com vírgulas **e quebras de linha**.
2. Ignora linhas totalmente vazias.
3. Para cada respondente, considera apenas as células não-vazias.
4. Classifica cada resposta como **quantitativa** (número 1–4 → entra na média
   da dimensão) ou **qualitativa** (texto livre → vira lista).
5. As dimensões são identificadas por palavras-chave no enunciado da pergunta,
   o que mantém o painel funcionando mesmo quando o formulário ganha/perde
   colunas. Colunas genéricas `Quantitativa 0X` herdam a dimensão do bloco.

> Nomes de coluna se repetem entre os blocos; o merge é não-destrutivo (mantém
> o primeiro valor não-vazio) para nunca apagar uma resposta real.

---

## 🔐 Variáveis de ambiente

Crie um `.env.local` na raiz:

```env
SHEET_ID=1AeRD3cebArjru-dOo_iIWsyDuRgjaWO5ZRNexqDbZIY
NEXT_PUBLIC_URL=http://localhost:3000
```

Na **Vercel** → *Settings → Environment Variables*, adicione as mesmas chaves
(troque `NEXT_PUBLIC_URL` pela URL de produção).

---

## ☁️ Deploy na Vercel

1. Suba o repositório no GitHub.
2. Na Vercel: **New Project → Import** e selecione o repositório.
3. Framework Preset: **Next.js** (detectado automaticamente). Build/Output
   padrão.
4. Configure as variáveis de ambiente acima e faça o deploy.

Os dados são revalidados a cada **60 segundos** (ISR), então o painel reflete
novas respostas sem precisar de novo deploy.
