import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PeriodSelector } from './components/PeriodSelector';
import { KPICards } from './components/KPICards';
import { MonthlyEvolutionChart } from './components/MonthlyEvolutionChart';
import { CausesAnalysis } from './components/CausesAnalysis';
import { TopStudiesAnalysis } from './components/TopStudiesAnalysis';
import { SeverityAndFollowUp } from './components/SeverityAndFollowUp';
import { AIAnalysisPanel } from './components/AIAnalysisPanel';
import { AskDataChatbot } from './components/AskDataChatbot';
import { ExecutiveSummaryView } from './components/ExecutiveSummaryView';
import { DictionaryModal } from './components/DictionaryModal';
import { DataSyncModal } from './components/DataSyncModal';
import { IntradayDeliveriesView } from './components/IntradayDeliveriesView';
import { IntradayChartsView } from './components/IntradayChartsView';
import { IntradayImportModal, ClosureAuditSummary } from './components/IntradayImportModal';
import { TATFollowUpView } from './components/TATFollowUpView';
import { TATImportModal } from './components/TATImportModal';
import {
  INITIAL_RESUMEN_MENSUAL,
  INITIAL_INCUMPLIMIENTOS,
  INITIAL_RANKING_CAUSAS,
  INITIAL_RANKING_ESTUDIOS,
  INITIAL_DICCIONARIO,
} from './data/initialData';
import { INITIAL_INTRADAY_RECORDS } from './data/intradayData';
import {
  getPeriodKPIs,
  getSeverityDistribution,
  getTopDelaysList,
  getCausesForPeriod,
  getStudiesForPeriod,
} from './services/dataService';
import {
  loadIntradayDataset,
  saveIntradayDataset,
  clearIntradayDataset,
  loadAllDailyDeliveries,
  saveDailyDeliveryEntry,
  deleteDailyDeliveryEntry,
  clearAllDailyDeliveries,
  formatToDDMMYYYYHHmm,
  fetchCentralMonthlyData,
  fetchCentralTATCases,
  batchSaveCentralTATCases,
  fetchCentralTATSummaries,
  saveCentralTATSummary,
} from './services/storageService';
import { buildDailyDeliveryEntry, processMorningTATFile, MONTH_NAMES_LIST, calculateTATPeriodKPIs } from './services/operationalService';
import {
  ActiveModule,
  MonthName,
  ResumenMensualRow,
  UserSession,
  IntradayRecord,
  DailyDeliveryEntry,
  MonthlyPeriodMetadata,
  TATCase,
  TATDailySummary,
  LoadStatus,
} from './types';
import {
  Clock,
  Sparkles,
  ShieldCheck,
  BookOpen,
  Lock,
  ChevronRight,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';

export default function App() {
  // Current calendar date
  const today = new Date();
  const currentCalendarMonth = MONTH_NAMES_LIST[today.getMonth()];
  const currentCalendarYear = today.getFullYear();

  // State - Default period: Mes y Año Actuales en curso (ej. Octubre 2026)
  const [activeModule, setActiveModule] = useState<ActiveModule>('entregas_hoy');
  const [selectedMonth, setSelectedMonth] = useState<MonthName>(currentCalendarMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentCalendarYear);

  // Al ingresar al módulo TAT ('plazos'), asegurar que el período por defecto sea el mes y año actuales
  useEffect(() => {
    if (activeModule === 'plazos') {
      const now = new Date();
      setSelectedMonth(MONTH_NAMES_LIST[now.getMonth()]);
      setSelectedYear(now.getFullYear());
    }
  }, [activeModule]);

  // Master Data in State
  const [resumenList, setResumenList] = useState<ResumenMensualRow[]>(INITIAL_RESUMEN_MENSUAL);
  const [incumplimientosList] = useState(INITIAL_INCUMPLIMIENTOS);
  const [rankingCausasList] = useState(INITIAL_RANKING_CAUSAS);
  const [rankingEstudiosList] = useState(INITIAL_RANKING_ESTUDIOS);
  const [diccionarioList] = useState(INITIAL_DICCIONARIO);

  // Daily Deliveries & History with Persistent Central Storage
  const [dailyHistory, setDailyHistory] = useState<DailyDeliveryEntry[]>(() => {
    try {
      const cached = localStorage.getItem('labflores_daily_deliveries');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [intradayRecords, setIntradayRecords] = useState<IntradayRecord[]>([]);
  const [tatCases, setTatCases] = useState<TATCase[]>(() => {
    try {
      const cached = localStorage.getItem('labflores_tat_cases');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [tatSummaries, setTatSummaries] = useState<TATDailySummary[]>(() => {
    try {
      const cached = localStorage.getItem('labflores_tat_summaries');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState<boolean>(true);
  const [monthlyPeriodMetadata, setMonthlyPeriodMetadata] = useState<Record<string, MonthlyPeriodMetadata>>({
    'Julio-2026': {
      fechaActualizacion: '31/07/2026 20:00',
      cargadoPor: 'Dirección de Calidad (Sistema LIS)',
      nombreArchivo: 'Base_Maestra_Plazos_Julio_2026.xlsx',
    },
    'Agosto-2026': {
      fechaActualizacion: '18/08/2026 18:00',
      cargadoPor: 'preanalitica@labflores.com.ar',
      nombreArchivo: 'entregas_18_08_2026.csv',
    },
    'Septiembre-2026': {
      fechaActualizacion: '30/09/2026 20:00',
      cargadoPor: 'preanalitica@labflores.com.ar',
      nombreArchivo: 'Consolidado_TAT_Septiembre_2026.csv',
    },
    'Octubre-2026': {
      fechaActualizacion: '08/10/2026 08:07',
      cargadoPor: 'preanalitica@labflores.com.ar',
      nombreArchivo: '110236.csv',
    },
  });

  // Modals
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [isDataSyncOpen, setIsDataSyncOpen] = useState(false);
  const [isIntradayImportOpen, setIsIntradayImportOpen] = useState(false);
  const [isTATImportOpen, setIsTATImportOpen] = useState(false);

  // Intraday active date & audit notice state
  const [activeIntradayDate, setActiveIntradayDate] = useState<string | null>(null);
  const [auditNotice, setAuditNotice] = useState<ClosureAuditSummary | null>(null);

  // User Session
  const [userSession, setUserSession] = useState<UserSession>({
    email: 'preanalitica@labflores.com.ar',
    role: 'Coordinador de Calidad / Dirección',
    isAuthorizedForSensitiveData: true,
  });

  // Function to load all centralized persistent datasets from backend
  const refreshCentralData = async (isMounted = true) => {
    try {
      // 1. Fetch Central Monthly Data
      const centralMonthly = await fetchCentralMonthlyData();
      if (centralMonthly && isMounted) {
        if (centralMonthly.resumenList && centralMonthly.resumenList.length > 0) {
          setResumenList(centralMonthly.resumenList);
        }
        if (centralMonthly.periodMetadata) {
          setMonthlyPeriodMetadata(centralMonthly.periodMetadata);
        }
      }

      // 2. Fetch Central Daily Deliveries
      const allDeliveries = await loadAllDailyDeliveries();
      if (!isMounted) return;

      if (allDeliveries && allDeliveries.length > 0) {
        setDailyHistory(allDeliveries);
        const latest = allDeliveries[0];
        setIntradayRecords(latest.records || []);
        setLastUpdatedTime(latest.fechaActualizacion || formatToDDMMYYYYHHmm(new Date()));
      } else {
        // Initialize with benchmark dataset for 2026-08-18
        const initialEntry = buildDailyDeliveryEntry(
          INITIAL_INTRADAY_RECORDS,
          '2026-08-18',
          'entregas_18_08_2026.csv',
          '18/08/2026 18:00',
          'preanalitica@labflores.com.ar'
        );
        try {
          await saveDailyDeliveryEntry(initialEntry);
        } catch (e) {
          console.warn('Fallback saving initial daily entry:', e);
        }
        if (!isMounted) return;
        setDailyHistory([initialEntry]);
        setIntradayRecords(INITIAL_INTRADAY_RECORDS);
        setLastUpdatedTime('18/08/2026 18:00');
      }

      // 3. Fetch Central TAT Breaches & Cases (01/09/2026 formal start date)
      const centralTAT = await fetchCentralTATCases();
      if (isMounted) {
        setTatCases(centralTAT || []);
      }

      // 4. Fetch Central TAT Daily Summaries (Aislado de Entregas Diarias)
      const centralSummaries = await fetchCentralTATSummaries();
      if (isMounted) {
        setTatSummaries(centralSummaries || []);
      }
    } catch (err) {
      console.error('Error al recuperar dataset central:', err);
    } finally {
      if (isMounted) {
        setIsStorageLoading(false);
      }
    }
  };

  // Verify and load persisted datasets on startup & when window regains focus or periodic background polling
  useEffect(() => {
    let isMounted = true;
    setIsStorageLoading(true);
    refreshCentralData(isMounted);

    // Auto-refresh when user returns to tab (with throttle so it doesn't freeze the UI)
    let lastRefreshTime = Date.now();
    const onWindowFocus = () => {
      const now = Date.now();
      if (now - lastRefreshTime > 15000) {
        lastRefreshTime = now;
        refreshCentralData(true);
      }
    };

    window.addEventListener('focus', onWindowFocus);

    // Periodic polling every 60s for multi-device sync
    const pollInterval = setInterval(() => {
      lastRefreshTime = Date.now();
      refreshCentralData(true);
    }, 60000);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', onWindowFocus);
      clearInterval(pollInterval);
    };
  }, []);

  // Sincronización continua de resumenList con los datos operativos del módulo TAT para meses en curso y activos (>= Septiembre 2026)
  useEffect(() => {
    if ((tatSummaries && tatSummaries.length > 0) || (dailyHistory && dailyHistory.length > 0)) {
      setResumenList((prevList) => {
        let changed = false;
        const updated = prevList.map((r) => {
          if ((r.Mes === 'Septiembre' || r.Mes === 'Octubre') && r.Año === 2026) {
            const kpi = calculateTATPeriodKPIs(tatCases, r.Mes, r.Año, dailyHistory, prevList, new Date(), tatSummaries);
            if (kpi.totalOSPrometidasMes > 0 && kpi.porcentajeFueraPlazo !== null) {
              const newAtendidos = kpi.totalOSPrometidasMes;
              const newFuera = kpi.osAfectadasUnicasMes;
              const newPctFuera = kpi.porcentajeFueraPlazo;
              const newPctCumpl = Number((100 - newPctFuera).toFixed(2));
              const newEstado: LoadStatus = 'Cargado (completo)';
              if (
                r.EstadoCarga !== newEstado ||
                r.PacientesAtendidos !== newAtendidos ||
                r.PacientesUnicosFueraPlazo !== newFuera ||
                r.PorcentajeFueraPlazo !== newPctFuera
              ) {
                changed = true;
                return {
                  ...r,
                  EstadoCarga: newEstado,
                  PacientesAtendidos: newAtendidos,
                  PacientesUnicosFueraPlazo: newFuera,
                  EstudiosFueraPlazo: kpi.practicasFueraPlazoUnicasMes,
                  MedianaRetraso: Math.round(kpi.promedioDemoraDiasPeriodo) || 2,
                  MaximoRetraso: 7,
                  PorcentajeFueraPlazo: newPctFuera,
                  PorcentajeCumplimiento: newPctCumpl,
                };
              }
            }
          }
          return r;
        });
        return changed ? updated : prevList;
      });
    }
  }, [tatSummaries, dailyHistory, tatCases]);

  // Save or update a daily entry (Centrally persisted for all users)
  const handleSaveDailyEntry = async (entry: DailyDeliveryEntry) => {
    // Let errors bubble up to IntradayImportModal so it can inform user accurately
    await saveDailyDeliveryEntry(entry);
    const updated = await loadAllDailyDeliveries();
    setDailyHistory(updated);
    setIntradayRecords(entry.records || []);
    setLastUpdatedTime(entry.fechaActualizacion);
    setActiveIntradayDate(entry.fecha);
  };

  // Delete a daily entry
  const handleDeleteDailyEntry = async (fechaISO: string) => {
    try {
      await deleteDailyDeliveryEntry(fechaISO);
      const updated = await loadAllDailyDeliveries();
      setDailyHistory(updated);
      if (updated.length > 0) {
        setIntradayRecords(updated[0].records || []);
        setLastUpdatedTime(updated[0].fechaActualizacion);
      } else {
        setIntradayRecords([]);
        setLastUpdatedTime(null);
      }
    } catch (err) {
      console.error('Error al eliminar entrega diaria:', err);
    }
  };

  // Update records and persist
  const handleUpdateIntradayRecords = async (newRecords: IntradayRecord[]) => {
    setIntradayRecords(newRecords);
    if (newRecords && newRecords.length > 0) {
      try {
        const meta = await saveIntradayDataset(newRecords);
        setLastUpdatedTime(meta.lastUpdatedFormatted);
      } catch (err) {
        console.error('Error al guardar dataset en IndexedDB:', err);
        setLastUpdatedTime(formatToDDMMYYYYHHmm(new Date()));
      }
    } else {
      try {
        await clearIntradayDataset();
      } catch (err) {
        console.error('Error al limpiar IndexedDB:', err);
      }
      setLastUpdatedTime(null);
    }
  };

  // Clear local records
  const handleClearIntradayRecords = async () => {
    try {
      await clearAllDailyDeliveries();
      await clearIntradayDataset();
    } catch (err) {
      console.error('Error al limpiar almacenamiento local:', err);
    }
    setDailyHistory([]);
    setIntradayRecords([]);
    setLastUpdatedTime(null);
  };

  // Current Period Calculations
  const currentKPIs = useMemo(() => {
    return getPeriodKPIs(selectedMonth, selectedYear, resumenList, incumplimientosList);
  }, [selectedMonth, selectedYear, resumenList, incumplimientosList]);

  const currentSeverity = useMemo(() => {
    return getSeverityDistribution(selectedMonth, selectedYear, incumplimientosList);
  }, [selectedMonth, selectedYear, incumplimientosList]);

  const currentTopDelays = useMemo(() => {
    return getTopDelaysList(selectedMonth, selectedYear, incumplimientosList, 10);
  }, [selectedMonth, selectedYear, incumplimientosList]);

  const currentRankingCausas = useMemo(() => {
    return getCausesForPeriod(selectedMonth, selectedYear, rankingCausasList, incumplimientosList);
  }, [selectedMonth, selectedYear, rankingCausasList, incumplimientosList]);

  const currentRankingEstudios = useMemo(() => {
    return getStudiesForPeriod(selectedMonth, selectedYear, rankingEstudiosList, incumplimientosList);
  }, [selectedMonth, selectedYear, rankingEstudiosList, incumplimientosList]);

  const periodoTexto = `${selectedMonth} ${selectedYear}`;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col font-sans antialiased text-[#111111] selection:bg-[#5F285F] selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        onOpenDictionary={() => setIsDictionaryOpen(true)}
        onOpenDataSync={() => setIsDataSyncOpen(true)}
        userSession={userSession}
        setUserSession={setUserSession}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* --- VIEW 1: RESUMEN EJECUTIVO --- */}
        {activeModule === 'resumen' && (
          <ExecutiveSummaryView
            kpis={currentKPIs}
            periodo={periodoTexto}
            onNavigateToPlazos={() => setActiveModule('plazos')}
          />
        )}

        {/* --- VIEW 2: MÓDULO OPERATIVO — ENTREGAS DIARIAS --- */}
        {activeModule === 'entregas_hoy' && (
          <IntradayDeliveriesView
            records={intradayRecords}
            dailyHistory={dailyHistory}
            onUpdateRecords={handleUpdateIntradayRecords}
            onSaveDailyEntry={handleSaveDailyEntry}
            onDeleteDailyEntry={handleDeleteDailyEntry}
            onClearRecords={handleClearIntradayRecords}
            lastUpdatedTime={lastUpdatedTime}
            isStorageLoading={isStorageLoading}
            userSession={userSession}
            onOpenImportModal={() => setIsIntradayImportOpen(true)}
            selectedDate={activeIntradayDate}
            onSelectDate={(date) => setActiveIntradayDate(date)}
            auditNotice={auditNotice}
            onDismissAuditNotice={() => setAuditNotice(null)}
          />
        )}

        {/* --- VIEW 2: GRÁFICOS DE ENTREGAS DIARIAS (TORTAS: PENDIENTES, TOP PRÁCTICAS, TOP SECTORES) --- */}
        {activeModule === 'entregas_graficos' && (
          <IntradayChartsView
            dailyHistory={dailyHistory}
            records={intradayRecords}
            selectedDate={activeIntradayDate}
            onSelectDate={(date) => setActiveIntradayDate(date)}
            onNavigateToDeliveries={() => setActiveModule('entregas_hoy')}
            lastUpdatedTime={lastUpdatedTime}
          />
        )}

        {/* --- VIEW 3: PLAZOS DE ENTREGA (MÓDULO TAT: SEGUIMIENTO DE PRÁCTICAS VENCIDAS) --- */}
        {activeModule === 'plazos' && (
          <TATFollowUpView
            tatCases={tatCases}
            onUpdateCases={(updated) => setTatCases(updated)}
            onOpenImportModal={() => setIsTATImportOpen(true)}
            userSession={userSession}
            lastUpdatedTime={lastUpdatedTime}
            tatSummaries={tatSummaries}
            dailyHistory={dailyHistory}
            resumenList={resumenList}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onSelectPeriod={(mes, año) => {
              setSelectedMonth(mes);
              setSelectedYear(año);
            }}
          />
        )}

        {/* --- VIEW 4: ASISTENTE IA --- */}
        {activeModule === 'asistente' && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <AskDataChatbot
              resumenList={resumenList}
              incumplimientosList={incumplimientosList}
              rankingCausasList={rankingCausasList}
              rankingEstudiosList={rankingEstudiosList}
              currentKPIs={currentKPIs}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />
          </div>
        )}

        {/* --- VIEW 5: MÓDULOS EN DESARROLLO --- */}
        {activeModule.startsWith('placeholder_') && (
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center max-w-2xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-[#F7F2F7] text-[#5F285F] flex items-center justify-center mx-auto mb-4 border border-[#E9DDE9]">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeModule === 'placeholder_experiencia' && 'Experiencia del Paciente'}
              {activeModule === 'placeholder_preanalitica' && 'Calidad Preanalítica'}
              {activeModule === 'placeholder_analitica' && 'Calidad Analítica'}
              {activeModule === 'placeholder_iso15189' && 'ISO 15189'}
            </h2>
            <p className="text-sm text-slate-600 font-medium mt-2 leading-relaxed">
              Este módulo se encuentra planificado dentro del marco de aseguramiento continuo.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setActiveModule('plazos')}
                className="px-5 py-2.5 bg-[#5F285F] hover:bg-[#452045] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-xs"
              >
                Volver a TAT
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Dictionary / Glossary Modal */}
      <DictionaryModal
        isOpen={isDictionaryOpen}
        onClose={() => setIsDictionaryOpen(false)}
        dictionary={diccionarioList}
      />

      {/* Data Sync / CSV Import Modal for Monthly TAT */}
      <DataSyncModal
        isOpen={isDataSyncOpen}
        onClose={() => setIsDataSyncOpen(false)}
        onUpdateResumen={(newList, updatedMeta) => {
          setResumenList(newList);
          if (updatedMeta) {
            setMonthlyPeriodMetadata((prev) => ({ ...prev, ...updatedMeta }));
          }
        }}
        resumenList={resumenList}
        userEmail={userSession.email}
      />

      {/* Data Import Modal for Daily Deliveries */}
      <IntradayImportModal
        isOpen={isIntradayImportOpen}
        onClose={() => setIsIntradayImportOpen(false)}
        onUpdateRecords={handleUpdateIntradayRecords}
        onSaveDailyEntry={handleSaveDailyEntry}
        dailyHistory={dailyHistory}
        currentRecordsCount={intradayRecords.length}
        userEmail={userSession.email}
        onClosureUpdated={(summary) => {
          setAuditNotice(summary);
          setActiveIntradayDate(summary.fecha);
        }}
        onSelectDate={(date) => setActiveIntradayDate(date)}
      />

      {/* Morning LIS Import Modal for TAT Follow-up */}
      <TATImportModal
        isOpen={isTATImportOpen}
        onClose={() => setIsTATImportOpen(false)}
        existingCases={tatCases}
        tatSummaries={tatSummaries}
        dailyHistory={dailyHistory}
        userEmail={userSession.email}
        onApplyUpdatedCases={async (updated) => {
          setTatCases(updated);
          await batchSaveCentralTATCases(updated);
          setLastUpdatedTime(formatToDDMMYYYYHHmm(new Date()));
        }}
        onApplyMorningResult={async (result) => {
          // 1. Guardar casos TAT
          setTatCases(result.updatedCases);
          await batchSaveCentralTATCases(result.updatedCases);

          // 2. Guardar resumen propio y aislado del TAT (sin afectar jamás a Entregas Diarias)
          if (result.tatSummary) {
            try {
              await saveCentralTATSummary(result.tatSummary);
              const updatedSummaries = await fetchCentralTATSummaries();
              setTatSummaries(updatedSummaries);
            } catch (summaryErr) {
              console.warn('Error al persistir resumen diario TAT en base central:', summaryErr);
            }
          }

          setLastUpdatedTime(formatToDDMMYYYYHHmm(new Date()));
        }}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">Laboratorio de Análisis Clínicos</span>
            <span>•</span>
            <span>Sistema Integral de Gestión de Calidad & Tiempos de Respuesta</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center gap-1 text-slate-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Conforme a ISO 15189 / ISO 9001</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
