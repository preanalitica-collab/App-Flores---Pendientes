import React from 'react';
import {
  FileText,
  AlertCircle,
  Repeat,
  Info,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { RankingEstudioRow, ResumenMensualRow } from '../types';

interface TopStudiesAnalysisProps {
  estudios?: RankingEstudioRow[];
  periodo?: string;
  resumenList?: ResumenMensualRow[];
}

export const TopStudiesAnalysis: React.FC<TopStudiesAnalysisProps> = ({
  estudios = [],
  periodo = '',
  resumenList = [],
}) => {
  const loadedMonthsCount = (resumenList || []).filter(
    (r) => r?.EstadoCarga !== 'Pendiente de carga'
  ).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#5F285F]" />
            <h3 className="text-[18px] font-bold text-slate-900">
              Top 10 Prestaciones / Estudios con Mayor Desvío ({periodo})
            </h3>
          </div>
          <p className="text-[14px] text-slate-600 mt-1">
            Estratificación por volumen de retrasos, mediana de demora y severidad máxima
          </p>
        </div>
      </div>

      {estudios.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-[14px] bg-slate-50 rounded-xl">
          No hay estudios registrados para este período.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold text-[14px]">
              <tr>
                <th className="py-3 px-3.5">#</th>
                <th className="py-3 px-3.5">Examen / Estudio Normalizado</th>
                <th className="py-3 px-3.5 text-right">Cantidad</th>
                <th className="py-3 px-3.5 text-right">% del Período</th>
                <th className="py-3 px-3.5 text-right">Mediana Demora</th>
                <th className="py-3 px-3.5 text-right">Demora Máxima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-[14px]">
              {estudios.map((est, idx) => (
                <tr
                  key={est.Estudio}
                  className="hover:bg-slate-50 transition"
                >
                  <td className="py-3 px-3.5 text-slate-400 font-bold">{idx + 1}</td>
                  <td className="py-3 px-3.5 font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>{est.Estudio}</span>
                  </td>
                  <td className="py-3 px-3.5 text-right font-bold text-[#5F285F]">
                    {est.Cantidad}
                  </td>
                  <td className="py-3 px-3.5 text-right font-medium text-slate-600">
                    {est.PorcentajeTotal}%
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-semibold text-[13.5px]">
                      {est.DemoraMediana} d
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-md font-bold text-[13.5px] ${
                        est.DemoraMaxima > 7
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {est.DemoraMaxima} d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Estudios Reincidentes Block (Section 7) */}
      <div className="mt-5 p-5 rounded-xl border border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-2 mb-2.5">
          <Repeat className="w-4 h-4 text-[#5F285F]" />
          <h4 className="text-[14.5px] font-bold uppercase tracking-wider text-slate-800">
            Estudios Reincidentes (Persistencia Multi-Período)
          </h4>
        </div>

        {loadedMonthsCount < 3 ? (
          <div className="flex items-start gap-3 text-[14px] text-slate-600 bg-white p-4 rounded-xl border border-slate-200">
            <Info className="w-5 h-5 text-[#744174] mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              <p className="font-semibold text-slate-900 text-[14.5px]">
                Datos insuficientes para evaluar recurrencia sistemática:
              </p>
              <p className="mt-1 text-slate-600 text-[14px]">
                Actualmente se cuenta con {loadedMonthsCount} períodos ingresados. Por rigor metodológico de calidad
                (ISO 15189:2022), la evaluación de recurrencia requiere una serie mínima de 3 meses consecutivos
                cargados para distinguir variaciones puntuales de problemas crónicos en procesos analíticos.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-[14px] text-slate-700">
            Evaluación de recurrencia en curso sobre la serie histórica.
          </div>
        )}
      </div>
    </div>
  );
};
