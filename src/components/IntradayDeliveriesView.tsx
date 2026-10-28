import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  IntradayRecord,
  ConsolidatedPractice,
  UserSession,
  DailyDeliveryEntry,
  DeliveryObservation,
} from '../types';
import { ClosureAuditSummary } from './IntradayImportModal';
import { FileAuditHistoryModal } from './FileAuditHistoryModal';
import {
  calculateIntradayKPIs,
  calculateDailyComparison,
  consolidateRecordsIntoPractices,
  classifyTimePromise,
  isActoBioquimico,
  getTodayLocalDateString,
  formatISOToDisplayDate,
  getPracticeObservationKey,
  isEmergenciaOS,
} from '../services/operationalService';
import {
  fetchCentralObservations,
  saveCentralObservation,
  deleteCentralObservation,
  formatToDDMMYYYYHHmm,
  loadDailyDeliveryByDate,
} from '../services/storageService';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Filter,
  Search,
  ShieldCheck,
  Building2,
  ArrowUpDown,
  Download,
  Eye,
  EyeOff,
  Calendar,
  Zap,
  ChevronDown,
  ChevronRight,
  QrCode,
  FlaskConical,
  Trash2,
  Database,
  Upload,
  RotateCcw,
  X,
  Target,
  Users,
  Activity,
  CheckSquare,
  FileText,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  History,
  MessageSquare,
  Edit3,
  Check,
  Copy,
  Plus,
  MessageCircle,
} from 'lucide-react';

interface IntradayDeliveriesViewProps {
  records?: IntradayRecord[];
  dailyHistory?: DailyDeliveryEntry[];
  onUpdateRecords?: (newRecords: IntradayRecord[]) => void;
  onSaveDailyEntry?: (entry: DailyDeliveryEntry) => void;
  onDeleteDailyEntry?: (fechaISO: string) => void;
  onClearRecords?: () => void;
  lastUpdatedTime?: string | null;
  isStorageLoading?: boolean;
  userSession?: UserSession;
  onOpenImportModal?: () => void;
  selectedDate?: string | null;
  onSelectDate?: (dateISO: string) => void;
  auditNotice?: ClosureAuditSummary | null;
  onDismissAuditNotice?: () => void;
}

interface CopyOSButtonProps {
  os: string;
}

const CopyOSButton: React.FC<CopyOSButtonProps> = ({ os }) => {
  const [copied, setCopied] = useState(false);
  // Extract clean OS number, e.g. "011-67857-3" without any (E) marker or trailing spaces
  const cleanOS = os ? os.replace(/\s*\(E\)\s*/gi, '').trim() : '';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleanOS) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(cleanOS);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = cleanOS;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Error al copiar OS:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-sans font-semibold transition cursor-pointer select-none shrink-0 ${
        copied
          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
          : 'bg-slate-100 hover:bg-[#F7F2F7] text-slate-600 hover:text-[#5F285F] border border-slate-200 hover:border-[#E9DDE9]'
      }`}
      title={`Copiar OS: ${cleanOS}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
          <span className="text-emerald-700 font-bold">Copiado</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 text-slate-400 group-hover:text-[#5F285F] shrink-0" />
          <span>Copiar OS</span>
        </>
      )}
    </button>
  );
};

interface ObservationCellProps {
  os: string;
  estudio: string;
  obs?: DeliveryObservation;
  userEmail: string;
  onSave: (os: string, estudio: string, text: string) => Promise<void>;
  onDelete: (os: string, estudio: string) => Promise<void>;
  onViewFull: (obs: DeliveryObservation) => void;
}

const ObservationCell: React.FC<ObservationCellProps> = ({
  os,
  estudio,
  obs,
  userEmail,
  onSave,
  onDelete,
  onViewFull,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(obs?.texto || '');
  const [showSavedBadge, setShowSavedBadge] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const badgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync draftText if external obs changes and not currently editing
  useEffect(() => {
    if (!isEditing) {
      setDraftText(obs?.texto || '');
    }
  }, [obs?.texto, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleCommit = async () => {
    const trimmed = draftText.trim();
    const currentText = (obs?.texto || '').trim();

    if (trimmed === currentText) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    if (!trimmed) {
      // User cleared the observation
      await onDelete(os, estudio);
    } else {
      await onSave(os, estudio, trimmed);
    }
    setIsSaving(false);
    setIsEditing(false);

    // Show "Guardado" badge
    setShowSavedBadge(true);
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = setTimeout(() => {
      setShowSavedBadge(false);
    }, 2200);
  };

  const handleCancel = () => {
    setDraftText(obs?.texto || '');
    setIsEditing(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    await onDelete(os, estudio);
    setDraftText('');
    setIsSaving(false);
    setIsEditing(false);
    setShowSavedBadge(true);
    if (badgeTimerRef.current) clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = setTimeout(() => {
      setShowSavedBadge(false);
    }, 2200);
  };

  if (isEditing) {
    return (
      <div className="w-64 min-w-[220px] max-w-[280px] space-y-1.5 p-1">
        <textarea
          ref={textareaRef}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleCommit();
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
          placeholder="Escriba la observación aquí..."
          rows={2}
          className="w-full text-[13px] text-slate-900 bg-white border-2 border-[#5F285F] rounded-lg p-2 focus:outline-hidden shadow-xs resize-none"
        />
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate" title={`Guardará como ${userEmail}`}>
            Auto-guarda al salir
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCancel}
              className="text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCommit}
              disabled={isSaving}
              className="bg-[#5F285F] text-white font-semibold px-2 py-0.5 rounded hover:bg-[#4A1F4A] cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Check className="w-3 h-3" />
              Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (obs?.texto) {
    const isLong = obs.texto.length > 55;
    return (
      <div className="w-64 min-w-[220px] max-w-[280px]">
        <div
          onClick={() => setIsEditing(true)}
          className="group relative bg-amber-50/50 hover:bg-amber-50/80 border border-amber-200/80 hover:border-amber-300 rounded-lg p-2 transition cursor-pointer text-left shadow-2xs"
          title="Haga clic para editar la observación"
        >
          <div className="flex items-start justify-between gap-1">
            <p className="text-[13px] text-slate-900 font-medium leading-snug line-clamp-2 break-words">
              {obs.texto}
            </p>
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 text-slate-500 hover:text-[#5F285F] hover:bg-white rounded transition"
                title="Modificar observación"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                title="Eliminar observación"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 font-sans border-t border-amber-200/40 pt-1">
            <span className="truncate flex items-center gap-1" title={`Modificado por ${obs.modificadoPor} el ${obs.fechaHora}`}>
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              {obs.modificadoPor.split('@')[0]} • {obs.fechaHora.split(' ')[1] || obs.fechaHora}
            </span>
            {isLong && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewFull(obs);
                }}
                className="text-[#5F285F] hover:underline font-semibold shrink-0 ml-1"
              >
                Ver más
              </button>
            )}
          </div>
        </div>

        {showSavedBadge && (
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
            <Check className="w-3 h-3 text-emerald-600" />
            Guardado
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-64 min-w-[220px] max-w-[280px]">
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="w-full text-left py-1.5 px-2.5 rounded-lg border border-dashed border-slate-300 hover:border-[#5F285F]/60 bg-white hover:bg-slate-50 text-[12.5px] text-slate-400 hover:text-slate-700 flex items-center justify-between transition group cursor-pointer"
        title="Agregar observación manual a esta orden y práctica"
      >
        <span className="flex items-center gap-1.5 truncate">
          <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#5F285F]" />
          <span>Escribir observación...</span>
        </span>
        <Edit3 className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#5F285F] opacity-0 group-hover:opacity-100 transition" />
      </button>

      {showSavedBadge && (
        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
          <Check className="w-3 h-3 text-emerald-600" />
          Guardado
        </div>
      )}
    </div>
  );
};

export const IntradayDeliveriesView: React.FC<IntradayDeliveriesViewProps> = ({
  records = [],
  dailyHistory = [],
  onUpdateRecords = () => {},
  onDeleteDailyEntry = (_fechaISO: string) => {},
  onClearRecords = () => {},
  lastUpdatedTime = null,
  isStorageLoading = false,
  userSession = { email: '', role: '', isAuthorizedForSensitiveData: false },
  onOpenImportModal = () => {},
  selectedDate: propSelectedDate = null,
  onSelectDate,
  auditNotice = null,
  onDismissAuditNotice = () => {},
}) => {
  // Fecha local actual del usuario/dispositivo (calculada dinámicamente sin UTC)
  const todayDate = useMemo(() => getTodayLocalDateString(), []);

  // Fechas históricas con datos en el dataset cargado o en el historial
  const datesWithData = useMemo(() => {
    const datesSet = new Set<string>();
    (records || []).forEach((r) => {
      if (r.fechaPrometida) datesSet.add(r.fechaPrometida);
    });
    (dailyHistory || []).forEach((h) => {
      if (h.fecha) datesSet.add(h.fecha);
    });
    return Array.from(datesSet).sort().reverse();
  }, [records, dailyHistory]);

  // Lista de todas las fechas para el selector (Hoy siempre incluido, orden descendente)
  const selectableDates = useMemo(() => {
    const datesSet = new Set<string>();
    datesSet.add(todayDate);
    datesWithData.forEach((d) => datesSet.add(d));
    return Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  }, [todayDate, datesWithData]);

  // Último día con datos disponibles (el más reciente de los datos cargados)
  const latestDateWithData = useMemo(() => {
    return datesWithData.length > 0 ? datesWithData[0] : null;
  }, [datesWithData]);

  // State: la fecha seleccionada por defecto al ingresar es HOY (nunca abrir automáticamente el último histórico)
  const [internalSelectedDate, setInternalSelectedDate] = useState<string>(() => {
    return propSelectedDate || getTodayLocalDateString();
  });

  // Observations State (Centralized map keyed by `${cleanOS}___${normStudy}`)
  const [observationsMap, setObservationsMap] = useState<Record<string, DeliveryObservation>>({});
  const [viewingObservation, setViewingObservation] = useState<DeliveryObservation | null>(null);

  // Load observations from centralized backend on mount and window focus
  useEffect(() => {
    let isMounted = true;
    const loadObservations = async () => {
      try {
        const data = await fetchCentralObservations();
        if (isMounted && data) {
          setObservationsMap(data);
        }
      } catch (err) {
        console.warn('Error al recuperar observaciones centrales:', err);
      }
    };

    loadObservations();
    const handleFocus = () => loadObservations();
    window.addEventListener('focus', handleFocus);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleSaveObservation = async (os: string, estudio: string, text: string) => {
    const key = getPracticeObservationKey(os, estudio);
    const nowFormatted = formatToDDMMYYYYHHmm(new Date());
    const author = userSession.email || 'preanalitica@labflores.com.ar';

    const obsObj: DeliveryObservation = {
      id: key,
      os,
      estudio,
      texto: text.trim(),
      fechaHora: nowFormatted,
      modificadoPor: author,
      fechaISO: selectedDate,
    };

    // Optimistic local update
    setObservationsMap((prev) => ({
      ...prev,
      [key]: obsObj,
    }));

    // Persist to central database backend
    try {
      await saveCentralObservation(obsObj);
    } catch (err) {
      console.error('Error al guardar observación en base de datos central:', err);
    }
  };

  const handleDeleteObservation = async (os: string, estudio: string) => {
    const key = getPracticeObservationKey(os, estudio);

    // Optimistic local update
    setObservationsMap((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    // Delete in central database backend
    try {
      await deleteCentralObservation(key);
    } catch (err) {
      console.error('Error al eliminar observación en base de datos central:', err);
    }
  };

  // Sync internal state when external prop changes
  useEffect(() => {
    if (propSelectedDate && propSelectedDate !== internalSelectedDate) {
      setInternalSelectedDate(propSelectedDate);
    }
  }, [propSelectedDate]);

  const selectedDate = propSelectedDate || internalSelectedDate;
  const setSelectedDate = (newDate: string) => {
    setInternalSelectedDate(newDate);
    if (onSelectDate) onSelectDate(newDate);
  };
  const [showSensitiveNames, setShowSensitiveNames] = useState<boolean>(false);
  const [showAuditHistoryModal, setShowAuditHistoryModal] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [deleteTargetDate, setDeleteTargetDate] = useState<string | null>(null);
  const [tableViewScope, setTableViewScope] = useState<'solo_no_listas' | 'todas' | 'agrupado_os'>('solo_no_listas');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedPractices, setExpandedPractices] = useState<Set<string>>(new Set());

  // Filters for the table
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSedeFilter, setSelectedSedeFilter] = useState<string>('TODAS');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('TODOS');
  const [selectedStatusCategoryFilter, setSelectedStatusCategoryFilter] = useState<string>('TODOS');
  const [selectedPromisedTimeFilter, setSelectedPromisedTimeFilter] = useState<'TODAS' | 'HASTA_18' | 'DESPUES_18' | 'SIN_HORA'>('TODAS');
  const [selectedAttentionTypeFilter, setSelectedAttentionTypeFilter] = useState<'TODOS' | 'EMERGENCIA' | 'RUTINA'>('TODOS');
  const [sortField, setSortField] = useState<'hora' | 'os' | 'estudio' | 'sede'>('hora');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Lazy loaded full records cache for historical dates
  const [loadedDateRecords, setLoadedDateRecords] = useState<Record<string, IntradayRecord[]>>({});
  const [isLoadingHistoricalDate, setIsLoadingHistoricalDate] = useState<boolean>(false);

  // Pagination states for high performance rendering
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const [ordersPage, setOrdersPage] = useState<number>(1);
  const [ordersPageSize, setOrdersPageSize] = useState<number>(50);

  // Debounced search to prevent heavy UI re-renders on keystrokes
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 180);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset pagination when filters or search change
  useEffect(() => {
    setCurrentPage(1);
    setOrdersPage(1);
  }, [
    debouncedSearchTerm,
    selectedSedeFilter,
    selectedSectorFilter,
    selectedStatusCategoryFilter,
    selectedPromisedTimeFilter,
    selectedAttentionTypeFilter,
    tableViewScope,
    selectedDate,
    sortField,
    sortOrder,
  ]);

  // Fetch full records on demand if a historical day without full records is selected
  useEffect(() => {
    let isMounted = true;
    const fromHistory = dailyHistory.find((h) => h.fecha === selectedDate);
    if (
      fromHistory &&
      (!fromHistory.records || fromHistory.records.length === 0) &&
      !loadedDateRecords[selectedDate]
    ) {
      setIsLoadingHistoricalDate(true);
      loadDailyDeliveryByDate(selectedDate)
        .then((fullEntry) => {
          if (isMounted && fullEntry && Array.isArray(fullEntry.records) && fullEntry.records.length > 0) {
            setLoadedDateRecords((prev) => ({ ...prev, [selectedDate]: fullEntry.records }));
          }
        })
        .catch((err) => {
          console.warn('Error cargando registros del día:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingHistoricalDate(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [selectedDate, dailyHistory, loadedDateRecords]);

  // Determina si la fecha actualmente seleccionada tiene datos cargados
  const selectedDateHasData = useMemo(() => {
    return datesWithData.includes(selectedDate);
  }, [datesWithData, selectedDate]);

  // Dataset activo para la fecha seleccionada
  const activeDateRecords = useMemo(() => {
    if (loadedDateRecords[selectedDate] && loadedDateRecords[selectedDate].length > 0) {
      return loadedDateRecords[selectedDate];
    }
    const fromHistory = dailyHistory.find((h) => h.fecha === selectedDate);
    if (fromHistory && fromHistory.records && fromHistory.records.length > 0) {
      return fromHistory.records;
    }
    return (records || []).filter((r) => r.fechaPrometida === selectedDate);
  }, [records, dailyHistory, selectedDate, loadedDateRecords]);

  // Active Daily Entry metadata
  const activeDailyEntry = useMemo(() => {
    return dailyHistory.find((h) => h.fecha === selectedDate) || null;
  }, [dailyHistory, selectedDate]);

  // KPIs calculation for the active date
  const kpis = useMemo(() => {
    return calculateIntradayKPIs(activeDateRecords, selectedDate, '18:00');
  }, [activeDateRecords, selectedDate]);

  // Daily comparison against previous available historical day
  const dailyComparison = useMemo(() => {
    return calculateDailyComparison(dailyHistory, selectedDate);
  }, [dailyHistory, selectedDate]);

  // Sedes & Sectores for dropdowns
  const sedesList = useMemo(() => {
    const set = new Set(activeDateRecords.map((r) => r.sede).filter(Boolean));
    return Array.from(set).sort();
  }, [activeDateRecords]);

  const sectoresList = useMemo(() => {
    const set = new Set(activeDateRecords.map((r) => r.sector).filter(Boolean));
    return Array.from(set).sort();
  }, [activeDateRecords]);

  // Consolidated practices for current date
  const currentConsolidatedPractices = useMemo(() => {
    return consolidateRecordsIntoPractices(activeDateRecords, '18:00');
  }, [activeDateRecords]);

  // Filtered practices for Table (Section 6)
  const filteredPractices = useMemo(() => {
    return currentConsolidatedPractices.filter((p) => {
      // Scope filter
      if (tableViewScope === 'solo_no_listas') {
        if (p.grupoConsolidado === 'LISTO') return false;
      }

      // Status category filter
      if (selectedStatusCategoryFilter !== 'TODOS') {
        if (p.estadoConsolidado !== selectedStatusCategoryFilter) return false;
      }

      // Sede filter
      if (selectedSedeFilter !== 'TODAS' && p.sede !== selectedSedeFilter) {
        return false;
      }

      // Sector filter
      if (selectedSectorFilter !== 'TODOS' && p.sector !== selectedSectorFilter) {
        return false;
      }

      // Promised Time filter (≤ 18:00 vs > 18:00 vs Sin hora)
      if (selectedPromisedTimeFilter !== 'TODAS') {
        const timeGroup = classifyTimePromise(p.horaPrometida);
        if (selectedPromisedTimeFilter === 'HASTA_18' && timeGroup !== 'HASTA_18') return false;
        if (selectedPromisedTimeFilter === 'DESPUES_18' && timeGroup !== 'DESPUES_18') return false;
        if (selectedPromisedTimeFilter === 'SIN_HORA' && timeGroup !== 'SIN_HORA_VALIDA') return false;
      }

      // Attention Type filter (Emergencias con (E) vs Rutina con demás)
      if (selectedAttentionTypeFilter !== 'TODOS') {
        const isEmerg = isEmergenciaOS(p.os) || (p.physicalRecords && p.physicalRecords.some((r) => isEmergenciaOS(r.os)));
        if (selectedAttentionTypeFilter === 'EMERGENCIA' && !isEmerg) return false;
        if (selectedAttentionTypeFilter === 'RUTINA' && isEmerg) return false;
      }

      // Search filter
      if (debouncedSearchTerm.trim()) {
        const term = debouncedSearchTerm.toLowerCase();
        const obsKey = getPracticeObservationKey(p.os, p.estudio);
        const obs = observationsMap[obsKey];
        const matchesOS = p.os.toLowerCase().includes(term);
        const matchesStudy = p.estudio.toLowerCase().includes(term);
        const matchesPatientAnon = p.idPacienteAnon.toLowerCase().includes(term);
        const matchesPatientName = p.nombrePaciente?.toLowerCase().includes(term);
        const matchesBarcode = p.codigosBarra.some((bc) => bc.toLowerCase().includes(term));
        const matchesObservation = obs?.texto ? obs.texto.toLowerCase().includes(term) : false;
        return matchesOS || matchesStudy || matchesPatientAnon || matchesPatientName || matchesBarcode || matchesObservation;
      }

      return true;
    }).sort((a, b) => {
      let valA: string = '';
      let valB: string = '';

      if (sortField === 'hora') {
        valA = a.horaPrometida || '';
        valB = b.horaPrometida || '';
      } else if (sortField === 'os') {
        valA = a.os || '';
        valB = b.os || '';
      } else if (sortField === 'estudio') {
        valA = a.estudio || '';
        valB = b.estudio || '';
      } else if (sortField === 'sede') {
        valA = a.sede || '';
        valB = b.sede || '';
      }

      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [
    currentConsolidatedPractices,
    tableViewScope,
    selectedStatusCategoryFilter,
    selectedSedeFilter,
    selectedSectorFilter,
    selectedPromisedTimeFilter,
    selectedAttentionTypeFilter,
    debouncedSearchTerm,
    sortField,
    sortOrder,
    observationsMap,
  ]);

  // Grouped by OS for alternate view
  const ordersGroupedView = useMemo(() => {
    const map = new Map<string, {
      os: string;
      idPacienteAnon: string;
      nombrePaciente?: string;
      sede: string;
      horaPrometida: string;
      practicas: ConsolidatedPractice[];
      tieneNoListas: boolean;
      totalPracticas: number;
      practicasNoListasCount: number;
    }>();

    currentConsolidatedPractices.forEach((p) => {
      if (!map.has(p.os)) {
        map.set(p.os, {
          os: p.os,
          idPacienteAnon: p.idPacienteAnon,
          nombrePaciente: p.nombrePaciente,
          sede: p.sede,
          horaPrometida: p.horaPrometida,
          practicas: [],
          tieneNoListas: false,
          totalPracticas: 0,
          practicasNoListasCount: 0,
        });
      }

      const group = map.get(p.os)!;
      group.practicas.push(p);
      group.totalPracticas++;
      if (p.grupoConsolidado !== 'LISTO') {
        group.tieneNoListas = true;
        group.practicasNoListasCount++;
      }
    });

    let list = Array.from(map.values());

    if (tableViewScope === 'solo_no_listas') {
      list = list.filter((g) => g.tieneNoListas);
    }

    if (selectedSedeFilter !== 'TODAS') {
      list = list.filter((g) => g.sede === selectedSedeFilter);
    }

    if (selectedPromisedTimeFilter !== 'TODAS') {
      list = list.filter((g) => {
        const noListas = g.practicas.filter((p) => p.grupoConsolidado !== 'LISTO');
        if (noListas.length > 0) {
          const hasNoListasHasta18 = noListas.some((p) => classifyTimePromise(p.horaPrometida) === 'HASTA_18');
          const hasNoListasDespues18 = noListas.some((p) => classifyTimePromise(p.horaPrometida) === 'DESPUES_18');
          const hasNoListasSinHora = noListas.some((p) => classifyTimePromise(p.horaPrometida) === 'SIN_HORA_VALIDA');

          if (selectedPromisedTimeFilter === 'HASTA_18') {
            return hasNoListasHasta18;
          }
          if (selectedPromisedTimeFilter === 'DESPUES_18') {
            return !hasNoListasHasta18 && hasNoListasDespues18;
          }
          if (selectedPromisedTimeFilter === 'SIN_HORA') {
            return !hasNoListasHasta18 && !hasNoListasDespues18 && hasNoListasSinHora;
          }
        } else {
          // Si es una OS con todas sus prácticas listas
          if (selectedPromisedTimeFilter === 'HASTA_18') {
            return g.practicas.some((p) => classifyTimePromise(p.horaPrometida) === 'HASTA_18');
          }
          if (selectedPromisedTimeFilter === 'DESPUES_18') {
            return g.practicas.some((p) => classifyTimePromise(p.horaPrometida) === 'DESPUES_18');
          }
          if (selectedPromisedTimeFilter === 'SIN_HORA') {
            return g.practicas.some((p) => classifyTimePromise(p.horaPrometida) === 'SIN_HORA_VALIDA');
          }
        }
        return true;
      });
    }

    if (selectedAttentionTypeFilter !== 'TODOS') {
      list = list.filter((g) => {
        const isEmerg = isEmergenciaOS(g.os) || g.practicas.some((p) => isEmergenciaOS(p.os));
        return selectedAttentionTypeFilter === 'EMERGENCIA' ? isEmerg : !isEmerg;
      });
    }

    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      list = list.filter(
        (g) =>
          g.os.toLowerCase().includes(term) ||
          g.idPacienteAnon.toLowerCase().includes(term) ||
          g.nombrePaciente?.toLowerCase().includes(term) ||
          g.practicas.some((p) => {
            const obsKey = getPracticeObservationKey(p.os, p.estudio);
            const obs = observationsMap[obsKey];
            return p.estudio.toLowerCase().includes(term) || (obs?.texto ? obs.texto.toLowerCase().includes(term) : false);
          })
      );
    }

    return list.sort((a, b) => b.practicasNoListasCount - a.practicasNoListasCount);
  }, [currentConsolidatedPractices, tableViewScope, selectedSedeFilter, selectedPromisedTimeFilter, selectedAttentionTypeFilter, debouncedSearchTerm, observationsMap]);

  // High-performance paginated datasets (only renders active page rows to DOM for 60 FPS fluidity)
  const totalPracticePages = Math.max(1, Math.ceil(filteredPractices.length / pageSize));
  const paginatedPractices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPractices.slice(start, start + pageSize);
  }, [filteredPractices, currentPage, pageSize]);

  const totalOrderPages = Math.max(1, Math.ceil(ordersGroupedView.length / ordersPageSize));
  const paginatedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersPageSize;
    return ordersGroupedView.slice(start, start + ordersPageSize);
  }, [ordersGroupedView, ordersPage, ordersPageSize]);

  // Accordion toggle handlers
  const toggleOrderExpand = (os: string) => {
    const newSet = new Set(expandedOrders);
    if (newSet.has(os)) {
      newSet.delete(os);
    } else {
      newSet.add(os);
    }
    setExpandedOrders(newSet);
  };

  const togglePracticeExpand = (practiceId: string) => {
    const newSet = new Set(expandedPractices);
    if (newSet.has(practiceId)) {
      newSet.delete(practiceId);
    } else {
      newSet.add(practiceId);
    }
    setExpandedPractices(newSet);
  };

  // CSV Export for Non-Ready Practices (with Observaciones)
  const handleExportNonReadyCSV = () => {
    const nonReady = currentConsolidatedPractices.filter((p) => p.grupoConsolidado !== 'LISTO');
    if (nonReady.length === 0) return;

    const headers = [
      'OS',
      'ID Paciente',
      'Paciente',
      'Examen / Estudio',
      'Sede',
      'Sector',
      'Status LIS',
      'Hora Prometida',
      'Fecha Prometida',
      'Recipientes',
      'Codigos Barra',
      'Observaciones',
      'Obs. Modificado Por',
      'Obs. Fecha y Hora',
    ];

    const rows = nonReady.map((p) => {
      const obsKey = getPracticeObservationKey(p.os, p.estudio);
      const obs = observationsMap[obsKey];
      return [
        `"${p.os}"`,
        `"${p.idPacienteAnon}"`,
        `"${showSensitiveNames ? p.nombrePaciente || '' : 'CONFIDENCIAL'}"`,
        `"${p.estudio}"`,
        `"${p.sede}"`,
        `"${p.sector}"`,
        `"${p.estadoConsolidado}"`,
        `"${p.horaPrometida}"`,
        `"${p.fechaPrometida}"`,
        p.cantidadRecipientes,
        `"${p.codigosBarra.join(', ')}"`,
        `"${(obs?.texto || '').replace(/"/g, '""')}"`,
        `"${obs?.modificadoPor || ''}"`,
        `"${obs?.fechaHora || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `entregas_no_listas_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for All Filtered Practices (with Observaciones)
  const handleExportFilteredCSV = () => {
    if (filteredPractices.length === 0) return;

    const headers = [
      'OS',
      'ID Paciente',
      'Paciente',
      'Examen / Estudio',
      'Sede',
      'Sector',
      'Status LIS',
      'Hora Prometida',
      'Fecha Prometida',
      'Recipientes',
      'Codigos Barra',
      'Observaciones',
      'Obs. Modificado Por',
      'Obs. Fecha y Hora',
    ];

    const rows = filteredPractices.map((p) => {
      const obsKey = getPracticeObservationKey(p.os, p.estudio);
      const obs = observationsMap[obsKey];
      return [
        `"${p.os}"`,
        `"${p.idPacienteAnon}"`,
        `"${showSensitiveNames ? p.nombrePaciente || '' : 'CONFIDENCIAL'}"`,
        `"${p.estudio}"`,
        `"${p.sede}"`,
        `"${p.sector}"`,
        `"${p.estadoConsolidado}"`,
        `"${p.horaPrometida}"`,
        `"${p.fechaPrometida}"`,
        p.cantidadRecipientes,
        `"${p.codigosBarra.join(', ')}"`,
        `"${(obs?.texto || '').replace(/"/g, '""')}"`,
        `"${obs?.modificadoPor || ''}"`,
        `"${obs?.fechaHora || ''}"`,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `entregas_practicas_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedSelectedDate = formatISOToDisplayDate(selectedDate);
  const formattedLatestDate = latestDateWithData ? formatISOToDisplayDate(latestDateWithData) : null;
  const isToday = selectedDate === todayDate;

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 0. HEADER & BARRA DE ESTADO / SELECTOR DE JORNADA */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-[#5F285F] text-[#F7F2F7] text-[12.5px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Módulo Operativo
              </span>
              {isToday && (
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[12.5px] px-2.5 py-0.5 rounded-full font-bold">
                  Jornada de Hoy
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Entregas Diarias</span>
            </h1>
            <p className="text-[14px] text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Registro diario del impacto sobre pacientes y del estado de las prácticas clínicas, con conservación histórica y trazabilidad analítica.
            </p>
          </div>

          {/* Action Buttons & Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAuditHistoryModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[14px] font-semibold transition cursor-pointer"
              title="Registro de auditoría técnica, archivos y trazabilidad de cargas"
            >
              <ShieldCheck className="w-4 h-4 text-purple-300" />
              <span>Auditoría de cargas</span>
            </button>
            <button
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5F285F] hover:bg-[#452045] text-white text-[14px] font-bold shadow-sm transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Cargar Entregas Diarias</span>
            </button>
          </div>
        </div>

        {/* Dynamic Context Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-[14px]">
          {/* Selector Único de Jornada */}
          <div className="flex items-center gap-2.5 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2">
            <Calendar className="w-4 h-4 text-[#E9DDE9]" />
            <span className="text-slate-300 font-semibold text-[13.5px]">Jornada:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-extrabold text-white text-[14px] focus:outline-hidden cursor-pointer pr-2"
            >
              {selectableDates.map((d) => {
                const isTodayItem = d === todayDate;
                const label = isTodayItem
                  ? `Hoy — ${formatISOToDisplayDate(d)}`
                  : formatISOToDisplayDate(d);
                return (
                  <option key={d} value={d} className="bg-slate-800 text-white text-[14px]">
                    {label}
                  </option>
                );
              })}
            </select>
            {!isToday && (
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11.5px] px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap">
                Jornada histórica — {formattedSelectedDate}
              </span>
            )}
            {isLoadingHistoricalDate && (
              <span className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11.5px] px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap animate-pulse">
                <RotateCcw className="w-3 h-3 animate-spin" />
                <span>Cargando registros...</span>
              </span>
            )}
          </div>

          {/* Metadata de última actualización, usuario y archivo */}
          <div className="flex flex-wrap items-center gap-3 text-slate-300 text-[13px]">
            {activeDailyEntry?.fechaActualizacion ? (
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Última actualización: <strong className="text-white font-medium">{activeDailyEntry.fechaActualizacion}</strong>
                </span>
              </div>
            ) : lastUpdatedTime ? (
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Última actualización: <strong className="text-white font-medium">{lastUpdatedTime}</strong>
                </span>
              </div>
            ) : null}

            {activeDailyEntry?.cargadoPor && (
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <Users className="w-3.5 h-3.5 text-purple-300" />
                <span className="text-slate-300">
                  Cargado por: <strong className="text-white font-medium">{activeDailyEntry.cargadoPor}</strong>
                </span>
              </div>
            )}

            {activeDailyEntry?.nombreArchivo && (
              <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[12.5px] bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700">
                <FileText className="w-3.5 h-3.5 text-[#E9DDE9]" />
                <span className="truncate max-w-[200px]" title={activeDailyEntry.nombreArchivo}>
                  {activeDailyEntry.nombreArchivo}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/50 border border-emerald-700/60 px-2.5 py-1 rounded-lg text-[12px] font-semibold">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Base en la Nube (Firestore)</span>
            </div>

            <div className="flex items-center gap-1.5 text-indigo-300 bg-indigo-950/50 border border-indigo-700/60 px-2.5 py-1 rounded-lg text-[12px] font-semibold" title="Motor determinístico con trazabilidad ISO 15189">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Reglas v{kpis.rulesVersion || '1.0'} • ISO 15189</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 0.1 AUDITORÍA: NOTIFICACIÓN DE CIERRE ACTUALIZADO CORRECTAMENTE */}
      {/* ========================================================================= */}
      {auditNotice && (
        <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl p-5 text-white shadow-xl space-y-3.5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-emerald-300 text-base sm:text-lg tracking-tight">
                Cierre actualizado correctamente
              </h3>
            </div>
            <button
              onClick={onDismissAuditNotice}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer transition hover:bg-slate-800"
              title="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-medium">Fecha</div>
              <div className="font-bold text-white text-sm mt-0.5">{auditNotice.fechaFormateada}</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-medium">Archivo anterior reemplazado</div>
              <div className="font-bold text-emerald-400 text-sm mt-0.5">
                {auditNotice.archivoReemplazado ? 'Sí' : 'No (Nueva carga)'}
              </div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 col-span-2 sm:col-span-1 lg:col-span-2">
              <div className="text-slate-400 text-[11px] font-medium">Nuevo archivo</div>
              <div className="font-bold text-white text-sm mt-0.5 truncate" title={auditNotice.nombreArchivo}>
                {auditNotice.nombreArchivo}
              </div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-medium">Filas procesadas</div>
              <div className="font-bold text-slate-200 text-sm mt-0.5">{auditNotice.filasProcesadas}</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-medium">Prácticas consolidadas</div>
              <div className="font-bold text-emerald-400 text-sm mt-0.5">{auditNotice.practicasConsolidadas}</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <div className="text-slate-400 text-[11px] font-medium">OS únicas</div>
              <div className="font-bold text-amber-400 text-sm mt-0.5">{auditNotice.osUnicas}</div>
            </div>
          </div>

          <div className="text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-slate-800/80 gap-1 font-mono">
            <span>Actualizado: <strong className="text-emerald-300">{auditNotice.fechaActualizacion}</strong></span>
            <span className="text-[11px] text-slate-400">Todos los indicadores, rankings y estados se recalcularon a partir del nuevo dataset.</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASO: NO HAY DATOS PARA LA JORNADA SELECCIONADA */}
      {/* ========================================================================= */}
      {!selectedDateHasData ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 sm:p-14 shadow-sm text-center max-w-3xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Sin datos cargados para esta jornada
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Fecha seleccionada: <strong className="text-slate-900">{formattedSelectedDate}</strong>. Todavía no se registraron datos de entregas para esta fecha.
          </p>

          {formattedLatestDate && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 rounded-xl text-sm text-slate-700 border border-slate-200">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Último día con datos disponibles: <strong className="text-slate-900 font-bold">{formattedLatestDate}</strong></span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {latestDateWithData && (
              <button
                onClick={() => setSelectedDate(latestDateWithData)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold border border-slate-200 transition cursor-pointer flex items-center gap-2"
              >
                <Calendar className="w-4 h-4 text-slate-600" />
                <span>Ver datos del {formattedLatestDate}</span>
              </button>
            )}

            <button
              onClick={onOpenImportModal}
              className="px-5 py-2.5 rounded-xl bg-[#5F285F] hover:bg-[#452045] text-white text-sm font-bold shadow-sm transition cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>{isToday ? 'Cargar datos de hoy' : `Cargar datos del ${formattedSelectedDate}`}</span>
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* CASO: LA JORNADA SELECCIONADA TIENE DATOS */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* BANNER DE ADVERTENCIA: ERROR DE CONSISTENCIA MATEMÁTICA ISO 15189 */}
          {(!kpis.esConsistente || kpis.errorConsistencia) && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-rose-900">
                <h4 className="text-[15px] font-bold">
                  Advertencia de Consistencia de Datos (ISO 15189)
                </h4>
                <p className="text-[13.5px] leading-relaxed text-rose-800">
                  {kpis.errorConsistencia || 'Se ha detectado una inconsistencia en la suma o balance de los registros de la jornada.'}
                </p>
                <div className="text-[12px] font-mono bg-white/80 p-2 rounded-lg border border-rose-200 text-rose-700 mt-2">
                  Balance: OS Totales ({kpis.osTotales}) = Listas ({kpis.osCompletamenteListas}) + Con Pendientes ({kpis.osConPendientes}) | Prácticas Válidas ({kpis.practicasValidas}) = Listas ({kpis.practicasListas}) + No Listas ({kpis.practicasNoListas}) + Desconocidas ({kpis.practicasDesconocidas})
                </div>
              </div>
            </div>
          )}

          {/* BANNER DE ADVERTENCIA: STATUS LIS DESCONOCIDO */}
          {kpis.statusDesconocidosList && kpis.statusDesconocidosList.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-amber-900">
                <h4 className="text-[15px] font-bold">
                  Status LIS Desconocido Detectado — Requiere Clasificación
                </h4>
                <p className="text-[13.5px] leading-relaxed text-amber-800">
                  Se detectaron estados técnicos no contemplados en el diccionario determinístico:{' '}
                  <strong className="font-semibold">{kpis.statusDesconocidosList.join(', ')}</strong>.
                  Por norma ISO 15189, estos estados no son clasificados aleatoriamente y se aíslan para revisión del responsable de laboratorio.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 1. IMPACTO EN PACIENTES / OS */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-[#5F285F]" />
                <h2 className="text-[18px] font-bold uppercase tracking-wider text-slate-900">
                  Impacto en Pacientes / Órdenes de Servicio (OS)
                </h2>
              </div>
              <span className="text-[14px] text-slate-500 italic">
                Cada OS se cuenta una sola vez
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* OS Totales */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5">
                <div className="text-[14px] font-bold text-slate-700 uppercase tracking-wider">
                  OS Totales de la Jornada
                </div>
                <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 mt-2">
                  {kpis.osTotales.toLocaleString('es-AR')}
                </div>
                <div className="text-[13.5px] text-slate-500 mt-1.5 font-medium leading-normal">
                  100% de los pacientes con compromiso para esta fecha
                </div>
              </div>

              {/* OS Completamente Listas */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-emerald-950 uppercase tracking-wider">
                    OS Completamente Listas
                  </span>
                  <span className="bg-emerald-100 text-emerald-900 text-[14px] font-bold px-2.5 py-0.5 rounded-lg">
                    {kpis.osCompletamenteListasPct.toLocaleString('es-AR')} %
                  </span>
                </div>
                <div className="text-3xl sm:text-[34px] font-extrabold text-emerald-800 mt-2">
                  {kpis.osCompletamenteListas.toLocaleString('es-AR')}
                </div>
                <div className="text-[13.5px] text-emerald-800/80 mt-1.5 font-medium leading-normal">
                  Todas sus determinaciones listas para informe/entrega
                </div>
                <div className="w-full bg-emerald-200/70 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, kpis.osCompletamenteListasPct)}%` }}
                  />
                </div>
              </div>

              {/* OS con Pendientes - Soft Amber */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-amber-950 uppercase tracking-wider">
                      OS con al menos 1 práctica no lista
                    </span>
                    <span className="bg-amber-100 text-amber-950 text-[14px] font-bold px-2.5 py-0.5 rounded-lg">
                      {kpis.osConPendientesPct.toLocaleString('es-AR')} %
                    </span>
                  </div>
                  <div className="text-3xl sm:text-[34px] font-extrabold text-amber-900 mt-2">
                    {kpis.osConPendientes.toLocaleString('es-AR')}
                  </div>
                  <div className="text-[13.5px] text-amber-800/80 mt-1.5 font-medium leading-normal">
                    Pacientes con informe demorado o incompleto
                  </div>
                  <div className="w-full bg-amber-200/70 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, kpis.osConPendientesPct)}%` }}
                    />
                  </div>
                </div>

                {/* Desglose Destacado según Hora Prometida de Entrega */}
                <div className="mt-4 pt-3 border-t border-amber-200/70">
                  <div className="text-[11.5px] font-bold text-amber-900/70 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Desglose por Franja Horaria</span>
                    {selectedPromisedTimeFilter !== 'TODAS' && (
                      <button
                        type="button"
                        onClick={() => setSelectedPromisedTimeFilter('TODAS')}
                        className="text-amber-800 hover:text-amber-950 underline font-semibold text-[11px] cursor-pointer"
                      >
                        Limpiar filtro
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Sub-bloque 1: Hasta las 18:00 */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPromisedTimeFilter(selectedPromisedTimeFilter === 'HASTA_18' ? 'TODAS' : 'HASTA_18');
                        setTableViewScope('agrupado_os');
                      }}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'HASTA_18'
                          ? 'bg-amber-200/90 border-amber-400 ring-2 ring-amber-400/50 shadow-xs'
                          : 'bg-white/80 hover:bg-amber-100/70 border-amber-200/80 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="text-[12px] font-bold text-amber-950 tracking-tight">Hasta las 18:00</span>
                        </div>
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          {kpis.osConPendientesHasta18Pct.toLocaleString('es-AR')} %
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-2xl font-black text-amber-900 font-mono">
                          {kpis.osConPendientesHasta18.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[11px] text-amber-800/80 font-medium">OS prioritarias</span>
                      </div>
                    </button>

                    {/* Sub-bloque 2: Después de las 18:00 */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPromisedTimeFilter(selectedPromisedTimeFilter === 'DESPUES_18' ? 'TODAS' : 'DESPUES_18');
                        setTableViewScope('agrupado_os');
                      }}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'DESPUES_18'
                          ? 'bg-purple-200/90 border-purple-400 ring-2 ring-purple-400/50 shadow-xs'
                          : 'bg-purple-50/70 hover:bg-purple-100/60 border-purple-200/80 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                          <span className="text-[12px] font-bold text-purple-950 tracking-tight">Después 18:00</span>
                        </div>
                        <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded">
                          {kpis.osConPendientesDespues18Pct.toLocaleString('es-AR')} %
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-2xl font-black text-purple-950 font-mono">
                          {kpis.osConPendientesDespues18.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[11px] text-purple-800/80 font-medium">OS vespertinas</span>
                      </div>
                    </button>
                  </div>

                  {kpis.osConPendientesSinHoraValida > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPromisedTimeFilter(selectedPromisedTimeFilter === 'SIN_HORA' ? 'TODAS' : 'SIN_HORA');
                        setTableViewScope('agrupado_os');
                      }}
                      className={`mt-2 w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'SIN_HORA'
                          ? 'bg-rose-200 border-rose-400 ring-2 ring-rose-400/50 font-bold'
                          : 'bg-rose-50/90 hover:bg-rose-100/80 border-rose-200 text-rose-950'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="text-[12px] font-semibold">Sin hora promesa válida:</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-[13px]">
                        <span>{kpis.osConPendientesSinHoraValida.toLocaleString('es-AR')} OS</span>
                        <span className="text-rose-700 font-medium text-[11px]">
                          ({kpis.osConPendientesSinHoraValidaPct.toLocaleString('es-AR')} %)
                        </span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. ESTADO DE LAS PRÁCTICAS */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-[#5F285F]" />
                <h2 className="text-[18px] font-bold uppercase tracking-wider text-slate-900">
                  Estado de las Prácticas Clínicas
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-slate-600">
                <span>Total evaluadas:</span>
                <strong className="text-slate-900 font-bold font-mono">{kpis.practicasValidas.toLocaleString('es-AR')}</strong>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-rose-800 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  <span>Emergencias (E):</span>
                  <strong className="font-mono">{kpis.practicasNoListasEmergencia} no listas</strong>
                </span>
                <span className="inline-flex items-center gap-1 text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <span>Rutina:</span>
                  <strong className="font-mono">{kpis.practicasNoListasRutina} no listas</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Card 1: Prácticas Totales Válidas */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="text-[14px] font-bold text-slate-700 uppercase tracking-wider">
                    Prácticas Totales Válidas
                  </div>
                  <div className="text-3xl sm:text-[34px] font-extrabold text-slate-900 mt-2">
                    {kpis.practicasValidas.toLocaleString('es-AR')}
                  </div>
                  <div className="text-[13px] text-slate-500 mt-1.5 font-medium leading-normal">
                    Excluido Acto Bioquímico ({kpis.estudiosExcluidosActoBioquimico} filas)
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[12px] font-medium text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Emergencias: <strong className="text-slate-800 font-bold font-mono">{kpis.practicasValidasEmergencia}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    Rutina: <strong className="text-slate-800 font-bold font-mono">{kpis.practicasValidasRutina}</strong>
                  </span>
                </div>
              </div>

              {/* Card 2: Prácticas Listas */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-emerald-950 uppercase tracking-wider">
                      Prácticas Listas
                    </span>
                    <span className="bg-emerald-100 text-emerald-900 text-[14px] font-bold px-2.5 py-0.5 rounded-lg">
                      {kpis.practicasListasPct.toLocaleString('es-AR')} %
                    </span>
                  </div>
                  <div className="text-3xl sm:text-[34px] font-extrabold text-emerald-800 mt-2">
                    {kpis.practicasListas.toLocaleString('es-AR')}
                  </div>
                  <div className="text-[13px] text-emerald-800/80 mt-1.5 font-medium leading-normal">
                    Informadas, validadas o listas para entrega
                  </div>
                  <div className="w-full bg-emerald-200/70 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, kpis.practicasListasPct)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-200/70 flex items-center justify-between text-[12px] font-medium text-emerald-800">
                  <span>Emergencias: <strong className="font-mono">{kpis.practicasListasEmergencia}</strong></span>
                  <span>Rutina: <strong className="font-mono">{kpis.practicasListasRutina}</strong></span>
                </div>
              </div>

              {/* Card 3: Prácticas No Listas Emergencias (O.S. con (E)) */}
              <div className={`rounded-2xl p-5 flex flex-col justify-between transition-all border ${
                selectedAttentionTypeFilter === 'EMERGENCIA'
                  ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-400/50 shadow-sm'
                  : 'bg-rose-50/50 border-rose-200/80 hover:border-rose-300'
              }`}>
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-bold text-rose-950 uppercase tracking-tight">
                        Prácticas No Listas Emergencias
                      </span>
                      <span className="bg-rose-200/80 text-rose-800 text-[11px] font-extrabold px-1.5 py-0.5 rounded border border-rose-300 shrink-0">
                        (E)
                      </span>
                    </div>
                    <span className="bg-rose-100 text-rose-900 text-[13.5px] font-bold px-2 py-0.5 rounded-lg shrink-0 font-mono">
                      {kpis.practicasNoListasEmergenciaPct.toLocaleString('es-AR')} %
                    </span>
                  </div>
                  <div className="text-3xl sm:text-[34px] font-extrabold text-rose-900 mt-2 font-mono">
                    {kpis.practicasNoListasEmergencia.toLocaleString('es-AR')}
                  </div>
                  <div className="text-[13px] text-rose-800/80 mt-1 font-medium leading-normal">
                    {kpis.practicasNoListasEmergencia} de {kpis.practicasValidasEmergencia} determinaciones de emergencias
                  </div>
                  <div className="w-full bg-rose-200/70 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className="bg-rose-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, kpis.practicasNoListasEmergenciaPct)}%` }}
                    />
                  </div>
                </div>

                {/* Desglose Destacado según Hora Prometida */}
                <div className="mt-4 pt-3 border-t border-rose-200/70">
                  <div className="text-[11px] font-bold text-rose-900/70 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Desglose por Franja Horaria</span>
                    {selectedAttentionTypeFilter === 'EMERGENCIA' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAttentionTypeFilter('TODOS');
                          setSelectedPromisedTimeFilter('TODAS');
                        }}
                        className="text-rose-800 hover:text-rose-950 underline font-semibold text-[11px] cursor-pointer"
                      >
                        Limpiar filtro
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Sub-bloque 1: Hasta las 18:00 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPromisedTimeFilter === 'HASTA_18' && selectedAttentionTypeFilter === 'EMERGENCIA') {
                          setSelectedPromisedTimeFilter('TODAS');
                          setSelectedAttentionTypeFilter('TODOS');
                        } else {
                          setSelectedPromisedTimeFilter('HASTA_18');
                          setSelectedAttentionTypeFilter('EMERGENCIA');
                          setTableViewScope('solo_no_listas');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'HASTA_18' && selectedAttentionTypeFilter === 'EMERGENCIA'
                          ? 'bg-rose-200/90 border-rose-400 ring-2 ring-rose-400/50 shadow-xs'
                          : 'bg-white/80 hover:bg-rose-100/70 border-rose-200/80 shadow-2xs'
                      }`}
                      title="Filtrar prácticas no listas de emergencias hasta las 18:00"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11.5px] font-bold text-rose-950">Hasta 18:00</span>
                        <span className="text-[10.5px] font-bold text-rose-800 bg-rose-100 px-1 py-0.5 rounded font-mono">
                          {kpis.practicasNoListasEmergenciaHasta18Pct.toLocaleString('es-AR')}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xl font-black text-rose-900 font-mono">
                          {kpis.practicasNoListasEmergenciaHasta18.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] text-rose-700 font-medium">Diurnas</span>
                      </div>
                    </button>

                    {/* Sub-bloque 2: Después de las 18:00 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPromisedTimeFilter === 'DESPUES_18' && selectedAttentionTypeFilter === 'EMERGENCIA') {
                          setSelectedPromisedTimeFilter('TODAS');
                          setSelectedAttentionTypeFilter('TODOS');
                        } else {
                          setSelectedPromisedTimeFilter('DESPUES_18');
                          setSelectedAttentionTypeFilter('EMERGENCIA');
                          setTableViewScope('solo_no_listas');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'DESPUES_18' && selectedAttentionTypeFilter === 'EMERGENCIA'
                          ? 'bg-purple-200/90 border-purple-400 ring-2 ring-purple-400/50 shadow-xs'
                          : 'bg-purple-50/70 hover:bg-purple-100/60 border-purple-200/80 shadow-2xs'
                      }`}
                      title="Filtrar prácticas no listas de emergencias después de las 18:00"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11.5px] font-bold text-purple-950">Después 18:00</span>
                        <span className="text-[10.5px] font-bold text-purple-800 bg-purple-100 px-1 py-0.5 rounded font-mono">
                          {kpis.practicasNoListasEmergenciaDespues18Pct.toLocaleString('es-AR')}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xl font-black text-purple-950 font-mono">
                          {kpis.practicasNoListasEmergenciaDespues18.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] text-purple-700 font-medium">Vespertinas</span>
                      </div>
                    </button>
                  </div>

                  {kpis.practicasNoListasEmergenciaSinHoraValida > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPromisedTimeFilter === 'SIN_HORA' && selectedAttentionTypeFilter === 'EMERGENCIA') {
                          setSelectedPromisedTimeFilter('TODAS');
                          setSelectedAttentionTypeFilter('TODOS');
                        } else {
                          setSelectedPromisedTimeFilter('SIN_HORA');
                          setSelectedAttentionTypeFilter('EMERGENCIA');
                          setTableViewScope('solo_no_listas');
                        }
                      }}
                      className={`mt-2 w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'SIN_HORA' && selectedAttentionTypeFilter === 'EMERGENCIA'
                          ? 'bg-rose-200 border-rose-400 ring-2 ring-rose-400/50 font-bold'
                          : 'bg-white/80 hover:bg-rose-100/70 border-rose-200 text-rose-950'
                      }`}
                    >
                      <span className="text-[11px] font-semibold">Sin hora promesa:</span>
                      <span className="font-mono font-bold text-[12px]">{kpis.practicasNoListasEmergenciaSinHoraValida}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card 4: Prácticas No Listas Rutina (Todas las demás O.S.) */}
              <div className={`rounded-2xl p-5 flex flex-col justify-between transition-all border ${
                selectedAttentionTypeFilter === 'RUTINA'
                  ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/50 shadow-sm'
                  : 'bg-amber-50/60 border-amber-200/80 hover:border-amber-300'
              }`}>
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13.5px] font-bold text-amber-950 uppercase tracking-tight">
                        Prácticas No Listas Rutina
                      </span>
                      <span className="bg-amber-200/80 text-amber-900 text-[11px] font-extrabold px-1.5 py-0.5 rounded border border-amber-300 shrink-0">
                        Rutina
                      </span>
                    </div>
                    <span className="bg-amber-100 text-amber-950 text-[13.5px] font-bold px-2 py-0.5 rounded-lg shrink-0 font-mono">
                      {kpis.practicasNoListasRutinaPct.toLocaleString('es-AR')} %
                    </span>
                  </div>
                  <div className="text-3xl sm:text-[34px] font-extrabold text-amber-900 mt-2 font-mono">
                    {kpis.practicasNoListasRutina.toLocaleString('es-AR')}
                  </div>
                  <div className="text-[13px] text-amber-800/80 mt-1 font-medium leading-normal">
                    {kpis.practicasNoListasRutina} de {kpis.practicasValidasRutina} determinaciones de rutina
                  </div>
                  <div className="w-full bg-amber-200/70 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, kpis.practicasNoListasRutinaPct)}%` }}
                    />
                  </div>
                </div>

                {/* Desglose Destacado según Hora Prometida */}
                <div className="mt-4 pt-3 border-t border-amber-200/70">
                  <div className="text-[11px] font-bold text-amber-900/70 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Desglose por Franja Horaria</span>
                    {selectedAttentionTypeFilter === 'RUTINA' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAttentionTypeFilter('TODOS');
                          setSelectedPromisedTimeFilter('TODAS');
                        }}
                        className="text-amber-800 hover:text-amber-950 underline font-semibold text-[11px] cursor-pointer"
                      >
                        Limpiar filtro
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Sub-bloque 1: Hasta las 18:00 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPromisedTimeFilter === 'HASTA_18' && selectedAttentionTypeFilter === 'RUTINA') {
                          setSelectedPromisedTimeFilter('TODAS');
                          setSelectedAttentionTypeFilter('TODOS');
                        } else {
                          setSelectedPromisedTimeFilter('HASTA_18');
                          setSelectedAttentionTypeFilter('RUTINA');
                          setTableViewScope('solo_no_listas');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'HASTA_18' && selectedAttentionTypeFilter === 'RUTINA'
                          ? 'bg-amber-200/90 border-amber-400 ring-2 ring-amber-400/50 shadow-xs'
                          : 'bg-white/80 hover:bg-amber-100/70 border-amber-200/80 shadow-2xs'
                      }`}
                      title="Filtrar prácticas no listas de rutina hasta las 18:00"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11.5px] font-bold text-amber-950">Hasta 18:00</span>
                        <span className="text-[10.5px] font-bold text-amber-800 bg-amber-100 px-1 py-0.5 rounded font-mono">
                          {kpis.practicasNoListasRutinaHasta18Pct.toLocaleString('es-AR')}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xl font-black text-amber-900 font-mono">
                          {kpis.practicasNoListasRutinaHasta18.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] text-amber-800/80 font-medium">Diurnas</span>
                      </div>
                    </button>

                    {/* Sub-bloque 2: Después de las 18:00 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPromisedTimeFilter === 'DESPUES_18' && selectedAttentionTypeFilter === 'RUTINA') {
                          setSelectedPromisedTimeFilter('TODAS');
                          setSelectedAttentionTypeFilter('TODOS');
                        } else {
                          setSelectedPromisedTimeFilter('DESPUES_18');
                          setSelectedAttentionTypeFilter('RUTINA');
                          setTableViewScope('solo_no_listas');
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'DESPUES_18' && selectedAttentionTypeFilter === 'RUTINA'
                          ? 'bg-purple-200/90 border-purple-400 ring-2 ring-purple-400/50 shadow-xs'
                          : 'bg-purple-50/70 hover:bg-purple-100/60 border-purple-200/80 shadow-2xs'
                      }`}
                      title="Filtrar prácticas no listas de rutina después de las 18:00"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11.5px] font-bold text-purple-950">Después 18:00</span>
                        <span className="text-[10.5px] font-bold text-purple-800 bg-purple-100 px-1 py-0.5 rounded font-mono">
                          {kpis.practicasNoListasRutinaDespues18Pct.toLocaleString('es-AR')}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xl font-black text-purple-950 font-mono">
                          {kpis.practicasNoListasRutinaDespues18.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] text-purple-700 font-medium">Vespertinas</span>
                      </div>
                    </button>
                  </div>

                  {kpis.practicasNoListasRutinaSinHoraValida > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPromisedTimeFilter === 'SIN_HORA' && selectedAttentionTypeFilter === 'RUTINA') {
                          setSelectedPromisedTimeFilter('TODAS');
                          setSelectedAttentionTypeFilter('TODOS');
                        } else {
                          setSelectedPromisedTimeFilter('SIN_HORA');
                          setSelectedAttentionTypeFilter('RUTINA');
                          setTableViewScope('solo_no_listas');
                        }
                      }}
                      className={`mt-2 w-full p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                        selectedPromisedTimeFilter === 'SIN_HORA' && selectedAttentionTypeFilter === 'RUTINA'
                          ? 'bg-rose-200 border-rose-400 ring-2 ring-rose-400/50 font-bold'
                          : 'bg-white/80 hover:bg-amber-100/70 border-amber-200 text-amber-950'
                      }`}
                    >
                      <span className="text-[11px] font-semibold">Sin hora promesa:</span>
                      <span className="font-mono font-bold text-[12px]">{kpis.practicasNoListasRutinaSinHoraValida}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. ¿QUÉ ESTÁ PENDIENTE? */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-[#5F285F]" />
                <h2 className="text-[18px] font-bold uppercase tracking-wider text-slate-900">
                  ¿Qué está pendiente?
                </h2>
              </div>
              <span className="text-[14px] text-slate-500">
                Desglose de los 5 estados que componen las prácticas no listas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* 1. ESPERANDO EN UNIDAD */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatusCategoryFilter(
                    selectedStatusCategoryFilter === 'ESPERANDO EN UNIDAD' ? 'TODOS' : 'ESPERANDO EN UNIDAD'
                  );
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  selectedStatusCategoryFilter === 'ESPERANDO EN UNIDAD'
                    ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400'
                    : 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
                }`}
              >
                <div className="text-[13.5px] font-bold text-amber-900 uppercase">1. Esperando en Unidad</div>
                <div className="text-2xl sm:text-[30px] font-black text-amber-900 mt-1">
                  {kpis.composicionPendientes.esperandoEnUnidad.cantidad}
                </div>
                <div className="text-[13.5px] text-amber-700 font-semibold mt-1">
                  {kpis.composicionPendientes.esperandoEnUnidad.porcentaje.toLocaleString('es-AR')} % de no listas
                </div>
              </button>

              {/* 2. EN PROCESO */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatusCategoryFilter(
                    selectedStatusCategoryFilter === 'EN PROCESO' ? 'TODOS' : 'EN PROCESO'
                  );
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  selectedStatusCategoryFilter === 'EN PROCESO'
                    ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-400'
                    : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50'
                }`}
              >
                <div className="text-[13.5px] font-bold text-blue-900 uppercase">2. En Proceso</div>
                <div className="text-2xl sm:text-[30px] font-black text-blue-900 mt-1">
                  {kpis.composicionPendientes.enProceso.cantidad}
                </div>
                <div className="text-[13.5px] text-blue-700 font-semibold mt-1">
                  {kpis.composicionPendientes.enProceso.porcentaje.toLocaleString('es-AR')} % de no listas
                </div>
              </button>

              {/* 3. RESULTADO EN INTERFACE */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatusCategoryFilter(
                    selectedStatusCategoryFilter === 'RESULTADO EN INTERFACE' ? 'TODOS' : 'RESULTADO EN INTERFACE'
                  );
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  selectedStatusCategoryFilter === 'RESULTADO EN INTERFACE'
                    ? 'bg-[#E9DDE9] border-[#5F285F] ring-2 ring-[#5F285F]'
                    : 'bg-[#F7F2F7] border-[#E9DDE9] hover:bg-[#E9DDE9]/60'
                }`}
              >
                <div className="text-[13.5px] font-bold text-[#5F285F] uppercase">3. Resultado en Interface</div>
                <div className="text-2xl sm:text-[30px] font-black text-[#5F285F] mt-1">
                  {kpis.composicionPendientes.resultadoEnInterface.cantidad}
                </div>
                <div className="text-[13.5px] text-[#744174] font-semibold mt-1">
                  {kpis.composicionPendientes.resultadoEnInterface.porcentaje.toLocaleString('es-AR')} % de no listas
                </div>
              </button>

              {/* 4. A FIRMAR */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatusCategoryFilter(
                    selectedStatusCategoryFilter === 'A FIRMAR' ? 'TODOS' : 'A FIRMAR'
                  );
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  selectedStatusCategoryFilter === 'A FIRMAR'
                    ? 'bg-teal-100 border-teal-400 ring-2 ring-teal-400'
                    : 'bg-teal-50/50 border-teal-200 hover:bg-teal-50'
                }`}
              >
                <div className="text-[13.5px] font-bold text-teal-900 uppercase">4. A Firmar</div>
                <div className="text-2xl sm:text-[30px] font-black text-teal-900 mt-1">
                  {kpis.composicionPendientes.aFirmar.cantidad}
                </div>
                <div className="text-[13.5px] text-teal-700 font-semibold mt-1">
                  {kpis.composicionPendientes.aFirmar.porcentaje.toLocaleString('es-AR')} % de no listas
                </div>
              </button>

              {/* 5. CUARENTENA */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatusCategoryFilter(
                    selectedStatusCategoryFilter === 'CUARENTENA' ? 'TODOS' : 'CUARENTENA'
                  );
                }}
                className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                  selectedStatusCategoryFilter === 'CUARENTENA'
                    ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-400'
                    : 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
                }`}
              >
                <div className="text-[13.5px] font-bold text-rose-900 uppercase">5. Cuarentena</div>
                <div className="text-2xl sm:text-[30px] font-black text-rose-900 mt-1">
                  {kpis.composicionPendientes.cuarentena.cantidad}
                </div>
                <div className="text-[13.5px] text-rose-700 font-semibold mt-1">
                  {kpis.composicionPendientes.cuarentena.porcentaje.toLocaleString('es-AR')} % de no listas
                </div>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 4. DETALLE OPERATIVO DE PRÁCTICAS */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            {/* Header & Table Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-[18px] font-bold text-slate-900 uppercase tracking-tight">
                  Detalle de Prácticas Operativas
                </h3>
                <p className="text-[14px] text-slate-600 mt-0.5">
                  Consolidación clínica por (OS + Estudio) con trazabilidad de códigos de barra físicos.
                </p>
              </div>

              {/* View Scope Selectors & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center text-[14px] font-semibold border border-slate-200">
                  <button
                    onClick={() => setTableViewScope('solo_no_listas')}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                      tableViewScope === 'solo_no_listas' ? 'bg-[#5F285F] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Solo No Listas ({kpis.practicasNoListas})
                  </button>
                  <button
                    onClick={() => setTableViewScope('todas')}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                      tableViewScope === 'todas' ? 'bg-[#5F285F] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({kpis.practicasValidas})
                  </button>
                  <button
                    onClick={() => setTableViewScope('agrupado_os')}
                    className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                      tableViewScope === 'agrupado_os' ? 'bg-[#5F285F] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Agrupado por OS ({kpis.osTotales})
                  </button>
                </div>

                <button
                  onClick={handleExportNonReadyCSV}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F7F2F7] hover:bg-[#E9DDE9] text-[#5F285F] text-[14px] font-semibold transition border border-[#E9DDE9] cursor-pointer"
                  title="Exportar archivo CSV con las prácticas pendientes y sus observaciones"
                >
                  <Download className="w-4 h-4 text-[#5F285F]" />
                  <span>Exportar No Listas (CSV)</span>
                </button>

                <button
                  onClick={handleExportFilteredCSV}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-[14px] font-semibold transition border border-slate-200 cursor-pointer"
                  title="Exportar archivo CSV con todas las prácticas filtradas y sus observaciones"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                  <span>Exportar Todo (CSV)</span>
                </button>

                {userSession.isAuthorizedForSensitiveData && (
                  <button
                    onClick={() => setShowSensitiveNames(!showSensitiveNames)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[14px] font-semibold transition border cursor-pointer ${
                      showSensitiveNames
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                    title="Desbloquear visualización de nombres de pacientes (Perfil Dirección / Autorizado)"
                  >
                    {showSensitiveNames ? <EyeOff className="w-4 h-4 text-amber-700" /> : <Eye className="w-4 h-4 text-slate-500" />}
                    <span>{showSensitiveNames ? 'Ocultar Nombres' : 'Ver Nombres'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar OS, estudio, paciente..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:ring-2 focus:ring-slate-900 focus:bg-white"
                />
              </div>

              {/* Sede Filter */}
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedSedeFilter}
                  onChange={(e) => setSelectedSedeFilter(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="TODAS">Todas las Sedes ({sedesList.length})</option>
                  {sedesList.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Sector / Ruta Filter */}
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
                <FlaskConical className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedSectorFilter}
                  onChange={(e) => setSelectedSectorFilter(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="TODOS">Todos los Sectores</option>
                  {sectoresList.map((sec) => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              {/* Status Category Filter */}
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedStatusCategoryFilter}
                  onChange={(e) => setSelectedStatusCategoryFilter(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="TODOS">Todos los Estados</option>
                  <option value="ESPERANDO EN UNIDAD">Esperando en Unidad</option>
                  <option value="EN PROCESO">En Proceso</option>
                  <option value="RESULTADO EN INTERFACE">Resultado en Interface</option>
                  <option value="A FIRMAR">A Firmar</option>
                  <option value="CUARENTENA">Cuarentena</option>
                </select>
              </div>

              {/* Promised Time Filter (≤ 18:00 vs > 18:00) */}
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedPromisedTimeFilter}
                  onChange={(e) => setSelectedPromisedTimeFilter(e.target.value as any)}
                  className="w-full bg-transparent text-[14px] font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="TODAS">Todas las Horas</option>
                  <option value="HASTA_18">Hasta 18:00 (≤ 18:00)</option>
                  <option value="DESPUES_18">Después 18:00 (&gt; 18:00)</option>
                  {kpis.practicasNoListasSinHoraValida > 0 && (
                    <option value="SIN_HORA">Sin hora promesa ({kpis.practicasNoListasSinHoraValida})</option>
                  )}
                </select>
              </div>

              {/* Tipo de O.S. (Emergencias vs Rutina) */}
              <div className={`flex items-center space-x-2 border rounded-xl px-3.5 py-2 transition ${
                selectedAttentionTypeFilter === 'EMERGENCIA'
                  ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300'
                  : selectedAttentionTypeFilter === 'RUTINA'
                  ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <Zap className={`w-4 h-4 shrink-0 ${
                  selectedAttentionTypeFilter === 'EMERGENCIA'
                    ? 'text-rose-600'
                    : selectedAttentionTypeFilter === 'RUTINA'
                    ? 'text-amber-600'
                    : 'text-slate-400'
                }`} />
                <select
                  value={selectedAttentionTypeFilter}
                  onChange={(e) => setSelectedAttentionTypeFilter(e.target.value as any)}
                  className="w-full bg-transparent text-[14px] font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="TODOS">Todas las O.S.</option>
                  <option value="EMERGENCIA">Emergencias — O.S. (E)</option>
                  <option value="RUTINA">Rutina — Demás O.S.</option>
                </select>
              </div>
            </div>

            {/* Active Filters Badges */}
            {(selectedAttentionTypeFilter !== 'TODOS' || selectedPromisedTimeFilter !== 'TODAS' || selectedStatusCategoryFilter !== 'TODOS' || selectedSedeFilter !== 'TODAS' || selectedSectorFilter !== 'TODOS' || searchTerm) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[12.5px]">
                <span className="text-slate-500 font-medium">Filtros activos:</span>
                {selectedAttentionTypeFilter !== 'TODOS' && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold border ${
                    selectedAttentionTypeFilter === 'EMERGENCIA'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {selectedAttentionTypeFilter === 'EMERGENCIA' ? 'Emergencias (E)' : 'Rutina'}
                    <button
                      type="button"
                      onClick={() => setSelectedAttentionTypeFilter('TODOS')}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedPromisedTimeFilter !== 'TODAS' && (
                  <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                    {selectedPromisedTimeFilter === 'HASTA_18' ? 'Hasta las 18:00' : selectedPromisedTimeFilter === 'DESPUES_18' ? 'Después de 18:00' : 'Sin hora promesa'}
                    <button
                      type="button"
                      onClick={() => setSelectedPromisedTimeFilter('TODAS')}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedStatusCategoryFilter !== 'TODOS' && (
                  <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                    {selectedStatusCategoryFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedStatusCategoryFilter('TODOS')}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                )}
                {selectedSedeFilter !== 'TODAS' && (
                  <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-800 border border-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                    Sede: {selectedSedeFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedSedeFilter('TODAS')}
                      className="hover:opacity-75 cursor-pointer ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAttentionTypeFilter('TODOS');
                    setSelectedPromisedTimeFilter('TODAS');
                    setSelectedStatusCategoryFilter('TODOS');
                    setSelectedSedeFilter('TODAS');
                    setSelectedSectorFilter('TODOS');
                    setSearchTerm('');
                  }}
                  className="text-[#5F285F] hover:underline font-bold text-[12px] cursor-pointer ml-1"
                >
                  Restablecer todos los filtros
                </button>
              </div>
            )}

            {/* Table Rendering */}
            {tableViewScope !== 'agrupado_os' ? (
              /* Vista de Prácticas Clínicas Consolidadas */
              <div className="space-y-3">
                <div className="overflow-x-auto max-h-[560px] border border-slate-200 rounded-xl">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 text-[14px]">
                    <tr>
                      <th className="py-3 px-3.5 w-8"></th>
                      <th
                        className="py-3 px-3.5 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          if (sortField === 'os') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortField('os'); setSortOrder('asc'); }
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>OS / Paciente</span>
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3.5 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          if (sortField === 'estudio') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortField('estudio'); setSortOrder('asc'); }
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Examen / Estudio</span>
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th
                        className="py-3 px-3.5 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          if (sortField === 'sede') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortField('sede'); setSortOrder('asc'); }
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Sede / Unidad</span>
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3.5">Sector / Ruta</th>
                      <th className="py-3 px-3.5">Status LIS</th>
                      <th
                        className="py-3 px-3.5 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          if (sortField === 'hora') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortField('hora'); setSortOrder('asc'); }
                        }}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Hora Prometida</span>
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-3 px-3.5 w-64 min-w-[220px] max-w-[280px]">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[14px]">
                    {filteredPractices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500 text-[14px]">
                          No se encontraron prácticas clínicas con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      paginatedPractices.map((p) => {
                        const isExpanded = expandedPractices.has(p.id);
                        const isNonReady = p.grupoConsolidado !== 'LISTO';
                        const obsKey = getPracticeObservationKey(p.os, p.estudio);
                        const obs = observationsMap[obsKey];

                        return (
                          <React.Fragment key={p.id}>
                            <tr
                              className={`hover:bg-slate-50 transition ${
                                isNonReady ? 'bg-white' : 'bg-slate-50/50 text-slate-500'
                              }`}
                            >
                              <td className="py-3 px-3.5 text-center align-middle">
                                {p.physicalRecords.length > 1 ? (
                                  <button
                                    onClick={() => togglePracticeExpand(p.id)}
                                    className="p-1 rounded-md hover:bg-slate-200 text-slate-500 cursor-pointer"
                                    title={`Ver ${p.physicalRecords.length} recipientes físicos`}
                                  >
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                ) : (
                                  <div className="w-4 h-4" />
                                )}
                              </td>
                              <td className="py-3 px-3.5 font-mono font-bold text-slate-900 align-middle">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{p.os}</span>
                                  <CopyOSButton os={p.os} />
                                  {isEmergenciaOS(p.os) && (
                                    <span className="px-1.5 py-0.5 text-[10.5px] font-extrabold bg-rose-100 text-rose-800 rounded border border-rose-200">
                                      (E) Emergencia
                                    </span>
                                  )}
                                </div>
                                <div className="text-[13.5px] font-sans font-normal text-slate-500 flex items-center gap-1 mt-0.5">
                                  <span>{p.idPacienteAnon}</span>
                                  {showSensitiveNames && p.nombrePaciente && (
                                    <span className="font-semibold text-slate-800">• {p.nombrePaciente}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 font-medium text-slate-900 align-middle">
                                <div>{p.estudio}</div>
                                {p.cantidadRecipientes > 1 && (
                                  <div className="inline-flex items-center gap-1 text-[13px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md mt-1 border border-blue-200 font-semibold">
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>{p.cantidadRecipientes} tubos/recipientes físicos</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-slate-700 align-middle">{p.sede}</td>
                              <td className="py-3 px-3.5 text-slate-600 font-mono text-[13px] align-middle">
                                {p.sector || '-'}
                              </td>
                              <td className="py-3 px-3.5 align-middle">
                                <span
                                  className={`inline-block px-2.5 py-1 rounded-md text-[13.5px] font-bold ${
                                    p.grupoConsolidado === 'LISTO'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : p.estadoConsolidado === 'ESPERANDO EN UNIDAD'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : p.estadoConsolidado === 'EN PROCESO'
                                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                      : p.estadoConsolidado === 'RESULTADO EN INTERFACE'
                                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                      : p.estadoConsolidado === 'A FIRMAR'
                                      ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                      : 'bg-rose-100 text-rose-900 border border-rose-300'
                                  }`}
                                >
                                  {p.estadoConsolidado}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 align-middle">
                                {(() => {
                                  const tg = classifyTimePromise(p.horaPrometida);
                                  if (tg === 'HASTA_18') {
                                    return (
                                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-[13px]">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        {p.horaPrometida}
                                      </span>
                                    );
                                  } else if (tg === 'DESPUES_18') {
                                    return (
                                      <span className="inline-flex items-center gap-1 font-mono font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[13px]">
                                        <Clock className="w-3 h-3 text-purple-600" />
                                        {p.horaPrometida}
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-[12px]">
                                        <AlertCircle className="w-3 h-3 text-rose-500" />
                                        {p.horaPrometida || 'Sin hora'}
                                      </span>
                                    );
                                  }
                                })()}
                              </td>
                              <td className="py-3 px-3.5 align-middle">
                                <ObservationCell
                                  os={p.os}
                                  estudio={p.estudio}
                                  obs={obs}
                                  userEmail={userSession.email}
                                  onSave={handleSaveObservation}
                                  onDelete={handleDeleteObservation}
                                  onViewFull={(o) => setViewingObservation(o)}
                                />
                              </td>
                            </tr>

                            {/* Acordeón de Trazabilidad Física */}
                            {isExpanded && (
                              <tr className="bg-slate-50/90 border-y border-slate-200">
                                <td colSpan={8} className="p-4 pl-10">
                                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-[14px] space-y-2.5">
                                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-[14px]">
                                      <QrCode className="w-4 h-4 text-blue-600" />
                                      <span>Trazabilidad de Códigos de Barra y Tubos Físicos del LIS ({p.physicalRecords.length}):</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                      {p.physicalRecords.map((r, i) => (
                                        <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[13px]">
                                          <div className="font-bold text-slate-800">
                                            Cód. Barra: {r.codigoBarra || 'Sin código'}
                                          </div>
                                          <div className="text-slate-600 mt-0.5">
                                            Estado: <span className="font-semibold">{r.estado}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Controles de paginación de alta fluidez para Prácticas */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Mostrando</span>
                  <strong className="text-slate-900 font-semibold">
                    {filteredPractices.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </strong>
                  <span>–</span>
                  <strong className="text-slate-900 font-semibold">
                    {Math.min(currentPage * pageSize, filteredPractices.length)}
                  </strong>
                  <span>de</span>
                  <strong className="text-slate-900 font-semibold">{filteredPractices.length.toLocaleString('es-AR')}</strong>
                  <span>prácticas</span>
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
                      {currentPage} / {totalPracticePages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPracticePages, p + 1))}
                      disabled={currentPage >= totalPracticePages}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                      title="Página siguiente"
                    >
                      ›
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPracticePages)}
                      disabled={currentPage >= totalPracticePages}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                      title="Última página"
                    >
                      »
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Vista Agrupada por Órdenes de Servicio */
            <div className="space-y-3">
              <div className="overflow-x-auto max-h-[560px] border border-slate-200 rounded-xl">
                <table className="w-full text-left text-[14px]">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10 text-[14px]">
                    <tr>
                      <th className="py-3 px-3.5 w-8"></th>
                      <th className="py-3 px-3.5">OS / Paciente</th>
                      <th className="py-3 px-3.5">Sede</th>
                      <th className="py-3 px-3.5">Hora Prometida</th>
                      <th className="py-3 px-3.5">Total Prácticas</th>
                      <th className="py-3 px-3.5">Estado de la OS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[14px]">
                    {ordersGroupedView.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 text-[14px]">
                          No se encontraron órdenes de servicio con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((ord) => {
                        const isExpanded = expandedOrders.has(ord.os);

                        return (
                          <React.Fragment key={ord.os}>
                            <tr className="hover:bg-slate-50 transition">
                              <td className="py-3 px-3.5 text-center">
                                <button
                                  onClick={() => toggleOrderExpand(ord.os)}
                                  className="p-1 rounded-md hover:bg-slate-200 text-slate-500 cursor-pointer"
                                >
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                              </td>
                              <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{ord.os}</span>
                                  <CopyOSButton os={ord.os} />
                                  {isEmergenciaOS(ord.os) && (
                                    <span className="px-1.5 py-0.5 text-[10.5px] font-extrabold bg-rose-100 text-rose-800 rounded border border-rose-200">
                                      (E) Emergencia
                                    </span>
                                  )}
                                </div>
                                <div className="text-[13.5px] font-sans font-normal text-slate-500 flex items-center gap-1">
                                  <span>{ord.idPacienteAnon}</span>
                                  {showSensitiveNames && ord.nombrePaciente && (
                                    <span className="font-semibold text-slate-800">• {ord.nombrePaciente}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 text-slate-700">{ord.sede}</td>
                              <td className="py-3 px-3.5 align-middle">
                                {(() => {
                                  const tg = classifyTimePromise(ord.horaPrometida);
                                  if (tg === 'HASTA_18') {
                                    return (
                                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-[13px]">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        {ord.horaPrometida}
                                      </span>
                                    );
                                  } else if (tg === 'DESPUES_18') {
                                    return (
                                      <span className="inline-flex items-center gap-1 font-mono font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[13px]">
                                        <Clock className="w-3 h-3 text-purple-600" />
                                        {ord.horaPrometida}
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-[12px]">
                                        <AlertCircle className="w-3 h-3 text-rose-500" />
                                        {ord.horaPrometida || 'Sin hora'}
                                      </span>
                                    );
                                  }
                                })()}
                              </td>
                              <td className="py-3 px-3.5 font-bold text-slate-900">{ord.totalPracticas}</td>
                              <td className="py-3 px-3.5">
                                {ord.tieneNoListas ? (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[13.5px] font-bold px-2.5 py-1 rounded-md">
                                    Con Pendientes ({ord.practicasNoListasCount} de {ord.totalPracticas})
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[13.5px] font-bold px-2.5 py-1 rounded-md">
                                    ✓ Completamente Lista
                                  </span>
                                )}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-slate-50/80 border-y border-slate-200">
                                <td colSpan={6} className="p-4 pl-10">
                                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                                    <div className="font-bold text-slate-800 text-[14px]">
                                      Prácticas de la OS {ord.os}:
                                    </div>
                                    <div className="divide-y divide-slate-100 text-[14px]">
                                      {ord.practicas.map((p) => {
                                        const obsKey = getPracticeObservationKey(p.os, p.estudio);
                                        const obs = observationsMap[obsKey];

                                        return (
                                          <div key={p.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                              <span className="font-semibold text-slate-900">{p.estudio}</span>
                                              <span className="text-slate-500 font-mono text-[13px] ml-2">({p.sector || 'Sin sector'})</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <span
                                                className={`text-[13.5px] font-bold px-2.5 py-0.5 rounded-md shrink-0 ${
                                                  p.grupoConsolidado === 'LISTO'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-rose-100 text-rose-800'
                                                }`}
                                              >
                                                {p.estadoConsolidado}
                                              </span>
                                              <ObservationCell
                                                os={p.os}
                                                estudio={p.estudio}
                                                obs={obs}
                                                userEmail={userSession.email}
                                                onSave={handleSaveObservation}
                                                onDelete={handleDeleteObservation}
                                                onViewFull={(o) => setViewingObservation(o)}
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Controles de paginación de alta fluidez para Órdenes */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Mostrando</span>
                  <strong className="text-slate-900 font-semibold">
                    {ordersGroupedView.length === 0 ? 0 : (ordersPage - 1) * ordersPageSize + 1}
                  </strong>
                  <span>–</span>
                  <strong className="text-slate-900 font-semibold">
                    {Math.min(ordersPage * ordersPageSize, ordersGroupedView.length)}
                  </strong>
                  <span>de</span>
                  <strong className="text-slate-900 font-semibold">{ordersGroupedView.length.toLocaleString('es-AR')}</strong>
                  <span>órdenes</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span>Filas:</span>
                    <select
                      value={ordersPageSize}
                      onChange={(e) => {
                        setOrdersPageSize(Number(e.target.value));
                        setOrdersPage(1);
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
                      onClick={() => setOrdersPage(1)}
                      disabled={ordersPage === 1}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                      title="Primera página"
                    >
                      «
                    </button>
                    <button
                      onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                      disabled={ordersPage === 1}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                      title="Página anterior"
                    >
                      ‹
                    </button>
                    <span className="px-3 py-1 font-medium text-slate-800">
                      {ordersPage} / {totalOrderPages}
                    </span>
                    <button
                      onClick={() => setOrdersPage((p) => Math.min(totalOrderPages, p + 1))}
                      disabled={ordersPage >= totalOrderPages}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition cursor-pointer text-[12px] font-medium"
                      title="Página siguiente"
                    >
                      ›
                    </button>
                    <button
                      onClick={() => setOrdersPage(totalOrderPages)}
                      disabled={ordersPage >= totalOrderPages}
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
          {/* 5. ¿DÓNDE SE CONCENTRAN LOS PENDIENTES? (TOP PRÁCTICAS Y SECTORES AL FINAL) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 Prácticas No Listas */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <FlaskConical className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-[18px] font-bold uppercase tracking-wider text-slate-900">
                    Top 5 de Prácticas No Listas
                  </h3>
                </div>
                <span className="text-[14px] text-slate-600 font-medium">
                  {kpis.practicasNoListas} pendientes totales
                </span>
              </div>

              {kpis.topPracticasNoListas.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-[14px]">
                  No se registran prácticas no listas para esta jornada.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {kpis.topPracticasNoListas.slice(0, 5).map((item, idx) => (
                    <div key={item.estudio} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[14px]">
                        <span className="font-semibold text-slate-800 truncate max-w-[70%]">
                          {idx + 1}. {item.estudio}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.cantidad}</span>
                          <span className="text-slate-600 font-mono text-[13.5px]">
                            ({item.porcentaje.toLocaleString('es-AR')} %)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#5F285F] h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, item.porcentaje)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top 3 Sectores / Rutas Técnicas */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-[#744174]" />
                  <h3 className="text-[18px] font-bold uppercase tracking-wider text-slate-900">
                    Top 3 de Sectores / Rutas
                  </h3>
                </div>
                <span className="text-[14px] text-slate-600 font-medium">
                  Concentración de carga técnica
                </span>
              </div>

              {activeDailyEntry?.top3Sectores && activeDailyEntry.top3Sectores.length > 0 ? (
                <div className="space-y-3.5">
                  {activeDailyEntry.top3Sectores.slice(0, 3).map((sec, idx) => (
                    <div key={sec.sector} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[14px]">
                        <span className="font-semibold text-slate-800 truncate max-w-[70%]">
                          {idx + 1}. {sec.sector}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{sec.cantidad}</span>
                          <span className="text-slate-600 font-mono text-[13.5px]">
                            ({sec.porcentaje.toLocaleString('es-AR')} %)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#744174] h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, sec.porcentaje)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="py-8 text-center text-slate-500 text-[14px]">
                    Distribución uniforme o sin concentración técnica en sectores específicos.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL DE VISUALIZACIÓN COMPLETA DE OBSERVACIÓN */}
      {/* ========================================================================= */}
      {viewingObservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F7F2F7] text-[#5F285F] text-[12.5px] font-bold">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Observación Operativa</span>
                </div>
                <h3 className="font-bold text-[18px] text-slate-900 mt-1">
                  {viewingObservation.estudio}
                </h3>
                <p className="text-[13px] text-slate-500 font-mono">
                  Orden de Servicio: <span className="font-bold text-slate-800">{viewingObservation.os}</span>
                </p>
              </div>
              <button
                onClick={() => setViewingObservation(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-[14px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                {viewingObservation.texto}
              </p>
            </div>

            <div className="flex items-center justify-between text-[12px] text-slate-500 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Última modificación: <strong>{viewingObservation.modificadoPor}</strong> ({viewingObservation.fechaHora})</span>
              </div>
              <button
                onClick={() => setViewingObservation(null)}
                className="px-4 py-2 rounded-xl text-[14px] font-semibold bg-[#5F285F] hover:bg-[#4A1F4A] text-white transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {/* ========================================================================= */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-[17px] text-slate-900">¿Eliminar jornada histórica?</h3>
            </div>
            <p className="text-[14px] text-slate-600 leading-relaxed">
              Esta acción eliminará el registro de entregas del día{' '}
              <strong>{deleteTargetDate ? formatISOToDisplayDate(deleteTargetDate) : ''}</strong> del almacenamiento local.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setDeleteTargetDate(null);
                }}
                className="px-4 py-2 rounded-xl text-[14px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (deleteTargetDate) {
                    onDeleteDailyEntry(deleteTargetDate);
                  }
                  setShowDeleteConfirmModal(false);
                  setDeleteTargetDate(null);
                }}
                className="px-4 py-2 rounded-xl text-[14px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL DE HISTORIAL DE ARCHIVOS Y AUDITORÍA */}
      {/* ========================================================================= */}
      <FileAuditHistoryModal
        isOpen={showAuditHistoryModal}
        onClose={() => setShowAuditHistoryModal(false)}
        dailyHistory={dailyHistory}
        onSelectDate={(date) => {
          setSelectedDate(date);
        }}
      />
    </div>
  );
};
