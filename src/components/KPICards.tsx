import React from 'react';
import {
  CheckCircle,
  Users,
  Clock,
  AlertOctagon,
  HelpCircle,
  TrendingDown,
  Info,
} from 'lucide-react';
import { PeriodKPIs } from '../types';

interface KPICardsProps {
  kpis: PeriodKPIs;
  periodo: string;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpis, periodo }) => {
  const isPending = kpis.estadoCarga === 'Pendiente de carga';
  const isPartial = kpis.estadoCarga.startsWith('Cargado (parcial)');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
      {/* KPI 1: Cumplimiento de Plazos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow transition relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] sm:text-[15px] font-bold uppercase tracking-wider text-slate-700">
              % Cumplimiento Global
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-2">
            {isPending ? (
              <div className="text-[24px] font-bold text-slate-400">Sin datos</div>
            ) : isPartial ? (
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-bold text-amber-600">Dato pendiente</span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-[30px] sm:text-[34px] font-black text-slate-900 tracking-tight leading-none">
                  {kpis.cumplimientoTexto}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-[13.5px] sm:text-[14px] text-slate-600 font-medium flex items-center gap-1.5 border-t border-slate-100 pt-3">
          <span className="text-slate-500">Base:</span>
          <span>{kpis.cumplimientoDetalle}</span>
        </div>
      </div>

      {/* KPI 2: Pacientes Fuera de Plazo */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow transition relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] sm:text-[15px] font-bold uppercase tracking-wider text-slate-700">
              Pacientes Fuera de Plazo
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-2">
            {isPending ? (
              <div className="text-[24px] font-bold text-slate-400">Sin datos</div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-[30px] sm:text-[34px] font-black text-slate-900 tracking-tight leading-none">
                  {kpis.pacientesFueraPlazo}
                </span>
                <span className="text-[14px] font-bold text-slate-500">
                  pacientes únicos
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-[13.5px] sm:text-[14px] text-slate-600 font-medium flex items-center justify-between border-t border-slate-100 pt-3">
          <span>Estudios afectados:</span>
          <span className="font-bold text-slate-800">
            {isPending ? '-' : `${kpis.estudiosFueraPlazo} exámenes`}
          </span>
        </div>
      </div>

      {/* KPI 3: Mediana de Demora */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow transition relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5">
              <span className="text-[14px] sm:text-[15px] font-bold uppercase tracking-wider text-slate-700">
                Mediana de Demora
              </span>
              <div className="group relative cursor-pointer" title="Se usa mediana en lugar de promedio para evitar distorsión por casos extremos.">
                <HelpCircle className="w-4 h-4 text-slate-400" />
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#F7F2F7] text-[#5F285F] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#5F285F]" />
            </div>
          </div>

          <div className="mt-2">
            {isPending ? (
              <div className="text-[24px] font-bold text-slate-400">Sin datos</div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[30px] sm:text-[34px] font-black text-slate-900 tracking-tight leading-none">
                  {kpis.medianaDemora}
                </span>
                <span className="text-[14px] font-bold text-slate-600">días corridos</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-[13.5px] sm:text-[14px] text-slate-600 font-medium flex items-center gap-1.5 border-t border-slate-100 pt-3">
          <Info className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="truncate">Percentil 50 (tendencia central real)</span>
        </div>
      </div>

      {/* KPI 4: Demora Máxima */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow transition relative overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] sm:text-[15px] font-bold uppercase tracking-wider text-slate-700">
              Demora Máxima
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-2">
            {isPending ? (
              <div className="text-[24px] font-bold text-slate-400">Sin datos</div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[30px] sm:text-[34px] font-black text-amber-700 tracking-tight leading-none">
                  {kpis.maximaDemora}
                </span>
                <span className="text-[14px] font-bold text-slate-600">días de retraso</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-[13.5px] sm:text-[14px] text-slate-600 font-medium flex items-center justify-between border-t border-slate-100 pt-3">
          <span>Caso más crítico:</span>
          <span className="font-bold text-amber-800">
            {isPending ? '-' : 'Derivación / Especial'}
          </span>
        </div>
      </div>
    </div>
  );
};
