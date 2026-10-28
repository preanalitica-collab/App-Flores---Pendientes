import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  setLogLevel,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import {
  DailyDeliveryEntry,
  MonthlyMasterDataset,
  DeliveryObservation,
  IncumplimientoTAT,
  IntradayRecord,
} from '../src/types';

export interface UploadedFileAuditLog {
  id: string;
  nombreArchivo: string;
  tamanoArchivo?: string;
  fechaISO: string;
  fechaCarga: string;
  usuarioCarga: string;
  tipo: 'ENTREGA_DIARIA' | 'BASE_MENSUAL' | 'TAT';
  tipoCarga?: 'ENTREGAS_DIARIAS' | 'TAT' | 'BASE_MENSUAL';
  totalFilas?: number;
  totalPracticas?: number;
  reemplazo?: boolean;
  contenidoPreview?: string;
}

let firestoreInstance: Firestore | null = null;
let firebaseInitialized = false;

// =========================================================================
// RESILIENT CIRCUIT BREAKER: FIRESTORE QUOTA PROTECTION
// =========================================================================
let firestoreQuotaExceeded = false;
let firestoreQuotaCooldownUntil = 0;

export function isFirestoreQuotaExceeded(): boolean {
  if (!firestoreQuotaExceeded) return false;
  if (Date.now() > firestoreQuotaCooldownUntil) {
    firestoreQuotaExceeded = false;
    return false;
  }
  return true;
}

export function markFirestoreQuotaExceeded(context: string): void {
  if (!firestoreQuotaExceeded) {
    firestoreQuotaExceeded = true;
    firestoreQuotaCooldownUntil = Date.now() + 30 * 60 * 1000; // 30 min cooldown
    console.warn(`[FirebaseStore] Aviso: Cuota diaria de Firestore alcanzada (${context}). Modo local resiliente activo en central_database.json.`);
  }
}

export function handleFirestoreError(context: string, err: any): void {
  const errMsg = err?.message || String(err);
  const isQuota =
    err?.code === 'resource-exhausted' ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('free tier database');

  if (isQuota) {
    markFirestoreQuotaExceeded(context);
  } else {
    console.warn(`[FirebaseStore] Aviso en ${context}: ${errMsg}`);
  }
}

export function getFirestoreSyncStatus(): {
  isConfigured: boolean;
  isQuotaExceeded: boolean;
  mode: 'cloud_synced' | 'local_resilient';
  message: string;
} {
  const quota = isFirestoreQuotaExceeded();
  return {
    isConfigured: firebaseInitialized,
    isQuotaExceeded: quota,
    mode: quota ? 'local_resilient' : (firebaseInitialized ? 'cloud_synced' : 'local_resilient'),
    message: quota
      ? 'Cuota diaria de Firestore alcanzada. Operando en modo local resiliente con persistencia central continua.'
      : (firebaseInitialized ? 'Sincronización en la nube activa.' : 'Almacenamiento local centralizado activo.'),
  };
}

export function getFirestoreDB(): Firestore | null {
  if (isFirestoreQuotaExceeded()) return null;
  if (firestoreInstance) return firestoreInstance;

  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) {
      console.warn('[FirebaseStore] firebase-applet-config.json no encontrado.');
      return null;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.projectId || !config.apiKey) {
      console.warn('[FirebaseStore] Configuración de Firebase incompleta.');
      return null;
    }

    try {
      setLogLevel('error');
    } catch {
      // Ignore if setLogLevel is not permitted
    }

    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    const databaseId = config.firestoreDatabaseId || '(default)';
    firestoreInstance = getFirestore(app, databaseId);
    firebaseInitialized = true;
    console.log(`[FirebaseStore] Conectado exitosamente a Firestore en proyecto ${config.projectId} (DB: ${databaseId})`);
    return firestoreInstance;
  } catch (err) {
    handleFirestoreError('inicialización de Firestore', err);
    return null;
  }
}

// =========================================================================
// FIRESTORE SYNC: DELIVERIES (CON SOPORTE PARA DATASETS GRANDES / CHUNKING)
// =========================================================================

const RECORDS_CHUNK_SIZE = 300; // ~30-50KB por chunk (muy por debajo del límite de 1MB)

function cleanFirestoreObject<T>(obj: T): any {
  return JSON.parse(JSON.stringify(obj));
}

export async function fetchAllDeliveriesFromFirestore(): Promise<DailyDeliveryEntry[] | null> {
  if (isFirestoreQuotaExceeded()) return null;
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const colRef = collection(db, 'deliveries');
    const snapshot = await getDocs(colRef);
    const results: DailyDeliveryEntry[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as any;
      if (!data || !data.fecha) continue;

      let records: IntradayRecord[] = Array.isArray(data.records) ? data.records : [];

      // Optimización de cuota: solo recuperar chunks si no se ha excedido la cuota
      const isRecentDate = data.fecha >= '2026-09-01';
      if ((data.hasChunks || records.length === 0) && isRecentDate && !isFirestoreQuotaExceeded()) {
        try {
          const chunksColRef = collection(db, 'deliveries', docSnap.id, 'chunks');
          const chunksSnapshot = await getDocs(chunksColRef);
          if (!chunksSnapshot.empty) {
            const chunkDocs = chunksSnapshot.docs.map((c) => c.data() as { chunkIndex: number; records: IntradayRecord[] });
            chunkDocs.sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
            const assembledRecords: IntradayRecord[] = [];
            chunkDocs.forEach((c) => {
              if (Array.isArray(c.records)) {
                assembledRecords.push(...c.records);
              }
            });
            records = assembledRecords;
          }
        } catch (chunkErr) {
          handleFirestoreError(`lectura de chunks para ${docSnap.id}`, chunkErr);
        }
      }

      results.push({
        ...data,
        records,
      });
    }

    console.log(`[FirebaseStore] ${results.length} entregas diarias recuperadas desde Firestore.`);
    return results.sort((a, b) => b.fecha.localeCompare(a.fecha));
  } catch (err) {
    handleFirestoreError('consultar entregas diarias en Firestore', err);
    return null;
  }
}

export async function saveDeliveryToFirestore(entry: DailyDeliveryEntry): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const rawRecords = entry.records || [];
    const chunks: IntradayRecord[][] = [];

    for (let i = 0; i < rawRecords.length; i += RECORDS_CHUNK_SIZE) {
      chunks.push(rawRecords.slice(i, i + RECORDS_CHUNK_SIZE));
    }

    // Separar records del encabezado principal para no exceder el límite de 1MB
    const { records, archivoOriginal, ...entryHeader } = entry;

    // Limpiar archivo original si excede 200KB para el documento raíz
    let safeArchivoOriginal = archivoOriginal;
    if (archivoOriginal && archivoOriginal.length > 200000) {
      safeArchivoOriginal = archivoOriginal.substring(0, 10000) + '... [truncado por tamaño en Firestore]';
    }

    const cleanedHeader = cleanFirestoreObject({
      ...entryHeader,
      archivoOriginal: safeArchivoOriginal,
      recordsCount: rawRecords.length,
      hasChunks: chunks.length > 0,
      chunksCount: chunks.length,
      updatedAtServer: new Date().toISOString(),
    });

    // Guardar encabezado principal y chunks de registros de forma atómica en lotes
    // 1. Escribir documento principal
    const mainDocRef = doc(db, 'deliveries', entry.fecha);
    await setDoc(mainDocRef, cleanedHeader);

    // 2. Escribir chunks de registros (en lotes de hasta 400 escrituras)
    if (chunks.length > 0) {
      const BATCH_LIMIT = 400;
      for (let b = 0; b < chunks.length; b += BATCH_LIMIT) {
        if (isFirestoreQuotaExceeded()) break;
        const batch = writeBatch(db);
        const currentSlice = chunks.slice(b, b + BATCH_LIMIT);
        currentSlice.forEach((chunk, relIdx) => {
          const absoluteIdx = b + relIdx;
          const chunkRef = doc(db, 'deliveries', entry.fecha, 'chunks', `chunk_${String(absoluteIdx).padStart(4, '0')}`);
          batch.set(chunkRef, {
            chunkIndex: absoluteIdx,
            totalChunks: chunks.length,
            recordsCount: chunk.length,
            records: cleanFirestoreObject(chunk),
          });
        });
        await batch.commit();
      }
    }

    console.log(`[FirebaseStore] Entrega diaria para ${entry.fecha} persistida en Firestore (${rawRecords.length} registros en ${chunks.length} chunks).`);
    return true;
  } catch (err) {
    handleFirestoreError(`guardar entrega para ${entry.fecha} en Firestore`, err);
    return false;
  }
}

export async function deleteDeliveryFromFirestore(fecha: string): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    // Eliminar chunks primero
    const chunksColRef = collection(db, 'deliveries', fecha, 'chunks');
    const chunksSnapshot = await getDocs(chunksColRef);
    if (!chunksSnapshot.empty) {
      const batch = writeBatch(db);
      chunksSnapshot.docs.forEach((c) => batch.delete(c.ref));
      batch.delete(doc(db, 'deliveries', fecha));
      await batch.commit();
    } else {
      const docRef = doc(db, 'deliveries', fecha);
      await deleteDoc(docRef);
    }
    console.log(`[FirebaseStore] Entrega diaria para ${fecha} eliminada de Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError(`eliminar entrega ${fecha} de Firestore`, err);
    return false;
  }
}

// =========================================================================
// FIRESTORE SYNC: OBSERVATIONS
// =========================================================================

function sanitizeDocId(id: string): string {
  // Reemplazar caracteres no permitidos en IDs de Firestore
  return id.replace(/[\/\\]/g, '_');
}

export async function fetchAllObservationsFromFirestore(): Promise<Record<string, DeliveryObservation> | null> {
  if (isFirestoreQuotaExceeded()) return null;
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const colRef = collection(db, 'observations');
    const snapshot = await getDocs(colRef);
    const map: Record<string, DeliveryObservation> = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as DeliveryObservation;
      if (data && data.id) {
        map[data.id] = data;
      }
    });
    console.log(`[FirebaseStore] ${Object.keys(map).length} observaciones recuperadas desde Firestore.`);
    return map;
  } catch (err) {
    handleFirestoreError('consultar observaciones en Firestore', err);
    return null;
  }
}

export async function saveObservationToFirestore(obs: DeliveryObservation): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const safeId = sanitizeDocId(obs.id);
    const docRef = doc(db, 'observations', safeId);
    await setDoc(docRef, {
      ...obs,
      updatedAtServer: new Date().toISOString(),
    });
    console.log(`[FirebaseStore] Observación ${obs.id} persistida en Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError(`guardar observación ${obs.id} en Firestore`, err);
    return false;
  }
}

export async function deleteObservationFromFirestore(id: string): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const safeId = sanitizeDocId(id);
    const docRef = doc(db, 'observations', safeId);
    await deleteDoc(docRef);
    console.log(`[FirebaseStore] Observación ${id} eliminada de Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError(`eliminar observación ${id} de Firestore`, err);
    return false;
  }
}

// =========================================================================
// FIRESTORE SYNC: MONTHLY DATASET
// =========================================================================

export async function fetchMonthlyDatasetFromFirestore(): Promise<MonthlyMasterDataset | null> {
  if (isFirestoreQuotaExceeded()) return null;
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const docRef = doc(db, 'monthly_periods', 'master_dataset');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data() as { dataset: MonthlyMasterDataset };
      if (data && data.dataset) {
        console.log('[FirebaseStore] Dataset mensual maestro recuperado desde Firestore.');
        return data.dataset;
      }
    }
    return null;
  } catch (err) {
    handleFirestoreError('consultar dataset mensual en Firestore', err);
    return null;
  }
}

export async function saveMonthlyDatasetToFirestore(dataset: MonthlyMasterDataset, updatedBy: string): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const docRef = doc(db, 'monthly_periods', 'master_dataset');
    await setDoc(docRef, {
      dataset,
      updatedAtServer: new Date().toISOString(),
      updatedBy,
    });
    console.log('[FirebaseStore] Dataset mensual maestro persistido en Firestore.');
    return true;
  } catch (err) {
    handleFirestoreError('guardar dataset mensual en Firestore', err);
    return false;
  }
}

// =========================================================================
// FIRESTORE SYNC: FILE UPLOAD HISTORY & AUDIT LOGS
// =========================================================================

export async function fetchFileAuditLogsFromFirestore(): Promise<UploadedFileAuditLog[] | null> {
  if (isFirestoreQuotaExceeded()) return null;
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const colRef = collection(db, 'files_history');
    const snapshot = await getDocs(colRef);
    const logs: UploadedFileAuditLog[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as UploadedFileAuditLog;
      if (data) logs.push(data);
    });
    return logs.sort((a, b) => b.id.localeCompare(a.id));
  } catch (err) {
    handleFirestoreError('consultar historial de archivos en Firestore', err);
    return null;
  }
}

export async function logFileUploadToFirestore(log: UploadedFileAuditLog): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const docRef = doc(db, 'files_history', log.id);
    await setDoc(docRef, {
      ...log,
      timestamp: new Date().toISOString(),
    });
    console.log(`[FirebaseStore] Registro de auditoría de archivo ${log.nombreArchivo} (${log.fechaISO}) guardado en Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError(`registrar archivo ${log.nombreArchivo} en auditoría Firestore`, err);
    return false;
  }
}

// =========================================================================
// FIRESTORE SYNC: TAT BREACHES (Incumplimientos TAT)
// =========================================================================

export async function fetchAllTATBreachesFromFirestore(): Promise<Record<string, IncumplimientoTAT> | null> {
  if (isFirestoreQuotaExceeded()) return null;
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const colRef = collection(db, 'tat_breaches');
    const snapshot = await getDocs(colRef);
    const map: Record<string, IncumplimientoTAT> = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as IncumplimientoTAT;
      if (data && data.id) {
        map[data.id] = data;
      }
    });
    console.log(`[FirebaseStore] ${Object.keys(map).length} incumplimientos TAT recuperados desde Firestore.`);
    return map;
  } catch (err) {
    handleFirestoreError('consultar incumplimientos TAT en Firestore', err);
    return null;
  }
}

export async function saveTATBreachToFirestore(breach: IncumplimientoTAT): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const safeId = sanitizeDocId(breach.id);
    const docRef = doc(db, 'tat_breaches', safeId);
    await setDoc(
      docRef,
      {
        ...breach,
        updatedAtServer: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`[FirebaseStore] Incumplimiento TAT ${breach.id} persistido en Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError(`guardar incumplimiento TAT ${breach.id} en Firestore`, err);
    return false;
  }
}

export async function updateTATObservationInFirestore(
  id: string,
  partialData: {
    id: string;
    observacion: string;
    observaciones: string;
    autorObservacion: string;
    fechaObservacion: string;
    usuarioUltimaModificacion: string;
    fechaUltimaModificacion: string;
    ultimaModificacionObs?: {
      usuario: string;
      fechaHora: string;
    };
    historialObservaciones?: any[];
  }
): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const safeId = sanitizeDocId(id);
    const docRef = doc(db, 'tat_breaches', safeId);
    await setDoc(
      docRef,
      {
        ...partialData,
        updatedAtServer: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`[FirebaseStore] Observación de caso TAT ${id} actualizada parcialmente en Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError(`actualizar observación TAT ${id} en Firestore`, err);
    return false;
  }
}

export async function batchSaveTATBreachesToFirestore(breaches: IncumplimientoTAT[]): Promise<boolean> {
  if (isFirestoreQuotaExceeded() || !breaches.length) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    for (const b of breaches) {
      if (isFirestoreQuotaExceeded()) break;
      const safeId = sanitizeDocId(b.id);
      const docRef = doc(db, 'tat_breaches', safeId);
      await setDoc(docRef, {
        ...b,
        updatedAtServer: new Date().toISOString(),
      });
    }
    console.log(`[FirebaseStore] ${breaches.length} incumplimientos TAT guardados en Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError('guardado por lote de incumplimientos TAT en Firestore', err);
    return false;
  }
}

export async function deleteTATBreachFromFirestore(id: string): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const safeId = sanitizeDocId(id);
    const docRef = doc(db, 'tat_breaches', safeId);
    await deleteDoc(docRef);
    console.log(`[FirebaseStore] Incumplimiento TAT ${id} eliminado de Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError(`eliminar incumplimiento TAT ${id} de Firestore`, err);
    return false;
  }
}

// =========================================================================
// FIRESTORE SYNC: TAT SUMMARIES (RESÚMENES DIARIOS PROPIOS DEL MÓDULO TAT)
// =========================================================================

export async function fetchAllTATSummariesFromFirestore(): Promise<any[] | null> {
  if (isFirestoreQuotaExceeded()) return null;
  const db = getFirestoreDB();
  if (!db) return null;

  try {
    const colRef = collection(db, 'tat_summaries');
    const snapshot = await getDocs(colRef);
    const summaries: any[] = [];
    snapshot.forEach((d) => {
      summaries.push(d.data());
    });
    console.log(`[FirebaseStore] ${summaries.length} resúmenes diarios TAT leídos desde Firestore.`);
    return summaries;
  } catch (err) {
    handleFirestoreError('leer resúmenes diarios TAT desde Firestore', err);
    return null;
  }
}

export async function saveTATSummaryToFirestore(summary: any): Promise<boolean> {
  if (isFirestoreQuotaExceeded() || !summary?.fecha) return false;
  const db = getFirestoreDB();
  if (!db) return false;

  try {
    const docRef = doc(db, 'tat_summaries', summary.fecha);
    await setDoc(docRef, {
      ...summary,
      updatedAtServer: new Date().toISOString(),
    });
    console.log(`[FirebaseStore] Resumen diario TAT ${summary.fecha} guardado en Firestore.`);
    return true;
  } catch (err) {
    handleFirestoreError(`guardar resumen diario TAT ${summary.fecha} en Firestore`, err);
    return false;
  }
}


