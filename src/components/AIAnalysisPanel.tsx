import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  AlertTriangle,
  Target,
  FileCheck,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import {
  AIAnalysisResult,
  PeriodKPIs,
  RankingCausaRow,
  RankingEstudioRow,
  ResumenMensualRow,
  MonthName,
} from '../types';

interface AIAnalysisPanelProps {
  selectedMonth: MonthName;
  selectedYear: number;
  kpis: PeriodKPIs;
  causas?: RankingCausaRow[];
  estudios?: RankingEstudioRow[];
  resumenList?: ResumenMensualRow[];
}

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  selectedMonth,
  selectedYear,
  kpis,
  causas = [],
  estudios = [],
  resumenList = [],
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [sourceTag, setSourceTag] = useState<string>('gemini-3.7-flash');

  const periodo = `${selectedMonth} ${selectedYear}`;
  const isPending = kpis.estadoCarga === 'Pendiente de carga';

  // Find previous month for comparison
  const previousMonthItem = (resumenList || []).find((r) => {
    // Simple lookup: July before August
    if (selectedMonth === 'Agosto') return r?.Mes === 'Julio' && r?.Año === selectedYear;
    return false;
  });

  const fetchAnalysis = async () => {
    if (isPending) {
      setAnalysis(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo,
          datosMesActual: {
            mes: selectedMonth,
            año: selectedYear,
            kpis,
          },
          datosMesAnterior:
            previousMonthItem && previousMonthItem.EstadoCarga !== 'Pendiente de carga'
              ? previousMonthItem
              : null,
          resumenRanking: {
            causas: causas.slice(0, 6),
            estudios: estudios.slice(0, 6),
          },
        }),
      });

      const data = await response.json();
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        setSourceTag(data.source || 'gemini-3.7-flash');
      }
    } catch (err) {
      console.error('Error fetching AI analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [selectedMonth, selectedYear, kpis.estadoCarga]);

  const handleCopy = () => {
    if (!analysis) return;
    const text = `ANÁLISIS DE CONFIABILIDAD Y PLAZOS DE ENTREGA - ${periodo}
=========================================================
1. QUÉ CAMBIÓ:
${analysis.queCambio}

2. PRINCIPALES CAUSAS:
${analysis.principalesCausas.map((c) => `- ${c}`).join('\n')}

3. CONCENTRACIÓN PARETO:
${analysis.concentracion}

4. SEVERIDAD DE LAS DEMORAS:
${analysis.severidad}

5. RECURRENCIA:
${analysis.recurrencia}

6. RIESGOS GERENCIALES DETECTADOS:
${analysis.riesgos.map((r) => `⚠ ${r}`).join('\n')}

7. PRIORIDADES DE INTERVENCIÓN:
${analysis.prioridades.map((p, i) => `${i + 1}. ${p}`).join('\n')}
=========================================================
Laboratorio Clínico • Gestión ISO 9001 e ISO 15189:2022`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isPending) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-sm mb-6">
        <Sparkles className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
        <p className="font-bold text-base text-slate-700">Análisis Inteligente No Disponible</p>
        <p className="text-sm text-slate-500 mt-1.5 max-w-lg mx-auto">
          El período {periodo} se encuentra pendiente de carga. Selecciona Julio o Agosto para ver el análisis de calidad.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-[#2c132c] text-slate-100 rounded-2xl border border-slate-800 p-6 sm:p-7 shadow-xl mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#5F285F]/50 border border-[#744174]/60 flex items-center justify-center text-[#E9DDE9] shadow-xs shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Análisis Inteligente del Período ({periodo})
              </h3>
              <span className="bg-[#5F285F]/40 text-[#E9DDE9] border border-[#744174]/60 text-[12.5px] px-3 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {sourceTag.includes('gemini') ? 'Gemini 3.7 Flash' : 'Motor Analítico ISO'}
              </span>
            </div>
            <p className="text-[14px] text-slate-300 mt-0.5">
              Evaluación ejecutiva de desvíos, riesgos de oportunidad y prioridades de mejora
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2.5 self-start sm:self-auto shrink-0">
          <button
            onClick={fetchAnalysis}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[14px] font-semibold border border-slate-700 transition shadow-xs cursor-pointer"
            title="Recalcular análisis con datos vigentes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analizando...' : 'Actualizar'}</span>
          </button>

          <button
            onClick={handleCopy}
            disabled={!analysis}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-[#5F285F] hover:bg-[#452045] text-white text-[14px] font-bold shadow-xs transition cursor-pointer"
            title="Copiar reporte ejecutivo para minuta"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copiado' : 'Copiar Reporte'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-400 mb-3" />
          <p className="text-base font-semibold text-slate-200">
            Sintetizando desvíos y evaluando riesgos analíticos con Gemini...
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Aplicando reglas de prudencia causal y criterios ISO 15189:2022
          </p>
        </div>
      ) : analysis ? (
        <div className="mt-6 space-y-6 text-sm text-slate-200 leading-relaxed">
          {/* 1. Qué cambió & Concentración */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Qué cambió */}
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 sm:p-5">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-2.5">
                <TrendingUp className="w-4 h-4" />
                <span className="uppercase text-xs tracking-wider">1. Qué cambió en el período</span>
              </div>
              <p className="text-slate-100 text-sm leading-relaxed">{analysis.queCambio}</p>
            </div>

            {/* Concentración Pareto */}
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 sm:p-5">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold mb-2.5">
                <Target className="w-4 h-4" />
                <span className="uppercase text-xs tracking-wider">2. Concentración de Desvíos (Pareto)</span>
              </div>
              <p className="text-slate-100 text-sm leading-relaxed">{analysis.concentracion}</p>
            </div>
          </div>

          {/* 2. Principales Causas & Severidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Principales Causas */}
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 sm:p-5">
              <div className="flex items-center space-x-2 text-blue-400 font-bold mb-2.5">
                <FileCheck className="w-4 h-4" />
                <span className="uppercase text-xs tracking-wider">3. Causas Principales Validadas</span>
              </div>
              <ul className="space-y-2 text-slate-100 text-sm">
                {analysis.principalesCausas.map((c, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-blue-400 font-bold text-base leading-none mt-0.5">•</span>
                    <span className="leading-snug">{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Severidad y Recurrencia */}
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 text-amber-400 font-bold mb-2.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="uppercase text-xs tracking-wider">4. Severidad de las Demoras</span>
                </div>
                <p className="text-slate-100 text-sm leading-relaxed mb-3">{analysis.severidad}</p>
              </div>

              <div className="pt-3 border-t border-slate-700/80">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Evaluación de Recurrencia:
                </span>
                <p className="text-slate-300 italic text-xs leading-relaxed">{analysis.recurrencia}</p>
              </div>
            </div>
          </div>

          {/* 3. Riesgos Gerenciales Detectados */}
          <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl p-4 sm:p-5">
            <div className="flex items-center space-x-2 text-rose-400 font-bold mb-3">
              <ShieldAlert className="w-4 h-4" />
              <span className="uppercase text-xs tracking-wider">
                5. Riesgos Identificados para Dirección y Calidad
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-2">
              {analysis.riesgos.map((r, i) => (
                <div
                  key={i}
                  className="bg-slate-900/90 border border-rose-900/50 p-3.5 rounded-xl text-slate-100 text-sm flex items-start gap-2.5 leading-snug"
                >
                  <span className="text-rose-400 font-bold shrink-0 mt-0.5">⚠</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Cinco Prioridades de Acción Recomendadas */}
          <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-4 sm:p-5">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold mb-3">
              <Check className="w-4 h-4" />
              <span className="uppercase text-xs tracking-wider">
                6. Plan de Acción: Top 5 Prioridades Estratégicas
              </span>
            </div>
            <div className="space-y-2.5 mt-2">
              {analysis.prioridades.map((p, i) => (
                <div
                  key={i}
                  className="bg-slate-900/90 border border-emerald-900/50 p-3 rounded-xl text-slate-100 text-sm flex items-start gap-3"
                >
                  <span className="w-6 h-6 rounded-full bg-emerald-800/80 text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-snug pt-0.5">{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Methodological Note */}
          <div className="text-xs text-slate-400 italic pt-2 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Nota metodológica: El análisis IA opera bajo el principio de asociación y prudencia analítica. No
              infiere causalidad médica definitiva ni diagnósticos de pacientes.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
