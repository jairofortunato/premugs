"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  buildRespostas,
  scorePorDimensao,
  indicadoresPorDimensao,
  mediaPorPapel,
  mediaPorDimensaoEPapel,
  distribuicaoNotas,
  corPorScore,
  formatarDataBR,
  agruparQualitativas,
  avaliacaoGeral,
  anosDisponiveis,
  respostaMaisRecente,
  PAPEIS,
  type SheetsPayload,
} from "@/lib/parseSheets";
import KPICard from "@/components/KPICard";
import DimensionChart from "@/components/DimensionChart";
import QualitativeSection from "@/components/QualitativeSection";
import ResponsesTable from "@/components/ResponsesTable";

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-gray-900">{children}</h2>
      {sub && <p className="text-sm text-gray-500">{sub}</p>}
    </div>
  );
}

const PAPEL_COR_HEX: Record<string, string> = {
  "Residente(a)": "#2563eb",
  "Preceptor(a)": "#057a55",
  "Tutor(a)": "#d97706",
  "Coordenador(a)": "#7c3aed",
};

const papelCurto = (p: string) => p.replace("(a)", "");

type Aba = "geral" | "qualitativas" | "individuais";

const ABAS: { id: Aba; label: string }[] = [
  { id: "geral", label: "Visão geral" },
  { id: "qualitativas", label: "Qualitativas" },
  { id: "individuais", label: "Respostas individuais" },
];

export default function DashboardClient({ payload }: { payload: SheetsPayload }) {
  const todas = useMemo(() => buildRespostas(payload), [payload]);

  const [aba, setAba] = useState<Aba>("geral");
  const [papelFiltro, setPapelFiltro] = useState<string>("Todos");
  const [anoFiltro, setAnoFiltro] = useState<string>("Todos");

  const anos = useMemo(() => anosDisponiveis(todas), [todas]);

  const filtradas = useMemo(() => {
    return todas.filter((r) => {
      if (papelFiltro !== "Todos" && r.papel !== papelFiltro) return false;
      if (anoFiltro !== "Todos" && r.ano !== anoFiltro) return false;
      return true;
    });
  }, [todas, papelFiltro, anoFiltro]);

  const scores = useMemo(() => scorePorDimensao(filtradas), [filtradas]);
  const indicadores = useMemo(() => indicadoresPorDimensao(filtradas), [filtradas]);
  const mediasPapel = useMemo(
    () => mediaPorPapel(filtradas).filter((m) => m.media !== null),
    [filtradas]
  );
  const dimensaoPapel = useMemo(() => mediaPorDimensaoEPapel(filtradas), [filtradas]);
  const distNotas = useMemo(() => distribuicaoNotas(filtradas), [filtradas]);
  const papeisPresentes = useMemo(
    () => PAPEIS.filter((p) => filtradas.some((r) => r.papel === p)),
    [filtradas]
  );
  const qualitativas = useMemo(() => agruparQualitativas(filtradas), [filtradas]);
  const geral = useMemo(() => avaliacaoGeral(filtradas), [filtradas]);
  const recente = useMemo(() => respostaMaisRecente(filtradas), [filtradas]);

  const total = filtradas.length;
  const porPapel = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of PAPEIS) acc[p] = 0;
    for (const r of filtradas) acc[r.papel] = (acc[r.papel] ?? 0) + 1;
    return acc;
  }, [filtradas]);

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const recomendaData = [
    { name: "Sim", value: geral.recomenda.sim },
    { name: "Não", value: geral.recomenda.nao },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8">
      {/* ---------- Filtros ---------- */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-card sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Papel
          </label>
          <select
            value={papelFiltro}
            onChange={(e) => setPapelFiltro(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="Todos">Todos os papéis</option>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
            Ano / ciclo avaliado
          </label>
          <select
            value={anoFiltro}
            onChange={(e) => setAnoFiltro(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="Todos">Todos os anos</option>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        {(papelFiltro !== "Todos" || anoFiltro !== "Todos") && (
          <button
            onClick={() => {
              setPapelFiltro("Todos");
              setAnoFiltro("Todos");
            }}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* ---------- Abas ---------- */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-100 bg-white p-1 shadow-card">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              aba === a.id
                ? "bg-brand-blue text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {a.label}
            {a.id === "qualitativas" && qualitativas.length > 0 && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${
                  aba === a.id ? "bg-white/20" : "bg-gray-100 text-gray-500"
                }`}
              >
                {qualitativas.reduce((acc, g) => acc + g.itens.length, 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === "geral" && (
        <>
      {/* ---------- KPIs ---------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard label="Total de respostas" value={total} accent="blue" />
        <KPICard
          label="Residentes"
          value={porPapel["Residente(a)"] ?? 0}
          sub={`${pct(porPapel["Residente(a)"] ?? 0)}% do total`}
          accent="blue"
        />
        <KPICard
          label="Preceptores"
          value={porPapel["Preceptor(a)"] ?? 0}
          sub={`${pct(porPapel["Preceptor(a)"] ?? 0)}% do total`}
          accent="green"
        />
        <KPICard
          label="Tutores"
          value={porPapel["Tutor(a)"] ?? 0}
          sub={`${pct(porPapel["Tutor(a)"] ?? 0)}% do total`}
          accent="green"
        />
        <KPICard
          label="Coordenadores"
          value={porPapel["Coordenador(a)"] ?? 0}
          sub={`${pct(porPapel["Coordenador(a)"] ?? 0)}% do total`}
          accent="gray"
        />
        <KPICard
          label="Resposta mais recente"
          value={recente ? formatarDataBR(recente).split(" ")[0] : "—"}
          sub={recente ? formatarDataBR(recente).split(" ").slice(1).join(" ") : undefined}
          accent="gray"
        />
      </div>

      {/* ---------- Dimensões ---------- */}
      <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-card sm:p-6">
        <SectionTitle sub="Média das perguntas quantitativas (escala 1–4) por dimensão avaliada — clique em uma dimensão para ver os indicadores">
          Dimensões avaliadas
        </SectionTitle>
        <DimensionChart scores={scores} indicadores={indicadores} />
      </section>

      {/* ---------- Comparativos por papel ---------- */}
      <section>
        <SectionTitle sub="Médias das notas quantitativas (escala 1–4) comparadas entre os papéis">
          Comparativos por papel
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Média geral por papel */}
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-card">
            <p className="text-sm font-semibold text-gray-800">
              Média de notas por papel
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              Média de todas as perguntas quantitativas respondidas por cada papel
            </p>
            <div className="mt-3 h-64">
              {mediasPapel.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mediasPapel}>
                    <XAxis
                      dataKey="papel"
                      tickFormatter={papelCurto}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis domain={[0, 4]} fontSize={11} width={24} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f3f4f6" }}
                      formatter={(v, _n, item) => [
                        `${Number(v).toFixed(1)}/4.0 · ${item?.payload?.n ?? 0} notas`,
                        "Média",
                      ]}
                      labelFormatter={(l) => papelCurto(String(l))}
                    />
                    <Bar dataKey="media" radius={[4, 4, 0, 0]}>
                      {mediasPapel.map((m) => (
                        <Cell key={m.papel} fill={PAPEL_COR_HEX[m.papel] ?? "#6b7280"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-300">
                  Sem dados
                </div>
              )}
            </div>
          </div>

          {/* Distribuição de todas as notas */}
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-card">
            <p className="text-sm font-semibold text-gray-800">
              Distribuição de todas as notas
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              Quantidade de respostas por nota em todas as perguntas quantitativas
            </p>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distNotas}>
                  <XAxis
                    dataKey="nota"
                    tickFormatter={(v) => `Nota ${v}`}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} fontSize={11} width={24} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f3f4f6" }}
                    formatter={(v) => [`${v} respostas`, "Quantidade"]}
                    labelFormatter={(l) => `Nota ${l}`}
                  />
                  <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                    {distNotas.map((d) => (
                      <Cell key={d.nota} fill={corPorScore(d.nota)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Média por dimensão e papel */}
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-card lg:col-span-2">
            <p className="text-sm font-semibold text-gray-800">
              Média por dimensão e papel
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              Como cada papel avalia cada dimensão do programa
            </p>
            <div className="mt-3 h-72">
              {papeisPresentes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dimensaoPapel}>
                    <XAxis dataKey="dimensao" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 4]} fontSize={11} width={24} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f3f4f6" }}
                      formatter={(v, n) => [`${Number(v).toFixed(1)}/4.0`, papelCurto(String(n))]}
                    />
                    <Legend formatter={(v) => papelCurto(String(v))} />
                    {papeisPresentes.map((p) => (
                      <Bar
                        key={p}
                        dataKey={p}
                        fill={PAPEL_COR_HEX[p] ?? "#6b7280"}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={32}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-300">
                  Sem dados
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Avaliação Geral ---------- */}
      <section>
        <SectionTitle sub="Percepção global do programa e da ferramenta de avaliação">
          Avaliação Geral
        </SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Distribuição "de forma geral" */}
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-card">
            <p className="text-sm font-semibold text-gray-800">
              Como avalia o PREMUGS?
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              Média{" "}
              <span className="font-bold text-brand-blue">
                {geral.geralMedia !== null ? geral.geralMedia.toFixed(1) : "—"}
              </span>
              /4.0 · {geral.geralN} respostas
            </p>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={geral.geralDistribuicao}>
                  <XAxis
                    dataKey="nota"
                    tickFormatter={(v) => `Nota ${v}`}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} fontSize={11} width={24} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f3f4f6" }}
                    formatter={(v) => [`${v} respostas`, "Quantidade"]}
                    labelFormatter={(l) => `Nota ${l}`}
                  />
                  <Bar dataKey="quantidade" radius={[4, 4, 0, 0]}>
                    {geral.geralDistribuicao.map((d) => (
                      <Cell
                        key={d.nota}
                        fill={d.nota >= 3 ? "#057a55" : d.nota === 2 ? "#d97706" : "#dc2626"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut recomendação */}
          <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-card">
            <p className="text-sm font-semibold text-gray-800">
              Recomendaria o PREMUGS?
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {geral.recomenda.total} respostas
            </p>
            <div className="mt-3 h-64">
              {recomendaData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={recomendaData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      <Cell fill="#057a55" />
                      <Cell fill="#dc2626" />
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v}`, n as string]} />
                    <Legend
                      formatter={(value) => {
                        const item = recomendaData.find((d) => d.name === value);
                        const p =
                          geral.recomenda.total > 0 && item
                            ? Math.round((item.value / geral.recomenda.total) * 100)
                            : 0;
                        return `${value} · ${p}%`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-300">
                  Sem dados
                </div>
              )}
            </div>
          </div>

          {/* Utilidade da ferramenta */}
          <div className="flex flex-col rounded-lg border border-gray-100 bg-white p-5 shadow-card">
            <p className="text-sm font-semibold text-gray-800">
              Utilidade do PREMUGS Avalia
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {geral.ferramentaN} respostas
            </p>
            <div className="flex flex-1 flex-col items-center justify-center">
              <span className="text-5xl font-bold text-brand-green">
                {geral.ferramentaMedia !== null
                  ? geral.ferramentaMedia.toFixed(1)
                  : "—"}
              </span>
              <span className="text-sm text-gray-400">de 4.0</span>
            </div>
          </div>
        </div>
      </section>
        </>
      )}

      {/* ---------- Qualitativas ---------- */}
      {aba === "qualitativas" && (
        <section>
          <SectionTitle sub="Respostas em texto livre, agrupadas por pergunta e papel">
            Respostas qualitativas
          </SectionTitle>
          <QualitativeSection grupos={qualitativas} />
        </section>
      )}

      {/* ---------- Tabela bruta ---------- */}
      {aba === "individuais" && (
        <section>
          <SectionTitle sub="Clique em uma linha para expandir todas as respostas da pessoa">
            Respostas individuais
          </SectionTitle>
          <ResponsesTable respostas={filtradas} />
        </section>
      )}
    </div>
  );
}
