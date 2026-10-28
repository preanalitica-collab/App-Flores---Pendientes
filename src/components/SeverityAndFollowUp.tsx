import React from 'react';
import {
  AlertOctagon,
  Clock,
  CheckCircle,
  Clock3,
  HelpCircle,
  FileCheck2,
  FileX2,
  AlertTriangle,
} from 'lucide-react';
import { SeverityDistribution, PeriodKPIs } from '../types';

interface SeverityAndFollowUpProps {
  distribution?: SeverityDistribution;
  severity?: SeverityDistribution;
  severityData?: SeverityDistribution;
  topDelays?: Array<{
    ranking: number;
    codigoCaso: string;
    estudio: string;
    diasRetraso: number;
    causa: string;
    fechaPrometida: string;
    fechaReal: string;
    estadoOS: string;
    notificacion: string;
  }>;
  kpis?: PeriodKPIs;
  periodo?: string;
  totalIncumplimientos?: number;
}

export const SeverityAndFollowUp: React.FC<SeverityAndFollowUpProps> = ({
  distribution,
  severity,
  severityData,
  topDelays = [],
  kpis,
  periodo = '',
  totalIncumplimientos,
}) => {
  const dist = distribution || severity || severityData || {
    dia1: 0,
    dias2a3: 0,
    dias4a7: 0,
    mas7dias: 0,
    total: 0,
  };

  const total = dist.total || totalIncumplimientos || 1;
  const p1 = Math.round((dist.dia1 / total) * 100);
  const p2a3 = Math.round((dist.dias2a3 / total) * 100);
  const p4a7 = Math.round((dist.dias4a7 / total) * 100);
  const pMas7 = Math.round((dist.mas7dias / total) * 100);

  const openCasesCount = (kpis?.totalCasosSinEstado || 0) + (kpis?.totalCasosEnProceso || 0);

  return (
    <div className="space-y-6 mb-6">
      {/* 1. SEVERIDAD DE LAS DEMORAS (Sección 8) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-[#5F285F]" />
              <h3 className="text-[18px] font-bold text-slate-900">
                Severidad y Magnitud de los Retrasos ({periodo})
              </h3>
            </div>
            <p className="text-[14px] text-slate-600 mt-1">
              Distingue retrasos operativos leves de demoras críticas prolongadas
            </p>
          </div>
        </div>

        {/* Severity Buckets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
          {/* 1 día */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-slate-800">1 Día de demora</span>
              <span className="text-[13px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md">
                Leve
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-[30px] font-black text-slate-900">{dist.dia1}</span>
              <span className="text-[14px] text-slate-600 font-semibold">casos ({p1}%)</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${p1}%` }}></div>
            </div>
          </div>

          {/* 2-3 días */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-slate-800">2 a 3 Días</span>
              <span className="text-[13px] font-bold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-md">
                Moderado
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-[30px] font-black text-slate-900">{dist.dias2a3}</span>
              <span className="text-[14px] text-slate-600 font-semibold">casos ({p2a3}%)</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full" style={{ width: `${p2a3}%` }}></div>
            </div>
          </div>

          {/* 4-7 días */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-slate-800">4 a 7 Días</span>
              <span className="text-[13px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                Relevante
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-[30px] font-black text-slate-900">{dist.dias4a7}</span>
              <span className="text-[14px] text-slate-600 font-semibold">casos ({p4a7}%)</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${p4a7}%` }}></div>
            </div>
          </div>

          {/* Más de 7 días */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-rose-950">Más de 7 Días</span>
              <span className="text-[13px] font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md">
                Crítico
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-[30px] font-black text-rose-900">{dist.mas7dias}</span>
              <span className="text-[14px] text-rose-700 font-semibold">casos ({pMas7}%)</span>
            </div>
            <div className="w-full bg-rose-200 h-2 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-rose-600 h-full rounded-full" style={{ width: `${pMas7}%` }}></div>
            </div>
          </div>
        </div>

        {/* Top 10 Mayores Demoras (Anonymized Case Codes for Executive View) */}
        <div>
          <h4 className="text-[14px] font-bold uppercase tracking-wider text-slate-800 mb-2.5">
            Top 10 Mayores Demoras Registradas (Datos Anonimizados)
          </h4>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-semibold text-[14px]">
                <tr>
                  <th className="py-3 px-3.5">#</th>
                  <th className="py-3 px-3.5">Código de Caso</th>
                  <th className="py-3 px-3.5">Examen / Estudio</th>
                  <th className="py-3 px-3.5 text-right">Días Retraso</th>
                  <th className="py-3 px-3.5">Causa Validada</th>
                  <th className="py-3 px-3.5">Estado OS</th>
                  <th className="py-3 px-3.5">Notificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-[14px]">
                {topDelays.map((item) => (
                  <tr key={item.ranking} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3.5 text-slate-400 font-bold">{item.ranking}</td>
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-700 text-[13.5px]">
                      {item.codigoCaso}
                    </td>
                    <td className="py-3 px-3.5 font-semibold text-slate-900">{item.estudio}</td>
                    <td className="py-3 px-3.5 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md font-bold bg-rose-100 text-rose-800 text-[13.5px]">
                        +{item.diasRetraso} días
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-600">{item.causa}</td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-bold ${
                          item.estadoOS === 'Cerrado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.estadoOS === 'En Proceso'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.estadoOS}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`text-[13.5px] font-semibold ${
                          item.notificacion === 'Con registro'
                            ? 'text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {item.notificacion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. ESTADO DE SEGUIMIENTO Y GESTIÓN (Sección 9) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center space-x-2 mb-4">
          <Clock3 className="w-5 h-5 text-[#5F285F]" />
          <h3 className="text-[18px] font-bold text-slate-900">
            Estado de Seguimiento y Registro de Notificación ({periodo})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Estado OS */}
          <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-slate-50/50">
            <h4 className="text-[14px] font-bold uppercase tracking-wider text-slate-700 mb-3.5 flex items-center justify-between">
              <span>Resolución Operativa (Estado OS)</span>
              <span className="text-slate-500 font-semibold text-[13.5px]">Total: {dist.total}</span>
            </h4>
            <div className="space-y-2.5">
              {/* Cerrado */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-[14px]">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">Cerrado</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-slate-900">{kpis?.totalCasosCerrados ?? 0}</span>
                  <span className="text-slate-500 text-[13px] font-medium">
                    ({Math.round(((kpis?.totalCasosCerrados ?? 0) / total) * 100)}%)
                  </span>
                </div>
              </div>

              {/* En Proceso */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-[14px]">
                <div className="flex items-center gap-2.5">
                  <Clock3 className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-800">En Proceso</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-blue-700">{kpis?.totalCasosEnProceso ?? 0}</span>
                  <span className="text-slate-500 text-[13px] font-medium">
                    ({Math.round(((kpis?.totalCasosEnProceso ?? 0) / total) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Sin estado definido */}
              <div className="flex items-center justify-between p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-[14px]">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-amber-950">Sin estado definido</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-amber-900">{kpis?.totalCasosSinEstado ?? 0}</span>
                  <span className="text-amber-800 text-[13px] font-medium">
                    ({Math.round(((kpis?.totalCasosSinEstado ?? 0) / total) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[13px] text-slate-500 mt-2.5 italic">
              * Regla mandatoria: los campos vacíos se tipifican como "Sin estado definido", nunca como "pendiente".
            </p>
          </div>

          {/* Card 2: Notificación - Registro */}
          <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-slate-50/50">
            <h4 className="text-[14px] font-bold uppercase tracking-wider text-slate-700 mb-3.5 flex items-center justify-between">
              <span>Evidencia de Notificación (Registro LIS)</span>
              <span className="text-slate-500 font-semibold text-[13.5px]">Total: {dist.total}</span>
            </h4>
            <div className="space-y-2.5">
              {/* Con registro */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-[14px]">
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">Con registro documental</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-emerald-700">{kpis?.totalConRegistroNotif ?? 0}</span>
                  <span className="text-slate-500 text-[13px] font-medium">
                    ({Math.round(((kpis?.totalConRegistroNotif ?? 0) / total) * 100)}%)
                  </span>
                </div>
              </div>

              {/* Sin registro */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-[14px]">
                <div className="flex items-center gap-2.5">
                  <FileX2 className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-700">Sin registro en sistema</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-slate-700">{kpis?.totalSinRegistroNotif ?? 0}</span>
                  <span className="text-slate-500 text-[13px] font-medium">
                    ({Math.round(((kpis?.totalSinRegistroNotif ?? 0) / total) * 100)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Mandatory Warning Note (Section 9) */}
            <div className="mt-3.5 bg-blue-50 border border-blue-200 rounded-xl p-3 text-[13.5px] text-blue-900 leading-relaxed">
              <strong>Aclaración Metodológica:</strong> "Sin registro" representa exclusivamente que no se ha
              cargado constancia escrita en el campo del sistema, no significa que el paciente no haya sido
              notificado.
            </div>
          </div>
        </div>

        {/* Visual Risk Alert for Open Cases (Section 9) */}
        {openCasesCount > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl p-4 text-[14px] text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-bold text-amber-950 text-[15px]">
                Alerta de Gestión: ⚠ {openCasesCount} casos fuera de plazo continúan sin cierre documentado.
              </p>
              <p className="text-amber-800 mt-1">
                Existen {kpis?.totalCasosSinEstado ?? 0} casos clasificados como <em>"Sin estado definido"</em> y{' '}
                {kpis?.totalCasosEnProceso ?? 0} casos <em>"En Proceso"</em> que requieren seguimiento operativo en el LIS
                para completar el ciclo de no conformidades ISO 15189.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
