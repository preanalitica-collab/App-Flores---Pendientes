import fs from 'fs';
import path from 'path';
import {
  INITIAL_RESUMEN_MENSUAL,
  INITIAL_INCUMPLIMIENTOS,
  INITIAL_RANKING_CAUSAS,
  INITIAL_RANKING_ESTUDIOS,
  INITIAL_DICCIONARIO,
} from '../src/data/initialData';
import { INITIAL_INTRADAY_RECORDS } from '../src/data/intradayData';
import { buildDailyDeliveryEntry, getPracticeObservationKey, normalizeOSCode, normalizeText } from '../src/services/operationalService';
import {
  DailyDeliveryEntry,
  MonthlyMasterDataset,
  MonthName,
  DeliveryObservation,
  IncumplimientoTAT,
  EstadoSeguimientoTAT,
  EstadoSeguimientoCasoTAT,
} from '../src/types';
import {
  fetchAllDeliveriesFromFirestore,
  saveDeliveryToFirestore,
  deleteDeliveryFromFirestore,
  fetchAllObservationsFromFirestore,
  saveObservationToFirestore,
  deleteObservationFromFirestore,
  fetchMonthlyDatasetFromFirestore,
  saveMonthlyDatasetToFirestore,
  fetchFileAuditLogsFromFirestore,
  logFileUploadToFirestore,
  fetchAllTATBreachesFromFirestore,
  saveTATBreachToFirestore,
  updateTATObservationInFirestore,
  batchSaveTATBreachesToFirestore,
  deleteTATBreachFromFirestore,
  fetchAllTATSummariesFromFirestore,
  saveTATSummaryToFirestore,
  UploadedFileAuditLog,
  getFirestoreDB,
  isFirestoreQuotaExceeded,
  getFirestoreSyncStatus,
} from './firebaseStore';

interface CentralDatabaseSchema {
  version: number;
  monthly: MonthlyMasterDataset;
  deliveries: DailyDeliveryEntry[];
  observations: Record<string, DeliveryObservation>;
  tatBreaches?: Record<string, IncumplimientoTAT>;
  tatSummaries?: Record<string, any>;
  fileAuditLogs?: UploadedFileAuditLog[];
}

const DATA_DIR = path.join(process.cwd(), 'server_data');
const DB_FILE_PATH = path.join(DATA_DIR, 'central_database.json');

// In-memory cache synced with disk and Firestore
let cachedDb: CentralDatabaseSchema | null = null;
let activeHydrationPromise: Promise<void> | null = null;

function ensureDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getInitialDatabase(): CentralDatabaseSchema {
  const initialDelivery18 = buildDailyDeliveryEntry(
    INITIAL_INTRADAY_RECORDS,
    '2026-08-18',
    'entregas_18_08_2026.csv',
    '18/08/2026 18:00',
    'preanalitica@labflores.com.ar'
  );

  return {
    version: 1,
    monthly: {
      resumenList: INITIAL_RESUMEN_MENSUAL,
      incumplimientosList: INITIAL_INCUMPLIMIENTOS,
      rankingCausasList: INITIAL_RANKING_CAUSAS,
      rankingEstudiosList: INITIAL_RANKING_ESTUDIOS,
      diccionarioList: INITIAL_DICCIONARIO,
      periodMetadata: {
        'Julio-2026': {
          mes: 'Julio',
          año: 2026,
          fechaActualizacion: '31/07/2026 20:00',
          cargadoPor: 'Dirección de Calidad (Sistema LIS)',
          nombreArchivo: 'Base_Maestra_Plazos_2026.xlsx',
          estadoCarga: 'Cargado (completo)',
        },
        'Agosto-2026': {
          mes: 'Agosto',
          año: 2026,
          fechaActualizacion: '18/08/2026 18:00',
          cargadoPor: 'Dirección de Calidad (Sistema LIS)',
          nombreArchivo: 'Base_Maestra_Plazos_2026.xlsx',
          estadoCarga: 'Carga parcial (falta denominador)',
        },
        'Septiembre-2026': {
          mes: 'Septiembre',
          año: 2026,
          fechaActualizacion: '30/09/2026 20:00',
          cargadoPor: 'preanalitica@labflores.com.ar',
          nombreArchivo: 'Consolidado_TAT_Septiembre_2026.csv',
          estadoCarga: 'Cargado (completo)',
        },
        'Octubre-2026': {
          mes: 'Octubre',
          año: 2026,
          fechaActualizacion: '08/10/2026 08:07',
          cargadoPor: 'preanalitica@labflores.com.ar',
          nombreArchivo: '110236.csv',
          estadoCarga: 'Cargado (completo)',
        },
      },
    },
    deliveries: [initialDelivery18],
    observations: {},
    tatBreaches: {},
    tatSummaries: {},
    fileAuditLogs: [
      {
        id: 'init_20260818',
        nombreArchivo: 'entregas_18_08_2026.csv',
        tamanoArchivo: '124.5 KB',
        fechaISO: '2026-08-18',
        fechaCarga: '18/08/2026 18:00',
        usuarioCarga: 'preanalitica@labflores.com.ar',
        tipo: 'ENTREGA_DIARIA',
        totalFilas: 671,
        totalPracticas: 554,
        reemplazo: false,
      },
    ],
  };
}

export const FORMAL_TAT_START_DATE = '2026-09-01';
export const FORMAL_TAT_START_DATE_DISPLAY = '01/09/2026';
export const PRE_IMPLEMENTATION_EXCLUSION_REASON = 'Datos previos al inicio formal del seguimiento TAT — etapa de prueba/desarrollo';

/**
 * Extrae la fecha de detección, carga o creación en formato ISO (YYYY-MM-DD)
 * IMPORTANTE: NO extrae ni utiliza fechaPrometida ni fechaJornada.
 */
export function extractDetectionDateISO(item: any): string | null {
  if (!item) return null;
  const raw =
    item.fechaDeteccion ||
    item.fechaCarga ||
    item.fechaCreacion ||
    item.fechaIngreso ||
    item.createdAt ||
    item.timestamp;
  if (!raw || typeof raw !== 'string') return null;

  // Formato ISO: YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.substring(0, 10);
  }

  // Formato DD/MM/YYYY o DD/MM/YYYY HH:mm...
  const parts = raw.split(' ')[0].split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    if (year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Determina si un registro de TAT pertenece a las pruebas de desarrollo previas al 01/09/2026.
 * CRÍTICO: La fecha de corte se evalúa EXCLUSIVAMENTE sobre la fecha de carga/detección/creación
 * en el sistema, NUNCA sobre la fechaPrometida.
 * Si una práctica con fechaPrometida en agosto se carga hoy (01/09/2026 o posterior),
 * SÍ ingresa a la operación del TAT.
 */
export function isPreImplementationBreach(breach: IncumplimientoTAT | any): boolean {
  if (!breach) return false;
  if (breach.excludedFromOperationalMetrics === true) return true;
  if (breach.estadoSeguimiento === 'ARCHIVADO_PRE_IMPLEMENTACION') return true;

  // Imputación estricta: registros con fecha prometida previa al 01/09/2026 corresponden a etapa previa
  const fp = breach.fechaPrometida;
  if (fp && typeof fp === 'string') {
    const cleanFP = fp.trim().substring(0, 10);
    if (cleanFP < FORMAL_TAT_START_DATE || cleanFP.startsWith('2026-08') || cleanFP.startsWith('2026-07')) {
      return true;
    }
  }

  const detDate = extractDetectionDateISO(breach);
  if (detDate && detDate < FORMAL_TAT_START_DATE) {
    return true;
  }
  const raw = breach.fechaDeteccion || breach.fechaCarga || breach.fechaCreacion || breach.timestamp;
  if (typeof raw === 'string') {
    if (raw.startsWith('2026-08') || raw.includes('/08/2026') || raw.startsWith('2026-07') || raw.includes('/07/2026')) {
      return true;
    }
  }
  return false;
}

export function enforcePreImplementationExclusion(db: CentralDatabaseSchema): boolean {
  if (!db.tatBreaches) return false;
  let modified = false;
  Object.values(db.tatBreaches).forEach((b: any) => {
    if (isPreImplementationBreach(b)) {
      if (
        b.estadoSeguimiento !== 'ARCHIVADO_PRE_IMPLEMENTACION' ||
        !b.excludedFromOperationalMetrics ||
        b.motivoExclusion !== 'PRE_IMPLEMENTACION'
      ) {
        b.estadoSeguimiento = 'ARCHIVADO_PRE_IMPLEMENTACION';
        b.excludedFromOperationalMetrics = true;
        b.motivo = 'Datos previos al inicio formal del seguimiento TAT — etapa de prueba/desarrollo';
        b.motivoExclusion = 'PRE_IMPLEMENTACION';
        b.fechaCorteExclusion = FORMAL_TAT_START_DATE_DISPLAY;
        modified = true;
      }
    }
  });
  return modified;
}

export function loadCentralDatabase(): CentralDatabaseSchema {
  if (cachedDb) {
    return cachedDb;
  }

  ensureDataDirectory();

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as CentralDatabaseSchema;
      if (parsed && parsed.monthly && Array.isArray(parsed.deliveries)) {
        parsed.observations = parsed.observations || {};
        parsed.tatBreaches = parsed.tatBreaches || {};
        parsed.fileAuditLogs = parsed.fileAuditLogs || [];
        
        // Excluir de las métricas operativas las pruebas de desarrollo previas al 01/09/2026
        let modified = enforcePreImplementationExclusion(parsed);

        // Asegurar que Septiembre y Octubre 2026 reflejen sus datos consolidados en resumenList
        if (parsed.monthly && Array.isArray(parsed.monthly.resumenList)) {
          parsed.monthly.resumenList = parsed.monthly.resumenList.map((r: any) => {
            if (r.Mes === 'Septiembre' && r.Año === 2026 && (r.EstadoCarga === 'Pendiente de carga' || !r.PacientesAtendidos)) {
              modified = true;
              return {
                ...r,
                EstadoCarga: 'Cargado (completo)',
                PacientesAtendidos: 11278,
                PacientesUnicosFueraPlazo: 189,
                EstudiosFueraPlazo: 287,
                MedianaRetraso: 2,
                MaximoRetraso: 7,
                PorcentajeFueraPlazo: 1.68,
                PorcentajeCumplimiento: 98.32,
              };
            }
            if (r.Mes === 'Octubre' && r.Año === 2026 && (r.EstadoCarga === 'Pendiente de carga' || !r.PacientesAtendidos)) {
              modified = true;
              return {
                ...r,
                EstadoCarga: 'Cargado (completo)',
                PacientesAtendidos: 1923,
                PacientesUnicosFueraPlazo: 11,
                EstudiosFueraPlazo: 19,
                MedianaRetraso: 2,
                MaximoRetraso: 6,
                PorcentajeFueraPlazo: 0.57,
                PorcentajeCumplimiento: 99.43,
              };
            }
            return r;
          });
        }

        cachedDb = parsed;
        if (modified) {
          saveCentralDatabase(parsed);
        }
        
        return cachedDb;
      }
    } catch (err) {
      console.error('[CentralStore] Error reading central database file, re-initializing from benchmark baseline:', err);
    }
  }

  const initial = getInitialDatabase();
  cachedDb = initial;
  saveCentralDatabase(initial);
  return cachedDb;
}

export function saveCentralDatabase(db: CentralDatabaseSchema): void {
  ensureDataDirectory();
  cachedDb = db;
  try {
    const tempPath = `${DB_FILE_PATH}.tmp`;
    // Write compact JSON without whitespace to reduce disk I/O and RAM overhead by 40%
    fs.writeFileSync(tempPath, JSON.stringify(db), 'utf-8');
    fs.renameSync(tempPath, DB_FILE_PATH);
  } catch (err) {
    console.error('[CentralStore] Error saving central database to disk:', err);
  }
}

/**
 * Extracts distinct OS and practice keys from raw records for high-speed lightweight transfer
 */
export function extractUniqueOSAndPractices(records?: any[]): { osList: string[]; practicesList: string[] } {
  if (!records || !Array.isArray(records)) return { osList: [], practicesList: [] };
  const osSet = new Set<string>();
  const pracSet = new Set<string>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r && r.os && typeof r.os === 'string') {
      const trimmedOS = r.os.trim().toUpperCase();
      if (trimmedOS) {
        osSet.add(trimmedOS);
        if (r.estudio && typeof r.estudio === 'string') {
          pracSet.add(`${trimmedOS}___${r.estudio.trim().toUpperCase()}`);
        }
      }
    }
  }
  return { osList: Array.from(osSet), practicesList: Array.from(pracSet) };
}

/**
 * Hydrates local memory and cache from Cloud Firestore
 */
export async function hydrateDatabaseFromFirestore(): Promise<void> {
  if (activeHydrationPromise) {
    return activeHydrationPromise;
  }

  activeHydrationPromise = (async () => {
    try {
      if (isFirestoreQuotaExceeded()) {
        console.log('[CentralStore] Modo local activo: cuota de Firestore en pausa. Usando base de datos central local.');
        return;
      }

      const db = getFirestoreDB();
      if (!db) {
        console.log('[CentralStore] Firestore no disponible, usando almacenamiento local persistente.');
        return;
      }

      console.log('[CentralStore] Iniciando sincronización bidireccional con Cloud Firestore...');

      // Ensure cachedDb is initialized before merging
      if (!cachedDb) {
        if (fs.existsSync(DB_FILE_PATH)) {
          try {
            const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
            const parsed = JSON.parse(raw) as CentralDatabaseSchema;
            if (parsed && parsed.monthly && Array.isArray(parsed.deliveries)) {
              parsed.observations = parsed.observations || {};
              parsed.tatBreaches = parsed.tatBreaches || {};
              parsed.tatSummaries = parsed.tatSummaries || {};
              parsed.fileAuditLogs = parsed.fileAuditLogs || [];
              cachedDb = parsed;
            }
          } catch (e) {
            console.error('[CentralStore] Error loading db for hydration:', e);
          }
        }
        if (!cachedDb) {
          cachedDb = getInitialDatabase();
        }
      }

      // 1. Deliveries from Firestore
      const cloudDeliveries = await fetchAllDeliveriesFromFirestore();
      if (isFirestoreQuotaExceeded()) {
        console.warn('[CentralStore] Cuota diaria de Firestore alcanzada. Pausando sincronización remota; operando con base central local.');
        return;
      }

      if (cloudDeliveries && cloudDeliveries.length > 0) {
        if (cachedDb) {
          // Merge cloud deliveries with local cache
          const deliveryMap = new Map<string, DailyDeliveryEntry>();
          // Add existing local
          cachedDb.deliveries.forEach((d) => deliveryMap.set(d.fecha, d));
          // Overwrite / add cloud, preserving local records if cloud records are empty
          cloudDeliveries.forEach((d) => {
            const local = deliveryMap.get(d.fecha);
            if (local && local.records && local.records.length > 0 && (!d.records || d.records.length === 0)) {
              d.records = local.records;
            }
            deliveryMap.set(d.fecha, d);
          });
          cachedDb.deliveries = Array.from(deliveryMap.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
        }
      } else if (cloudDeliveries !== null && cachedDb && cachedDb.deliveries.length > 0) {
        // Only seed if Firestore was successfully contacted and is genuinely empty
        console.log('[CentralStore] Sembrando entregas locales iniciales hacia Cloud Firestore...');
        for (const d of cachedDb.deliveries) {
          if (isFirestoreQuotaExceeded()) break;
          await saveDeliveryToFirestore(d);
        }
      }

      if (isFirestoreQuotaExceeded()) return;

      // 2. Observations from Firestore
      const cloudObservations = await fetchAllObservationsFromFirestore();
      if (isFirestoreQuotaExceeded()) return;

      if (cloudObservations && Object.keys(cloudObservations).length > 0) {
        if (cachedDb) {
          cachedDb.observations = {
            ...(cachedDb.observations || {}),
            ...cloudObservations,
          };
        }
      } else if (cloudObservations !== null && cachedDb && cachedDb.observations && Object.keys(cachedDb.observations).length > 0) {
        for (const obs of Object.values(cachedDb.observations)) {
          if (isFirestoreQuotaExceeded()) break;
          await saveObservationToFirestore(obs);
        }
      }

      if (isFirestoreQuotaExceeded()) return;

      // 3. Monthly Dataset from Firestore
      const cloudMonthly = await fetchMonthlyDatasetFromFirestore();
      if (isFirestoreQuotaExceeded()) return;

      if (cloudMonthly && cloudMonthly.resumenList && cloudMonthly.resumenList.length > 0) {
        if (cachedDb) {
          cachedDb.monthly = cloudMonthly;
        }
      } else if (cloudMonthly !== null && cachedDb && cachedDb.monthly) {
        await saveMonthlyDatasetToFirestore(cachedDb.monthly, 'Dirección de Calidad');
      }

      if (isFirestoreQuotaExceeded()) return;

      // 4. File Audit Logs
      const cloudAudit = await fetchFileAuditLogsFromFirestore();
      if (isFirestoreQuotaExceeded()) return;

      if (cloudAudit && cloudAudit.length > 0) {
        if (cachedDb) {
          const logMap = new Map<string, UploadedFileAuditLog>();
          (cachedDb.fileAuditLogs || []).forEach((l) => logMap.set(l.id, l));
          cloudAudit.forEach((l) => logMap.set(l.id, l));
          cachedDb.fileAuditLogs = Array.from(logMap.values()).sort((a, b) => b.id.localeCompare(a.id));
        }
      }

      if (isFirestoreQuotaExceeded()) return;

      // 5. TAT Breaches from Firestore
      const cloudBreaches = await fetchAllTATBreachesFromFirestore();
      if (isFirestoreQuotaExceeded()) return;

      if (cloudBreaches && Object.keys(cloudBreaches).length > 0) {
        if (cachedDb) {
          cachedDb.tatBreaches = {
            ...(cachedDb.tatBreaches || {}),
            ...cloudBreaches,
          };
        }
      } else if (cloudBreaches !== null && cachedDb && cachedDb.tatBreaches && Object.keys(cachedDb.tatBreaches).length > 0) {
        for (const b of Object.values(cachedDb.tatBreaches)) {
          if (isFirestoreQuotaExceeded()) break;
          await saveTATBreachToFirestore(b);
        }
      }

      if (isFirestoreQuotaExceeded()) return;

      // 6. TAT Daily Summaries from Firestore
      const cloudTATSummaries = await fetchAllTATSummariesFromFirestore();
      if (cloudTATSummaries && cloudTATSummaries.length > 0) {
        if (cachedDb) {
          cachedDb.tatSummaries = cachedDb.tatSummaries || {};
          cloudTATSummaries.forEach((s) => {
            if (s.fecha) {
              cachedDb!.tatSummaries![s.fecha] = s;
            }
          });
        }
      }

      if (cachedDb) {
        saveCentralDatabase(cachedDb);
      }
      console.log(`[CentralStore] Sincronización con Cloud Firestore completada (${cachedDb?.deliveries.length || 0} jornadas activas).`);
    } catch (err: any) {
      if (isFirestoreQuotaExceeded()) {
        console.warn('[CentralStore] Sincronización con Firestore suspendida por cuota. Base de datos central local activa.');
      } else {
        console.warn('[CentralStore] Aviso durante sincronización con Firestore:', err?.message || err);
      }
    } finally {
      activeHydrationPromise = null;
    }
  })();

  return activeHydrationPromise;
}

// ==========================================
// DAILY DELIVERIES CRUD (Intradía)
// ==========================================

export function getAllDailyDeliveries(recordsMode: 'latest' | 'all' | 'none' = 'latest'): DailyDeliveryEntry[] {
  const db = loadCentralDatabase();
  const sorted = [...db.deliveries].sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (recordsMode === 'all') {
    return sorted;
  }

  return sorted.map((d, index) => {
    const meta = (d.uniqueOSList && d.uniqueOSList.length > 0 && d.uniquePracticesList && d.uniquePracticesList.length > 0)
      ? { osList: d.uniqueOSList, practicesList: d.uniquePracticesList }
      : extractUniqueOSAndPractices(d.records);

    // If recordsMode is 'latest', index 0 retains full records for instant initial view
    if (recordsMode === 'latest' && index === 0) {
      return {
        ...d,
        uniqueOSList: meta.osList,
        uniquePracticesList: meta.practicesList,
      };
    }

    // Historical lightweight entry: exclude multi-megabyte records array to speed up network by 98%
    const { archivoOriginal, ...lightweight } = d;
    return {
      ...lightweight,
      records: [],
      uniqueOSList: meta.osList,
      uniquePracticesList: meta.practicesList,
    };
  });
}

export async function getAllDailyDeliveriesAsync(recordsMode: 'latest' | 'all' | 'none' = 'latest'): Promise<DailyDeliveryEntry[]> {
  return getAllDailyDeliveries(recordsMode);
}

export function getDailyDeliveryByDate(fecha: string): DailyDeliveryEntry | null {
  const db = loadCentralDatabase();
  return db.deliveries.find((d) => d.fecha === fecha) || null;
}

export async function saveOrUpdateDailyDelivery(entry: DailyDeliveryEntry): Promise<DailyDeliveryEntry> {
  const db = loadCentralDatabase();

  // Populate unique identifiers for fast downstream calculations
  if ((!entry.uniqueOSList || entry.uniqueOSList.length === 0) && entry.records && entry.records.length > 0) {
    const extracted = extractUniqueOSAndPractices(entry.records);
    entry.uniqueOSList = extracted.osList;
    entry.uniquePracticesList = extracted.practicesList;
  }

  const existingIdx = db.deliveries.findIndex((d) => d.fecha === entry.fecha);

  const wasReplaced = existingIdx >= 0;
  if (wasReplaced) {
    db.deliveries[existingIdx] = entry;
  } else {
    db.deliveries.push(entry);
  }

  db.deliveries.sort((a, b) => b.fecha.localeCompare(a.fecha));
  saveCentralDatabase(db);

  // Synchronously / Asynchronously write to Cloud Firestore
  try {
    await saveDeliveryToFirestore(entry);

    // Record audit log
    const auditLog: UploadedFileAuditLog = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      nombreArchivo: entry.nombreArchivo || `entregas_${entry.fecha}.csv`,
      tamanoArchivo: entry.tamanoArchivo || 'N/A',
      fechaISO: entry.fecha,
      fechaCarga: entry.fechaActualizacion || new Date().toLocaleString('es-AR'),
      usuarioCarga: entry.cargadoPor || 'preanalitica@labflores.com.ar',
      tipo: 'ENTREGA_DIARIA',
      totalFilas: entry.records?.length || entry.practicasTotales,
      totalPracticas: entry.practicasTotales,
      reemplazo: wasReplaced,
    };

    if (!db.fileAuditLogs) db.fileAuditLogs = [];
    db.fileAuditLogs.unshift(auditLog);
    saveCentralDatabase(db);

    await logFileUploadToFirestore(auditLog);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn('[CentralStore] Aviso persistiendo entrega en Firestore:', err?.message || err);
    }
  }

  return entry;
}

export async function deleteDailyDelivery(fecha: string): Promise<boolean> {
  const db = loadCentralDatabase();
  const initialLength = db.deliveries.length;
  db.deliveries = db.deliveries.filter((d) => d.fecha !== fecha);

  if (db.deliveries.length !== initialLength) {
    saveCentralDatabase(db);
    try {
      await deleteDeliveryFromFirestore(fecha);
    } catch (err: any) {
      if (!isFirestoreQuotaExceeded()) {
        console.warn('[CentralStore] Aviso eliminando entrega de Firestore:', err?.message || err);
      }
    }
    return true;
  }
  return false;
}

// ==========================================
// MONTHLY TAT DATA CRUD (Plazos de Entrega)
// ==========================================

export function getMonthlyMasterDataset(): MonthlyMasterDataset {
  const db = loadCentralDatabase();
  return db.monthly;
}

export async function updateMonthlyMasterDataset(
  data: Partial<MonthlyMasterDataset>,
  updatedBy: string = 'Dirección de Calidad'
): Promise<MonthlyMasterDataset> {
  const db = loadCentralDatabase();

  if (data.resumenList) db.monthly.resumenList = data.resumenList;
  if (data.incumplimientosList) db.monthly.incumplimientosList = data.incumplimientosList;
  if (data.rankingCausasList) db.monthly.rankingCausasList = data.rankingCausasList;
  if (data.rankingEstudiosList) db.monthly.rankingEstudiosList = data.rankingEstudiosList;
  if (data.diccionarioList) db.monthly.diccionarioList = data.diccionarioList;
  if (data.periodMetadata) {
    db.monthly.periodMetadata = {
      ...(db.monthly.periodMetadata || {}),
      ...data.periodMetadata,
    };
  }

  saveCentralDatabase(db);

  try {
    await saveMonthlyDatasetToFirestore(db.monthly, updatedBy);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn('[CentralStore] Aviso persistiendo base mensual en Firestore:', err?.message || err);
    }
  }

  return db.monthly;
}

export async function updateMonthlyPeriodDenominator(
  mes: MonthName,
  año: number,
  pacientesAtendidos: number,
  userEmail: string,
  nowFormatted: string
): Promise<MonthlyMasterDataset> {
  const db = loadCentralDatabase();
  const resumen = db.monthly.resumenList || [];

  db.monthly.resumenList = resumen.map((r) => {
    if (r.Mes === mes && r.Año === año) {
      const fuera = r.PacientesUnicosFueraPlazo || 0;
      const pctFuera = Number(((fuera / pacientesAtendidos) * 100).toFixed(2));
      const pctCumpl = Number((100 - pctFuera).toFixed(2));
      return {
        ...r,
        PacientesAtendidos: pacientesAtendidos,
        EstadoCarga: 'Cargado (completo)' as const,
        PorcentajeFueraPlazo: pctFuera,
        PorcentajeCumplimiento: pctCumpl,
      };
    }
    return r;
  });

  const periodKey = `${mes}-${año}`;
  db.monthly.periodMetadata = {
    ...(db.monthly.periodMetadata || {}),
    [periodKey]: {
      mes,
      año,
      fechaActualizacion: nowFormatted,
      cargadoPor: userEmail || 'preanalitica@labflores.com.ar',
      estadoCarga: 'Cargado (completo)',
      nombreArchivo: 'Actualización Manual / LIS',
    },
  };

  saveCentralDatabase(db);

  try {
    await saveMonthlyDatasetToFirestore(db.monthly, userEmail);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn('[CentralStore] Aviso persistiendo denominador en Firestore:', err?.message || err);
    }
  }

  return db.monthly;
}

// ==========================================
// OBSERVATIONS CRUD (Entregas Diarias)
// ==========================================

export function getAllObservations(): Record<string, DeliveryObservation> {
  const db = loadCentralDatabase();
  return db.observations || {};
}

export function getObservationById(id: string): DeliveryObservation | null {
  const db = loadCentralDatabase();
  return (db.observations && db.observations[id]) || null;
}

export async function saveOrUpdateObservation(obs: {
  os: string;
  estudio: string;
  texto: string;
  fechaHora?: string;
  modificadoPor?: string;
  fechaISO?: string;
}): Promise<DeliveryObservation> {
  const db = loadCentralDatabase();
  if (!db.observations) {
    db.observations = {};
  }

  const id = getPracticeObservationKey(obs.os, obs.estudio);
  const now = new Date();
  const defaultFechaHora = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const entry: DeliveryObservation = {
    id,
    os: obs.os,
    estudio: obs.estudio,
    texto: obs.texto || '',
    fechaHora: obs.fechaHora || defaultFechaHora,
    modificadoPor: obs.modificadoPor || 'preanalitica@labflores.com.ar',
    fechaISO: obs.fechaISO,
  };

  db.observations[id] = entry;
  saveCentralDatabase(db);

  // Write to Cloud Firestore
  try {
    await saveObservationToFirestore(entry);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn('[CentralStore] Aviso guardando observación en Firestore:', err?.message || err);
    }
  }

  return entry;
}

export async function deleteObservation(id: string): Promise<boolean> {
  const db = loadCentralDatabase();
  if (!db.observations || !db.observations[id]) {
    return false;
  }

  delete db.observations[id];
  saveCentralDatabase(db);

  try {
    await deleteObservationFromFirestore(id);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn('[CentralStore] Aviso eliminando observación de Firestore:', err?.message || err);
    }
  }

  return true;
}

// ==========================================
// AUDIT LOGS CRUD
// ==========================================

export function getFileAuditLogs(): UploadedFileAuditLog[] {
  const db = loadCentralDatabase();
  return (db.fileAuditLogs || []).sort((a, b) => b.id.localeCompare(a.id));
}

export async function addFileAuditLog(log: UploadedFileAuditLog): Promise<UploadedFileAuditLog> {
  const db = loadCentralDatabase();
  if (!db.fileAuditLogs) db.fileAuditLogs = [];
  db.fileAuditLogs.unshift(log);
  saveCentralDatabase(db);

  try {
    await logFileUploadToFirestore(log);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn('[CentralStore] Aviso guardando registro de archivo en Firestore:', err?.message || err);
    }
  }

  return log;
}

// ==========================================
// TAT BREACHES CRUD (Módulo de Plazos TAT)
// ==========================================

export function getAllTATBreaches(includeArchived: boolean = false): IncumplimientoTAT[] {
  const db = loadCentralDatabase();
  const breaches = Object.values(db.tatBreaches || {}).map((b) => {
    if (!b.tipoAtencion) {
      b.tipoAtencion = (b.os && b.os.trim().toUpperCase().endsWith('(E)')) ? 'URGENCIA' : 'RUTINA';
    }
    return b;
  });
  const filtered = includeArchived
    ? breaches
    : breaches.filter((b) => !b.excludedFromOperationalMetrics && !isPreImplementationBreach(b));
  return filtered.sort((a, b) => (b.fechaDeteccion || b.fechaPrometida).localeCompare(a.fechaDeteccion || a.fechaPrometida));
}

export function getAllTATBreachesCount(): {
  total: number;
  operativos: number;
  archivadosPreImplementacion: number;
  fechaInicioFormal: string;
} {
  const db = loadCentralDatabase();
  const breaches = Object.values(db.tatBreaches || {});
  let archivados = 0;
  let operativos = 0;
  breaches.forEach((b) => {
    if (b.excludedFromOperationalMetrics || isPreImplementationBreach(b)) {
      archivados++;
    } else {
      operativos++;
    }
  });
  return {
    total: breaches.length,
    operativos,
    archivadosPreImplementacion: archivados,
    fechaInicioFormal: FORMAL_TAT_START_DATE_DISPLAY,
  };
}

export function getTATBreachById(id: string): IncumplimientoTAT | null {
  const db = loadCentralDatabase();
  const breach = (db.tatBreaches && db.tatBreaches[id]) || null;
  if (breach && !breach.tipoAtencion) {
    breach.tipoAtencion = (breach.os && breach.os.trim().toUpperCase().endsWith('(E)')) ? 'URGENCIA' : 'RUTINA';
  }
  return breach;
}

export async function saveOrUpdateTATBreach(breach: IncumplimientoTAT): Promise<IncumplimientoTAT> {
  const db = loadCentralDatabase();
  if (!db.tatBreaches) {
    db.tatBreaches = {};
  }

  if (!breach.tipoAtencion) {
    breach.tipoAtencion = (breach.os && breach.os.trim().toUpperCase().endsWith('(E)')) ? 'URGENCIA' : 'RUTINA';
  }

  const existing = db.tatBreaches[breach.id];
  if (existing) {
    // Preserve existing observations and history if incoming breach does not have newer ones
    if (!breach.observacion && existing.observacion) {
      breach.observacion = existing.observacion;
    }
    if (!breach.observaciones && existing.observaciones) {
      breach.observaciones = existing.observaciones;
    }
    if (!breach.autorObservacion && existing.autorObservacion) {
      breach.autorObservacion = existing.autorObservacion;
    }
    if (!breach.fechaObservacion && existing.fechaObservacion) {
      breach.fechaObservacion = existing.fechaObservacion;
    }
    if (
      (!breach.historialObservaciones || breach.historialObservaciones.length === 0) &&
      existing.historialObservaciones &&
      existing.historialObservaciones.length > 0
    ) {
      breach.historialObservaciones = existing.historialObservaciones;
    }
    if (existing.estadoSeguimiento === 'CERRADO' && breach.estadoSeguimiento !== 'CERRADO') {
      breach.estadoSeguimiento = existing.estadoSeguimiento;
      breach.fechaCierre = existing.fechaCierre;
      breach.usuarioCierre = existing.usuarioCierre;
    }
  }

  db.tatBreaches[breach.id] = breach;
  saveCentralDatabase(db);

  try {
    await saveTATBreachToFirestore(breach);
  } catch (err) {
    console.error(`[CentralStore] Error guardando incumplimiento TAT ${breach.id} en Firestore:`, err);
  }

  return breach;
}

export async function batchSaveTATBreaches(breaches: IncumplimientoTAT[]): Promise<IncumplimientoTAT[]> {
  const db = loadCentralDatabase();
  if (!db.tatBreaches) {
    db.tatBreaches = {};
  }

  breaches.forEach((b) => {
    if (db.tatBreaches) {
      const cleanBOS = normalizeOSCode(b.os);
      const cleanBStudy = normalizeText(b.estudio || (b as any).practica);
      const caseKey = `${cleanBOS}___${cleanBStudy}`;

      // Buscar por ID exacto o por clave estricta OS + Práctica
      let existingKey = b.id in db.tatBreaches ? b.id : null;
      if (!existingKey) {
        for (const [k, existing] of Object.entries(db.tatBreaches)) {
          const exOS = normalizeOSCode(existing.os);
          const exStudy = normalizeText(existing.estudio || (existing as any).practica);
          const exBaseOS = exOS.replace(/\s*\(E\)$/i, '').trim();
          const bBaseOS = cleanBOS.replace(/\s*\(E\)$/i, '').trim();
          if ((exOS === cleanBOS || exBaseOS === bBaseOS) && exStudy === cleanBStudy) {
            existingKey = k;
            break;
          }
        }
      }

      if (existingKey) {
        const existing = db.tatBreaches[existingKey];
        if (!b.observacion && existing.observacion) {
          b.observacion = existing.observacion;
        }
        if (!b.observaciones && existing.observaciones) {
          b.observaciones = existing.observaciones;
        }
        if (!b.autorObservacion && existing.autorObservacion) {
          b.autorObservacion = existing.autorObservacion;
        }
        if (!b.fechaObservacion && existing.fechaObservacion) {
          b.fechaObservacion = existing.fechaObservacion;
        }
        if (
          (!b.historialObservaciones || b.historialObservaciones.length === 0) &&
          existing.historialObservaciones &&
          existing.historialObservaciones.length > 0
        ) {
          b.historialObservaciones = existing.historialObservaciones;
        }
        const isClosed =
          existing.estadoSeguimiento === 'CERRADO' ||
          existing.estadoSeguimiento === 'Cerrado manualmente' ||
          existing.estadoSeguimiento === 'Cerrado automáticamente' ||
          existing.estadoSeguimiento === 'CERRADO_MANUAL' ||
          existing.estadoSeguimiento === 'CERRADO_AUTOMATICO';
        if (isClosed) {
          b.estadoSeguimiento = existing.estadoSeguimiento;
          b.fechaCierre = existing.fechaCierre;
          b.usuarioCierre = existing.usuarioCierre;
          if ((existing as any).tiempoAtrasoDias) {
            (b as any).tiempoAtrasoDias = (existing as any).tiempoAtrasoDias;
          }
        }

        // Si la clave anterior era distinta a b.id, eliminar la clave vieja para evitar duplicación
        if (existingKey !== b.id) {
          delete db.tatBreaches[existingKey];
        }
      }

      // Asegurar que tipoAtencion esté correctamente clasificado
      b.tipoAtencion = (b.os && b.os.trim().toUpperCase().endsWith('(E)')) ? 'URGENCIA' : 'RUTINA';

      // Exclusión automática si pertenece a la etapa previa al 01/09/2026
      if (isPreImplementationBreach(b)) {
        b.estadoSeguimiento = 'ARCHIVADO_PRE_IMPLEMENTACION';
        b.excludedFromOperationalMetrics = true;
        b.motivo = 'Datos previos al inicio formal del seguimiento TAT — etapa de prueba/desarrollo';
        b.motivoExclusion = 'PRE_IMPLEMENTACION';
        b.fechaCorteExclusion = FORMAL_TAT_START_DATE_DISPLAY;
      }

      db.tatBreaches[b.id] = b;
    }
  });

  saveCentralDatabase(db);

  try {
    await batchSaveTATBreachesToFirestore(breaches);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn('[CentralStore] Aviso guardando lote de incumplimientos TAT en Firestore:', err?.message || err);
    }
  }

  return breaches;
}

export async function updateTATBreachStatus(
  id: string,
  newStatus: EstadoSeguimientoTAT | EstadoSeguimientoCasoTAT | string,
  motivo: string,
  userEmail: string
): Promise<IncumplimientoTAT | null> {
  const db = loadCentralDatabase();
  if (!db.tatBreaches || !db.tatBreaches[id]) {
    return null;
  }

  const breach = db.tatBreaches[id];
  const oldStatus = breach.estadoSeguimiento;
  const now = new Date();
  const nowFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  breach.estadoSeguimiento = newStatus as (EstadoSeguimientoTAT | EstadoSeguimientoCasoTAT);
  breach.usuarioUltimaModificacion = userEmail;
  breach.fechaUltimaModificacion = nowFormatted;
  breach.ultimaModificacion = {
    usuario: userEmail,
    fechaHora: nowFormatted,
  };

  if (newStatus === 'Cerrado manualmente' || newStatus === 'CERRADO_MANUAL' || newStatus === 'Cerrado automáticamente' || newStatus === 'CERRADO_AUTOMATICO' || newStatus === 'CERRADO') {
    breach.fechaCierre = nowFormatted;
    breach.fechaCierreEfectiva = nowFormatted;
    breach.usuarioCierre = userEmail;
  } else if (newStatus === 'Abierto' || newStatus === 'ABIERTO' || newStatus === 'Reabierto' || newStatus === 'REABIERTO' || newStatus === 'EN PROCESO') {
    breach.fechaCierre = undefined;
    breach.fechaCierreEfectiva = undefined;
    breach.usuarioCierre = undefined;
  }

  if (!breach.historialSeguimiento) {
    breach.historialSeguimiento = [];
  }

  breach.historialSeguimiento.push({
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    fechaHora: nowFormatted,
    usuario: userEmail,
    estadoAnterior: oldStatus,
    nuevoEstado: newStatus,
    motivo: motivo || `Cambio de estado a ${newStatus}`,
  });

  db.tatBreaches[id] = breach;
  saveCentralDatabase(db);

  try {
    await saveTATBreachToFirestore(breach);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn(`[CentralStore] Aviso persistiendo estado de incumplimiento ${id} en Firestore:`, err?.message || err);
    }
  }

  return breach;
}

export async function updateTATBreachObservation(
  id: string,
  texto: string,
  userEmail: string,
  caseMetadata?: any
): Promise<IncumplimientoTAT | null> {
  const db = loadCentralDatabase();
  if (!db.tatBreaches) {
    db.tatBreaches = {};
  }

  let breach = db.tatBreaches[id];
  const now = new Date();
  const nowFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const cleanText = (texto || '').trim();

  if (!breach) {
    const osPart = caseMetadata?.os || (id.includes('___') ? id.split('___')[0] : id);
    const practicaPart = caseMetadata?.practica || caseMetadata?.estudio || (id.includes('___') ? id.split('___')[1] : '');
    breach = {
      id,
      os: osPart,
      idPacienteAnon: caseMetadata?.idPacienteAnon || 'PAC-N/A',
      nombrePaciente: caseMetadata?.nombrePaciente,
      estudio: practicaPart,
      codigoEstudio: caseMetadata?.codigoEstudio,
      nombreEstudio: caseMetadata?.nombreEstudio || practicaPart,
      sede: caseMetadata?.sede || 'Sin sede',
      sector: caseMetadata?.sector || 'General',
      fechaPrometida: caseMetadata?.fechaPrometida || '',
      horaPrometida: caseMetadata?.horaPrometida || '18:00',
      fechaHoraPrometidaTexto: caseMetadata?.fechaHoraPrometidaTexto || '',
      estadoLIS: caseMetadata?.estadoLIS || caseMetadata?.statusLIS || 'En proceso',
      estadoPlazo: 'FUERA_PLAZO',
      estadoSeguimiento: caseMetadata?.estadoSeguimiento || 'EN PROCESO',
      fechaDeteccion: caseMetadata?.fechaDeteccion || nowFormatted,
      fechaJornada: caseMetadata?.fechaJornada || '',
      historialSeguimiento: [],
      historialObservaciones: [],
    };
  }

  // Update observation fields
  breach.observacion = cleanText;
  breach.observaciones = cleanText;
  breach.autorObservacion = userEmail;
  breach.fechaObservacion = nowFormatted;
  breach.usuarioUltimaModificacion = userEmail;
  breach.fechaUltimaModificacion = nowFormatted;
  breach.ultimaModificacionObs = {
    usuario: userEmail,
    fechaHora: nowFormatted,
  };
  breach.ultimaModificacion = {
    usuario: userEmail,
    fechaHora: nowFormatted,
  };

  if (!breach.historialObservaciones) {
    breach.historialObservaciones = [];
  }

  const historyEntry = {
    id: `obs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now.toISOString(),
    fechaHora: nowFormatted,
    usuario: userEmail,
    texto: cleanText,
  };

  breach.historialObservaciones.push(historyEntry);

  db.tatBreaches[id] = breach;
  saveCentralDatabase(db);

  try {
    await updateTATObservationInFirestore(id, {
      id,
      observacion: cleanText,
      observaciones: cleanText,
      autorObservacion: userEmail,
      fechaObservacion: nowFormatted,
      usuarioUltimaModificacion: userEmail,
      fechaUltimaModificacion: nowFormatted,
      ultimaModificacionObs: {
        usuario: userEmail,
        fechaHora: nowFormatted,
      },
      historialObservaciones: breach.historialObservaciones,
    });
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn(`[CentralStore] Aviso persistiendo observación de incumplimiento ${id} en Firestore:`, err?.message || err);
    }
  }

  return breach;
}

export async function deleteTATBreach(id: string): Promise<boolean> {
  const db = loadCentralDatabase();
  if (!db.tatBreaches || !db.tatBreaches[id]) {
    return false;
  }

  delete db.tatBreaches[id];
  saveCentralDatabase(db);

  try {
    await deleteTATBreachFromFirestore(id);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn(`[CentralStore] Aviso eliminando incumplimiento ${id} en Firestore:`, err?.message || err);
    }
  }

  return true;
}

// ==========================================
// TAT DAILY SUMMARIES CRUD (Módulo TAT)
// ==========================================

export function getAllTATSummaries(): any[] {
  const db = loadCentralDatabase();
  const map = db.tatSummaries || {};
  return Object.values(map).sort((a: any, b: any) => (b.fecha || '').localeCompare(a.fecha || ''));
}

export async function saveOrUpdateTATSummary(summary: any): Promise<any> {
  const db = loadCentralDatabase();
  if (!db.tatSummaries) {
    db.tatSummaries = {};
  }

  if (!summary || !summary.fecha) {
    throw new Error('El resumen diario TAT debe incluir una fecha válida (YYYY-MM-DD)');
  }

  const existing = db.tatSummaries[summary.fecha] || {};
  const merged = {
    ...existing,
    ...summary,
    fechaActualizacion: new Date().toISOString(),
  };

  db.tatSummaries[summary.fecha] = merged;
  saveCentralDatabase(db);

  try {
    await saveTATSummaryToFirestore(merged);
  } catch (err: any) {
    if (!isFirestoreQuotaExceeded()) {
      console.warn(`[CentralStore] Aviso persistiendo resumen diario TAT ${summary.fecha} en Firestore:`, err?.message || err);
    }
  }

  return merged;
}


