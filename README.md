# PREMUGS — Painel de Avaliação Institucional

Dashboard estático (HTML + CSS + JS puro) com os resultados da avaliação institucional do **Programa de Residência Multiprofissional em Gestão em Saúde** da Secretaria Municipal de Saúde de Florianópolis.

- **Stack:** HTML + Chart.js + PapaParse (via CDN). Zero build, zero backend.
- **Hospedagem:** Vercel (estático).
- **Públicos avaliados:** Residentes, Preceptores, Tutores e Coordenação.
- **Dimensões:** Pedagógica, Relacional, Organizacional, Governança e Sustentabilidade.

---

## 📁 Estrutura

```
.
├── index.html                          ← dashboard (auto-suficiente)
├── data/
│   └── respostas_premugs_fake.csv      ← CSV de exemplo (referência do formato)
└── README.md
```

## 🚀 Deploy na Vercel

1. Suba este repositório no GitHub.
2. Na Vercel: **New Project → Import**, selecione o repositório.
3. Framework Preset: **Other**. Build Command: (vazio). Output Directory: `.`.
4. Deploy. Pronto — a Vercel serve o `index.html` diretamente.

> ⚠️ A primeira versão usa dados **mock** já agregados (calculados a partir do CSV de exemplo). Para plugar a planilha real do Google Forms, veja a seção abaixo.

---

## 🔌 Conectar à planilha do Google Forms

O arquivo `index.html` traz uma camada de dados isolada no início do `<script>`. A única coisa que precisa mudar é a configuração no topo:

```js
const FONTE_DADOS = "mock";   // ← troque para "sheets-api" ou "csv"
```

### Opção A — Google Sheets API v4 (recomendada para produção)

A planilha pode permanecer **privada**, basta liberar leitura pública.

1. **Crie uma API Key** em https://console.cloud.google.com → APIs & Services → Credentials → Create credentials → API key.
2. Ative a **Google Sheets API** no projeto.
3. Restrinja a API Key:
   - **Application restrictions:** HTTP referrers → `https://seu-dominio.vercel.app/*`
   - **API restrictions:** apenas Google Sheets API
4. Na planilha de respostas do Google Forms: **Compartilhar → "Qualquer pessoa com o link" → Leitor**.
5. Pegue o `SHEET_ID` da URL: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`.
6. Edite o `index.html`:

   ```js
   const FONTE_DADOS    = "sheets-api";
   const SHEET_ID       = "1AbCdEf..."; 
   const SHEET_RANGE    = "Respostas ao formulário 1!A1:EZ";
   const SHEETS_API_KEY = "AIzaSy...";
   ```

7. Commit e push — a Vercel re-implanta automaticamente.

> **Sobre expor a API Key no front-end:** a key fica visível no HTML, mas isso é seguro **desde que** ela esteja restrita por referrer HTTP ao domínio da Vercel. Sem essa restrição, qualquer um pode usar sua quota — então não pule esse passo.

### Opção B — CSV publicado na web (mais simples, planilha pública)

1. Na planilha: **Arquivo → Compartilhar → Publicar na web → Aba de respostas → CSV → Publicar**.
2. Copie a URL gerada.
3. Edite o `index.html`:

   ```js
   const FONTE_DADOS = "csv";
   const CSV_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv";
   ```

> Nessa opção, qualquer pessoa com a URL vê os dados. Não use se as respostas forem sensíveis.

---

## 🧠 Como o painel entende a planilha

O formulário do PREMUGS tem **quatro seções condicionais** (uma por público). Cada respondente preenche apenas a sua seção, então cada bloco de colunas pertence a um público. O painel:

1. Lê a coluna **"Qual é o seu papel no PREMUGS?"** (`COLUNA_PAPEL`) para identificar o público.
2. Aplica o mapa `COLUNAS_POR_PUBLICO` para somar as notas Likert 1–5 das colunas certas, por dimensão.
3. Calcula a média de cada dimensão por público e a média geral.

Se a estrutura do formulário mudar (perguntas adicionadas/removidas/reordenadas), basta atualizar os índices em `COLUNAS_POR_PUBLICO` dentro do `index.html`. O resto do painel não muda.

### Faixa A1 sugerida

```
Respostas ao formulário 1!A1:EZ
```

Cobre as 146 colunas atuais do formulário. Aumente o limite (`EZ` → `GZ` etc.) se novas perguntas forem adicionadas.

---

## 🎨 Personalização rápida

- **Paleta:** variáveis CSS no `:root` do `<style>` (tons azul-petróleo / verde-petróleo).
- **Faixas semafóricas:** função `classificarNota()` no `<script>` (≥4 forte · 3–3.99 atenção · <3 frágil).
- **Dimensões/públicos:** constantes `DIMENSOES` e `PUBLICOS` no topo do `<script>`.

---

## 🧪 Rodando localmente

Como é um único HTML, basta abrir o arquivo no navegador. Se quiser testar a opção CSV/Sheets sem CORS travar:

```bash
npx serve .
# ou
python3 -m http.server 8000
```

Acesse http://localhost:8000.
