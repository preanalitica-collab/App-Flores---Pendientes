import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart3, AlertCircle, Info } from 'lucide-react';
import { ResumenMensualRow } from '../types';

interface MonthlyEvolutionChartProps {
  resumenList?: ResumenMensualRow[];
  selectedYear?: number;
}

export const MonthlyEvolutionChart: React.FC<MonthlyEvolutionChartProps> = ({
  resumenList = [],
  selectedYear = 2026,
}) => {
  const [chartType, setChartType] = useState<'cumplimiento' | 'pacientes'>('pacientes');

  // Filter only loaded months (excluding "Pendiente de carga")
  const loadedMonths = (resumenList || []).filter(
    (r) => r?.Año === selectedYear && r?.EstadoCarga !== 'Pendiente de carga'
  );

  const chartData = loadedMonths.map((m) => {
    const isPartial = m.EstadoCarga.startsWith('Cargado (parcial)');
    return {
      mes: m.Mes,
      estadoCarga: m.EstadoCarga,
      pacientesFuera: m.PacientesUnicosFueraPlazo,
      estudiosFuera: m.EstudiosFueraPlazo,
      porcentajeCumplimiento: isPartial ? null : m.PorcentajeCumplimiento,
      porcentajeFuera: isPartial ? null : m.PorcentajeFueraPlazo,
      mediana: m.MedianaRetraso,
      maximo: m.MaximoRetraso,
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm mb-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-[#5F285F]" />
            <h3 className="text-[18px] font-bold text-slate-900">
              Evolución Mensual del Desempeño ({selectedYear})
            </h3>
          </div>
          <p className="text-[14px] text-slate-600 mt-1">
            Monitoreo comparativo de desvíos temporales en la entrega de resultados
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200">
          <button
            onClick={() => setChartType('pacientes')}
            className={`px-3.5 py-1.5 text-[14px] font-semibold rounded-lg transition cursor-pointer ${
              chartType === 'pacientes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cantidad de Pacientes
          </button>
          <button
            onClick={() => setChartType('cumplimiento')}
            className={`px-3.5 py-1.5 text-[14px] font-semibold rounded-lg transition cursor-pointer ${
              chartType === 'cumplimiento'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            % de Cumplimiento
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      {loadedMonths.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <AlertCircle className="w-8 h-8 mb-2 text-slate-400" />
          <p className="text-[14px] font-medium">No hay meses con datos cargados para {selectedYear}</p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'cumplimiento' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fill: '#475569', fontSize: 13.5 }} />
                <YAxis
                  domain={[90, 100]}
                  tick={{ fill: '#475569', fontSize: 13.5 }}
                  unit="%"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg text-[14px]">
                          <p className="font-bold text-slate-200 mb-1">{label} {selectedYear}</p>
                          {data.porcentajeCumplimiento !== null ? (
                            <p className="text-emerald-400 font-semibold">
                              Cumplimiento: {data.porcentajeCumplimiento}%
                            </p>
                          ) : (
                            <p className="text-amber-300 font-semibold">
                              % Cumplimiento: Dato pendiente (falta denominador)
                            </p>
                          )}
                          <p className="text-slate-300 mt-1">
                            Pacientes con desvío: {data.pacientesFuera}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '13.5px' }} />
                <Line
                  type="monotone"
                  dataKey="porcentajeCumplimiento"
                  name="% Cumplimiento de Plazos"
                  stroke="#10b981"
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fill: '#475569', fontSize: 13.5 }} />
                <YAxis tick={{ fill: '#475569', fontSize: 13.5 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg text-[14px]">
                          <p className="font-bold text-slate-200 mb-1">{label} {selectedYear}</p>
                          <p className="text-rose-400 font-semibold">
                            Pacientes fuera de plazo: {data.pacientesFuera}
                          </p>
                          <p className="text-slate-300">
                            Estudios totales afectados: {data.estudiosFuera}
                          </p>
                          <p className="text-blue-300 mt-1">
                            Mediana de demora: {data.mediana} días
                          </p>
                          {data.estadoCarga.startsWith('Cargado (parcial)') && (
                            <p className="text-amber-300 mt-1 text-[13px]">
                              * Carga parcial: Denominador pendiente
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '13.5px' }} />
                <Bar
                  dataKey="pacientesFuera"
                  name="Pacientes Únicos Fuera de Plazo"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
                <Bar
                  dataKey="estudiosFuera"
                  name="Estudios Totales Afectados"
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Expectation Management Box for Directorship (Section 2 & 5) */}
      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-[14px] text-slate-600 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#744174] mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-800">Nota de alcance de serie histórica:</span>{' '}
          Actualmente la base maestra cuenta con 2 períodos ingresados (Julio completo y Agosto parcial). La serie
          comparativa y los análisis de tendencia se enriquecerán automáticamente a medida que se consoliden los
          siguientes meses.
        </div>
      </div>
    </div>
  );
};
