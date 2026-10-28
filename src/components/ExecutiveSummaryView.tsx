import React from 'react';
import {
  ShieldCheck,
  Clock,
  HeartHandshake,
  TestTube2,
  Activity,
  Award,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { PeriodKPIs } from '../types';

interface ExecutiveSummaryViewProps {
  kpis: PeriodKPIs;
  periodo: string;
  onNavigateToPlazos: () => void;
}

export const ExecutiveSummaryView: React.FC<ExecutiveSummaryViewProps> = ({
  kpis,
  periodo,
  onNavigateToPlazos,
}) => {
  return (
    <div className="space-y-6 mb-6">
      {/* Banner / Strategic Question */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-md">
        <div className="max-w-3xl">
          <span className="text-[13px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-3 py-1 rounded-full">
            Marco Estratégico • ISO 9001 & ISO 15189:2022
          </span>
          <h2 className="text-xl sm:text-[26px] sm:leading-tight font-extrabold mt-3.5 tracking-tight">
            ¿Qué está comprometiendo actualmente la confiabilidad del laboratorio y dónde deberíamos intervenir primero?
          </h2>
          <p className="text-[14.5px] text-slate-300 mt-2.5 leading-relaxed">
            Tablero de control ejecutivo para la Dirección y Gerencias con el ciclo: <strong className="text-white">MONITOREAR → DETECTAR → PRIORIZAR → ACTUAR</strong>.
          </p>
        </div>
      </div>

      {/* 5 Strategic Axes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* EJE 1: CUMPLIMIENTO DE PLAZOS (ACTIVE) */}
        <div className="bg-white rounded-2xl border-2 border-[#5F285F] p-5 sm:p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#5F285F] text-white text-[13px] font-bold px-3.5 py-1.5 rounded-bl-xl uppercase tracking-wider">
            Módulo Activo
          </div>

          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#F7F2F7] text-[#5F285F] flex items-center justify-center">
                <Clock className="w-6 h-6 text-[#5F285F]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-[17px]">
                  1. Cumplimiento de Plazos (TAT)
                </h3>
                <span className="text-[13.5px] text-[#5F285F] font-semibold">
                  Período: {periodo}
                </span>
              </div>
            </div>

            <p className="text-[14px] text-slate-600 mb-4 leading-relaxed">
              Monitoreo del tiempo de respuesta comprometido, tipificación de causas de retraso y resolución de no conformidades.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-[14px] mb-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">% Cumplimiento Global:</span>
                <span className="font-bold text-slate-900 text-[16px]">{kpis.cumplimientoTexto}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Pacientes con Desvío:</span>
                <span className="font-bold text-rose-700 text-[15px]">{kpis.pacientesFueraPlazo ?? '-'} pacientes</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Mediana de Demora:</span>
                <span className="font-bold text-slate-800 text-[15px]">{kpis.medianaDemora ?? '-'} días</span>
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToPlazos}
            className="w-full bg-[#5F285F] hover:bg-[#452045] text-white py-2.5 px-4 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
          >
            <span>Ver Dashboard de Plazos</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* EJE 2: EXPERIENCIA DEL PACIENTE (EN DESARROLLO) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between opacity-80">
          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-700 text-[17px]">
                  2. Experiencia del Paciente
                </h3>
                <span className="text-[13px] text-slate-500 font-medium">
                  Módulo en desarrollo
                </span>
              </div>
            </div>

            <p className="text-[14px] text-slate-500 mb-4 leading-relaxed">
              Índice Net Promoter Score (NPS), tiempos de espera en sala de extracciones, encuestas de satisfacción y gestión de reclamos.
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center text-[14px] text-slate-500">
              Integración de encuestas post-atención y recepción programada para próximas versiones.
            </div>
          </div>

          <div className="text-center pt-3 text-[14px] font-semibold text-slate-400">
            Próximamente
          </div>
        </div>

        {/* EJE 3: CALIDAD PREANALÍTICA (EN DESARROLLO) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between opacity-80">
          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <TestTube2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-700 text-[17px]">
                  3. Calidad Preanalítica
                </h3>
                <span className="text-[13px] text-slate-500 font-medium">
                  Módulo en desarrollo
                </span>
              </div>
            </div>

            <p className="text-[14px] text-slate-500 mb-4 leading-relaxed">
              Tasa de rechazo de muestras, hemólisis, lipemia, volumen insuficiente y errores en la identificación de tubos primarios.
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center text-[14px] text-slate-500">
              Captura de incidentes preanalíticos en fase de diseño de protocolo.
            </div>
          </div>

          <div className="text-center pt-3 text-[14px] font-semibold text-slate-400">
            Próximamente
          </div>
        </div>

        {/* EJE 4: CALIDAD ANALÍTICA (EN DESARROLLO) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between opacity-80">
          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-700 text-[17px]">
                  4. Calidad Analítica
                </h3>
                <span className="text-[13px] text-slate-500 font-medium">
                  Módulo en desarrollo
                </span>
              </div>
            </div>

            <p className="text-[14px] text-slate-500 mb-4 leading-relaxed">
              Control de calidad interno (IQC), reglas de Westgard, coeficientes de variación y evaluación externa de la calidad (PEEC / EQA).
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center text-[14px] text-slate-500">
              Módulo analítico en desarrollo según especificaciones CLSI C24.
            </div>
          </div>

          <div className="text-center pt-3 text-[14px] font-semibold text-slate-400">
            Próximamente
          </div>
        </div>

        {/* EJE 5: AVANCE ISO 15189:2022 (EN DESARROLLO) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between opacity-80">
          <div>
            <div className="flex items-center space-x-3 mb-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-700 text-[17px]">
                  5. Adecuación ISO 15189:2022
                </h3>
                <span className="text-[13px] text-slate-500 font-medium">
                  Módulo en desarrollo
                </span>
              </div>
            </div>

            <p className="text-[14px] text-slate-500 mb-4 leading-relaxed">
              Matriz de riesgos, cumplimiento de cláusulas normativas, indicadores de calidad y seguimiento de planes de acción correctiva (CAPA).
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center text-[14px] text-slate-500">
              Monitoreo de adecuación documental y operativa en proceso.
            </div>
          </div>

          <div className="text-center pt-3 text-[14px] font-semibold text-slate-400">
            Próximamente
          </div>
        </div>
      </div>
    </div>
  );
};
