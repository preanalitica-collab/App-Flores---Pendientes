import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  Legend,
} from 'recharts';
import {
  Clock,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ChevronDown,
  Download,
  Building2,
  Layers,
  Check,
  Edit3,
  Save,
  X,
  Calendar,
  Sparkles,
  ArrowUpDown,
  TrendingUp,
  Info,
  ShieldCheck,
  BarChart3,
  History,
  MessageSquare,
  User,
} from 'lucide-react';
import {
  TATCase,
  TATObservationHistoryEntry,
  TATKPISummary,
  UserSession,
  DailyDeliveryEntry,
  ResumenMensualRow,
  MonthName,
  MonthlyTATMetric,
  TATPeriodKPIs,
  TATDailySummary,
  TipoAtencionOS,
} from '../types';
import {
  calculateTATPeriodKPIs,
  calculateMonthlyTATHistory,
  calculateHistoricalTATAverage,
  toggleTATCaseStatus,
  formatISOToDisplayDate,
  MONTH_NAMES_LIST,
  calculateDelayDays,
  isPreImplementationBreach,
  isCaseInPeriod,
  getTipoAtencion,
  getMonthIndex,
  parseMonthYearFromDate,
  extractPromisedMonthYear,
} from '../services/operationalService';
import {
  saveCentralTATCase,
  updateCentralTATStatus,
  updateCentralTATObservation,
  formatToDDMMYYYYHHmm,
} from '../services/storageService';

interface TATFollowUpViewProps {
  tatCases: TATCase[];
  onUpdateCases: (updated: TATCase[]) => void;
  onOpenImportModal: () => void;
  userSession: UserSession;
  lastUpdatedTime?: string | null;
  tatSummaries?: TATDailySummary[];
  dailyHistory?: DailyDeliveryEntry[];
  resumenList?: ResumenMensualRow[];
  selectedMonth?: MonthName;
  selectedYear?: number;
  onSelectPeriod?: (mes: MonthName, año: number) => void;
}

export const TATFollowUpView: React.FC<TATFollowUpViewProps> = ({
  tatCases,
  onUpdateCases,
  onOpenImportModal,
  userSession,
  lastUpdatedTime,
  tatSummaries = [],
  dailyHistory = [],
  resumenList = [],
  selectedMonth,
  selectedYear,
  onSelectPeriod,
}) => {
  const today = new Date();
  const currentActualMonth = MONTH_NAMES_LIST[today.getMonth()];
  const currentActualYear = today.getFullYear();

  // Period Selection State: siempre por defecto el mes y año actuales en curso
  const [currentMonth, setCurrentMonth] = useState<MonthName>(selectedMonth || currentActualMonth);
  const [currentYear, setCurrentYear] = useState<number>(selectedYear || currentActualYear);
  const [historyWindow, setHistoryWindow] = useState<3 | 6 | 12>(6);
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  // Al ingresar al módulo o recargar, restablecer por defecto al mes actual en curso
  useEffect(() => {
    const now = new Date();
    const actualMonth = MONTH_NAMES_LIST[now.getMonth()];
    const actualYear = now.getFullYear();
    setCurrentMonth(actualMonth);
    setCurrentYear(actualYear);
    if (onSelectPeriod) {
      onSelectPeriod(actualMonth, actualYear);
    }
  }, []);

  // Synchronize when parent props change
  useEffect(() => {
    if (selectedMonth) setCurrentMonth(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedYear) setCurrentYear(selectedYear);
  }, [selectedYear]);

  const handlePeriodChange = (mes: MonthName, año: number) => {
    setCurrentMonth(mes);
    setCurrentYear(año);
    if (onSelectPeriod) {
      onSelectPeriod(mes, año);
    }
  };

  // Filters & Search for Operative Table
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'TODOS' | 'EN PROCESO' | 'CERRADO'>('EN PROCESO');
  const [selectedTipoAtencion, setSelectedTipoAtencion] = useState<'TODOS' | 'URGENCIA' | 'RUTINA'>('TODOS');
  const [selectedPeriodScope, setSelectedPeriodScope] = useState<'TODOS' | 'MES_SELECCIONADO'>('TODOS');
  const [selectedSedeFilter, setSelectedSedeFilter] = useState('TODAS');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState('TODOS');
  const [sortBy, setSortBy] = useState<'dias' | 'fecha' | 'os' | 'status'>('dias');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedEvolutionSeries, setSelectedEvolutionSeries] = useState<'GLOBAL' | 'URGENCIA' | 'RUTINA' | 'COMPARATIVA'>('GLOBAL');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 180);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchTerm,
    selectedStatusFilter,
    selectedTipoAtencion,
    selectedPeriodScope,
    selectedSedeFilter,
    selectedSectorFilter,
    sortBy,
    sortOrder,
    currentMonth,
    currentYear,
  ]);

  // Inline editing of observations
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [editingObsText, setEditingObsText] = useState('');
  const [isSavingObs, setIsSavingObs] = useState(false);
  const [historyModalCase, setHistoryModalCase] = useState<TATCase | null>(null);

  // Status toggle confirmation / loading state
  const [togglingCaseId, setTogglingCaseId] = useState<string | null>(null);

  // Casos operativos activos (excluyendo automáticamente pruebas previas al 01/09/2026)
  const operationalCases = useMemo(() => {
    return tatCases.filter((c) => !c.excludedFromOperationalMetrics && !isPreImplementationBreach(c));
  }, [tatCases]);

  // 1. Calculate Period KPIs for top 3 cards
  const periodKPIs: TATPeriodKPIs = useMemo(() => {
    return calculateTATPeriodKPIs(
      operationalCases,
      currentMonth,
      currentYear,
      dailyHistory,
      resumenList,
      new Date(),
      tatSummaries
    );
  }, [operationalCases, currentMonth, currentYear, dailyHistory, resumenList, tatSummaries]);

  // 2. Calculate Monthly History for Evolution Chart (strictly bounded >= Septiembre 2026)
  const monthlyHistory: MonthlyTATMetric[] = useMemo(() => {
    return calculateMonthlyTATHistory(operationalCases, dailyHistory, resumenList, new Date(), tatSummaries);
  }, [operationalCases, dailyHistory, resumenList, tatSummaries]);

  // 2b. Displayed Monthly History bounded by selected window, never going before Septiembre 2026
  const displayedMonthlyHistory = useMemo(() => {
    return monthlyHistory.slice(-historyWindow);
  }, [monthlyHistory, historyWindow]);

  // 3. Calculate Historical Average
  const historicalAverage = useMemo(() => {
    const seriesKey = selectedEvolutionSeries === 'COMPARATIVA' ? 'GLOBAL' : selectedEvolutionSeries;
    return calculateHistoricalTATAverage(monthlyHistory, historyWindow, seriesKey);
  }, [monthlyHistory, historyWindow, selectedEvolutionSeries]);

  // Períodos válidos para el selector (mes en curso + meses con datos válidos)
  const availablePeriods = useMemo(() => {
    const map = new Map<string, { mes: MonthName; año: number; label: string; isCurrent: boolean }>();

    // 1. Mes en curso actual
    const now = new Date();
    const actualMes = MONTH_NAMES_LIST[now.getMonth()];
    const actualAño = now.getFullYear();
    const actualKey = `${actualMes}-${actualAño}`;
    map.set(actualKey, {
      mes: actualMes,
      año: actualAño,
      label: `${actualMes} ${actualAño} · Mes en curso`,
      isCurrent: true,
    });

    // 2. Meses con datos en entregas diarias
    dailyHistory.forEach((d) => {
      const p = parseMonthYearFromDate(d.fecha);
      if (p) {
        const k = `${p.mes}-${p.año}`;
        if (!map.has(k)) {
          map.set(k, {
            mes: p.mes,
            año: p.año,
            label: `${p.mes} ${p.año}`,
            isCurrent: p.mes === actualMes && p.año === actualAño,
          });
        }
      }
    });

    // 3. Meses con resúmenes TAT
    tatSummaries.forEach((s) => {
      const p = parseMonthYearFromDate((s as any).fechaPrometida) || parseMonthYearFromDate(s.fecha);
      if (p) {
        const k = `${p.mes}-${p.año}`;
        if (!map.has(k)) {
          map.set(k, {
            mes: p.mes,
            año: p.año,
            label: `${p.mes} ${p.año}`,
            isCurrent: p.mes === actualMes && p.año === actualAño,
          });
        }
      }
    });

    // 4. Meses con casos operativos
    operationalCases.forEach((c) => {
      const p = extractPromisedMonthYear(c);
      if (p) {
        const k = `${p.mes}-${p.año}`;
        if (!map.has(k)) {
          map.set(k, {
            mes: p.mes,
            año: p.año,
            label: `${p.mes} ${p.año}`,
            isCurrent: p.mes === actualMes && p.año === actualAño,
          });
        }
      }
    });

    // 5. Meses históricos consolidados en resumenList
    resumenList.forEach((r) => {
      if (r.PacientesAtendidos && r.PacientesAtendidos > 0) {
        const k = `${r.Mes}-${r.Año}`;
        if (!map.has(k)) {
          map.set(k, {
            mes: r.Mes,
            año: r.Año,
            label: `${r.Mes} ${r.Año} (Histórico)`,
            isCurrent: r.Mes === actualMes && r.Año === actualAño,
          });
        }
      }
    });

    // Ordenar cronológicamente descendente
    return Array.from(map.values()).sort((a, b) => {
      if (a.año !== b.año) return b.año - a.año;
      return getMonthIndex(b.mes) - getMonthIndex(a.mes);
    });
  }, [dailyHistory, tatSummaries, operationalCases, resumenList]);

  // Unique sedes & sectors for filters
  const uniqueSedes = useMemo(() => {
    const set = new Set<string>();
    operationalCases.forEach((c) => {
      if (c.sede && c.sede.trim()) set.add(c.sede.trim());
    });
    return Array.from(set).sort();
  }, [operationalCases]);

  const uniqueSectores = useMemo(() => {
    const set = new Set<string>();
    operationalCases.forEach((c) => {
      if (c.sector && c.sector.trim()) set.add(c.sector.trim());
    });
    return Array.from(set).sort();
  }, [operationalCases]);

  // Filtered & Sorted Cases for the Operative Table
  const filteredCases = useMemo(() => {
    return operationalCases
      .filter((c) => {
        // Period scope filter
        if (selectedPeriodScope === 'MES_SELECCIONADO') {
          if (!isCaseInPeriod(c, currentMonth, currentYear)) return false;
        }

        // Status filter
        if (selectedStatusFilter === 'EN PROCESO') {
          if (c.estadoSeguimiento !== 'EN PROCESO' && c.estadoSeguimiento !== 'ABIERTO') return false;
        } else if (selectedStatusFilter === 'CERRADO') {
          if (
            c.estadoSeguimiento !== 'CERRADO' &&
            c.estadoSeguimiento !== 'Cerrado manualmente' &&
            c.estadoSeguimiento !== 'Cerrado automáticamente'
          )
            return false;
        }

        // Tipo de atención filter (URGENCIA vs RUTINA)
        if (selectedTipoAtencion === 'URGENCIA') {
          if ((c.tipoAtencion || getTipoAtencion(c.os)) !== 'URGENCIA') return false;
        } else if (selectedTipoAtencion === 'RUTINA') {
          if ((c.tipoAtencion || getTipoAtencion(c.os)) !== 'RUTINA') return false;
        }

        // Sede filter
        if (selectedSedeFilter !== 'TODAS' && c.sede !== selectedSedeFilter) return false;

        // Sector filter
        if (selectedSectorFilter !== 'TODOS' && c.sector !== selectedSectorFilter) return false;

        // Search text (OS, Práctica, Paciente, Observaciones, Sede, Sector, Status LIS)
        if (debouncedSearchTerm.trim()) {
          const q = debouncedSearchTerm.toLowerCase().trim();
          const matchOS = c.os.toLowerCase().includes(q);
          const matchPrac = c.practica.toLowerCase().includes(q);
          const matchPac =
            (c.nombrePaciente || '').toLowerCase().includes(q) || c.idPacienteAnon.toLowerCase().includes(q);
          const matchObs = (c.observaciones || '').toLowerCase().includes(q);
          const matchSede = (c.sede || '').toLowerCase().includes(q);
          const matchSec = (c.sector || '').toLowerCase().includes(q);
          const matchStatus = (c.statusLIS || '').toLowerCase().includes(q);
          return matchOS || matchPrac || matchPac || matchObs || matchSede || matchSec || matchStatus;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'dias') {
          cmp = (a.tiempoAtrasoDias || 0) - (b.tiempoAtrasoDias || 0);
        } else if (sortBy === 'fecha') {
          cmp = (a.fechaPrometida || '').localeCompare(b.fechaPrometida || '');
        } else if (sortBy === 'os') {
          cmp = a.os.localeCompare(b.os);
        } else if (sortBy === 'status') {
          cmp = (a.statusLIS || '').localeCompare(b.statusLIS || '');
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [operationalCases, selectedPeriodScope, currentMonth, currentYear, selectedStatusFilter, selectedTipoAtencion, selectedSedeFilter, selectedSectorFilter, debouncedSearchTerm, sortBy, sortOrder]);

  const totalCasesPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  // Handle Toggle Status (EN PROCESO <-> CERRADO)
  const handleToggleStatus = async (item: TATCase) => {
    setTogglingCaseId(item.id);
    const updated = toggleTATCaseStatus(item, userSession.email, new Date());

    // Optimistic UI update
    const newCasesList = tatCases.map((c) => (c.id === item.id ? updated : c));
    onUpdateCases(newCasesList);

    // Save to Backend & Firestore
    try {
      await updateCentralTATStatus(
        updated.id,
        updated.estadoSeguimiento,
        userSession.email,
        updated.estadoSeguimiento === 'CERRADO'
          ? 'Cierre operativo de caso TAT'
          : 'Reapertura a seguimiento en proceso'
      );
      await saveCentralTATCase(updated);
    } catch (err) {
      console.error('Error al actualizar estado en servidor:', err);
    } finally {
      setTogglingCaseId(null);
    }
  };

  // Start editing observation
  const handleStartEditObs = (item: TATCase) => {
    setEditingCaseId(item.id);
    setEditingObsText(item.observaciones || '');
  };

  // Save observation
  const handleSaveObs = async (item: TATCase) => {
    setIsSavingObs(true);
    const now = new Date();
    const nowFormatted = formatToDDMMYYYYHHmm(now);
    const cleanObs = editingObsText.trim();

    const newHistEntry: TATObservationHistoryEntry = {
      id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now.toISOString(),
      fechaHora: nowFormatted,
      usuario: userSession.email || 'usuario@labflores.com.ar',
      texto: cleanObs,
    };

    const existingHistory = Array.isArray(item.historialObservaciones) ? item.historialObservaciones : [];
    const updatedHistory = cleanObs ? [...existingHistory, newHistEntry] : existingHistory;

    const updated: TATCase = {
      ...item,
      observaciones: cleanObs,
      autorObservacion: userSession.email || 'usuario@labflores.com.ar',
      fechaObservacion: nowFormatted,
      fechaUltimaActualizacion: nowFormatted,
      historialObservaciones: updatedHistory,
    };

    // 1. Optimistic UI update
    const newCasesList = tatCases.map((c) => (c.id === item.id ? updated : c));
    onUpdateCases(newCasesList);

    // 2. Persist to server / Firestore
    try {
      const persistedCase = await updateCentralTATObservation(item.id, cleanObs, userSession.email || 'usuario@labflores.com.ar', item);
      if (persistedCase) {
        const mergedList = tatCases.map((c) => (c.id === item.id ? { ...updated, ...persistedCase } : c));
        onUpdateCases(mergedList);
      }
    } catch (err) {
      console.error('Error al guardar observación en servidor:', err);
    } finally {
      setIsSavingObs(false);
      setEditingCaseId(null);
    }
  };

  // Cancel editing observation
  const handleCancelEditObs = () => {
    setEditingCaseId(null);
    setEditingObsText('');
  };

  // CSV Export for Audit / Reporting
  const handleExportCSV = () => {
    if (filteredCases.length === 0) return;

    const headers = [
      'ID_Caso',
      'OS',
      'Tipo_Atencion',
      'Practica',
      'Sede',
      'Sector',
      'Fecha_Prometida',
      'Fecha_Deteccion',
      'Status_LIS',
      'Tiempo_Atraso_Dias',
      'Estado_Seguimiento',
      'Fecha_Cierre',
      'Usuario_Cierre',
      'Observaciones',
    ];

    const rows = filteredCases.map((c) => [
      `"${c.id}"`,
      `"${c.os.replace(/"/g, '""')}"`,
      `"${c.tipoAtencion || getTipoAtencion(c.os)}"`,
      `"${c.practica.replace(/"/g, '""')}"`,
      `"${(c.sede || '').replace(/"/g, '""')}"`,
      `"${(c.sector || '').replace(/"/g, '""')}"`,
      `"${c.fechaPrometida || ''}"`,
      `"${c.fechaDeteccion || ''}"`,
      `"${(c.statusLIS || '').replace(/"/g, '""')}"`,
      c.tiempoAtrasoDias || 1,
      `"${c.estadoSeguimiento}"`,
      `"${c.fechaCierre || ''}"`,
      `"${c.usuarioCierre || ''}"`,
      `"${(c.observaciones || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TAT_Seguimiento_${currentMonth}_${currentYear}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom Tooltip for Evolution Chart with Global, Urgencias and Rutina series
  const CustomMonthlyTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: MonthlyTATMetric = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-2 backdrop-blur-xs min-w-[270px]">
          <div className="font-bold text-sm border-b border-slate-700 pb-1 flex items-center justify-between text-[#E9DDE9]">
            <span>{data.monthKey}</span>
            <span className="text-[10px] text-slate-400 font-mono">Reglas v{data.rulesVersion}</span>
          </div>

          {/* TAT Global */}
          <div>
            <div className="flex justify-between items-center text-slate-200">
              <span className="text-slate-300 font-semibold">TAT Global:</span>
              <span className="font-bold font-mono text-purple-300 text-sm">
                {data.porcentajeCalculado !== null
                  ? `${data.porcentajeCalculado.toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} %`
                  : 'Dato pendiente'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400 text-[10.5px]">
              <span>OS únicas afectadas / totales:</span>
              <span className="font-mono text-slate-300">
                {data.osAfectadasUnicas} / {data.totalOSPrometidas.toLocaleString('es-AR')} OS
              </span>
            </div>
          </div>

          {/* TAT Urgencias */}
          <div className="pt-1.5 border-t border-slate-800">
            <div className="flex justify-between items-center text-rose-300">
              <span className="font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                TAT Urgencias:
              </span>
              <span className="font-bold font-mono text-xs">
                {data.porcentajeCalculadoUrgencias !== null && data.porcentajeCalculadoUrgencias !== undefined
                  ? `${data.porcentajeCalculadoUrgencias.toLocaleString('es-AR', { minimumFractionDigits: 2 })} %`
                  : 'N/D'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400 text-[10px]">
              <span>OS fuera de plazo / totales:</span>
              <span className="font-mono text-rose-200">
                {data.osAfectadasUnicasUrgencias ?? 0} / {(data.totalOSPrometidasUrgencias ?? 0).toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* TAT Rutina */}
          <div className="pt-1.5 border-t border-slate-800">
            <div className="flex justify-between items-center text-indigo-300">
              <span className="font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                TAT Rutina:
              </span>
              <span className="font-bold font-mono text-xs">
                {data.porcentajeCalculadoRutina !== null && data.porcentajeCalculadoRutina !== undefined
                  ? `${data.porcentajeCalculadoRutina.toLocaleString('es-AR', { minimumFractionDigits: 2 })} %`
                  : 'N/D'}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400 text-[10px]">
              <span>OS fuera de plazo / totales:</span>
              <span className="font-mono text-indigo-200">
                {data.osAfectadasUnicasRutina ?? 0} / {(data.totalOSPrometidasRutina ?? 0).toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {data.promedioDemoraDias > 0 && (
            <div className="flex justify-between items-center text-slate-300 text-[10.5px] pt-1.5 border-t border-slate-800">
              <span>Demora promedio:</span>
              <span className="font-mono font-semibold text-slate-100">
                {data.promedioDemoraDias.toLocaleString('es-AR', { minimumFractionDigits: 1 })} días
              </span>
            </div>
          )}

          <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-800 flex items-center justify-between">
            <span>Click para seleccionar mes</span>
            <span>{data.fechaCalculo}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. ENCABEZADO INSTITUCIONAL Y SELECTOR DE PERÍODO */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Seguimiento TAT
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F7F2F7] text-[#5F285F] border border-[#E9DDE9]">
                <ShieldCheck className="w-3 h-3 text-[#5F285F]" />
                Auditoría ISO
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              Detección y gestión operativa de determinaciones que continúan NO LISTAS al día siguiente de su fecha prometida.
            </p>
          </div>

          {/* Controles Principales: Selector de Período y Acciones */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Selector de Período (Únicamente meses con datos válidos o mes en curso) */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <Calendar className="w-4 h-4 text-[#5F285F] shrink-0" />
              <span className="text-xs font-semibold text-slate-500">Período:</span>
              <select
                value={`${currentMonth}-${currentYear}`}
                onChange={(e) => {
                  const [m, y] = e.target.value.split('-');
                  handlePeriodChange(m as MonthName, parseInt(y, 10));
                }}
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
                title="Seleccionar Período (muestra meses con datos válidos)"
              >
                {availablePeriods.map((p) => (
                  <option key={`${p.mes}-${p.año}`} value={`${p.mes}-${p.año}`}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Exportar CSV */}
            <button
              onClick={handleExportCSV}
              disabled={filteredCases.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer disabled:opacity-40 shadow-2xs"
              title="Exportar listado actual a archivo CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Exportar ({filteredCases.length})</span>
            </button>

            {/* Cargar Archivo Matutino */}
            <button
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#5F285F] hover:bg-[#4a1f4a] transition cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Archivo Matutino LIS</span>
            </button>
          </div>
        </div>

        {/* Sub-barra de Estado Operativo */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Lógica No Preventiva activa
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-[#5F285F] border border-purple-200">
              <Calendar className="w-3 h-3 text-[#5F285F]" />
              Inicio formal: 01/09/2026
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-mono text-[11.5px]">
              KPI Mensual: <strong>OS Única (Pacientes afectados)</strong> | Seguimiento: <strong>OS + Práctica</strong>
            </span>
          </div>
          {lastUpdatedTime && (
            <div className="font-mono text-slate-600">
              Última sincronización: <strong className="text-slate-800">{lastUpdatedTime}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TARJETAS DE INDICADORES PRINCIPALES (EXACTAMENTE TRES TARJETAS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* INDICADOR 1: CASOS EN PROCESO */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-amber-950 uppercase tracking-wider">
              {selectedTipoAtencion === 'TODOS'
                ? 'Casos en Proceso'
                : selectedTipoAtencion === 'URGENCIA'
                ? 'Casos en Proceso — Urgencias'
                : 'Casos en Proceso — Rutina'}
            </span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl sm:text-[36px] font-black text-amber-900 mt-2">
            {selectedTipoAtencion === 'TODOS'
              ? periodKPIs.casosEnProcesoActuales.toLocaleString('es-AR')
              : selectedTipoAtencion === 'URGENCIA'
              ? (periodKPIs.casosEnProcesoUrgencias || 0).toLocaleString('es-AR')
              : (periodKPIs.casosEnProcesoRutina || 0).toLocaleString('es-AR')}
          </div>
          <div className="text-[13px] text-amber-800 mt-1 font-medium">
            {selectedTipoAtencion === 'TODOS'
              ? 'Prácticas vencidas que requieren seguimiento'
              : selectedTipoAtencion === 'URGENCIA'
              ? 'Prácticas vencidas de Urgencias en seguimiento'
              : 'Prácticas vencidas de Rutina en seguimiento'}
          </div>
          <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-900 font-semibold">
            <span>Operativo en tiempo real</span>
            <span className="bg-amber-200/70 px-2 py-0.5 rounded-md font-mono">
              {selectedTipoAtencion === 'TODOS'
                ? `Urg: ${periodKPIs.casosEnProcesoUrgencias || 0} · Rut: ${periodKPIs.casosEnProcesoRutina || 0}`
                : selectedTipoAtencion === 'URGENCIA'
                ? `${operationalCases.filter((c) => (c.tipoAtencion || getTipoAtencion(c.os)) === 'URGENCIA').length} urgencias registradas`
                : `${operationalCases.filter((c) => (c.tipoAtencion || getTipoAtencion(c.os)) === 'RUTINA').length} rutinas registradas`}
            </span>
          </div>
        </div>

        {/* INDICADOR 2: PACIENTES AFECTADOS POR FUERA DE PLAZO (GLOBAL CON DESGLOSE URGENCIAS Y RUTINA) */}
        <div className="bg-[#F7F2F7] border border-[#E9DDE9] rounded-2xl p-5 shadow-xs transition hover:shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[12.5px] font-bold text-[#5F285F] uppercase tracking-wider">
                  {selectedTipoAtencion === 'TODOS'
                    ? 'Pacientes Afectados por Fuera de Plazo'
                    : selectedTipoAtencion === 'URGENCIA'
                    ? 'Pacientes Afectados por Fuera de Plazo — Urgencias'
                    : 'Pacientes Afectados por Fuera de Plazo — Rutina'}
                </span>
                <button
                  onClick={() => setShowAuditDetails(!showAuditDetails)}
                  className="text-[#744174] hover:text-[#5F285F] transition cursor-pointer p-0.5 rounded"
                  title="Detalle de cálculo y auditoría de pacientes afectados"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-[#E9DDE9] text-[#5F285F] text-xs font-bold font-mono">
                {currentMonth} {currentYear}
              </span>
            </div>

            {/* Inconsistencia de datos alert if triggered */}
            {periodKPIs.inconsistenciaClasificacion && (
              <div className="mt-2 p-2 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-bold border border-rose-300">
                Inconsistencia de datos: Discrepancia en la suma de Urgencias y Rutina.
              </div>
            )}

            {/* Número Principal */}
            <div className="text-3xl sm:text-[36px] font-black text-[#5F285F] mt-2 tracking-tight">
              {selectedTipoAtencion === 'TODOS'
                ? periodKPIs.porcentajeFueraPlazoTexto
                : selectedTipoAtencion === 'URGENCIA'
                ? periodKPIs.porcentajeFueraPlazoTextoUrgencias
                : periodKPIs.porcentajeFueraPlazoTextoRutina}
            </div>

            {/* Detalle del valor principal */}
            <div className="text-[12.5px] text-slate-700 mt-1 font-medium">
              {periodKPIs.esValido === false && !periodKPIs.inconsistenciaClasificacion ? (
                <span className="text-rose-700 font-bold">
                  Indicador no confiable — revisar consistencia de datos
                </span>
              ) : periodKPIs.totalOSPrometidasMes === 0 && periodKPIs.osAfectadasUnicasMes === 0 ? (
                <span className="text-slate-500 italic">
                  Sin registros con fecha prometida en {currentMonth} {currentYear}
                </span>
              ) : selectedTipoAtencion === 'TODOS' ? (
                <span>
                  <strong className="text-slate-900">{periodKPIs.osAfectadasUnicasMes}</strong> OS afectadas /{' '}
                  <strong className="text-slate-900">{periodKPIs.totalOSPrometidasMes.toLocaleString('es-AR')}</strong> OS totales
                </span>
              ) : selectedTipoAtencion === 'URGENCIA' ? (
                <span>
                  <strong className="text-rose-900">{periodKPIs.osAfectadasUnicasUrgencias}</strong> OS afectadas /{' '}
                  <strong className="text-slate-900">{periodKPIs.totalOSPrometidasUrgencias.toLocaleString('es-AR')}</strong> OS totales Urgencias
                </span>
              ) : (
                <span>
                  <strong className="text-indigo-900">{periodKPIs.osAfectadasUnicasRutina}</strong> OS afectadas /{' '}
                  <strong className="text-slate-900">{periodKPIs.totalOSPrometidasRutina.toLocaleString('es-AR')}</strong> OS totales Rutina
                </span>
              )}
            </div>

            {/* Mes en curso e información de acumulación de datos */}
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#5F285F] bg-[#E9DDE9]/60 border border-[#D8C2D8] px-2.5 py-0.5 rounded-md">
                <Calendar className="w-3.5 h-3.5 text-[#5F285F]" />
                <span>
                  {currentMonth} {currentYear}
                  {periodKPIs.textoMesParcial ? ` · ${periodKPIs.textoMesParcial}` : (periodKPIs.esMesParcial ? ' · Mes en curso' : '')}
                </span>
              </span>
            </div>
          </div>

          {/* Subtarjetas secundarias de Desglose Urgencias y Rutina (Requerimiento 7) */}
          <div className="mt-3.5 pt-3 border-t border-[#E9DDE9] grid grid-cols-2 gap-2">
            {/* Subtarjeta Urgencias */}
            <div
              onClick={() => {
                const next = selectedTipoAtencion === 'URGENCIA' ? 'TODOS' : 'URGENCIA';
                setSelectedTipoAtencion(next);
                setSelectedEvolutionSeries(next === 'URGENCIA' ? 'URGENCIA' : 'GLOBAL');
              }}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                selectedTipoAtencion === 'URGENCIA'
                  ? 'bg-rose-100/90 border-rose-300 ring-2 ring-rose-400/50 shadow-2xs'
                  : 'bg-white/80 border-[#E9DDE9] hover:bg-white hover:border-rose-300'
              }`}
              title="Click para alternar filtro de Urgencias"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Urgencias
                </span>
                <span className="text-xs font-black font-mono text-rose-700">
                  {periodKPIs.porcentajeFueraPlazoTextoUrgencias}
                </span>
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                <strong className="text-slate-900">{periodKPIs.osAfectadasUnicasUrgencias}</strong> fuera de plazo /{' '}
                <span>{periodKPIs.totalOSPrometidasUrgencias.toLocaleString('es-AR')}</span> totales
              </div>
            </div>

            {/* Subtarjeta Rutina */}
            <div
              onClick={() => {
                const next = selectedTipoAtencion === 'RUTINA' ? 'TODOS' : 'RUTINA';
                setSelectedTipoAtencion(next);
                setSelectedEvolutionSeries(next === 'RUTINA' ? 'RUTINA' : 'GLOBAL');
              }}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                selectedTipoAtencion === 'RUTINA'
                  ? 'bg-purple-100/90 border-purple-300 ring-2 ring-[#5F285F]/50 shadow-2xs'
                  : 'bg-white/80 border-[#E9DDE9] hover:bg-white hover:border-purple-300'
              }`}
              title="Click para alternar filtro de Rutina"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#5F285F] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5F285F]"></span>
                  Rutina
                </span>
                <span className="text-xs font-black font-mono text-[#5F285F]">
                  {periodKPIs.porcentajeFueraPlazoTextoRutina}
                </span>
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                <strong className="text-slate-900">{periodKPIs.osAfectadasUnicasRutina}</strong> fuera de plazo /{' '}
                <span>{periodKPIs.totalOSPrometidasRutina.toLocaleString('es-AR')}</span> totales
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-[#E9DDE9] flex items-center justify-between text-[10.5px] text-[#5F285F]">
            <span className="font-semibold">Unidad: Pacientes / OS Única</span>
            <span className="font-mono text-[10px] text-slate-600">Reglas v{periodKPIs.rulesVersion}</span>
          </div>

          {/* Modal / Popover desplegable de auditoría */}
          {showAuditDetails && (
            <div className="mt-3 p-3.5 bg-white border border-[#E9DDE9] rounded-2xl text-xs text-slate-700 space-y-2 shadow-lg">
              <div className="font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-[#5F285F]">Auditoría de Pacientes Afectados por Fuera de Plazo ({currentMonth} {currentYear})</span>
                <button
                  onClick={() => setShowAuditDetails(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-[11px] text-slate-600 leading-snug space-y-1">
                <p>
                  <strong>Definición institucional:</strong> Porcentaje de órdenes/pacientes que tuvieron al menos una práctica fuera del plazo prometido.
                </p>
                <p>
                  <strong>Unidad de cálculo:</strong> <code>OS ÚNICA</code> (una OS con múltiples análisis fuera de plazo cuenta como 1 paciente afectado).
                </p>
                <p>
                  <strong>Denominador mensual:</strong> Suma consolidada de <em>todas</em> las OS únicas cuya Fecha Promesa pertenezca al mes ({periodKPIs.totalOSPrometidasMes.toLocaleString('es-AR')} OS prometidas).
                </p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl font-mono text-[11px] space-y-1.5 text-slate-800 border border-slate-200">
                <div className="flex justify-between font-bold text-slate-900 border-b border-slate-200 pb-1">
                  <span>Balance Institucional</span>
                  <span>Numerador / Denominador</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700 font-semibold">• Urgencias:</span>
                  <span>{periodKPIs.osAfectadasUnicasUrgencias} / {periodKPIs.totalOSPrometidasUrgencias.toLocaleString('es-AR')} OS ({periodKPIs.porcentajeFueraPlazoTextoUrgencias})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5F285F] font-semibold">• Rutina:</span>
                  <span>{periodKPIs.osAfectadasUnicasRutina} / {periodKPIs.totalOSPrometidasRutina.toLocaleString('es-AR')} OS ({periodKPIs.porcentajeFueraPlazoTextoRutina})</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-slate-900 font-bold">
                  <span>= Total Global:</span>
                  <span>{periodKPIs.osAfectadasUnicasMes} / {periodKPIs.totalOSPrometidasMes.toLocaleString('es-AR')} OS ({periodKPIs.porcentajeFueraPlazoTexto})</span>
                </div>
                <div className="text-[10px] text-emerald-700 pt-0.5 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Validación estricta cumplida: OS Urgencias + OS Rutina = OS Global</span>
                </div>
              </div>

              {/* Desglose por Jornadas si existen */}
              {periodKPIs.desgloseJornadasMes && periodKPIs.desgloseJornadasMes.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Jornadas Matutinas Procesadas ({periodKPIs.desgloseJornadasMes.length})
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {periodKPIs.desgloseJornadasMes.map((jornada, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[10px] bg-slate-50/80 px-2 py-1 rounded border border-slate-100 font-mono"
                      >
                        <span>{jornada.fecha}</span>
                        <span className="text-slate-600">{jornada.osTotales.toLocaleString('es-AR')} OS ({jornada.practicasPrometidas.toLocaleString('es-AR')} prác.)</span>
                        <span className="text-amber-700 font-bold">{jornada.osAfectadas} OS afect.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* INDICADOR 3: PROMEDIO DE DEMORA */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs transition hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-slate-800 uppercase tracking-wider">
              {selectedTipoAtencion === 'TODOS'
                ? 'Promedio de Demora'
                : selectedTipoAtencion === 'URGENCIA'
                ? 'Demora Media — Urgencias'
                : 'Demora Media — Rutina'}
            </span>
            <span className="p-1.5 rounded-lg bg-slate-200 text-slate-700">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl sm:text-[36px] font-black text-slate-900 mt-2">
            {(selectedTipoAtencion === 'TODOS'
              ? periodKPIs.promedioDemoraDiasPeriodo
              : selectedTipoAtencion === 'URGENCIA'
              ? (periodKPIs.promedioDemoraDiasUrgencias || periodKPIs.promedioDemoraDiasPeriodo)
              : (periodKPIs.promedioDemoraDiasRutina || periodKPIs.promedioDemoraDiasPeriodo)
            ).toLocaleString('es-AR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{' '}
            <span className="text-lg font-bold text-slate-500">días</span>
          </div>
          <div className="text-[13px] text-slate-600 mt-1 font-medium">
            {selectedTipoAtencion === 'TODOS'
              ? `Demora media en días calendario (${currentMonth} ${currentYear})`
              : selectedTipoAtencion === 'URGENCIA'
              ? `Demora media en casos de Urgencias (${currentMonth} ${currentYear})`
              : `Demora media en casos de Rutina (${currentMonth} ${currentYear})`}
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
            <span>Días calendario</span>
            <span className="font-semibold text-slate-700">
              {selectedTipoAtencion === 'TODOS'
                ? `${periodKPIs.practicasFueraPlazoUnicasMes} casos evaluados`
                : selectedTipoAtencion === 'URGENCIA'
                ? `${operationalCases.filter((c) => isCaseInPeriod(c, currentMonth, currentYear) && (c.tipoAtencion || getTipoAtencion(c.os)) === 'URGENCIA').length} casos urgencia`
                : `${operationalCases.filter((c) => isCaseInPeriod(c, currentMonth, currentYear) && (c.tipoAtencion || getTipoAtencion(c.os)) === 'RUTINA').length} casos rutina`}
            </span>
          </div>
        </div>
      </div>

     
      {/* ========================================================================= */}
      {/* 4. LISTADO Y TABLA OPERATIVA DE SEGUIMIENTO */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        {/* Controles de Filtrado & Búsqueda */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-100">
          {/* Selector de Estado, Tipo de Atención y Alcance */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Selector de Estado: En Proceso / Todos / Cerrados */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold">
              <button
                onClick={() => setSelectedStatusFilter('EN PROCESO')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  selectedStatusFilter === 'EN PROCESO'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                En Proceso ({operationalCases.filter((c) => c.estadoSeguimiento === 'EN PROCESO' || c.estadoSeguimiento === 'ABIERTO').length})
              </button>
              <button
                onClick={() => setSelectedStatusFilter('TODOS')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  selectedStatusFilter === 'TODOS'
                    ? 'bg-[#5F285F] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({operationalCases.length})
              </button>
              <button
                onClick={() => setSelectedStatusFilter('CERRADO')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  selectedStatusFilter === 'CERRADO'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cerrados ({operationalCases.filter((c) => c.estadoSeguimiento === 'CERRADO' || c.estadoSeguimiento === 'Cerrado manualmente' || c.estadoSeguimiento === 'Cerrado automáticamente').length})
              </button>
            </div>

            {/* 2. Selector de Tipo de Atención (Requerimiento 8: Todos / Urgencias / Rutina) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <span className="text-[10.5px] font-bold text-slate-500 uppercase px-1.5 select-none">
                Tipo:
              </span>
              <button
                onClick={() => {
                  setSelectedTipoAtencion('TODOS');
                  setSelectedEvolutionSeries('GLOBAL');
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedTipoAtencion === 'TODOS'
                    ? 'bg-[#5F285F] text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({operationalCases.length})
              </button>
              <button
                onClick={() => {
                  setSelectedTipoAtencion('URGENCIA');
                  setSelectedEvolutionSeries('URGENCIA');
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedTipoAtencion === 'URGENCIA'
                    ? 'bg-rose-700 text-white shadow-2xs font-bold'
                    : 'text-rose-900 hover:text-rose-950'
                }`}
              >
                Urgencias ({operationalCases.filter((c) => (c.tipoAtencion || getTipoAtencion(c.os)) === 'URGENCIA').length})
              </button>
              <button
                onClick={() => {
                  setSelectedTipoAtencion('RUTINA');
                  setSelectedEvolutionSeries('RUTINA');
                }}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedTipoAtencion === 'RUTINA'
                    ? 'bg-indigo-700 text-white shadow-2xs font-bold'
                    : 'text-indigo-900 hover:text-indigo-950'
                }`}
              >
                Rutina ({operationalCases.filter((c) => (c.tipoAtencion || getTipoAtencion(c.os)) === 'RUTINA').length})
              </button>
            </div>

            {/* 3. Selector de Alcance Temporal: Todos los meses cargados vs Mes Seleccionado */}
            <div className="flex items-center gap-1 bg-purple-50/80 p-1 rounded-xl border border-purple-200 text-xs font-semibold">
              <button
                onClick={() => setSelectedPeriodScope('TODOS')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedPeriodScope === 'TODOS'
                    ? 'bg-[#5F285F] text-white shadow-2xs font-bold'
                    : 'text-purple-900 hover:text-purple-950'
                }`}
                title="Mostrar todos los casos cargados en el sistema (históricos y actuales)"
              >
                Todos los meses ({operationalCases.length})
              </button>
              <button
                onClick={() => setSelectedPeriodScope('MES_SELECCIONADO')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedPeriodScope === 'MES_SELECCIONADO'
                    ? 'bg-[#5F285F] text-white shadow-2xs font-bold'
                    : 'text-purple-900 hover:text-purple-950'
                }`}
                title={`Filtrar solo casos con fecha prometida en ${currentMonth} ${currentYear}`}
              >
                Solo {currentMonth} ({operationalCases.filter((c) => isCaseInPeriod(c, currentMonth, currentYear)).length})
              </button>
            </div>
          </div>

          {/* Filtros Secundarios y Buscador */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro de Sede */}
            <div className="relative">
              <select
                value={selectedSedeFilter}
                onChange={(e) => setSelectedSedeFilter(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5F285F] cursor-pointer"
              >
                <option value="TODAS">Todas las Sedes</option>
                {uniqueSedes.map((sede) => (
                  <option key={sede} value={sede}>
                    {sede}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro de Sector */}
            <div className="relative">
              <select
                value={selectedSectorFilter}
                onChange={(e) => setSelectedSectorFilter(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5F285F] cursor-pointer"
              >
                <option value="TODOS">Todos los Sectores</option>
                {uniqueSectores.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Buscador de Texto */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar OS, Práctica, Sede u Observación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5F285F]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabla Principal Simplificada con las 8 Columnas Exactas */}
        {filteredCases.length === 0 ? (
          <div className="py-16 text-center text-slate-500 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-base font-bold text-slate-800">
              No hay casos que coincidan con los filtros seleccionados
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {operationalCases.length === 0
                ? 'Cargue el archivo del LIS con fecha prometida del día anterior para detectar prácticas fuera de plazo.'
                : 'Intente modificar los filtros de estado, sede o sector.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  {/* 1. OS (angosta) */}
                  <th
                    className="py-2.5 px-3 w-[95px] cursor-pointer hover:bg-slate-100 transition select-none"
                    onClick={() => {
                      if (sortBy === 'os') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortBy('os');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>OS</span>
                      <ArrowUpDown className="w-3 h-3 opacity-50 shrink-0" />
                    </div>
                  </th>

                  {/* 2. Práctica (amplia) */}
                  <th className="py-2.5 px-3 min-w-[180px] max-w-[300px]">
                    Práctica
                  </th>

                  {/* 3. Sede (media) */}
                  <th className="py-2.5 px-2.5 w-[110px] whitespace-nowrap">
                    Sede
                  </th>

                  {/* 4. Fecha Prometida (angosta/media) */}
                  <th
                    className="py-2.5 px-2.5 w-[115px] cursor-pointer hover:bg-slate-100 transition select-none whitespace-nowrap"
                    onClick={() => {
                      if (sortBy === 'fecha') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortBy('fecha');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Fecha Prometida</span>
                      <ArrowUpDown className="w-3 h-3 opacity-50 shrink-0" />
                    </div>
                  </th>

                  {/* 5. Status LIS (media) */}
                  <th
                    className="py-2.5 px-2.5 w-[95px] cursor-pointer hover:bg-slate-100 transition select-none whitespace-nowrap"
                    onClick={() => {
                      if (sortBy === 'status') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortBy('status');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status LIS</span>
                      <ArrowUpDown className="w-3 h-3 opacity-50 shrink-0" />
                    </div>
                  </th>

                  {/* 6. Tiempo de Atraso (angosta) */}
                  <th
                    className="py-2.5 px-2.5 w-[105px] text-center cursor-pointer hover:bg-slate-100 transition select-none whitespace-nowrap"
                    onClick={() => {
                      if (sortBy === 'dias') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortBy('dias');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Atraso</span>
                      <ArrowUpDown className="w-3 h-3 opacity-50 shrink-0" />
                    </div>
                  </th>

                  {/* 7. Estado de Seguimiento (media) */}
                  <th className="py-2.5 px-2.5 w-[125px] text-center whitespace-nowrap">
                    Estado Seguimiento
                  </th>

                  {/* 8. Observaciones (amplia) */}
                  <th className="py-2.5 px-3 min-w-[200px]">
                    Observaciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedCases.map((item) => {
                  const isClosed =
                    item.estadoSeguimiento === 'CERRADO' ||
                    item.estadoSeguimiento === 'Cerrado manualmente' ||
                    item.estadoSeguimiento === 'Cerrado automáticamente';
                  const isEditingThisObs = editingCaseId === item.id;
                  const isTogglingThis = togglingCaseId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isClosed ? 'bg-slate-50/40 opacity-75' : ''
                      }`}
                    >
                      {/* 1. OS (angosta con badge de tipo de atención) */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{item.os}</span>
                          {(item.tipoAtencion || getTipoAtencion(item.os)) === 'URGENCIA' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              URGENCIA
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              RUTINA
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Práctica (amplia) */}
                      <td className="py-2.5 px-3 min-w-[180px] max-w-[300px]">
                        <div className="font-semibold text-slate-800 leading-snug break-words">
                          {item.practica}
                        </div>
                      </td>

                      {/* 3. Sede (media) */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap text-slate-600">
                        {item.sede || 'Sin sede'}
                      </td>

                      {/* 4. Fecha Prometida (angosta/media) */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap font-mono text-slate-600">
                        {item.fechaPrometidaTexto || formatISOToDisplayDate(item.fechaPrometida)}
                      </td>

                      {/* 5. Status LIS (media) */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            isClosed
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {item.statusLIS}
                        </span>
                      </td>

                      {/* 6. Tiempo de Atraso (angosta) */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                            isClosed
                              ? 'bg-slate-100 text-slate-600'
                              : item.tiempoAtrasoDias >= 3
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : item.tiempoAtrasoDias >= 2
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                          }`}
                        >
                          {item.tiempoAtrasoDias} {item.tiempoAtrasoDias === 1 ? 'd' : 'días'}
                        </span>
                        {isClosed && item.fechaCierre && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                            Cerrado ({item.fechaCierre.split(' ')[0]})
                          </div>
                        )}
                      </td>

                      {/* 7. Estado de Seguimiento (media, toggle EN PROCESO / CERRADO) */}
                      <td className="py-2.5 px-2.5 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={isTogglingThis}
                          className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border shadow-2xs w-[115px] ${
                            isClosed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                          } ${isTogglingThis ? 'opacity-50 cursor-wait' : ''}`}
                          title={isClosed ? 'Click para reabrir a EN PROCESO' : 'Click para marcar como CERRADO'}
                        >
                          {isClosed ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>CERRADO</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-white shrink-0" />
                              <span>EN PROCESO</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* 8. Observaciones (amplia, editable en línea, multiusuario persistente) */}
                      <td className="py-2.5 px-3 min-w-[240px] max-w-[340px]">
                        {isEditingThisObs ? (
                          <div className="space-y-1.5 bg-purple-50/50 p-2 rounded-lg border border-purple-200">
                            <textarea
                              value={editingObsText}
                              onChange={(e) => setEditingObsText(e.target.value)}
                              placeholder="Escriba motivo de demora o acción tomada..."
                              rows={3}
                              className="w-full text-xs p-2 bg-white border border-[#5F285F] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5F285F]/20 text-slate-800"
                              autoFocus
                            />
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[10px] text-slate-400">
                                Guardará para todos los usuarios
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={handleCancelEditObs}
                                  className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200/60 rounded-md cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => handleSaveObs(item)}
                                  disabled={isSavingObs}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-[#5F285F] text-white hover:bg-[#4a1f4a] rounded-md cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                                >
                                  {isSavingObs ? (
                                    <span>Guardando...</span>
                                  ) : (
                                    <>
                                      <Save className="w-3 h-3" />
                                      <span>Guardar</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div
                              onClick={() => handleStartEditObs(item)}
                              className="group flex items-start justify-between gap-1.5 p-1.5 rounded-lg hover:bg-slate-100/90 cursor-pointer transition min-h-[32px] border border-transparent hover:border-slate-200"
                              title="Click para editar o agregar observación"
                            >
                              <div className="flex-1 min-w-0">
                                {item.observaciones ? (
                                  <p className="text-xs text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                                    {item.observaciones}
                                  </p>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">
                                    + Agregar observación...
                                  </span>
                                )}
                              </div>
                              <Edit3 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5" />
                            </div>

                            {/* Metadata & Audit History Link */}
                            {(item.autorObservacion || item.fechaObservacion || (item.historialObservaciones && item.historialObservaciones.length > 0)) && (
                              <div className="flex items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
                                <div
                                  className="flex items-center gap-1 truncate"
                                  title={`Último cambio por ${item.autorObservacion || 'Usuario'} el ${item.fechaObservacion || item.fechaUltimaActualizacion}`}
                                >
                                  <User className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[120px]">
                                    {item.autorObservacion ? item.autorObservacion.split('@')[0] : 'Usuario'}
                                  </span>
                                  {item.fechaObservacion && (
                                    <span>• {item.fechaObservacion.split(' ')[0]}</span>
                                  )}
                                </div>

                                {item.historialObservaciones && item.historialObservaciones.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setHistoryModalCase(item);
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-[#5F285F] hover:text-[#4a1f4a] hover:underline cursor-pointer shrink-0"
                                    title="Ver historial de cambios de observaciones"
                                  >
                                    <History className="w-3 h-3" />
                                    <span>{item.historialObservaciones.length} cambios</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Controles de paginación de alta fluidez */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-600 mt-3">
            <div className="flex items-center gap-2">
              <span>Mostrando</span>
              <strong className="text-slate-900 font-semibold">
                {filteredCases.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>
              <span>–</span>
              <strong className="text-slate-900 font-semibold">
                {Math.min(currentPage * pageSize, filteredCases.length)}
              </strong>
              <span>de</span>
              <strong className="text-slate-900 font-semibold">{filteredCases.length.toLocaleString('es-AR')}</strong>
              <span>casos fuera de plazo</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span>Filas:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-[#5F285F]/20 cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                  title="Primera página"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                  title="Página anterior"
                >
                  ‹
                </button>
                <span className="px-3 py-1 font-medium text-slate-800">
                  {currentPage} / {totalCasesPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalCasesPages, p + 1))}
                  disabled={currentPage >= totalCasesPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                  title="Página siguiente"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalCasesPages)}
                  disabled={currentPage >= totalCasesPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                  title="Última página"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
      {/* ========================================================================= */}
      {/* 3. SECCIÓN: EVOLUCIÓN MENSUAL DE FUERA DE PLAZO */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#5F285F]" />
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                  Evolución Mensual de Fuera de Plazo
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-[#5F285F] border border-purple-200">
                <Calendar className="w-3 h-3 text-[#5F285F]" />
                Inicio formal del seguimiento: Septiembre 2026
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Porcentaje de OS/pacientes con al menos una práctica fuera del plazo prometido respecto al total de OS del período. Línea de base oficial desde Septiembre 2026.
            </p>
          </div>

          {/* Selector de Serie, Promedio Histórico y Selector de Ventana */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Selector de Serie (Requerimiento 9: Global / Urgencias / Rutina / Comparativa) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setSelectedEvolutionSeries('GLOBAL')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedEvolutionSeries === 'GLOBAL'
                    ? 'bg-[#5F285F] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Evolución institucional Global (% OS con al menos 1 práctica fuera de plazo)"
              >
                Global
              </button>
              <button
                onClick={() => setSelectedEvolutionSeries('URGENCIA')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedEvolutionSeries === 'URGENCIA'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'text-rose-900 hover:text-rose-950'
                }`}
                title="Evolución mensual exclusiva de Urgencias (OS terminadas en (E))"
              >
                Urgencias
              </button>
              <button
                onClick={() => setSelectedEvolutionSeries('RUTINA')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedEvolutionSeries === 'RUTINA'
                    ? 'bg-indigo-700 text-white shadow-2xs'
                    : 'text-indigo-900 hover:text-indigo-950'
                }`}
                title="Evolución mensual exclusiva de Rutina (OS regulares)"
              >
                Rutina
              </button>
              <button
                onClick={() => setSelectedEvolutionSeries('COMPARATIVA')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedEvolutionSeries === 'COMPARATIVA'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Comparar las 3 series en un único gráfico"
              >
                Comparativa
              </button>
            </div>

            {historicalAverage.average !== null && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-emerald-950 flex items-center gap-1.5 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  {historicalAverage.monthsCount === 1 ? (
                    <>
                      Promedio disponible: <span className="font-bold">{historicalAverage.validMonths[0]?.monthKey || 'Septiembre 2026'}</span> —{' '}
                      <strong className="font-bold font-mono text-emerald-900">{historicalAverage.averageFormatted}</strong>
                    </>
                  ) : (
                    <>
                      Promedio últimos {historicalAverage.monthsCount} meses ({selectedEvolutionSeries === 'URGENCIA' ? 'Urgencias' : selectedEvolutionSeries === 'RUTINA' ? 'Rutina' : 'Global'}):{' '}
                      <strong className="font-bold font-mono text-emerald-900">{historicalAverage.averageFormatted}</strong>
                    </>
                  )}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setHistoryWindow(3)}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  historyWindow === 3
                    ? 'bg-[#5F285F] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                3m
              </button>
              <button
                onClick={() => setHistoryWindow(6)}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  historyWindow === 6
                    ? 'bg-[#5F285F] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                6m
              </button>
              <button
                onClick={() => setHistoryWindow(12)}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  historyWindow === 12
                    ? 'bg-[#5F285F] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                12m
              </button>
            </div>
          </div>
        </div>

        {/* Gráfico de Evolución Mensual */}
        {displayedMonthlyHistory.length === 0 ? (
          <div className="py-10 text-center text-slate-500 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            <BarChart3 className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <div className="text-sm font-bold text-slate-700">Sin historial oficial disponible (Inicio formal: Septiembre 2026)</div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              A medida que se carguen las entregas diarias o el resumen mensual con total de prácticas prometidas desde Septiembre 2026 en adelante, se graficará la evolución histórica.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-full h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayedMonthlyHistory} margin={{ top: 12, right: 16, left: -15, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="monthKey"
                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    unit="%"
                    domain={[0, 'auto']}
                  />
                  <Tooltip content={<CustomMonthlyTooltip />} />
                  {selectedEvolutionSeries === 'COMPARATIVA' && (
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ paddingBottom: 6, fontSize: 11, fontWeight: 600 }}
                    />
                  )}
                  {historicalAverage.average !== null && selectedEvolutionSeries !== 'COMPARATIVA' && (
                    <ReferenceLine
                      y={historicalAverage.average}
                      stroke="#059669"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: historicalAverage.monthsCount === 1
                          ? `Promedio disponible (${historicalAverage.validMonths[0]?.monthKey || 'Septiembre 2026'}): ${historicalAverage.averageFormatted}`
                          : `Promedio (${historicalAverage.monthsCount}m): ${historicalAverage.averageFormatted}`,
                        fill: '#059669',
                        fontSize: 10,
                        fontWeight: 700,
                        position: 'insideTopRight',
                      }}
                    />
                  )}

                  {selectedEvolutionSeries === 'COMPARATIVA' ? (
                    <>
                      <Bar
                        dataKey="porcentajeCalculado"
                        name="TAT Global"
                        fill="#5F285F"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                        onClick={(entry: any) => {
                          if (entry && entry.mes && entry.año) handlePeriodChange(entry.mes, entry.año);
                        }}
                      />
                      <Bar
                        dataKey="porcentajeCalculadoUrgencias"
                        name="TAT Urgencias"
                        fill="#E11D48"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                        onClick={(entry: any) => {
                          if (entry && entry.mes && entry.año) handlePeriodChange(entry.mes, entry.año);
                        }}
                      />
                      <Bar
                        dataKey="porcentajeCalculadoRutina"
                        name="TAT Rutina"
                        fill="#7C3AED"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                        onClick={(entry: any) => {
                          if (entry && entry.mes && entry.año) handlePeriodChange(entry.mes, entry.año);
                        }}
                      />
                    </>
                  ) : selectedEvolutionSeries === 'URGENCIA' ? (
                    <Bar
                      dataKey="porcentajeCalculadoUrgencias"
                      name="TAT Urgencias"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                      onClick={(entry: any) => {
                        if (entry && entry.mes && entry.año) handlePeriodChange(entry.mes, entry.año);
                      }}
                    >
                      {displayedMonthlyHistory.map((entry, index) => {
                        const isSelected = entry.mes === currentMonth && entry.año === currentYear;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isSelected ? '#E11D48' : '#FDA4AF'}
                            className="cursor-pointer transition hover:opacity-85"
                          />
                        );
                      })}
                    </Bar>
                  ) : selectedEvolutionSeries === 'RUTINA' ? (
                    <Bar
                      dataKey="porcentajeCalculadoRutina"
                      name="TAT Rutina"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                      onClick={(entry: any) => {
                        if (entry && entry.mes && entry.año) handlePeriodChange(entry.mes, entry.año);
                      }}
                    >
                      {displayedMonthlyHistory.map((entry, index) => {
                        const isSelected = entry.mes === currentMonth && entry.año === currentYear;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isSelected ? '#7C3AED' : '#C4B5FD'}
                            className="cursor-pointer transition hover:opacity-85"
                          />
                        );
                      })}
                    </Bar>
                  ) : (
                    <Bar
                      dataKey="porcentajeCalculado"
                      name="TAT Global"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                      onClick={(entry: any) => {
                        if (entry && entry.mes && entry.año) handlePeriodChange(entry.mes, entry.año);
                      }}
                    >
                      {displayedMonthlyHistory.map((entry, index) => {
                        const isSelected = entry.mes === currentMonth && entry.año === currentYear;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={isSelected ? '#5F285F' : '#9E729E'}
                            className="cursor-pointer transition hover:opacity-85"
                          />
                        );
                      })}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chips de Meses Históricos Auditables */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Meses Auditables ({selectedEvolutionSeries}):
              </span>
              {displayedMonthlyHistory.map((m) => {
                const isSelected = m.mes === currentMonth && m.año === currentYear;
                const valueToShow =
                  selectedEvolutionSeries === 'URGENCIA'
                    ? m.porcentajeCalculadoUrgencias
                    : selectedEvolutionSeries === 'RUTINA'
                    ? m.porcentajeCalculadoRutina
                    : m.porcentajeCalculado;

                return (
                  <button
                    key={m.monthKey}
                    onClick={() => handlePeriodChange(m.mes, m.año)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                      isSelected
                        ? selectedEvolutionSeries === 'URGENCIA'
                          ? 'bg-rose-700 text-white border-rose-700 shadow-2xs'
                          : selectedEvolutionSeries === 'RUTINA'
                          ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                          : 'bg-[#5F285F] text-white border-[#5F285F] shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={`Click para ver datos de ${m.monthKey}`}
                  >
                    <span>{m.monthKey}</span>
                    <span
                      className={`font-mono text-[11px] ${
                        isSelected ? 'text-purple-200' : 'text-slate-500'
                      }`}
                    >
                      — {valueToShow !== null && valueToShow !== undefined
                        ? `${valueToShow.toLocaleString('es-AR', { minimumFractionDigits: 2 })} %`
                        : 'N/D'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE HISTORIAL DE OBSERVACIONES / AUDITORÍA MULTIUSUARIO */}
      {historyModalCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#5F285F] to-[#7a347a] text-white flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Historial de Observaciones</h3>
                  <p className="text-xs text-purple-100 mt-0.5">
                    OS <span className="font-mono font-bold text-white">{historyModalCase.os}</span> — {historyModalCase.practica}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalCase(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 text-xs text-slate-700 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>Sede: <strong className="text-slate-800">{historyModalCase.sede || 'Sin sede'}</strong></span>
                  <span>Sector: <strong className="text-slate-800">{historyModalCase.sector || 'General'}</strong></span>
                  <span>Estado: <strong className="text-[#5F285F]">{historyModalCase.estadoSeguimiento}</strong></span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Registro cronológico de modificaciones ({historyModalCase.historialObservaciones?.length || 0})
                </h4>

                {(!historyModalCase.historialObservaciones || historyModalCase.historialObservaciones.length === 0) ? (
                  <div className="p-4 text-center text-xs text-slate-500 italic bg-slate-50 rounded-xl border border-slate-100">
                    No se registran cambios históricos adicionales para esta observación.
                  </div>
                ) : (
                  <div className="space-y-2.5 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-purple-100">
                    {[...historyModalCase.historialObservaciones].reverse().map((entry, idx) => (
                      <div
                        key={entry.id || idx}
                        className="relative flex items-start gap-3 pl-7"
                      >
                        <div className="absolute left-2.5 top-1.5 w-2.5 h-2.5 rounded-full bg-[#5F285F] ring-4 ring-purple-50" />
                        <div className="flex-1 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl p-3 transition space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <User className="w-3 h-3 text-[#5F285F]" />
                              {entry.usuario}
                            </span>
                            <span className="font-mono text-slate-500 text-[10px]">
                              {entry.fechaHora || entry.timestamp}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed break-words whitespace-pre-wrap pt-0.5">
                            {entry.texto || <span className="italic text-slate-400">Observación vaciada</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setHistoryModalCase(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer shadow-2xs transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

 
};
