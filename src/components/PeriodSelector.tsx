import React from 'react';
import { Calendar, AlertTriangle, CheckCircle2, Info, PlusCircle, Clock, User, ShieldCheck } from 'lucide-react';
import { MonthName, ResumenMensualRow, MonthlyPeriodMetadata } from '../types';

interface PeriodSelectorProps {
  selectedMonth: MonthName;
  setSelectedMonth: (month: MonthName) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  resumenList?: ResumenMensualRow[];
  periodMetadata?: Record<string, MonthlyPeriodMetadata>;
  onOpenDataSync: () => void;
  onUpdateDenominator?: (month: MonthName, year: number, val: number) => void;
}

const MONTHS: MonthName[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const YEARS = [2026, 2025];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  resumenList = [],
  periodMetadata = {},
  onOpenDataSync,
}) => {
  const currentResumen = (resumenList || []).find(
    (r) => r?.Mes === selectedMonth && r?.Año === selectedYear
  );

  const estadoCarga = currentResumen?.EstadoCarga || 'Pendiente de carga';
  const periodKey = `${selectedMonth}-${selectedYear}`;
  const meta = periodMetadata[periodKey];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-[15px]">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Período de Análisis:</span>
          </div>

          {/* Month Dropdown */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value as MonthName)}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-[14px] font-semibold rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-[#5F285F] focus:border-[#5F285F] pr-8 cursor-pointer"
            >
              {MONTHS.map((m) => {
                const item = resumenList.find((r) => r.Mes === m && r.Año === selectedYear);
                const isLoaded = item && item.EstadoCarga !== 'Pendiente de carga';
                return (
                  <option key={m} value={m}>
                    {m} {isLoaded ? '• Con datos' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Year Dropdown */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 text-slate-900 text-[14px] font-semibold rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-[#5F285F] focus:border-[#5F285F] cursor-pointer"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Status Badge */}
          <div className="flex items-center">
            {estadoCarga === 'Cargado (completo)' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Cargado (completo)</span>
              </span>
            )}

            {estadoCarga.startsWith('Cargado (parcial)') && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13.5px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Carga parcial: falta denominador de atendidos</span>
              </span>
            )}

            {estadoCarga === 'Pendiente de carga' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Info className="w-4 h-4 text-slate-500" />
                <span>Pendiente de carga</span>
              </span>
            )}
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenDataSync}
            className="text-[14px] font-bold text-[#5F285F] hover:text-[#452045] bg-[#F7F2F7] hover:bg-[#E9DDE9] px-4 py-2 rounded-xl border border-[#E9DDE9] transition flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <PlusCircle className="w-4 h-4 text-[#5F285F]" />
            <span>Cargar Datos / Nuevo Mes</span>
          </button>
        </div>
      </div>

      {/* Central Persistence & Uploader Metadata Bar */}
      {estadoCarga !== 'Pendiente de carga' && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Última actualización:{' '}
                <strong className="text-slate-800 font-semibold">
                  {meta?.fechaActualizacion || (selectedMonth === 'Julio' ? '31/07/2026 20:00' : '18/08/2026 18:00')}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-600">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Datos cargados por:{' '}
                <strong className="text-slate-800 font-semibold">
                  {meta?.cargadoPor || 'Dirección de Calidad (Sistema LIS)'}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg text-[12px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Base Central Compartida</span>
          </div>
        </div>
      )}

      {/* Informative Warning for Partial Month (Agosto) */}
      {estadoCarga.startsWith('Cargado (parcial)') && (
        <div className="mt-3.5 bg-amber-50 border border-amber-200 text-amber-950 text-[14px] rounded-xl p-3.5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <p className="font-bold">Estado de Carga Parcial ({selectedMonth} {selectedYear}):</p>
            <p className="mt-1 text-amber-900">
              Se disponen de los conteos de pacientes fuera de plazo (62 pacientes) y medianas de retraso, pero el
              porcentaje global de cumplimiento figura como <strong>"Dato pendiente"</strong> debido a que aún no se
              ha ingresado el total de pacientes atendidos del período.
            </p>
          </div>
        </div>
      )}

      {/* Warning for Pending Month */}
      {estadoCarga === 'Pendiente de carga' && (
        <div className="mt-3.5 bg-slate-50 border border-slate-200 text-slate-800 text-[14px] rounded-xl p-3.5 flex items-start gap-3">
          <Info className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <p className="font-bold">Período sin registros consolidados ({selectedMonth} {selectedYear}):</p>
            <p className="mt-1 text-slate-600">
              Este período todavía no tiene datos cargados. Por regla metodológica, se omite de los cálculos históricos
              para no generar ceros artificiales.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
