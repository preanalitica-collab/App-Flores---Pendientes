import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Layers, AlertTriangle, Filter, CheckCircle2, ChevronRight } from 'lucide-react';
import { RankingCausaRow, IncumplimientoRow } from '../types';

interface CausesAnalysisProps {
  causas?: RankingCausaRow[];
  incumplimientos?: IncumplimientoRow[];
  periodo?: string;
}

export const CausesAnalysis: React.FC<CausesAnalysisProps> = ({
  causas = [],
  incumplimientos = [],
  periodo = '',
}) => {
  const [selectedCausa, setSelectedCausa] = useState<string | null>(null);

  const totalDesvios = (causas || []).reduce((acc, c) => acc + (c.Cantidad || 0), 0);

  // Drilldown studies for selected cause
  const filteredIncumplimientos = selectedCausa
    ? (incumplimientos || []).filter((i) => i?.CausaValidada === selectedCausa)
    : [];

  const affectedStudiesSummary = filteredIncumplimientos.reduce((acc, item) => {
    acc[item.ExamenEstudio] = (acc[item.ExamenEstudio] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedAffectedStudies = Object.entries(affectedStudiesSummary).sort(
    (a, b) => Number(b[1]) - Number(a[1])
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[#5F285F]" />
            <h3 className="text-[18px] font-bold text-slate-900">
              Estratificación de Causas de Incumplimiento ({periodo})
            </h3>
          </div>
          <p className="text-[14px] text-slate-600 mt-1">
            Agrupamiento por categoría estándar validada • Total: {totalDesvios} eventos registrados
          </p>
        </div>

        {selectedCausa && (
          <button
            onClick={() => setSelectedCausa(null)}
            className="text-[14px] font-semibold text-[#5F285F] hover:text-[#452045] bg-[#F7F2F7] px-3 py-1.5 rounded-lg border border-[#E9DDE9] transition flex items-center gap-1.5 self-start cursor-pointer"
          >
            <span>Quitar filtro ({selectedCausa})</span>
            <span>✕</span>
          </button>
        )}
      </div>

      {causas.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-[14px] bg-slate-50 rounded-xl">
          No hay causas registradas para este período.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Chart View (7 cols) */}
          <div className="lg:col-span-7">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={causas}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#475569', fontSize: 13 }} />
                  <YAxis
                    type="category"
                    dataKey="Causa"
                    width={180}
                    tick={{ fill: '#1e293b', fontSize: 13 }}
                    tickFormatter={(val) =>
                      val.length > 24 ? `${val.substring(0, 24)}...` : val
                    }
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload as RankingCausaRow;
                        return (
                          <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg text-[14px] max-w-xs">
                            <p className="font-bold text-slate-100">{d.Causa}</p>
                            <p className="text-emerald-400 font-semibold mt-1">
                              Cantidad: {d.Cantidad} estudios ({d.PorcentajeTotal}%)
                            </p>
                            {d.Causa.includes('revisar carga') && (
                              <p className="text-amber-300 text-[13px] mt-1">
                                Oportunidad de mejora: registro sin tipificación de origen.
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="Cantidad"
                    radius={[0, 4, 4, 0]}
                    onClick={(data) => setSelectedCausa(data.Causa)}
                    className="cursor-pointer"
                  >
                    {causas.map((entry, index) => {
                      const isUnregistered = entry.Causa.includes('revisar carga');
                      const isSelected = selectedCausa === entry.Causa;
                      let fill = '#5F285F'; // institutional purple
                      if (isUnregistered) fill = '#f59e0b'; // amber for unclassified
                      if (isSelected) fill = '#744174'; // medium purple if selected
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[13px] text-slate-500 mt-2 italic text-center">
              * Haz clic en una barra para ver los estudios específicos afectados por esa causa.
            </p>
          </div>

          {/* Table & Drilldown View (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-[14px]">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold text-[14px]">
                  <tr>
                    <th className="py-2.5 px-3">Causa Validada</th>
                    <th className="py-2.5 px-2 text-right">Cant.</th>
                    <th className="py-2.5 px-2 text-right">% Total</th>
                    <th className="py-2.5 px-2 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 text-[14px]">
                  {causas.map((c) => {
                    const isUnregistered = c.Causa.includes('revisar carga');
                    const isSelected = selectedCausa === c.Causa;
                    return (
                      <tr
                        key={c.Causa}
                        onClick={() => setSelectedCausa(isSelected ? null : c.Causa)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#F7F2F7] font-medium text-[#5F285F]'
                            : isUnregistered
                            ? 'bg-amber-50/50 hover:bg-amber-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3 flex items-center gap-1.5">
                          {isUnregistered && (
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <span className="truncate max-w-[160px]" title={c.Causa}>
                            {c.Causa}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-900">{c.Cantidad}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600 font-medium">
                          {c.PorcentajeTotal}%
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <ChevronRight className="w-4 h-4 text-slate-400 inline" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Drilldown Box */}
            {selectedCausa && (
              <div className="mt-3 p-3.5 bg-[#F7F2F7] border border-[#E9DDE9] rounded-xl text-[14px]">
                <p className="font-bold text-[#5F285F] mb-1.5 flex items-center justify-between text-[14px]">
                  <span>Estudios afectados por: {selectedCausa}</span>
                  <span className="text-[13px] bg-[#E9DDE9] text-[#5F285F] px-2 py-0.5 rounded-md font-bold">
                    {filteredIncumplimientos.length} casos
                  </span>
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 text-slate-700 text-[13.5px]">
                  {sortedAffectedStudies.map(([name, count]) => (
                    <div key={name} className="flex justify-between items-center text-[13.5px]">
                      <span className="truncate max-w-[200px]" title={name}>{name}</span>
                      <span className="font-bold text-[#5F285F]">{count} veces</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Clarification on "Causa no registrada" (Section 6) */}
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-[14px] text-amber-900 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <span className="font-bold text-amber-950">Transparencia en Calidad de Carga:</span>{' '}
          La categoría <strong>"Causa no registrada / revisar carga"</strong> se mantiene deliberadamente visible en
          el ranking para que la Dirección identifique oportunidades de capacitación operativa con el personal
          técnico, asegurando la trazabilidad completa del desvío exigida por ISO 15189:2022.
        </div>
      </div>
    </div>
  );
};
