import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  PieChart as PieChartIcon,
  Calendar,
  ArrowRight,
  Target,
  FlaskConical,
  Building2,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import {
  DailyDeliveryEntry,
  IntradayRecord,
} from '../types';
import {
  calculateIntradayKPIs,
  formatISOToDisplayDate,
} from '../services/operationalService';

interface IntradayChartsViewProps {
  dailyHistory?: DailyDeliveryEntry[];
  records?: IntradayRecord[];
  selectedDate?: string | null;
  onSelectDate?: (dateISO: string) => void;
  onNavigateToDeliveries?: () => void;
  lastUpdatedTime?: string | null;
}

// Institutional Flores Color Palette
const COLORS_ESTADOS = [
  '#f59e0b', // Esperando en Unidad (Amber)
  '#3b82f6', // En Proceso (Blue)
  '#5F285F', // Resultado en Interface (Brand Purple)
  '#0d9488', // A Firmar (Teal)
  '#e11d48', // Cuarentena (Rose)
];

const COLORS_PRACTICAS = [
  '#5F285F', // Top 1 (Brand Deep Purple)
  '#744174', // Top 2 (Medium Purple)
  '#2563eb', // Top 3 (Blue)
  '#0284c7', // Top 4 (Sky Blue)
  '#0d9488', // Top 5 (Teal)
  '#94a3b8', // Otras (Slate)
];

const COLORS_SECTORES = [
  '#5F285F', // Sector 1
  '#8b5cf6', // Sector 2
  '#3b82f6', // Sector 3
  '#cbd5e1', // Otros sectores
];

// Custom Tooltip component for Pie charts
const CustomPieTooltip = ({ active, payload, totalLabel = 'Total No Listas' }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700/80 text-[13px] backdrop-blur-xs max-w-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: payload[0].fill || '#5F285F' }} />
          <span className="font-bold text-white truncate">{data.name}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 mt-1 pt-1 border-t border-slate-800 text-[12.5px]">
          <span className="text-slate-300">Cantidad:</span>
          <span className="font-mono font-bold text-emerald-400">{data.value?.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 text-[12.5px] mt-0.5">
          <span className="text-slate-300">% de no listas:</span>
          <span className="font-mono font-bold text-amber-300">
            {typeof data.percentage === 'number' ? data.percentage.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : data.percentage}%
          </span>
        </div>
        {data.descripcion && (
          <p className="text-[11px] text-slate-400 mt-1.5 leading-snug italic border-t border-slate-800/80 pt-1">
            {data.descripcion}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const IntradayChartsView: React.FC<IntradayChartsViewProps> = ({
  dailyHistory = [],
  records = [],
  selectedDate = null,
  onSelectDate = (_dateISO: string) => {},
  onNavigateToDeliveries = () => {},
  lastUpdatedTime = null,
}) => {
  // Determine active entry
  const activeDailyEntry = useMemo(() => {
    if (selectedDate && dailyHistory.length > 0) {
      const match = dailyHistory.find((d) => d.fecha === selectedDate);
      if (match) return match;
    }
    return dailyHistory.length > 0 ? dailyHistory[0] : null;
  }, [dailyHistory, selectedDate]);

  const effectiveRecords = useMemo(() => {
    if (activeDailyEntry?.records && activeDailyEntry.records.length > 0) {
      return activeDailyEntry.records;
    }
    return records;
  }, [activeDailyEntry, records]);

  // KPIs calculation
  const kpis = useMemo(() => {
    const targetDate = activeDailyEntry?.fecha || selectedDate || 'TODAS';
    return calculateIntradayKPIs(effectiveRecords, targetDate, '18:00');
  }, [effectiveRecords, activeDailyEntry, selectedDate]);

  // 1. Data for "¿Qué está pendiente?" (5 status)
  const chartQueEstaPendiente = useMemo(() => {
    const comp = kpis.composicionPendientes;
    const total = kpis.practicasNoListas || 1;

    const raw = [
      {
        name: 'Esperando en Unidad',
        value: comp.esperandoEnUnidad.cantidad,
        percentage: comp.esperandoEnUnidad.porcentaje,
        fill: COLORS_ESTADOS[0],
        descripcion: 'Muestras recepcionadas en unidad periférica pendientes de ingreso o remisión técnica.',
      },
      {
        name: 'En Proceso',
        value: comp.enProceso.cantidad,
        percentage: comp.enProceso.porcentaje,
        fill: COLORS_ESTADOS[1],
        descripcion: 'Muestras en analizador técnico o ejecución de corrida analítica en el laboratorio.',
      },
      {
        name: 'Resultado en Interface',
        value: comp.resultadoEnInterface.cantidad,
        percentage: comp.resultadoEnInterface.porcentaje,
        fill: COLORS_ESTADOS[2],
        descripcion: 'Dato analítico transferido al LIS, pendiente de validación bioquímica por profesional.',
      },
      {
        name: 'A Firmar',
        value: comp.aFirmar.cantidad,
        percentage: comp.aFirmar.porcentaje,
        fill: COLORS_ESTADOS[3],
        descripcion: 'Protocolo completado técnicamente, pendiente de firma digital / autorización final.',
      },
      {
        name: 'Cuarentena',
        value: comp.cuarentena.cantidad,
        percentage: comp.cuarentena.porcentaje,
        fill: COLORS_ESTADOS[4],
        descripcion: 'Determinación retenida por verificación analítica, repetición de corrida o dilución.',
      },
    ];

    // Filter only those with value > 0 for chart, but return all for table
    return {
      chartData: raw.filter((r) => r.value > 0),
      tableData: raw,
      total: kpis.practicasNoListas,
    };
  }, [kpis]);

  // 2. Data for "Top 5 de Prácticas No Listas"
  const chartTopPracticas = useMemo(() => {
    const list = kpis.topPracticasNoListas || [];
    const totalNoListas = kpis.practicasNoListas || 1;
    const top5 = list.slice(0, 5);

    const top5Count = top5.reduce((sum, item) => sum + item.cantidad, 0);
    const otrasCount = Math.max(0, kpis.practicasNoListas - top5Count);

    const chartData = top5.map((item, idx) => ({
      name: item.estudio,
      value: item.cantidad,
      percentage: item.porcentaje,
      fill: COLORS_PRACTICAS[idx % COLORS_PRACTICAS.length],
      descripcion: `Top ${idx + 1} de prácticas con mayor demora técnica en la jornada`,
    }));

    if (otrasCount > 0) {
      chartData.push({
        name: 'Otras prácticas pendientes',
        value: otrasCount,
        percentage: Number(((otrasCount / totalNoListas) * 100).toFixed(1)),
        fill: COLORS_PRACTICAS[5],
        descripcion: 'Resto de análisis y determinaciones pendientes de la jornada',
      });
    }

    return {
      top5,
      chartData: chartData.filter((d) => d.value > 0),
      top5Count,
      otrasCount,
      total: kpis.practicasNoListas,
      concentracionTop5Pct: totalNoListas > 0 ? Number(((top5Count / totalNoListas) * 100).toFixed(1)) : 0,
    };
  }, [kpis]);

  // 3. Data for "Top 3 de Sectores / Rutas"
  const chartTopSectores = useMemo(() => {
    const totalNoListas = kpis.practicasNoListas || 1;
    let sectoresList: { sector: string; cantidad: number; porcentaje: number }[] = [];

    if (activeDailyEntry?.top3Sectores && activeDailyEntry.top3Sectores.length > 0) {
      sectoresList = activeDailyEntry.top3Sectores;
    } else {
      // Derive dynamically from effectiveRecords for non-ready practices
      const map: Record<string, number> = {};
      effectiveRecords.forEach((r) => {
        // Exclude ready or already validated
        const rawStat = (r.status || '').trim().toUpperCase();
        const isListo = rawStat.includes('LIST') || rawStat.includes('INFORMAD') || rawStat.includes('VALIDAD');
        if (!isListo) {
          const sec = (r.sector || 'Sin Sector').trim() || 'Sin Sector';
          map[sec] = (map[sec] || 0) + 1;
        }
      });

      sectoresList = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .map(([sec, count]) => ({
          sector: sec,
          cantidad: count,
          porcentaje: Number(((count / totalNoListas) * 100).toFixed(1)),
        }));
    }

    const top3 = sectoresList.slice(0, 3);
    const top3Count = top3.reduce((sum, s) => sum + s.cantidad, 0);
    const otrosSectoresCount = Math.max(0, kpis.practicasNoListas - top3Count);

    const chartData = top3.map((s, idx) => ({
      name: s.sector,
      value: s.cantidad,
      percentage: s.porcentaje,
      fill: COLORS_SECTORES[idx % COLORS_SECTORES.length],
      descripcion: `Sector técnico rankeado #${idx + 1} en carga pendiente`,
    }));

    if (otrosSectoresCount > 0) {
      chartData.push({
        name: 'Otros Sectores / Resto',
        value: otrosSectoresCount,
        percentage: Number(((otrosSectoresCount / totalNoListas) * 100).toFixed(1)),
        fill: COLORS_SECTORES[3],
        descripcion: 'Carga técnica distribuida en otras secciones del laboratorio',
      });
    }

    return {
      top3,
      chartData: chartData.filter((d) => d.value > 0),
      top3Count,
      otrosSectoresCount,
      total: kpis.practicasNoListas,
      concentracionTop3Pct: totalNoListas > 0 ? Number(((top3Count / totalNoListas) * 100).toFixed(1)) : 0,
    };
  }, [activeDailyEntry, effectiveRecords, kpis.practicasNoListas]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. INSTITUTIONAL HEADER & DATE SELECTOR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#F7F2F7] text-[#5F285F] border border-[#E9DDE9]">
                <PieChartIcon className="w-5 h-5 text-[#5F285F]" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                  Distribución Gráfica de Entregas Diarias
                </h1>
                <p className="text-[14px] text-slate-600 font-medium">
                  Gráficos tipo torta de composición de estados pendientes, top estudios y concentración técnica
                </p>
              </div>
            </div>
          </div>

          {/* Date Selector & Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-[#744174]" />
              <span className="text-[12px] font-bold text-slate-500 uppercase">Jornada:</span>
              <select
                value={activeDailyEntry?.fecha || ''}
                onChange={(e) => onSelectDate(e.target.value)}
                className="bg-transparent text-[14px] font-bold text-slate-800 focus:outline-hidden cursor-pointer"
              >
                {dailyHistory.map((d) => (
                  <option key={d.fecha} value={d.fecha}>
                    {formatISOToDisplayDate(d.fecha)} {d.isClosed ? '— [Cierre]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onNavigateToDeliveries}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5F285F] hover:bg-[#4A1F4A] text-white text-[14px] font-bold transition cursor-pointer shadow-xs"
            >
              <Zap className="w-4 h-4" />
              <span>Ver Tabla Detallada</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[12px] font-bold text-slate-500 uppercase">Prácticas Válidas</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {kpis.practicasValidas.toLocaleString('es-AR')}
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5 font-medium">
              Base operativa analítica
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="text-[12px] font-bold text-emerald-900 uppercase">Prácticas Listas</div>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">
              {kpis.practicasListasPct.toLocaleString('es-AR')}%
            </div>
            <div className="text-[12px] text-emerald-800 font-medium">
              {kpis.practicasListas.toLocaleString('es-AR')} informadas
            </div>
          </div>

          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <div className="text-[12px] font-bold text-rose-900 uppercase">Prácticas No Listas</div>
            <div className="text-2xl font-black text-rose-700 mt-0.5">
              {kpis.practicasNoListas.toLocaleString('es-AR')}
            </div>
            <div className="text-[12px] text-rose-800 font-medium">
              {kpis.practicasNoListasPct.toLocaleString('es-AR')}% pendientes
            </div>
          </div>

          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
            <div className="text-[12px] font-bold text-purple-900 uppercase">Emergencias vs Rutina</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-black text-rose-700">{kpis.practicasNoListasEmergencia} (E)</span>
              <span className="text-slate-400 font-semibold">/</span>
              <span className="text-xl font-black text-amber-700">{kpis.practicasNoListasRutina} Rut</span>
            </div>
            <div className="text-[12px] text-purple-900 font-medium">
              Desglose de no listas
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. THE THREE PIE CHARTS GRID */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===================================================================== */}
        {/* GRÁFICO 1: ¿QUÉ ESTÁ PENDIENTE? */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Target className="w-5 h-5 text-[#5F285F]" />
              <h2 className="text-[16px] font-bold uppercase tracking-wider text-slate-900">
                1. ¿Qué está pendiente?
              </h2>
            </div>
            <p className="text-[13px] text-slate-500 mt-1.5 leading-normal">
              Distribución de las <strong>{kpis.practicasNoListas}</strong> determinaciones en los 5 estados LIS no listos.
            </p>

            {/* Recharts Pie Chart */}
            <div className="h-64 sm:h-72 w-full mt-4 relative flex items-center justify-center">
              {chartQueEstaPendiente.chartData.length === 0 ? (
                <div className="text-center text-slate-400 py-12 text-[14px]">
                  ✓ No hay prácticas pendientes registradas
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartQueEstaPendiente.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartQueEstaPendiente.chartData.map((entry, index) => (
                          <Cell key={`cell-estado-${index}`} fill={entry.fill} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip totalLabel="Prácticas No Listas" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stat Badge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {kpis.practicasNoListas}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      No Listas
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Breakdown Legend Table */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            {chartQueEstaPendiente.tableData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2 truncate max-w-[65%]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className="font-semibold text-slate-800 truncate" title={item.name}>
                    {idx + 1}. {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[12.5px] shrink-0">
                  <strong className="text-slate-900 font-bold">{item.value}</strong>
                  <span className="text-slate-500">
                    ({item.percentage.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* GRÁFICO 2: TOP 5 DE PRÁCTICAS NO LISTAS */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <FlaskConical className="w-5 h-5 text-indigo-600" />
              <h2 className="text-[16px] font-bold uppercase tracking-wider text-slate-900">
                2. Top 5 de Prácticas
              </h2>
            </div>
            <p className="text-[13px] text-slate-500 mt-1.5 leading-normal">
              Concentración analítica: el Top 5 agrupa el <strong>{chartTopPracticas.concentracionTop5Pct}%</strong> de la demora.
            </p>

            {/* Recharts Pie Chart */}
            <div className="h-64 sm:h-72 w-full mt-4 relative flex items-center justify-center">
              {chartTopPracticas.chartData.length === 0 ? (
                <div className="text-center text-slate-400 py-12 text-[14px]">
                  No se registran prácticas no listas
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartTopPracticas.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartTopPracticas.chartData.map((entry, index) => (
                          <Cell key={`cell-practica-${index}`} fill={entry.fill} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip totalLabel="Determinaciones No Listas" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stat Badge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-indigo-950 font-mono">
                      {chartTopPracticas.top5Count}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      Top 5 Prácticas
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Breakdown Ranking Table */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            {chartTopPracticas.top5.length === 0 ? (
              <div className="text-xs text-slate-400 py-2 text-center">Sin prácticas demoradas</div>
            ) : (
              chartTopPracticas.top5.map((item, idx) => (
                <div key={item.estudio} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2 truncate max-w-[65%]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS_PRACTICAS[idx] }} />
                    <span className="font-semibold text-slate-800 truncate" title={item.estudio}>
                      {idx + 1}. {item.estudio}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[12.5px] shrink-0">
                    <strong className="text-slate-900 font-bold">{item.cantidad}</strong>
                    <span className="text-slate-500">
                      ({item.porcentaje.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%)
                    </span>
                  </div>
                </div>
              ))
            )}
            {chartTopPracticas.otrasCount > 0 && (
              <div className="flex items-center justify-between text-[13px] pt-1 border-t border-dashed border-slate-200">
                <div className="flex items-center gap-2 truncate text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-400" />
                  <span className="italic truncate">Otras prácticas ({kpis.practicasNoListas - chartTopPracticas.top5Count})</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[12.5px] text-slate-500">
                  <span>{chartTopPracticas.otrasCount}</span>
                  <span>({((chartTopPracticas.otrasCount / (kpis.practicasNoListas || 1)) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* GRÁFICO 3: TOP 3 DE SECTORES / RUTAS TÉCNICAS */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-[#744174]" />
              <h2 className="text-[16px] font-bold uppercase tracking-wider text-slate-900">
                3. Top 3 de Sectores / Rutas
              </h2>
            </div>
            <p className="text-[13px] text-slate-500 mt-1.5 leading-normal">
              Concentración técnica: las 3 principales áreas concentran el <strong>{chartTopSectores.concentracionTop3Pct}%</strong> de la carga.
            </p>

            {/* Recharts Pie Chart */}
            <div className="h-64 sm:h-72 w-full mt-4 relative flex items-center justify-center">
              {chartTopSectores.chartData.length === 0 ? (
                <div className="text-center text-slate-400 py-12 text-[14px]">
                  No se registran sectores con demoras
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartTopSectores.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartTopSectores.chartData.map((entry, index) => (
                          <Cell key={`cell-sector-${index}`} fill={entry.fill} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip totalLabel="Carga Técnica No Lista" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stat Badge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-[#5F285F] font-mono">
                      {chartTopSectores.top3Count}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      Top 3 Sectores
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Breakdown Sectors Table */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            {chartTopSectores.top3.length === 0 ? (
              <div className="text-xs text-slate-400 py-2 text-center">Distribución uniforme de sectores</div>
            ) : (
              chartTopSectores.top3.map((s, idx) => (
                <div key={s.sector} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2 truncate max-w-[65%]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS_SECTORES[idx] }} />
                    <span className="font-semibold text-slate-800 truncate" title={s.sector}>
                      {idx + 1}. {s.sector}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[12.5px] shrink-0">
                    <strong className="text-slate-900 font-bold">{s.cantidad}</strong>
                    <span className="text-slate-500">
                      ({s.porcentaje.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%)
                    </span>
                  </div>
                </div>
              ))
            )}
            {chartTopSectores.otrosSectoresCount > 0 && (
              <div className="flex items-center justify-between text-[13px] pt-1 border-t border-dashed border-slate-200">
                <div className="flex items-center gap-2 truncate text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-300" />
                  <span className="italic truncate">Otros sectores</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[12.5px] text-slate-500">
                  <span>{chartTopSectores.otrosSectoresCount}</span>
                  <span>({((chartTopSectores.otrosSectoresCount / (kpis.practicasNoListas || 1)) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. EXECUTIVE PARETO & AUDIT INSIGHTS BOX */}
      {/* ========================================================================= */}
      <div className="bg-[#F7F2F7] border border-[#E9DDE9] rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-xl bg-white border border-[#E9DDE9] text-[#5F285F] shrink-0 shadow-2xs">
              <ShieldCheck className="w-6 h-6 text-[#5F285F]" />
            </span>
            <div>
              <h3 className="text-base sm:text-[17px] font-bold text-slate-900 leading-tight">
                Análisis Operativo Bajo Principio de Pareto (ISO 9001 & ISO 15189:2022)
              </h3>
              <p className="text-[13.5px] text-slate-600 mt-1 max-w-4xl leading-relaxed">
                El monitoreo diario refleja que el <strong>{chartTopPracticas.concentracionTop5Pct}%</strong> de las determinaciones demoradas se focaliza en solo 5 análisis clínicos, y el <strong>{chartTopSectores.concentracionTop3Pct}%</strong> de la carga técnica se sitúa en los 3 sectores principales. Priorizar la validación de estos focos destraba la entrega de órdenes completas a pacientes.
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToDeliveries}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5F285F] hover:bg-[#4A1F4A] text-white text-[13.5px] font-bold transition cursor-pointer shadow-xs whitespace-nowrap shrink-0"
          >
            <span>Ir al Detalle de Pacientes</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
