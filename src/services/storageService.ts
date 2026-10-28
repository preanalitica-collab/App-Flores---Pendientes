import {
  IntradayRecord,
  DailyDeliveryEntry,
  MonthlyMasterDataset,
  MonthName,
  DeliveryObservation,
  TATCase,
  TATDailySummary,
} from '../types';
import { INITIAL_INTRADAY_RECORDS } from '../data/intradayData';
import { buildDailyDeliveryEntry } from './operationalService';

const DB_NAME = 'LabFlores_Intraday_DB';
const DB_VERSION = 2;
const STORE_NAME = 'intraday_records_store';
const DAILY_STORE_NAME = 'daily_deliveries_store';
const META_KEY = 'dataset_metadata';
const RECORDS_KEY = 'dataset_records';
const LOCAL_STORAGE_DAILY_KEY = 'labflores_daily_deliveries_history';

export interface StorageMetadata {
  lastUpdatedISO: string;
  lastUpdatedFormatted: string;
  recordCount: number;
  dateKey?: string;
  cargadoPor?: string;
}

/**
 * Format a Date or ISO string to "DD/MM/YYYY HH:mm"
 */
export function formatToDDMMYYYYHHmm(dateInput?: Date | string | number | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Strip sensitive personal data (e.g. Patient full names) before local storage
 * to strictly comply with ISO/HIPAA data protection rules.
 */
export function sanitizeRecordsForStorage(records: IntradayRecord[]): IntradayRecord[] {
  return records.map((record) => {
    const { nombrePaciente, ...safeRecord } = record;
    return {
      ...safeRecord,
      nombrePaciente: undefined, // Enforce removal of personal names in storage
    };
  });
}

// =========================================================================
// CENTRALIZED SERVER BACKEND API CLIENT (Single Source of Truth)
// =========================================================================

/**
 * Fetches all daily deliveries from centralized backend server
 * Uses recordsMode='latest' by default for instant 98% payload compression
 */
export async function fetchCentralDeliveries(recordsMode: 'latest' | 'all' | 'none' = 'latest'): Promise<DailyDeliveryEntry[]> {
  try {
    const res = await fetch(`/api/deliveries?recordsMode=${recordsMode}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Error en servidor: ${res.statusText}`);
    }
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      // Also cache in local IndexedDB for resilience asynchronously
      saveAllToIndexedDB(json.data).catch(() => {});
      return json.data;
    }
    return [];
  } catch (err) {
    console.warn('[CentralAPI] Error al conectar con servidor central, usando almacenamiento local:', err);
    return loadAllFromIndexedDB();
  }
}

/**
 * Saves or updates a daily delivery entry in the centralized server backend
 */
export async function saveCentralDelivery(entry: DailyDeliveryEntry): Promise<DailyDeliveryEntry> {
  const res = await fetch('/api/deliveries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });

  if (!res.ok) {
    let errorMsg = `Error del servidor (${res.status}): ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || 'El servidor no confirmó el guardado de la entrega diaria.');
  }

  // Also cache locally for offline resilience
  saveDailyDeliveryToIndexedDB(json.data).catch(() => {});
  return json.data;
}

/**
 * Fetches all file upload audit logs from the database
 */
export async function fetchCentralFileAuditLogs(): Promise<any[]> {
  try {
    const res = await fetch('/api/files-history', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al recuperar historial de archivos:', err);
  }
  return [];
}

/**
 * Posts a file upload audit log entry to the persistent database
 */
export async function postCentralFileAuditLog(log: any): Promise<boolean> {
  try {
    const res = await fetch('/api/files-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    return res.ok;
  } catch (err) {
    console.warn('[CentralAPI] Error registrando auditoría de archivo:', err);
    return false;
  }
}

/**
 * Deletes a daily delivery entry by ISO date in the centralized backend
 */
export async function deleteCentralDelivery(fechaISO: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/deliveries/${fechaISO}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      deleteFromIndexedDB(fechaISO).catch(() => {});
      return true;
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al eliminar en backend:', err);
  }

  await deleteFromIndexedDB(fechaISO);
  return true;
}

/**
 * Fetches the master monthly TAT dataset from the centralized backend
 */
export async function fetchCentralMonthlyData(): Promise<MonthlyMasterDataset | null> {
  try {
    const res = await fetch('/api/monthly-data', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Error en servidor: ${res.statusText}`);
    }
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.warn('[CentralAPI] Error al obtener datos mensuales desde el servidor:', err);
    return null;
  }
}

/**
 * Updates monthly dataset in centralized backend
 */
export async function saveCentralMonthlyData(data: Partial<MonthlyMasterDataset>): Promise<MonthlyMasterDataset | null> {
  try {
    const res = await fetch('/api/monthly-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Error al actualizar base mensual: ${res.statusText}`);
    }
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.error('[CentralAPI] Error al guardar datos mensuales en backend:', err);
    return null;
  }
}

/**
 * Updates monthly denominator (Pacientes Atendidos) centrally
 */
export async function updateCentralMonthlyDenominator(
  mes: MonthName,
  año: number,
  pacientesAtendidos: number,
  userEmail: string,
  fechaActualizacion?: string
): Promise<MonthlyMasterDataset | null> {
  try {
    const res = await fetch('/api/monthly-data/denominator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mes,
        año,
        pacientesAtendidos,
        userEmail,
        fechaActualizacion: fechaActualizacion || formatToDDMMYYYYHHmm(new Date()),
      }),
    });
    if (!res.ok) {
      throw new Error(`Error al consolidar denominador: ${res.statusText}`);
    }
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.error('[CentralAPI] Error al actualizar denominador central:', err);
    return null;
  }
}

/**
 * Get status and metadata of all periods in centralized backend
 */
export async function fetchCentralStatus(): Promise<any> {
  try {
    const res = await fetch('/api/status', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al consultar status del servidor:', err);
  }
  return null;
}

const LOCAL_STORAGE_OBSERVATIONS_KEY = 'labflores_delivery_observations';

/**
 * Recupera todas las observaciones de entregas diarias desde el servidor centralizado
 */
export async function fetchCentralObservations(): Promise<Record<string, DeliveryObservation>> {
  try {
    const res = await fetch('/api/observations', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        try {
          localStorage.setItem(LOCAL_STORAGE_OBSERVATIONS_KEY, JSON.stringify(json.data));
        } catch {}
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al obtener observaciones del servidor, usando local:', err);
  }

  // Fallback a localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OBSERVATIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

/**
 * Guarda o actualiza una observación en el backend central (persistido para todos los usuarios)
 */
export async function saveCentralObservation(obs: {
  os: string;
  estudio: string;
  texto: string;
  fechaHora?: string;
  modificadoPor?: string;
  fechaISO?: string;
}): Promise<DeliveryObservation | null> {
  try {
    const res = await fetch('/api/observations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obs),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_OBSERVATIONS_KEY);
          const map: Record<string, DeliveryObservation> = raw ? JSON.parse(raw) : {};
          map[json.data.id] = json.data;
          localStorage.setItem(LOCAL_STORAGE_OBSERVATIONS_KEY, JSON.stringify(map));
        } catch {}
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al guardar observación en servidor:', err);
  }
  return null;
}

/**
 * Elimina una observación por su clave única en el backend central
 */
export async function deleteCentralObservation(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/observations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_OBSERVATIONS_KEY);
        if (raw) {
          const map: Record<string, DeliveryObservation> = JSON.parse(raw);
          delete map[id];
          localStorage.setItem(LOCAL_STORAGE_OBSERVATIONS_KEY, JSON.stringify(map));
        }
      } catch {}
      return true;
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al eliminar observación del servidor:', err);
  }
  return false;
}

// =========================================================================
// TAT BREACHES & FOLLOW-UP CASES API CLIENT
// =========================================================================

const LOCAL_STORAGE_TAT_KEY = 'labflores_tat_cases_store';

/**
 * Carga todos los casos de seguimiento TAT desde el backend centralizado
 */
export async function fetchCentralTATCases(): Promise<TATCase[]> {
  try {
    const res = await fetch(`/api/tat/breaches?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const normalizedCases: TATCase[] = json.data.map((item: any) => ({
          ...item,
          tipoAtencion: (item.os && item.os.trim().toUpperCase().endsWith('(E)')) ? 'URGENCIA' : 'RUTINA',
          practica: item.practica || item.estudio || item.nombreEstudio || '',
          observaciones: item.observaciones !== undefined ? item.observaciones : (item.observacion || ''),
          autorObservacion: item.autorObservacion || undefined,
          fechaObservacion: item.fechaObservacion || undefined,
          historialObservaciones: Array.isArray(item.historialObservaciones) ? item.historialObservaciones : [],
          statusLIS: item.statusLIS || item.estadoLIS || 'En proceso',
          tiempoAtrasoDias: item.tiempoAtrasoDias !== undefined ? item.tiempoAtrasoDias : (item.demoraMinutos ? Math.ceil(item.demoraMinutos / 1440) : 1),
          estadoSeguimiento: item.estadoSeguimiento || 'EN PROCESO',
        }));

        try {
          localStorage.setItem(LOCAL_STORAGE_TAT_KEY, JSON.stringify(normalizedCases));
        } catch {}
        return normalizedCases;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al obtener casos TAT del servidor, usando local:', err);
  }

  // Fallback a localStorage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TAT_KEY);
    if (raw) {
      const parsed: TATCase[] = JSON.parse(raw);
      return parsed.map((item) => ({
        ...item,
        tipoAtencion: item.tipoAtencion || ((item.os && item.os.trim().toUpperCase().endsWith('(E)')) ? 'URGENCIA' : 'RUTINA'),
      }));
    }
  } catch {}
  return [];
}

/**
 * Guarda o actualiza un caso TAT en el servidor centralizado
 */
export async function saveCentralTATCase(tatCase: TATCase): Promise<TATCase | null> {
  try {
    const res = await fetch('/api/tat/breaches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tatCase,
        estudio: tatCase.practica,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al guardar caso TAT en servidor:', err);
  }
  return null;
}

/**
 * Guarda un lote de casos TAT en el servidor centralizado
 */
export async function batchSaveCentralTATCases(cases: TATCase[]): Promise<TATCase[]> {
  try {
    const breachesPayload = cases.map((c) => ({
      ...c,
      estudio: c.practica,
    }));
    const res = await fetch('/api/tat/breaches/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ breaches: breachesPayload }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        try {
          localStorage.setItem(LOCAL_STORAGE_TAT_KEY, JSON.stringify(cases));
        } catch {}
        return cases;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al guardar lote TAT en servidor:', err);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_TAT_KEY, JSON.stringify(cases));
  } catch {}
  return cases;
}

/**
 * Actualiza el estado de un caso TAT
 */
export async function updateCentralTATStatus(
  id: string,
  newStatus: string,
  userEmail: string,
  motivo?: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/tat/breaches/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newStatus,
        motivo: motivo || `Cambio a ${newStatus}`,
        userEmail,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[CentralAPI] Error al actualizar estado TAT en servidor:', err);
    return false;
  }
}

/**
 * Actualiza la observación de un caso TAT de forma persistente y atómica
 */
export async function updateCentralTATObservation(
  id: string,
  texto: string,
  userEmail: string,
  caseMetadata?: Partial<TATCase>
): Promise<TATCase | null> {
  try {
    const res = await fetch(`/api/tat/breaches/${encodeURIComponent(id)}/observation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texto,
        userEmail,
        ...caseMetadata,
        estudio: caseMetadata?.practica || undefined,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const updatedItem = json.data;
        const normalized: TATCase = {
          ...updatedItem,
          practica: updatedItem.practica || updatedItem.estudio || updatedItem.nombreEstudio || '',
          observaciones: updatedItem.observaciones !== undefined ? updatedItem.observaciones : (updatedItem.observacion || ''),
          autorObservacion: updatedItem.autorObservacion || userEmail,
          fechaObservacion: updatedItem.fechaObservacion || updatedItem.fechaUltimaModificacion,
          historialObservaciones: Array.isArray(updatedItem.historialObservaciones) ? updatedItem.historialObservaciones : [],
        };
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_TAT_KEY);
          if (raw) {
            const list: TATCase[] = JSON.parse(raw);
            const idx = list.findIndex((c) => c.id === id);
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...normalized };
            } else {
              list.push(normalized);
            }
            localStorage.setItem(LOCAL_STORAGE_TAT_KEY, JSON.stringify(list));
          }
        } catch {}
        return normalized;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al actualizar observación TAT en servidor:', err);
  }
  return null;
}

const LOCAL_STORAGE_TAT_SUMMARIES_KEY = 'labflores_tat_summaries';

/**
 * Recupera todos los resúmenes diarios propios del módulo TAT
 */
export async function fetchCentralTATSummaries(): Promise<TATDailySummary[]> {
  try {
    const res = await fetch('/api/tat/summaries', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        try {
          localStorage.setItem(LOCAL_STORAGE_TAT_SUMMARIES_KEY, JSON.stringify(json.data));
        } catch {}
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al recuperar resúmenes diarios TAT:', err);
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TAT_SUMMARIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/**
 * Guarda o actualiza un resumen diario propio del módulo TAT
 */
export async function saveCentralTATSummary(summary: TATDailySummary): Promise<TATDailySummary | null> {
  try {
    const res = await fetch('/api/tat/summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_TAT_SUMMARIES_KEY);
          const list: TATDailySummary[] = raw ? JSON.parse(raw) : [];
          const idx = list.findIndex((s) => s.fecha === summary.fecha);
          if (idx >= 0) {
            list[idx] = json.data;
          } else {
            list.push(json.data);
          }
          localStorage.setItem(LOCAL_STORAGE_TAT_SUMMARIES_KEY, JSON.stringify(list));
        } catch {}
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[CentralAPI] Error al guardar resumen diario TAT:', err);
  }
  return null;
}

// =========================================================================
// UNIFIED LOAD / SAVE HANDLERS (Exported for App components)
// =========================================================================

/**
 * Load all historical daily delivery entries (Server first, IndexedDB fallback)
 */
export async function loadAllDailyDeliveries(): Promise<DailyDeliveryEntry[]> {
  const central = await fetchCentralDeliveries();
  if (central && central.length > 0) {
    return central;
  }
  return loadAllFromIndexedDB();
}

/**
 * Save or update a single daily delivery entry (Centralized server + local cache)
 */
export async function saveDailyDeliveryEntry(entry: DailyDeliveryEntry): Promise<void> {
  await saveCentralDelivery(entry);
}

/**
 * Delete a single daily delivery entry by ISO date
 */
export async function deleteDailyDeliveryEntry(fechaISO: string): Promise<void> {
  await deleteCentralDelivery(fechaISO);
}

/**
 * Load specific day by date
 */
export async function loadDailyDeliveryByDate(fechaISO: string): Promise<DailyDeliveryEntry | null> {
  try {
    const res = await fetch(`/api/deliveries/${fechaISO}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
    }
  } catch {
    // Fallback to local
  }

  const all = await loadAllFromIndexedDB();
  return all.find((d) => d.fecha === fechaISO) || null;
}

// =========================================================================
// LOCAL STORAGE & INDEXEDDB UTILITIES (Resilience & Caching)
// =========================================================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no está disponible en este entorno.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(DAILY_STORE_NAME)) {
        db.createObjectStore(DAILY_STORE_NAME, { keyPath: 'fecha' });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export function getInitialSeededDeliveries(): DailyDeliveryEntry[] {
  if (INITIAL_INTRADAY_RECORDS && INITIAL_INTRADAY_RECORDS.length > 0) {
    const entry18 = buildDailyDeliveryEntry(
      INITIAL_INTRADAY_RECORDS,
      '2026-08-18',
      'entregas_18_08_2026.csv',
      '18/08/2026 18:00',
      'preanalitica@labflores.com.ar'
    );
    return [entry18];
  }
  return [];
}

async function loadAllFromIndexedDB(): Promise<DailyDeliveryEntry[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([DAILY_STORE_NAME], 'readonly');
      const store = transaction.objectStore(DAILY_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result as DailyDeliveryEntry[]) || [];
        db.close();
        if (results.length > 0) {
          results.sort((a, b) => b.fecha.localeCompare(a.fecha));
          resolve(results);
        } else {
          const ls = loadFromLocalStorage();
          resolve(ls.length > 0 ? ls : getInitialSeededDeliveries());
        }
      };

      req.onerror = () => {
        db.close();
        const ls = loadFromLocalStorage();
        resolve(ls.length > 0 ? ls : getInitialSeededDeliveries());
      };
    });
  } catch {
    const ls = loadFromLocalStorage();
    return ls.length > 0 ? ls : getInitialSeededDeliveries();
  }
}

async function saveAllToIndexedDB(entries: DailyDeliveryEntry[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DAILY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DAILY_STORE_NAME);

      entries.forEach((entry) => {
        store.put(entry);
      });

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.warn('Error al guardar caché en IndexedDB:', err);
  }
}

async function saveDailyDeliveryToIndexedDB(entry: DailyDeliveryEntry): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DAILY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DAILY_STORE_NAME);

      store.put(entry);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.warn('Error al guardar en IndexedDB:', err);
  }
}

async function deleteFromIndexedDB(fechaISO: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DAILY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DAILY_STORE_NAME);

      store.delete(fechaISO);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.warn('Error al eliminar de IndexedDB:', err);
  }
}

export async function clearAllDailyDeliveries(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([DAILY_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DAILY_STORE_NAME);

      store.clear();

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.warn('Error al limpiar entregas de IndexedDB:', err);
  }
}

function loadFromLocalStorage(): DailyDeliveryEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DAILY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveIntradayDataset(
  records: IntradayRecord[],
  customDate?: Date | string
): Promise<StorageMetadata> {
  const db = await openDB();
  const now = customDate ? (typeof customDate === 'string' ? new Date(customDate) : customDate) : new Date();
  const safeDate = isNaN(now.getTime()) ? new Date() : now;
  const iso = safeDate.toISOString();
  const formatted = formatToDDMMYYYYHHmm(safeDate);
  const sanitized = sanitizeRecordsForStorage(records);

  const metadata: StorageMetadata = {
    lastUpdatedISO: iso,
    lastUpdatedFormatted: formatted,
    recordCount: sanitized.length,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    store.put(sanitized, RECORDS_KEY);
    store.put(metadata, META_KEY);

    transaction.oncomplete = () => {
      db.close();
      resolve(metadata);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function loadIntradayDataset(): Promise<{
  records: IntradayRecord[];
  metadata: StorageMetadata | null;
} | null> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      const reqRecords = store.get(RECORDS_KEY);
      const reqMeta = store.get(META_KEY);

      transaction.oncomplete = () => {
        const records = (reqRecords.result as IntradayRecord[]) || [];
        const metadata = (reqMeta.result as StorageMetadata) || null;
        db.close();

        if (!records || records.length === 0) {
          resolve(null);
        } else {
          resolve({
            records,
            metadata,
          });
        }
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (err) {
    console.warn('No se pudo acceder a IndexedDB:', err);
    return null;
  }
}

export async function clearIntradayDataset(): Promise<void> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      store.delete(RECORDS_KEY);
      store.delete(META_KEY);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch {
    // ignore
  }
}
