import {
  IntradayRecord,
  ConsolidatedPractice,
  IntradayKPIs,
  IntradayHourlySnapshot,
  OperationalStatusGroup,
  OperationalAIInsight,
  DailyDeliveryEntry,
  DailyComparisonSummary,
  IncumplimientoTAT,
  DailyComparisonDetails,
  TATCase,
  TATKPISummary,
  MonthlyTATMetric,
  TATPeriodKPIs,
  MonthName,
  ResumenMensualRow,
  MorningTATProcessingResult,
  TATDailySummary,
  TipoAtencionOS,
} from '../types';
import { formatToDDMMYYYYHHmm } from './storageService';

/**
 * Obtiene la fecha local actual del dispositivo/usuario en formato ISO "YYYY-MM-DD"
 * Utiliza estrictamente la zona horaria local (sin conversión a UTC) para evitar desfases de fecha.
 */
export function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convierte una fecha ISO "YYYY-MM-DD" a formato argentino/local "DD/MM/YYYY"
 */
export function formatISOToDisplayDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  if (isoDate === 'TODAS') return 'Todas las fechas';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

/**
 * Convierte un objeto Date a formato local "DD/MM/YYYY"
 */
export function formatDateToDisplayDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Normaliza cualquier texto removiendo tildes, diacríticos, espacios redundantes
 * y convirtiendo a minúsculas para comparaciones precisas e insensibles.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos/tildes
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza el identificador de Orden de Servicio (OS) para garantizar la regla de unicidad (NIVEL 3).
 * - Elimina espacios iniciales y finales.
 * - Limpia comillas o artefactos de fórmulas Excel (ej. ="014-...").
 * - Si contiene información adicional como el nombre del paciente (ej. "014-67764-8 - Moreno Crespin"),
 *   extrae exclusivamente el identificador de OS ("014-67764-8").
 * - No utiliza PAC, código de barras ni recipientes para definir una OS única.
 */
export function normalizeOSCode(rawOS: string | null | undefined): string {
  if (!rawOS) return '';
  let cleaned = rawOS.trim().replace(/^="?|"$/g, '');
  const hasEmergencia = cleaned.toUpperCase().includes('(E)');
  if (cleaned.includes(' - ')) {
    cleaned = cleaned.split(' - ')[0].trim();
  }
  if (hasEmergencia && !cleaned.toUpperCase().includes('(E)')) {
    cleaned = `${cleaned} (E)`;
  }
  return cleaned.trim();
}

/**
 * Determina si una Orden de Servicio (OS) corresponde a Emergencias.
 * Regla: Toda OS cuyo valor contenga "(E)" (mayúscula o minúscula) corresponde a Emergencias.
 */
export function isEmergenciaOS(rawOS: string | null | undefined): boolean {
  if (!rawOS) return false;
  return rawOS.toUpperCase().includes('(E)');
}

/**
 * Determina si una Orden de Servicio (OS) corresponde a Calidad Analítica / controles internos.
 * Regla maestra: Toda OS cuyo número comience con "016" corresponde a Calidad Analítica
 * y NO representa un paciente real. Se excluye completamente de todos los cálculos de cumplimiento de plazos.
 */
export function isOSCalidadAnalitica(rawOS: string | null | undefined): boolean {
  if (!rawOS) return false;
  const cleaned = normalizeOSCode(rawOS).replace(/\s+/g, '');
  return cleaned.startsWith('016');
}

/**
 * Clasifica una Orden de Servicio (OS) según si corresponde a Emergencias (URGENCIA) o RUTINA.
 * Regla: Toda OS cuyo valor termine con "(E)" se clasifica como URGENCIA.
 * El resto de las OS se clasifica como RUTINA.
 * Respeta el valor original de la OS sin modificarlo ni recortarlo.
 */
export function getTipoAtencion(rawOS: string | null | undefined): TipoAtencionOS {
  if (!rawOS) return 'RUTINA';
  const clean = rawOS.trim();
  if (clean.toUpperCase().endsWith('(E)')) {
    return 'URGENCIA';
  }
  return 'RUTINA';
}

/**
 * Genera un identificador único, estable y normalizado para una práctica clínica en una OS.
 * Identifica la práctica por: OS + estudio (o código de examen)
 */
export function getPracticeObservationKey(os: string | null | undefined, estudio: string | null | undefined): string {
  const cleanOS = normalizeOSCode(os);
  const normStudy = normalizeText(estudio);
  return `${cleanOS}___${normStudy}`;
}

export function getConsolidatedPracticeKey(
  fechaPrometida: string | null | undefined,
  os: string | null | undefined,
  estudio: string | null | undefined
): string {
  const cleanDate = fechaPrometida ? fechaPrometida.trim() : '';
  const cleanOS = normalizeOSCode(os);
  const cleanStudy = normalizeText(estudio);
  return `${cleanDate}___${cleanOS}___${cleanStudy}`;
}

/**
 * Genera la clave única estricta para el Módulo TAT: OS + Práctica/Estudio
 * Esta clave garantiza idempotencia y evita duplicados al cargar archivos subsecuentes.
 */
export function getTATCaseKey(os: string | null | undefined, estudio: string | null | undefined): string {
  const cleanOS = normalizeOSCode(os);
  const cleanStudy = normalizeText(estudio);
  return `${cleanOS}___${cleanStudy}`;
}

/**
 * Parsea una fecha ISO (YYYY-MM-DD) o local (DD/MM/YYYY) a un objeto Date local (a las 00:00:00)
 */
export function parseDateOnly(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 0, 0, 0, 0);
    }
  } else if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  return null;
}

/**
 * Parsea una fecha y hora prometida a un objeto Date local
 */
export function parsePromisedDateTime(
  fechaPrometida: string | null | undefined,
  horaPrometida: string | null | undefined
): Date | null {
  if (!fechaPrometida) return null;
  let y = 0,
    m = 0,
    d = 0;
  if (fechaPrometida.includes('-')) {
    const parts = fechaPrometida.split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else if (fechaPrometida.includes('/')) {
    const parts = fechaPrometida.split('/');
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    y = parseInt(parts[2], 10);
  }
  if (!y || isNaN(y) || isNaN(m) || isNaN(d)) return null;

  let hh = 18,
    mm = 0,
    ss = 0;
  if (horaPrometida) {
    const timeParts = horaPrometida.split(':');
    hh = parseInt(timeParts[0], 10) || 0;
    mm = parseInt(timeParts[1], 10) || 0;
    ss = parseInt(timeParts[2] || '0', 10) || 0;
  }
  return new Date(y, m, d, hh, mm, ss);
}

/**
 * Calcula los días de retraso exactos: Fecha Actual - Fecha Prometida (en días enteros)
 */
export function calculateDelayDays(fechaPrometidaStr: string | null | undefined, fechaReferencia: Date = new Date()): number {
  const pDate = parseDateOnly(fechaPrometidaStr);
  if (!pDate) return 0;
  const refDate = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), fechaReferencia.getDate(), 0, 0, 0, 0);
  const diffMs = refDate.getTime() - pDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcula los minutos de retraso transcurridos entre la fecha prometida y la fecha de corte/evaluación
 */
export function calculateDelayMinutes(promisedDate: Date | null, evaluationDate: Date = new Date()): number {
  if (!promisedDate) return 0;
  const diffMs = evaluationDate.getTime() - promisedDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * Formatea los minutos de demora a un texto amigable y legible
 */
export function formatDelayDuration(minutes: number): string {
  if (minutes <= 0) return 'Sin demora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  if (hours < 24) {
    return remainingMin > 0 ? `${hours}h ${remainingMin}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export type TimePromiseGroup = 'HASTA_18' | 'DESPUES_18' | 'SIN_HORA_VALIDA';

/**
 * Clasifica la hora prometida de una práctica según la regla operativa:
 * - GRUPO 1 — HASTA LAS 18:00: horaPrometida <= 18:00 (ej. 13:30, 16:00, 18:00)
 * - GRUPO 2 — DESPUÉS DE LAS 18:00: horaPrometida > 18:00 (ej. 18:01, 19:30, 21:00)
 * - SIN HORA VÁLIDA: Si no tiene hora prometida o no tiene formato válido de hora
 */
export function classifyTimePromise(horaPrometida: string | null | undefined): TimePromiseGroup {
  if (!horaPrometida || typeof horaPrometida !== 'string' || !horaPrometida.trim()) {
    return 'SIN_HORA_VALIDA';
  }
  const clean = horaPrometida.trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return 'SIN_HORA_VALIDA';
  }
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return 'SIN_HORA_VALIDA';
  }
  const totalMin = hours * 60 + minutes;
  const threshold18 = 18 * 60; // 1080 min (18:00 hs)
  return totalMin <= threshold18 ? 'HASTA_18' : 'DESPUES_18';
}

/**
 * Regla Crítica de Exclusión:
 * Determina si un estudio corresponde a "Acto Bioquímico" (independiente de mayúsculas, minúsculas,
 * tildes, códigos de examen prefijados o espacios). Estos registros NUNCA deben incluirse en cálculos
 * de prácticas totales, prácticas listas, no listas, OS afectadas, porcentajes ni análisis IA.
 */
export function isActoBioquimico(studyName: string | null | undefined): boolean {
  if (!studyName) return false;
  const norm = normalizeText(studyName);
  return (
    norm.includes('acto bioquimico') ||
    norm.includes('acto bioquim') ||
    norm.includes('acto bioq') ||
    norm === 'acto bioquimico' ||
    norm.startsWith('acto bioquimico') ||
    norm.endsWith('acto bioquimico')
  );
}

/**
 * Determina si el estudio corresponde a un Antibiograma
 */
export function isAntibiograma(studyName: string | null | undefined): boolean {
  if (!studyName) return false;
  const norm = normalizeText(studyName);
  return norm.includes('antibiograma');
}

/**
 * Determina si el registro corresponde a la excepción de Antibiograma No Realizado:
 * En la nueva Regla Maestra, "NO REALIZADO" es LISTO para todas las determinaciones.
 */
export function isAntibiogramaNoRealizado(
  studyName: string | null | undefined,
  status: string | null | undefined
): boolean {
  if (!studyName || !status) return false;
  const normStatus = normalizeText(status);
  return isAntibiograma(studyName) && (normStatus === 'no realizado' || normStatus.includes('no realizado'));
}

/**
 * Devuelve la etiqueta de estado efectiva para visualización y trazabilidad
 */
export function getEffectiveDisplayStatus(
  status: string | null | undefined,
  studyName?: string | null | undefined
): string {
  if (isAntibiogramaNoRealizado(studyName, status)) {
    return 'NO APLICA / FINALIZADO';
  }
  return status || 'Sin estado';
}

/**
 * REGLA MAESTRA DE STATUS DEL LIS
 * 
 * STATUS = LISTO:
 * - ENVIADO POR E-MAIL (o email)
 * - CONSULTADO ONLINE (o consultado on line)
 * - IMPRESO ARCHIVO
 * - IMPRESO
 * - SIN INFORME
 * - NO REALIZADO
 * - ENTREGADO
 * - IMPRESO HOLD
 * - FINALIZADA / NO APLICA / INFORMADO
 * 
 * STATUS = NO LISTO:
 * - ESPERANDO EN UNIDAD
 * - EN PROCESO
 * - A FIRMAR
 * - CUARENTENA
 * - RESULTADO EN INTERFACE (o en interface)
 * 
 * STATUS DESCONOCIDO:
 * - Cualquier otro status no clasificado en la Regla Maestra.
 */
export function classifyOperationalStatus(
  status: string | null | undefined,
  _studyName?: string | null | undefined
): OperationalStatusGroup {
  if (!status) return 'DESCONOCIDO';
  const norm = normalizeText(status);

  // 1. STATUS = LISTO
  if (
    norm === 'enviado por e-mail' ||
    norm === 'enviado por email' ||
    norm === 'consultado online' ||
    norm === 'consultado on line' ||
    norm === 'impreso archivo' ||
    norm === 'impreso' ||
    norm === 'sin informe' ||
    norm === 'no realizado' ||
    norm === 'entregado' ||
    norm === 'impreso hold' ||
    norm === 'hold' ||
    norm === 'finalizada / no aplica' ||
    norm === 'no aplica / finalizado' ||
    norm === 'informado'
  ) {
    return 'LISTO';
  }

  // 2. STATUS = NO LISTO
  if (
    norm === 'esperando en unidad' ||
    norm === 'en proceso' ||
    norm === 'a firmar' ||
    norm === 'cuarentena' ||
    norm === 'resultado en interface' ||
    norm === 'en interface'
  ) {
    return 'NO_LISTO';
  }

  return 'DESCONOCIDO';
}

/**
 * Mapea un estado técnico de LIS no-listo a una de las 5 categorías operativas estándar
 */
export function normalizeNonReadyStatusCategory(status: string | null | undefined): string {
  if (!status) return 'EN PROCESO';
  const norm = normalizeText(status);
  if (norm.includes('esperando')) return 'ESPERANDO EN UNIDAD';
  if (norm.includes('cuarentena')) return 'CUARENTENA';
  if (norm.includes('firmar')) return 'A FIRMAR';
  if (norm.includes('interface')) return 'RESULTADO EN INTERFACE';
  return 'EN PROCESO';
}

/**
 * Obtiene el estado del registro según el corte horario solicitado
 */
export function getRecordStateAtCut(record: IntradayRecord, cut: string): string {
  switch (cut) {
    case '14:00':
      return record.estadoCorte14 || record.estado;
    case '16:00':
      return record.estadoCorte16 || record.estado;
    case '17:00':
      return record.estadoCorte17 || record.estado;
    case '18:00':
      return record.estadoCorte18 || record.estado;
    default:
      return record.estado;
  }
}

/**
 * Consolida registros físicos del LIS en Prácticas Clínicas (OS + Examen/Estudio)
 * Excluye automáticamente "Acto Bioquímico"
 */
export function consolidateRecordsIntoPractices(
  records: IntradayRecord[],
  cut: string = 'actual'
): ConsolidatedPractice[] {
  const groups = new Map<
    string,
    {
      key: string;
      os: string;
      idPacienteAnon: string;
      nombrePaciente?: string;
      estudio: string;
      sede: string;
      sector: string;
      fechaPrometida: string;
      horaPrometida: string;
      physicalRecords: IntradayRecord[];
      observaciones: string[];
    }
  >();

  records.forEach((record) => {
    // Excluir Acto Bioquímico y órdenes de Calidad Analítica (016)
    if (isActoBioquimico(record.estudio) || isOSCalidadAnalitica(record.os)) {
      return;
    }

    const cleanOS = normalizeOSCode(record.os);
    const key = `${cleanOS}___${normalizeText(record.estudio)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        os: cleanOS,
        idPacienteAnon: record.idPacienteAnon,
        nombrePaciente: record.nombrePaciente,
        estudio: record.estudio,
        sede: record.sede || 'Sin sede',
        sector: record.sector || 'General',
        fechaPrometida: record.fechaPrometida || '',
        horaPrometida: record.horaPrometida || '',
        physicalRecords: [],
        observaciones: [],
      });
    }

    const item = groups.get(key)!;
    if (!item.horaPrometida && record.horaPrometida) {
      item.horaPrometida = record.horaPrometida;
    }
    item.physicalRecords.push(record);
    if (record.observaciones && record.observaciones.trim()) {
      item.observaciones.push(record.observaciones.trim());
    }
  });

  const consolidated: ConsolidatedPractice[] = [];
  const now = new Date();

  groups.forEach((item) => {
    const rawStates = item.physicalRecords.map((r) => getRecordStateAtCut(r, cut));
    const classifiedGroups = rawStates.map((st) => classifyOperationalStatus(st, item.estudio));

    let grupoConsolidado: OperationalStatusGroup = 'LISTO';
    let estadoConsolidado = rawStates[0] || 'Listo';
    const esAntibiogramaNoAplica = false;

    // Regla de consolidación: Si al menos un recipiente NO_LISTO -> La práctica es NO_LISTA
    const nonReadyIndices = classifiedGroups
      .map((g, idx) => (g === 'NO_LISTO' || g === 'PENDIENTE' ? idx : -1))
      .filter((idx) => idx !== -1);

    const nonReadyStatesList = Array.from(new Set(nonReadyIndices.map((i) => rawStates[i])));

    if (nonReadyIndices.length > 0) {
      grupoConsolidado = 'NO_LISTO';
      estadoConsolidado = rawStates[nonReadyIndices[0]];
    } else {
      const desconocidoIndices = classifiedGroups
        .map((g, idx) => (g === 'DESCONOCIDO' ? idx : -1))
        .filter((idx) => idx !== -1);

      if (desconocidoIndices.length > 0) {
        grupoConsolidado = 'DESCONOCIDO';
        estadoConsolidado = rawStates[desconocidoIndices[0]];
      } else {
        grupoConsolidado = 'LISTO';
        estadoConsolidado = rawStates[0] || 'Listo';
      }
    }

    const codigosBarra = item.physicalRecords
      .map((r) => r.codigoBarra?.trim())
      .filter((cb): cb is string => Boolean(cb && cb !== '=""'));

    const promisedDateTime = parsePromisedDateTime(item.fechaPrometida, item.horaPrometida);
    const delayMin = grupoConsolidado === 'NO_LISTO' && promisedDateTime ? calculateDelayMinutes(promisedDateTime, now) : 0;

    let estadoPlazo: 'LISTA' | 'PENDIENTE_DENTRO_PLAZO' | 'FUERA_PLAZO' = 'LISTA';
    if (grupoConsolidado === 'LISTO') {
      estadoPlazo = 'LISTA';
    } else if (delayMin > 0) {
      estadoPlazo = 'FUERA_PLAZO';
    } else {
      estadoPlazo = 'PENDIENTE_DENTRO_PLAZO';
    }

    const tatBreachId = `${item.fechaPrometida || ''}___${normalizeOSCode(item.os)}___${normalizeText(item.estudio)}`;

    consolidated.push({
      id: `prac-${item.key}`,
      os: item.os,
      idPacienteAnon: item.idPacienteAnon,
      nombrePaciente: item.nombrePaciente,
      estudio: item.estudio,
      codigoEstudio: item.estudio?.match(/\((\d+)\)/)?.[1] || undefined,
      sede: item.sede,
      sector: item.sector,
      fechaPrometida: item.fechaPrometida,
      horaPrometida: item.horaPrometida,
      physicalRecords: item.physicalRecords,
      cantidadRecipientes: item.physicalRecords.length,
      codigosBarra,
      estadoConsolidado,
      grupoConsolidado,
      esAntibiogramaNoAplica,
      estadosNoListosPresentes: nonReadyStatesList,
      tieneMultiplesEstadosNoListos: nonReadyStatesList.length > 1,
      estadoPlazo,
      demoraMinutos: delayMin,
      demoraFormateada: formatDelayDuration(delayMin),
      tatBreachId,
      observaciones: item.observaciones.join('; '),
    });
  });

  return consolidated;
}

/**
 * Calcula los indicadores operativos para una fecha y corte horario dado
 * respetando estrictamente los 3 niveles de análisis y las reglas de balance.
 */
export function calculateIntradayKPIs(
  records: IntradayRecord[],
  selectedDate: string,
  selectedCut: string = 'actual'
): IntradayKPIs {
  const filasTotalesDataset = records.length;

  const dateRecords = selectedDate === 'TODAS'
    ? records
    : records.filter((r) => r.fechaPrometida === selectedDate);

  const filasFechaSeleccionada = dateRecords.length;

  // NIVEL 1 — FILAS FÍSICAS DEL LIS Y REGLA DE EXCLUSIÓN DE ACTO BIOQUÍMICO
  const actoBioquimicoCount = dateRecords.filter((r) => isActoBioquimico(r.estudio)).length;
  const validPhysicalRecords = dateRecords.filter((r) => !isActoBioquimico(r.estudio));
  const totalFilasFisicasValidas = validPhysicalRecords.length;

  const esBalanceCuadrado = filasFechaSeleccionada === (actoBioquimicoCount + totalFilasFisicasValidas);

  const recipientesCodigosBarra = validPhysicalRecords.filter(
    (r) => r.codigoBarra && r.codigoBarra.trim() && r.codigoBarra !== '=""'
  ).length || totalFilasFisicasValidas;

  const statusDesconocidosSet = new Set<string>();
  validPhysicalRecords.forEach((r) => {
    const rawState = getRecordStateAtCut(r, selectedCut);
    const grp = classifyOperationalStatus(rawState, r.estudio);
    if (grp === 'DESCONOCIDO') {
      statusDesconocidosSet.add(rawState);
    }
  });
  const statusDesconocidosList = Array.from(statusDesconocidosSet);

  // NIVEL 2 — PRÁCTICAS CLÍNICAS CONSOLIDADAS (OS + Examen/Estudio)
  const consolidatedPractices = consolidateRecordsIntoPractices(dateRecords, selectedCut);
  const practicasValidas = consolidatedPractices.length;
  const practicasPrevistas = practicasValidas;

  const isLikelyPartial = filasTotalesDataset > 0 && filasTotalesDataset < 250;

  let practicasListas = 0;
  let practicasNoListas = 0;
  let practicasDesconocidas = 0;

  // Contadores de separación según hora prometida para Prácticas No Listas
  let countHasta18 = 0;
  let countDespues18 = 0;
  let countSinHoraValida = 0;

  // Contadores específicos: Emergencias (O.S. que contienen '(E)')
  let practicasValidasEmergencia = 0;
  let practicasListasEmergencia = 0;
  let practicasNoListasEmergencia = 0;
  let countEmergenciaHasta18 = 0;
  let countEmergenciaDespues18 = 0;
  let countEmergenciaSinHoraValida = 0;

  // Contadores específicos: Rutina (todas las demás O.S.)
  let practicasValidasRutina = 0;
  let practicasListasRutina = 0;
  let practicasNoListasRutina = 0;
  let countRutinaHasta18 = 0;
  let countRutinaDespues18 = 0;
  let countRutinaSinHoraValida = 0;

  let countEsperando = 0;
  let countEnProceso = 0;
  let countAFirmar = 0;
  let countCuarentena = 0;
  let countInterface = 0;
  let haySuperposicionMultiplesEstados = false;

  const studiesNonReadyMap = new Map<string, number>();
  const statusDistributionMap = new Map<string, number>();

  consolidatedPractices.forEach((practice) => {
    const isEmerg = isEmergenciaOS(practice.os) || (practice.physicalRecords && practice.physicalRecords.some((r) => isEmergenciaOS(r.os)));
    if (isEmerg) {
      practicasValidasEmergencia++;
    } else {
      practicasValidasRutina++;
    }

    if (practice.grupoConsolidado === 'LISTO') {
      practicasListas++;
      if (isEmerg) {
        practicasListasEmergencia++;
      } else {
        practicasListasRutina++;
      }
    } else if (practice.grupoConsolidado === 'NO_LISTO' || practice.grupoConsolidado === 'PENDIENTE') {
      practicasNoListas++;

      // Clasificación de la hora prometida exclusivamente desde el LIS
      const timeGroup = classifyTimePromise(practice.horaPrometida);
      if (timeGroup === 'HASTA_18') {
        countHasta18++;
      } else if (timeGroup === 'DESPUES_18') {
        countDespues18++;
      } else {
        countSinHoraValida++;
      }

      if (isEmerg) {
        practicasNoListasEmergencia++;
        if (timeGroup === 'HASTA_18') {
          countEmergenciaHasta18++;
        } else if (timeGroup === 'DESPUES_18') {
          countEmergenciaDespues18++;
        } else {
          countEmergenciaSinHoraValida++;
        }
      } else {
        practicasNoListasRutina++;
        if (timeGroup === 'HASTA_18') {
          countRutinaHasta18++;
        } else if (timeGroup === 'DESPUES_18') {
          countRutinaDespues18++;
        } else {
          countRutinaSinHoraValida++;
        }
      }

      if (practice.tieneMultiplesEstadosNoListos) {
        haySuperposicionMultiplesEstados = true;
      }

      const primaryCat = normalizeNonReadyStatusCategory(practice.estadoConsolidado);
      if (primaryCat === 'ESPERANDO EN UNIDAD') countEsperando++;
      else if (primaryCat === 'EN PROCESO') countEnProceso++;
      else if (primaryCat === 'A FIRMAR') countAFirmar++;
      else if (primaryCat === 'CUARENTENA') countCuarentena++;
      else if (primaryCat === 'RESULTADO EN INTERFACE') countInterface++;
      else countEnProceso++;

      studiesNonReadyMap.set(practice.estudio, (studiesNonReadyMap.get(practice.estudio) || 0) + 1);
      statusDistributionMap.set(primaryCat, (statusDistributionMap.get(primaryCat) || 0) + 1);
    } else if (practice.grupoConsolidado === 'DESCONOCIDO') {
      practicasDesconocidas++;
    }
  });

  const practicasListasPct = practicasValidas > 0
    ? Math.round((practicasListas / practicasValidas) * 1000) / 10
    : 0;
  const practicasNoListasPct = practicasValidas > 0
    ? Math.round((practicasNoListas / practicasValidas) * 1000) / 10
    : 0;

  // Porcentajes Emergencias (O.S. que contienen '(E)')
  const practicasNoListasEmergenciaPct = practicasValidasEmergencia > 0
    ? Math.round((practicasNoListasEmergencia / practicasValidasEmergencia) * 1000) / 10
    : 0;
  const practicasNoListasEmergenciaHasta18Pct = practicasNoListasEmergencia > 0
    ? Math.round((countEmergenciaHasta18 / practicasNoListasEmergencia) * 1000) / 10
    : 0;
  const practicasNoListasEmergenciaDespues18Pct = practicasNoListasEmergencia > 0
    ? Math.round((countEmergenciaDespues18 / practicasNoListasEmergencia) * 1000) / 10
    : 0;
  const practicasNoListasEmergenciaSinHoraValidaPct = practicasNoListasEmergencia > 0
    ? Math.round((countEmergenciaSinHoraValida / practicasNoListasEmergencia) * 1000) / 10
    : 0;

  // Porcentajes Rutina (todas las demás O.S.)
  const practicasNoListasRutinaPct = practicasValidasRutina > 0
    ? Math.round((practicasNoListasRutina / practicasValidasRutina) * 1000) / 10
    : 0;
  const practicasNoListasRutinaHasta18Pct = practicasNoListasRutina > 0
    ? Math.round((countRutinaHasta18 / practicasNoListasRutina) * 1000) / 10
    : 0;
  const practicasNoListasRutinaDespues18Pct = practicasNoListasRutina > 0
    ? Math.round((countRutinaDespues18 / practicasNoListasRutina) * 1000) / 10
    : 0;
  const practicasNoListasRutinaSinHoraValidaPct = practicasNoListasRutina > 0
    ? Math.round((countRutinaSinHoraValida / practicasNoListasRutina) * 1000) / 10
    : 0;

  // Porcentajes de desglose respecto al total de prácticas NO LISTAS
  const practicasNoListasHasta18 = countHasta18;
  const practicasNoListasHasta18Pct = practicasNoListas > 0
    ? Math.round((countHasta18 / practicasNoListas) * 1000) / 10
    : 0;
  const practicasNoListasDespues18 = countDespues18;
  const practicasNoListasDespues18Pct = practicasNoListas > 0
    ? Math.round((countDespues18 / practicasNoListas) * 1000) / 10
    : 0;
  const practicasNoListasSinHoraValida = countSinHoraValida;
  const practicasNoListasSinHoraValidaPct = practicasNoListas > 0
    ? Math.round((countSinHoraValida / practicasNoListas) * 1000) / 10
    : 0;

  const calcPctNonReady = (count: number) => {
    return practicasNoListas > 0 ? Math.round((count / practicasNoListas) * 1000) / 10 : 0;
  };

  const composicionPendientes = {
    esperandoEnUnidad: { cantidad: countEsperando, porcentaje: calcPctNonReady(countEsperando) },
    enProceso: { cantidad: countEnProceso, porcentaje: calcPctNonReady(countEnProceso) },
    aFirmar: { cantidad: countAFirmar, porcentaje: calcPctNonReady(countAFirmar) },
    cuarentena: { cantidad: countCuarentena, porcentaje: calcPctNonReady(countCuarentena) },
    resultadoEnInterface: { cantidad: countInterface, porcentaje: calcPctNonReady(countInterface) },
    haySuperposicionMultiplesEstados,
  };

  // NIVEL 3 — ÓRDENES DE SERVICIO / PACIENTES (OS)
  const osMap = new Map<
    string,
    {
      os: string;
      idPacienteAnon: string;
      nombrePaciente?: string;
      sede: string;
      totalPracticas: number;
      practicasNoListas: number;
      practicasNoListasHasta18: number;
      practicasNoListasDespues18: number;
      practicasNoListasSinHora: number;
    }
  >();

  consolidatedPractices.forEach((practice) => {
    const cleanOS = practice.os;
    if (!osMap.has(cleanOS)) {
      osMap.set(cleanOS, {
        os: cleanOS,
        idPacienteAnon: practice.idPacienteAnon,
        nombrePaciente: practice.nombrePaciente,
        sede: practice.sede,
        totalPracticas: 0,
        practicasNoListas: 0,
        practicasNoListasHasta18: 0,
        practicasNoListasDespues18: 0,
        practicasNoListasSinHora: 0,
      });
    }

    const osEntry = osMap.get(cleanOS)!;
    osEntry.totalPracticas++;
    if (practice.grupoConsolidado === 'NO_LISTO' || practice.grupoConsolidado === 'PENDIENTE') {
      osEntry.practicasNoListas++;
      const timeGroup = classifyTimePromise(practice.horaPrometida);
      if (timeGroup === 'HASTA_18') {
        osEntry.practicasNoListasHasta18++;
      } else if (timeGroup === 'DESPUES_18') {
        osEntry.practicasNoListasDespues18++;
      } else {
        osEntry.practicasNoListasSinHora++;
      }
    }
  });

  const osTotales = osMap.size;
  const ordenesPrevistas = osTotales;

  let osCompletamenteListas = 0;
  let osConPendientes = 0;
  let osConPendientesHasta18 = 0;
  let osConPendientesDespues18 = 0;
  let osConPendientesSinHoraValida = 0;
  const detalleOSPendientes: IntradayKPIs['detalleOSPendientes'] = [];

  osMap.forEach((entry) => {
    if (entry.practicasNoListas === 0) {
      osCompletamenteListas++;
    } else {
      osConPendientes++;
      // Regla de unicidad y prioridad para OS:
      // Si tiene al menos una práctica no lista con hora prometida <= 18:00, se clasifica en Hasta las 18:00
      if (entry.practicasNoListasHasta18 > 0) {
        osConPendientesHasta18++;
      } else if (entry.practicasNoListasDespues18 > 0) {
        // Si todas sus prácticas no listas corresponden a después de las 18:00
        osConPendientesDespues18++;
      } else {
        // Prácticas no listas sin hora válida de entrega
        osConPendientesSinHoraValida++;
      }

      detalleOSPendientes.push({
        os: entry.os,
        practicasPendientes: entry.practicasNoListas,
        practicasTotales: entry.totalPracticas,
        idPacienteAnon: entry.idPacienteAnon,
        nombrePaciente: entry.nombrePaciente,
        sede: entry.sede,
      });
    }
  });

  const osCompletamenteListasPct = osTotales > 0
    ? Math.round((osCompletamenteListas / osTotales) * 1000) / 10
    : 0;
  const osConPendientesPct = osTotales > 0
    ? Math.round((osConPendientes / osTotales) * 1000) / 10
    : 0;

  const osConPendientesHasta18Pct = osConPendientes > 0
    ? Math.round((osConPendientesHasta18 / osConPendientes) * 1000) / 10
    : 0;
  const osConPendientesDespues18Pct = osConPendientes > 0
    ? Math.round((osConPendientesDespues18 / osConPendientes) * 1000) / 10
    : 0;
  const osConPendientesSinHoraValidaPct = osConPendientes > 0
    ? Math.round((osConPendientesSinHoraValida / osConPendientes) * 1000) / 10
    : 0;

  const ordenesListas = osCompletamenteListas;
  const ordenesPendientes = osConPendientes;
  const ordenesConPendientes = osConPendientes;

  const topPracticasNoListas = Array.from(studiesNonReadyMap.entries())
    .map(([estudio, cantidad]) => ({
      estudio,
      cantidad,
      porcentaje: practicasNoListas > 0 ? Math.round((cantidad / practicasNoListas) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  const distribucionStatus = Array.from(statusDistributionMap.entries())
    .map(([status, cantidad]) => ({
      status,
      cantidad,
      porcentaje: practicasNoListas > 0 ? Math.round((cantidad / practicasNoListas) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  const top3Count = topPracticasNoListas.slice(0, 3).reduce((acc, curr) => acc + curr.cantidad, 0);
  const concentracionTop3Pct = practicasNoListas > 0
    ? Math.round((top3Count / practicasNoListas) * 1000) / 10
    : 0;

  // VALIDACIÓN DE CONSISTENCIA MATEMÁTICA Y TRAZABILIDAD
  let esConsistente = true;
  let errorConsistencia: string | null = null;

  if (osTotales !== osCompletamenteListas + osConPendientes) {
    esConsistente = false;
    errorConsistencia = `Inconsistencia en balance de OS: Total (${osTotales}) != Listas (${osCompletamenteListas}) + Pendientes (${osConPendientes})`;
  } else if (osConPendientes !== osConPendientesHasta18 + osConPendientesDespues18 + osConPendientesSinHoraValida) {
    esConsistente = false;
    errorConsistencia = `Inconsistencia en balance horario de OS: Pendientes (${osConPendientes}) != Hasta 18:00 (${osConPendientesHasta18}) + Después 18:00 (${osConPendientesDespues18}) + Sin Hora (${osConPendientesSinHoraValida})`;
  } else if (practicasValidas !== practicasListas + practicasNoListas + practicasDesconocidas) {
    esConsistente = false;
    errorConsistencia = `Inconsistencia en balance de Prácticas: Total (${practicasValidas}) != Listas (${practicasListas}) + No Listas (${practicasNoListas}) + Desconocidas (${practicasDesconocidas})`;
  } else if (osConPendientes > practicasNoListas) {
    esConsistente = false;
    errorConsistencia = `Inconsistencia matemática: OS con pendientes (${osConPendientes}) no puede superar a Prácticas No Listas (${practicasNoListas})`;
  }

  return {
    rulesVersion: '1.0',
    fechaSeleccionada: selectedDate,
    corteSeleccionado: selectedCut,
    filasTotalesDataset,
    filasFechaSeleccionada,
    estudiosExcluidosActoBioquimico: actoBioquimicoCount,
    recipientesCodigosBarra,
    practicasPrevistas,
    practicasValidas,
    ordenesPrevistas,
    osTotales,
    esBalanceCuadrado,
    esLoteParcial: isLikelyPartial,

    practicasListas,
    practicasListasPct,
    practicasNoListas,
    practicasNoListasPct,
    practicasDesconocidas,

    // Separación de Prácticas No Listas según hora prometida LIS
    practicasNoListasHasta18,
    practicasNoListasHasta18Pct,
    practicasNoListasDespues18,
    practicasNoListasDespues18Pct,
    practicasNoListasSinHoraValida,
    practicasNoListasSinHoraValidaPct,

    // Desglose Emergencias vs Rutina para Prácticas No Listas
    practicasValidasEmergencia,
    practicasListasEmergencia,
    practicasNoListasEmergencia,
    practicasNoListasEmergenciaPct,
    practicasNoListasEmergenciaHasta18: countEmergenciaHasta18,
    practicasNoListasEmergenciaHasta18Pct,
    practicasNoListasEmergenciaDespues18: countEmergenciaDespues18,
    practicasNoListasEmergenciaDespues18Pct,
    practicasNoListasEmergenciaSinHoraValida: countEmergenciaSinHoraValida,
    practicasNoListasEmergenciaSinHoraValidaPct,

    practicasValidasRutina,
    practicasListasRutina,
    practicasNoListasRutina,
    practicasNoListasRutinaPct,
    practicasNoListasRutinaHasta18: countRutinaHasta18,
    practicasNoListasRutinaHasta18Pct,
    practicasNoListasRutinaDespues18: countRutinaDespues18,
    practicasNoListasRutinaDespues18Pct,
    practicasNoListasRutinaSinHoraValida: countRutinaSinHoraValida,
    practicasNoListasRutinaSinHoraValidaPct,

    composicionPendientes,

    ordenesListas,
    osCompletamenteListas,
    osCompletamenteListasPct,
    ordenesPendientes,
    ordenesConPendientes,
    osConPendientes,
    osConPendientesPct,

    // Separación de OS con Pendientes según hora prometida LIS
    osConPendientesHasta18,
    osConPendientesHasta18Pct,
    osConPendientesDespues18,
    osConPendientesDespues18Pct,
    osConPendientesSinHoraValida,
    osConPendientesSinHoraValidaPct,

    ordenesARevisar: practicasDesconocidas,
    porcentajeAvance: practicasListasPct,

    topPracticasNoListas,
    distribucionStatus,
    concentracionTop3Pct,

    statusDesconocidosList,
    esConsistente,
    errorConsistencia,
    detalleOSPendientes,

    practicasPendientes: practicasNoListas,
    practicasARevisar: practicasDesconocidas,
    estudiosPrevistos: practicasValidas,
    estudiosListos: practicasListas,
    estudiosPendientes: practicasNoListas,
    estudiosARevisar: practicasDesconocidas,
  };
}

/**
 * Genera el objeto completo DailyDeliveryEntry para persistir un cierre operativo diario
 */
export function buildDailyDeliveryEntry(
  records: IntradayRecord[],
  fechaISO: string,
  nombreArchivo: string,
  fechaActualizacion?: string,
  cargadoPor?: string,
  _previousRecords?: IntradayRecord[],
  _existingBreaches?: IncumplimientoTAT[]
): DailyDeliveryEntry {
  const kpis = calculateIntradayKPIs(records, fechaISO);
  const now = new Date();
  const defaultFechaHora = formatToDDMMYYYYHHmm(now);

  const sectorCounts = new Map<string, number>();
  records.forEach((r) => {
    if (r.fechaPrometida === fechaISO && !isActoBioquimico(r.estudio)) {
      const sec = r.sector?.trim() || 'General';
      sectorCounts.set(sec, (sectorCounts.get(sec) || 0) + 1);
    }
  });

  const totalSectoresPracticas = Array.from(sectorCounts.values()).reduce((a, b) => a + b, 0);
  const top3Sectores = Array.from(sectorCounts.entries())
    .map(([sector, count]) => ({
      sector,
      cantidad: count,
      porcentaje: totalSectoresPracticas > 0 ? Math.round((count / totalSectoresPracticas) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 3);

  return {
    rulesVersion: '1.0',
    fecha: fechaISO,
    fechaFormateada: formatISOToDisplayDate(fechaISO),
    fechaActualizacion: fechaActualizacion || defaultFechaHora,
    cargadoPor: cargadoPor || 'preanalitica@labflores.com.ar',
    nombreArchivo,
    osTotales: kpis.osTotales,
    osCompletamenteListas: kpis.osCompletamenteListas,
    osCompletamenteListasPct: kpis.osCompletamenteListasPct,
    osConPendientes: kpis.osConPendientes,
    osConPendientesPct: kpis.osConPendientesPct,
    osConPendientesHasta18: kpis.osConPendientesHasta18,
    osConPendientesHasta18Pct: kpis.osConPendientesHasta18Pct,
    osConPendientesDespues18: kpis.osConPendientesDespues18,
    osConPendientesDespues18Pct: kpis.osConPendientesDespues18Pct,
    osConPendientesSinHoraValida: kpis.osConPendientesSinHoraValida,
    osConPendientesSinHoraValidaPct: kpis.osConPendientesSinHoraValidaPct,
    practicasTotales: kpis.practicasValidas,
    practicasListas: kpis.practicasListas,
    practicasListasPct: kpis.practicasListasPct,
    practicasNoListas: kpis.practicasNoListas,
    practicasNoListasPct: kpis.practicasNoListasPct,
    practicasNoListasHasta18: kpis.practicasNoListasHasta18,
    practicasNoListasHasta18Pct: kpis.practicasNoListasHasta18Pct,
    practicasNoListasDespues18: kpis.practicasNoListasDespues18,
    practicasNoListasDespues18Pct: kpis.practicasNoListasDespues18Pct,
    practicasNoListasSinHoraValida: kpis.practicasNoListasSinHoraValida,
    practicasNoListasSinHoraValidaPct: kpis.practicasNoListasSinHoraValidaPct,
    practicasValidasEmergencia: kpis.practicasValidasEmergencia,
    practicasListasEmergencia: kpis.practicasListasEmergencia,
    practicasNoListasEmergencia: kpis.practicasNoListasEmergencia,
    practicasNoListasEmergenciaPct: kpis.practicasNoListasEmergenciaPct,
    practicasNoListasEmergenciaHasta18: kpis.practicasNoListasEmergenciaHasta18,
    practicasNoListasEmergenciaHasta18Pct: kpis.practicasNoListasEmergenciaHasta18Pct,
    practicasNoListasEmergenciaDespues18: kpis.practicasNoListasEmergenciaDespues18,
    practicasNoListasEmergenciaDespues18Pct: kpis.practicasNoListasEmergenciaDespues18Pct,
    practicasNoListasEmergenciaSinHoraValida: kpis.practicasNoListasEmergenciaSinHoraValida,
    practicasNoListasEmergenciaSinHoraValidaPct: kpis.practicasNoListasEmergenciaSinHoraValidaPct,
    practicasValidasRutina: kpis.practicasValidasRutina,
    practicasListasRutina: kpis.practicasListasRutina,
    practicasNoListasRutina: kpis.practicasNoListasRutina,
    practicasNoListasRutinaPct: kpis.practicasNoListasRutinaPct,
    practicasNoListasRutinaHasta18: kpis.practicasNoListasRutinaHasta18,
    practicasNoListasRutinaHasta18Pct: kpis.practicasNoListasRutinaHasta18Pct,
    practicasNoListasRutinaDespues18: kpis.practicasNoListasRutinaDespues18,
    practicasNoListasRutinaDespues18Pct: kpis.practicasNoListasRutinaDespues18Pct,
    practicasNoListasRutinaSinHoraValida: kpis.practicasNoListasRutinaSinHoraValida,
    practicasNoListasRutinaSinHoraValidaPct: kpis.practicasNoListasRutinaSinHoraValidaPct,
    esperandoEnUnidad: kpis.composicionPendientes.esperandoEnUnidad.cantidad,
    enProceso: kpis.composicionPendientes.enProceso.cantidad,
    resultadoEnInterface: kpis.composicionPendientes.resultadoEnInterface.cantidad,
    aFirmar: kpis.composicionPendientes.aFirmar.cantidad,
    cuarentena: kpis.composicionPendientes.cuarentena.cantidad,
    top5Practicas: kpis.topPracticasNoListas,
    top3Sectores,
    records,
  };
}

/**
 * Calcula la comparación diaria entre dos jornadas
 */
export function calculateDailyComparison(
  history: DailyDeliveryEntry[],
  currentDateISO: string
): DailyComparisonSummary | null {
  if (!history || history.length < 2) return null;

  const currentIndex = history.findIndex((h) => h.fecha === currentDateISO);
  if (currentIndex === -1) return null;

  // Buscar el día anterior disponible en el historial
  const current = history[currentIndex];
  const previous = history.find((h, idx) => idx > currentIndex && h.fecha < currentDateISO) || history[currentIndex + 1];

  if (!previous) return null;

  const osListasActualPct = current.osCompletamenteListasPct;
  const osListasAnteriorPct = previous.osCompletamenteListasPct;
  const varOSListasPP = Math.round((osListasActualPct - osListasAnteriorPct) * 10) / 10;

  const practicasListasActualPct = current.practicasListasPct;
  const practicasListasAnteriorPct = previous.practicasListasPct;
  const varPracticasListasPP = Math.round((practicasListasActualPct - practicasListasAnteriorPct) * 10) / 10;

  return {
    fechaActual: current.fecha,
    fechaActualFormateada: current.fechaFormateada || formatISOToDisplayDate(current.fecha),
    fechaAnterior: previous.fecha,
    fechaAnteriorFormateada: previous.fechaFormateada || formatISOToDisplayDate(previous.fecha),
    osListasActualPct,
    osListasAnteriorPct,
    varOSListasPP,
    practicasListasActualPct,
    practicasListasAnteriorPct,
    varPracticasListasPP,
  };
}

// =========================================================================================
// NUEVA LÓGICA DETERMINÍSTICA REDISEÑADA PARA EL MÓDULO TAT (SEGUIMIENTO DE PRÁCTICAS VENCIDAS)
// =========================================================================================

/**
 * Procesa un archivo matutino del LIS y actualiza la lista de casos TAT existentes.
 * 
 * Regla de Detección:
 * 1. Leer todas las prácticas del archivo.
 * 2. Excluir "Acto Bioquímico".
 * 3. Consolidar por (OS + Práctica/Estudio).
 * 4. Si la práctica está LISTA -> NO genera caso TAT.
 * 5. Si la práctica está NO LISTA -> Es un caso fuera de plazo.
 *    - Si ya existe en la lista TAT (por clave OS + Práctica):
 *      - Actualizar su status LIS actual.
 *      - Si está "EN PROCESO", recalcular días de atraso (Fecha Actual - Fecha Prometida).
 *      - Si está "CERRADO", mantener congelados los días de atraso y su estado cerrado.
 *    - Si es una práctica nueva que no existía:
 *      - Incorporarla automáticamente como nuevo caso TAT.
 *      - Estado de seguimiento inicial: "EN PROCESO".
 *      - Calcular días de atraso iniciales (Fecha Actual - Fecha Prometida).
 *      - Observaciones iniciales vacías.
 */
export function processMorningTATFile(
  records: IntradayRecord[],
  existingCases: TATCase[] = [],
  todayDate: Date = new Date(),
  userEmail: string = 'preanalitica@labflores.com.ar',
  fileName: string = 'archivo_matutino.csv',
  targetDateParam?: string,
  _dailyHistory?: DailyDeliveryEntry[],
  existingSummaries: TATDailySummary[] = []
): MorningTATProcessingResult {
  const nowFormatted = formatToDDMMYYYYHHmm(todayDate);
  const existingMap = new Map<string, TATCase>();
  existingCases.forEach((c) => {
    // Clave estricta OS + Práctica para unicidad determinística absoluta
    const key = getTATCaseKey(c.os, c.practica || (c as any).estudio);
    if (key) {
      existingMap.set(key, { ...c });
      const baseOS = normalizeOSCode(c.os).replace(/\s*\(E\)$/i, '').trim();
      const baseKey = `${baseOS}___${normalizeText(c.practica || (c as any).estudio)}`;
      if (!existingMap.has(baseKey)) {
        existingMap.set(baseKey, { ...c });
      }
    }
    if (c.id && !existingMap.has(c.id)) {
      existingMap.set(c.id, { ...c });
    }
  });

  // 1. Detectar fecha de promesa del archivo
  const dateCounts = new Map<string, number>();
  records.forEach((r) => {
    if (r.fechaPrometida && r.fechaPrometida.trim()) {
      dateCounts.set(r.fechaPrometida, (dateCounts.get(r.fechaPrometida) || 0) + 1);
    }
  });

  let detectedDate = targetDateParam || '';
  if (!detectedDate && dateCounts.size > 0) {
    let maxCount = -1;
    dateCounts.forEach((count, date) => {
      if (count > maxCount) {
        maxCount = count;
        detectedDate = date;
      }
    });
  }
  if (!detectedDate) {
    detectedDate = getTodayLocalDateString();
  }

  const fechaPromesaProcesada = detectedDate;
  const fechaPromesaTexto = formatISOToDisplayDate(fechaPromesaProcesada);

  // 2. Filtrar registros válidos (excluir Acto Bioquímico según reglas institucionales)
  const filasFisicasLeidas = records.length;
  const validRecords = records.filter((r) => !isActoBioquimico(r.estudio));
  const actosBioquimicosExcluidos = filasFisicasLeidas - validRecords.length;

  // 3. Consolidar por práctica clínica única (OS + Estudio)
  const consolidatedPractices = consolidateRecordsIntoPractices(validRecords, 'actual');
  const practicasClinicasUnicas = consolidatedPractices.length; // TOTAL PROMETIDO DEL DÍA

  // Calcular OS únicas del archivo matutino (Global, Urgencias, Rutina)
  const osTotalSet = new Set<string>();
  const osTotalUrgSet = new Set<string>();
  const osTotalRutSet = new Set<string>();
  const osAfectadasSet = new Set<string>();
  const osAfectadasUrgSet = new Set<string>();
  const osAfectadasRutSet = new Set<string>();

  let newCasesCount = 0;
  let updatedExistingCount = 0;
  let practicasListas = 0;
  let practicasNoListas = 0;

  consolidatedPractices.forEach((prac) => {
    if (prac.os) {
      const cleanOS = normalizeOSCode(prac.os);
      const tipo = getTipoAtencion(cleanOS);
      osTotalSet.add(cleanOS);
      if (tipo === 'URGENCIA') {
        osTotalUrgSet.add(cleanOS);
      } else {
        osTotalRutSet.add(cleanOS);
      }
    }

    // Clasificar listas vs no listas
    if (prac.grupoConsolidado === 'LISTO') {
      practicasListas++;
      return;
    }

    // Si está NO_LISTA, PENDIENTE o DESCONOCIDA (incumple plazo)
    practicasNoListas++;
    if (prac.os) {
      const cleanOS = normalizeOSCode(prac.os);
      const tipo = getTipoAtencion(cleanOS);
      osAfectadasSet.add(cleanOS);
      if (tipo === 'URGENCIA') {
        osAfectadasUrgSet.add(cleanOS);
      } else {
        osAfectadasRutSet.add(cleanOS);
      }
    }

    const caseId = getTATCaseKey(prac.os, prac.estudio);
    const baseOS = normalizeOSCode(prac.os).replace(/\s*\(E\)$/i, '').trim();
    const baseKey = `${baseOS}___${normalizeText(prac.estudio)}`;
    const delayDays = calculateDelayDays(prac.fechaPrometida || fechaPromesaProcesada, todayDate);
    const existing = existingMap.get(caseId) || existingMap.get(baseKey);

    if (existing) {
      // Actualizar caso existente sin sobrescribir observaciones ni fecha de cierre si ya fue cerrado
      updatedExistingCount++;
      existing.statusLIS = prac.estadoConsolidado;
      existing.fechaUltimaActualizacion = nowFormatted;
      existing.sede = prac.sede || existing.sede;
      existing.sector = prac.sector || existing.sector;
      if (prac.os && prac.os.includes('(E)')) {
        existing.os = prac.os;
      }
      existing.tipoAtencion = getTipoAtencion(existing.os);

      // Si el caso sigue EN PROCESO, actualizamos los días de retraso dinámicamente
      if (existing.estadoSeguimiento === 'EN PROCESO' || existing.estadoSeguimiento === 'ABIERTO') {
        existing.tiempoAtrasoDias = Math.max(1, delayDays);
      }
    } else {
      // Crear nuevo caso TAT (preserva OS original con (E) y deriva tipoAtencion)
      newCasesCount++;
      const newCase: TATCase = {
        id: caseId,
        rulesVersion: '1.1',
        os: prac.os,
        tipoAtencion: getTipoAtencion(prac.os),
        idPacienteAnon: prac.idPacienteAnon || 'PAC-N/A',
        nombrePaciente: prac.nombrePaciente,
        practica: prac.estudio,
        sede: prac.sede || 'Sin sede',
        sector: prac.sector || 'General',
        fechaPrometida: prac.fechaPrometida || fechaPromesaProcesada,
        fechaPrometidaTexto: formatISOToDisplayDate(prac.fechaPrometida || fechaPromesaProcesada),
        statusLIS: prac.estadoConsolidado,
        tiempoAtrasoDias: Math.max(1, delayDays),
        estadoSeguimiento: 'EN PROCESO',
        observaciones: prac.observaciones || '',
        fechaDeteccion: nowFormatted,
        fechaUltimaActualizacion: nowFormatted,
        archivoOrigen: fileName,
      };

      // Exclusión automática de casos anteriores al inicio formal (01/09/2026)
      if (newCase.fechaPrometida < FORMAL_TAT_START_DATE) {
        newCase.estadoSeguimiento = 'ARCHIVADO_PRE_IMPLEMENTACION';
        newCase.excludedFromOperationalMetrics = true;
        newCase.motivoExclusion = 'PRE_IMPLEMENTACION';
        newCase.motivo = 'Datos previos al inicio formal del seguimiento TAT — etapa de prueba/desarrollo';
        newCase.fechaCorteExclusion = FORMAL_TAT_START_DATE_DISPLAY;
      }

      existingMap.set(caseId, newCase);
    }
  });

  const osTotalesPrometidas = osTotalSet.size;
  const osAfectadasFueraPlazo = osAfectadasSet.size;

  const updatedCases = Array.from(existingMap.values());
  // Ordenar por días de atraso descendente y luego fecha prometida
  updatedCases.sort((a, b) => {
    if (b.tiempoAtrasoDias !== a.tiempoAtrasoDias) {
      return b.tiempoAtrasoDias - a.tiempoAtrasoDias;
    }
    return (b.fechaPrometida || '').localeCompare(a.fechaPrometida || '');
  });

  // 4. Verificación de balance y consistencia matemática obligatoria
  // LISTAS + NO LISTAS === TOTAL PROMETIDO DEL DÍA
  const esConsistente = practicasListas + practicasNoListas === practicasClinicasUnicas;

  // 5. Construir objeto TATDailySummary propio y exclusivo del Módulo TAT (sin tocar Entregas Diarias)
  const tatSummary: TATDailySummary = {
    fecha: fechaPromesaProcesada,
    fechaFormateada: fechaPromesaTexto,
    osTotales: osTotalesPrometidas,
    osAfectadas: osAfectadasFueraPlazo,
    osTotalesUrgencia: osTotalUrgSet.size,
    osAfectadasUrgencia: osAfectadasUrgSet.size,
    osTotalesRutina: osTotalRutSet.size,
    osAfectadasRutina: osAfectadasRutSet.size,
    practicasTotales: practicasClinicasUnicas,
    practicasListas: practicasListas,
    practicasNoListas: practicasNoListas,
    nombreArchivo: fileName,
    fechaCarga: nowFormatted,
    usuarioCarga: userEmail,
  };

  // 6. Proyección acumulada del mes (basada exclusivamente en resúmenes diarios TAT)
  const parsedPeriod = parseMonthYearFromDate(fechaPromesaProcesada);
  const mesNombre = parsedPeriod ? parsedPeriod.mes : MONTH_NAMES_LIST[todayDate.getMonth()];
  const mesAño = parsedPeriod ? parsedPeriod.año : todayDate.getFullYear();

  // Combinar con resúmenes diarios TAT existentes
  const combinedSummaries = existingSummaries.filter((s) => s.fecha !== fechaPromesaProcesada);
  combinedSummaries.push(tatSummary);

  const summariesInMonth = combinedSummaries.filter((s) => {
    const p = parseMonthYearFromDate(s.fecha);
    return p && p.mes === mesNombre && p.año === mesAño;
  });

  const totalOSPrometidasMensualAcumulado = summariesInMonth.reduce((acc, s) => acc + (s.osTotales || 0), 0);
  const totalPrometidoMensualAcumulado = summariesInMonth.reduce((acc, s) => acc + (s.practicasTotales || 0), 0);

  // Contar OS únicas afectadas en el mes (cada OS se cuenta una sola vez)
  const casesInMonth = updatedCases.filter((c) => isCaseInPeriod(c, mesNombre, mesAño));
  const uniqueOSInMonth = new Set<string>();
  casesInMonth.forEach((c) => {
    if (c.os) uniqueOSInMonth.add(c.os.trim());
  });
  const osAfectadasMensualAcumulado = uniqueOSInMonth.size;
  const fueraPlazoMensualAcumulado = casesInMonth.length;

  let porcentajeMensualCalculado: number | null = null;
  let porcentajeMensualCalculadoTexto = 'Dato pendiente';

  // KPI Institucional: % de OS / Pacientes Fuera de Plazo = (OS afectadas / OS prometidas) * 100
  if (totalOSPrometidasMensualAcumulado > 0) {
    const rawPct = (osAfectadasMensualAcumulado / totalOSPrometidasMensualAcumulado) * 100;
    porcentajeMensualCalculado = Math.round(rawPct * 100) / 100;
    porcentajeMensualCalculadoTexto = `${porcentajeMensualCalculado.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} %`;
  }

  return {
    updatedCases,
    newCasesCount,
    updatedExistingCount,
    totalNoListasEnArchivo: practicasNoListas,
    fechaPromesaProcesada,
    fechaPromesaTexto,
    filasFisicasLeidas,
    actosBioquimicosExcluidos,
    osTotalesPrometidas,
    osAfectadasFueraPlazo,
    practicasClinicasUnicas,
    practicasListas,
    practicasNoListas,
    esConsistente,
    mesNombre,
    mesAño,
    totalOSPrometidasMensualAcumulado,
    osAfectadasMensualAcumulado,
    totalPrometidoMensualAcumulado,
    fueraPlazoMensualAcumulado,
    porcentajeMensualCalculado,
    porcentajeMensualCalculadoTexto,
    tatSummary,
    consolidatedPractices,
  };
}

export const TAT_OFFICIAL_START = '2026-09-01';
export const TAT_OFFICIAL_START_PERIOD = '2026-09';
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
 * Determina si un caso o incumplimiento corresponde a la etapa previa al inicio formal del seguimiento TAT (01/09/2026).
 * Los registros anteriores corresponden a pruebas y desarrollo y no participan en la operación ni indicadores.
 */
export function isPreImplementationBreach(breach: TATCase | IncumplimientoTAT | any): boolean {
  if (!breach) return false;
  if (breach.excludedFromOperationalMetrics === true) return true;
  if (breach.estadoSeguimiento === 'ARCHIVADO_PRE_IMPLEMENTACION') return true;

  // Imputación estricta: si la fecha prometida es anterior al inicio formal (01/09/2026), se excluye
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

/**
 * Calcula los KPIs ejecutivos del Módulo TAT (excluyendo registros previos a la fecha formal 01/09/2026)
 */
export function calculateTATKPIs(cases: TATCase[], todayDate: Date = new Date()): TATKPISummary {
  const operationalCases = cases.filter((c) => !c.excludedFromOperationalMetrics && !isPreImplementationBreach(c));
  const totalCasos = operationalCases.length;
  const casosEnProceso = operationalCases.filter((c) => c.estadoSeguimiento === 'EN PROCESO' || c.estadoSeguimiento === 'ABIERTO');
  const casosCerrados = operationalCases.filter((c) => c.estadoSeguimiento === 'CERRADO' || c.estadoSeguimiento === 'Cerrado manualmente' || c.estadoSeguimiento === 'Cerrado automáticamente');

  const enProcesoDelays = casosEnProceso.map((c) => {
    return calculateDelayDays(c.fechaPrometida, todayDate) || c.tiempoAtrasoDias || 1;
  });

  const todosDelays = operationalCases.map((c) => c.tiempoAtrasoDias || 1);

  const promedioAtrasoDias = enProcesoDelays.length > 0
    ? Math.round((enProcesoDelays.reduce((acc, v) => acc + v, 0) / enProcesoDelays.length) * 10) / 10
    : 0;

  const maximoAtrasoDias = enProcesoDelays.length > 0
    ? Math.max(...enProcesoDelays)
    : (todosDelays.length > 0 ? Math.max(...todosDelays) : 0);

  return {
    totalCasos,
    casosEnProceso: casosEnProceso.length,
    casosCerrados: casosCerrados.length,
    promedioAtrasoDias,
    maximoAtrasoDias,
  };
}

/**
 * Cambia el estado de seguimiento de un caso TAT (EN PROCESO <-> CERRADO)
 * Al cerrar, congela la fecha y hora de cierre y los días de atraso finales.
 */
export function toggleTATCaseStatus(
  caseItem: TATCase,
  userEmail: string = 'preanalitica@labflores.com.ar',
  currentDate: Date = new Date()
): TATCase {
  const isClosing = caseItem.estadoSeguimiento === 'EN PROCESO' || caseItem.estadoSeguimiento === 'ABIERTO';
  const nowFormatted = formatToDDMMYYYYHHmm(currentDate);

  if (isClosing) {
    const finalDelay = calculateDelayDays(caseItem.fechaPrometida, currentDate) || caseItem.tiempoAtrasoDias || 1;
    return {
      ...caseItem,
      estadoSeguimiento: 'CERRADO',
      fechaCierre: nowFormatted,
      usuarioCierre: userEmail,
      tiempoAtrasoDias: finalDelay,
      fechaUltimaActualizacion: nowFormatted,
    };
  } else {
    // Reabrir a EN PROCESO
    const updatedDelay = calculateDelayDays(caseItem.fechaPrometida, currentDate) || caseItem.tiempoAtrasoDias || 1;
    return {
      ...caseItem,
      estadoSeguimiento: 'EN PROCESO',
      fechaCierre: undefined,
      usuarioCierre: undefined,
      tiempoAtrasoDias: updatedDelay,
      fechaUltimaActualizacion: nowFormatted,
    };
  }
}

// =========================================================================================
// CÁLCULOS AUDITABLES Y HISTÓRICOS DE % FUERA DE PLAZO MENSUAL Y EVOLUCIÓN TAT
// =========================================================================================

export const MONTH_NAMES_LIST: MonthName[] = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Obtiene el índice (0-11) a partir del nombre del mes en español
 */
export function getMonthIndex(mes: MonthName | string): number {
  const norm = normalizeText(mes);
  const map: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };
  return map[norm] ?? -1;
}

/**
 * Extrae mes y año de una fecha en formato YYYY-MM-DD, ISO o DD/MM/YYYY
 */
export function parseMonthYearFromDate(dateStr?: string | null): { mes: MonthName; año: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.trim();

  // Caso 1: YYYY-MM-DD o YYYY-MM (ej. 2026-08-31 o 2026-08-31 18:00 o 2026-08)
  const isoMatch = str.match(/(\d{4})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthNum = parseInt(isoMatch[2], 10);
    if (!isNaN(year) && monthNum >= 1 && monthNum <= 12) {
      return { mes: MONTH_NAMES_LIST[monthNum - 1], año: year };
    }
  }

  // Caso 2: DD/MM/YYYY o D/M/YYYY (ej. 31/08/2026 o 31/08/2026 18:00 o 31/08/2026 - 18:00:00)
  const localMatch = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (localMatch) {
    const monthNum = parseInt(localMatch[2], 10);
    const year = parseInt(localMatch[3], 10);
    if (!isNaN(year) && monthNum >= 1 && monthNum <= 12) {
      return { mes: MONTH_NAMES_LIST[monthNum - 1], año: year };
    }
  }

  return null;
}

/**
 * Extrae mes y año de la FECHA PROMETIDA de un caso TAT o incumplimiento.
 * REGLA MAESTRA DE ASIGNACIÓN TEMPORAL DEL KPI:
 * El mes al que pertenece una OS para el KPI se define EXCLUSIVAMENTE según su:
 * FECHA / HORA PROMETIDA.
 * NUNCA según fecha de carga, fecha de detección, fecha de incorporación al TAT o fecha de cierre.
 */
export function extractPromisedMonthYear(item: any): { mes: MonthName; año: number } | null {
  if (!item) return null;

  // REGLA ESTRICTA: El mes se define EXCLUSIVAMENTE por Fecha Prometida.
  // NUNCA por fecha de carga, fecha de detección, fecha de cierre ni jornada de carga.
  const candidates = [
    item.fechaPrometidaISO,
    item.fechaPrometida,
    item.fechaPrometidaTexto,
    item.fechaHoraPrometidaTexto,
    item.fechaHoraPrometidaISO,
    item.fechaPromesa,
  ];

  for (const raw of candidates) {
    if (raw && typeof raw === 'string' && raw.trim()) {
      const parsed = parseMonthYearFromDate(raw);
      if (parsed) return parsed;
    }
  }

  return null;
}

/**
 * Verifica si un caso TAT corresponde al mes y año indicados para el KPI de Cumplimiento.
 * CRÍTICO: Se evalúa EXCLUSIVAMENTE por su FECHA PROMETIDA.
 * - Numerador: COUNT DISTINCT(OS) de todas las OS con al menos una práctica fuera de plazo cuya fecha prometida pertenece al mes.
 * - Excluye OS de Calidad Analítica (016) y Acto Bioquímico.
 * - No utiliza fecha de detección, fecha de carga ni fecha de cierre.
 */
export function isCaseInPeriod(caseItem: TATCase | IncumplimientoTAT | any, mes: MonthName, año: number): boolean {
  if (!caseItem) return false;
  // Excluir OS de Calidad Analítica (016)
  if (isOSCalidadAnalitica(caseItem.os)) return false;
  // Excluir Acto Bioquímico
  if (isActoBioquimico(caseItem.practica || caseItem.estudio || caseItem.nombreEstudio)) return false;

  const parsedPromesa = extractPromisedMonthYear(caseItem);
  if (parsedPromesa) {
    return parsedPromesa.mes === mes && parsedPromesa.año === año;
  }

  return false;
}

/**
 * Calcula los 3 indicadores principales y métricas del período seleccionado para el Módulo TAT:
 * 1. CASOS EN PROCESO (Total operativo en laboratorio: prácticas OS + Estudio en proceso)
 * 2. % PACIENTES FUERA DE PLAZO (Fórmula institucional: OS únicas fuera de plazo / Total OS prometidas del mes * 100)
 * 3. PROMEDIO DE DEMORA (Días calendario promedio para los casos del período)
 * 
 * Regla de Asignación Temporal:
 * - Numerador y Denominador agrupados estrictamente por FECHA PROMETIDA.
 * - OS 016 y Acto Bioquímico excluidos.
 * - RulesVersion: 1.1
 */
export function calculateTATPeriodKPIs(
  allCases: TATCase[],
  selectedMonth: MonthName,
  selectedYear: number,
  dailyHistory: DailyDeliveryEntry[] = [],
  resumenList: ResumenMensualRow[] = [],
  todayDate: Date = new Date(),
  tatSummaries: TATDailySummary[] = []
): TATPeriodKPIs {
  const nowFormatted = formatToDDMMYYYYHHmm(todayDate);

  // 1. Filtrar casos operativos válidos (excluyendo datos previos al 01/09/2026 y OS 016 de Calidad)
  const operationalCases = allCases.filter(
    (c) => !c.excludedFromOperationalMetrics && !isPreImplementationBreach(c) && !isOSCalidadAnalitica(c.os) && !isActoBioquimico(c.practica)
  );

  // 1b. KPI Operativo Global y Desgloses: Casos actualmente en proceso (tiempo real de gestión operativa en laboratorio)
  const casosEnProcesoActuales = operationalCases.filter(
    (c) => c.estadoSeguimiento === 'EN PROCESO' || c.estadoSeguimiento === 'ABIERTO'
  ).length;

  const casosEnProcesoUrgencias = operationalCases.filter(
    (c) => (c.estadoSeguimiento === 'EN PROCESO' || c.estadoSeguimiento === 'ABIERTO') && getTipoAtencion(c.os) === 'URGENCIA'
  ).length;

  const casosEnProcesoRutina = operationalCases.filter(
    (c) => (c.estadoSeguimiento === 'EN PROCESO' || c.estadoSeguimiento === 'ABIERTO') && getTipoAtencion(c.os) === 'RUTINA'
  ).length;

  // 2. Casos del Período Seleccionado (Imputación estricta por FECHA PROMETIDA)
  const casesInPeriod = operationalCases.filter((c) => isCaseInPeriod(c, selectedMonth, selectedYear));
  let practicasFueraPlazoUnicasMes = casesInPeriod.length;

  // 2b. NUMERADOR DEL KPI INSTITUCIONAL (Global, Urgencias, Rutina):
  // COUNT DISTINCT(OS) de todas las OS que tengan al menos una práctica fuera de plazo cuya fecha prometida pertenezca al mes seleccionado.
  const osAfectadasSet = new Set<string>();
  const osAfectadasUrgSet = new Set<string>();
  const osAfectadasRutSet = new Set<string>();

  casesInPeriod.forEach((c) => {
    if (c.os && !isOSCalidadAnalitica(c.os)) {
      const cleanOS = normalizeOSCode(c.os);
      const baseOS = cleanOS.replace(/\s*\(E\)$/i, '').trim();
      const tipo = c.tipoAtencion || getTipoAtencion(cleanOS);
      osAfectadasSet.add(baseOS);
      if (tipo === 'URGENCIA') {
        osAfectadasUrgSet.add(baseOS);
      } else {
        osAfectadasRutSet.add(baseOS);
      }
    }
  });

  // Si una OS tiene al menos un incumplimiento urgente, clasificarla como Urgencia
  osAfectadasUrgSet.forEach((os) => osAfectadasRutSet.delete(os));

  let osAfectadasUnicasMes = osAfectadasSet.size;
  let osAfectadasUnicasUrgencias = osAfectadasUrgSet.size;
  let osAfectadasUnicasRutina = osAfectadasSet.size - osAfectadasUrgSet.size;

  // 3. DENOMINADOR MENSUAL DEL KPI INSTITUCIONAL:
  // COUNT DISTINCT(OS) de todas las OS válidas cuya fecha prometida pertenezca al mismo mes seleccionado.
  const allMonthlyOSSet = new Set<string>();
  const allMonthlyOSUrgSet = new Set<string>();
  const allMonthlyOSRutSet = new Set<string>();
  const monthlyPracticesSet = new Set<string>();

  const rawRecordsOSSet = new Set<string>();
  const rawRecordsOSUrgSet = new Set<string>();
  const rawRecordsOSRutSet = new Set<string>();
  const rawRecordsPracticesSet = new Set<string>();

  // Recorrer todas las entregas diarias registradas en el sistema evaluando EXCLUSIVAMENTE por Fecha Prometida
  dailyHistory.forEach((d) => {
    if (d.records && Array.isArray(d.records) && d.records.length > 0) {
      d.records.forEach((r) => {
        // Excluir Calidad Analítica 016 y Acto Bioquímico
        if (!isOSCalidadAnalitica(r.os) && !isActoBioquimico(r.estudio) && r.os && r.os.trim()) {
          // Evaluar imputación temporal EXCLUSIVAMENTE por fecha prometida del registro (nunca por fecha de carga de jornada)
          const recPromised = parseMonthYearFromDate(r.fechaPrometida) || parseMonthYearFromDate((r as any).fechaHoraPrometida);
          if (recPromised && recPromised.mes === selectedMonth && recPromised.año === selectedYear) {
            const cleanOS = normalizeOSCode(r.os);
            const tipo = getTipoAtencion(cleanOS);
            allMonthlyOSSet.add(cleanOS);
            rawRecordsOSSet.add(cleanOS);
            if (tipo === 'URGENCIA') {
              allMonthlyOSUrgSet.add(cleanOS);
              rawRecordsOSUrgSet.add(cleanOS);
            } else {
              allMonthlyOSRutSet.add(cleanOS);
              rawRecordsOSRutSet.add(cleanOS);
            }
            if (r.estudio) {
              monthlyPracticesSet.add(`${cleanOS}___${normalizeText(r.estudio)}`);
              rawRecordsPracticesSet.add(`${cleanOS}___${normalizeText(r.estudio)}`);
            }
          }
        }
      });
    } else if (d.uniqueOSList && Array.isArray(d.uniqueOSList) && d.uniqueOSList.length > 0) {
      // Modo optimizado de red: utilizar lista nominal deduplicada de OS de la jornada
      const dParsed = parseMonthYearFromDate(d.fecha);
      if (dParsed && dParsed.mes === selectedMonth && dParsed.año === selectedYear) {
        d.uniqueOSList.forEach((rawOS) => {
          if (rawOS && !isOSCalidadAnalitica(rawOS)) {
            const cleanOS = normalizeOSCode(rawOS);
            const tipo = getTipoAtencion(cleanOS);
            allMonthlyOSSet.add(cleanOS);
            rawRecordsOSSet.add(cleanOS);
            if (tipo === 'URGENCIA') {
              allMonthlyOSUrgSet.add(cleanOS);
              rawRecordsOSUrgSet.add(cleanOS);
            } else {
              allMonthlyOSRutSet.add(cleanOS);
              rawRecordsOSRutSet.add(cleanOS);
            }
          }
        });
      }
    }
  });

  // Asegurar que toda OS en casesInPeriod (casos TAT cuya fecha prometida pertenece al mes seleccionado) forme parte del universo
  casesInPeriod.forEach((c) => {
    if (c.os && !isOSCalidadAnalitica(c.os) && !isActoBioquimico(c.practica)) {
      const cleanOS = normalizeOSCode(c.os);
      const tipo = getTipoAtencion(cleanOS);
      allMonthlyOSSet.add(cleanOS);
      if (tipo === 'URGENCIA') {
        allMonthlyOSUrgSet.add(cleanOS);
      } else {
        allMonthlyOSRutSet.add(cleanOS);
      }
      monthlyPracticesSet.add(`${cleanOS}___${normalizeText(c.practica)}`);
    }
  });

  // También incluir todos los casos operativos cuya FECHA PROMETIDA pertenezca al mes seleccionado
  operationalCases.forEach((c) => {
    const pDate = extractPromisedMonthYear(c);
    if (pDate && pDate.mes === selectedMonth && pDate.año === selectedYear) {
      if (c.os && !isOSCalidadAnalitica(c.os) && !isActoBioquimico(c.practica)) {
        const cleanOS = normalizeOSCode(c.os);
        const tipo = getTipoAtencion(cleanOS);
        allMonthlyOSSet.add(cleanOS);
        if (tipo === 'URGENCIA') {
          allMonthlyOSUrgSet.add(cleanOS);
        } else {
          allMonthlyOSRutSet.add(cleanOS);
        }
        monthlyPracticesSet.add(`${cleanOS}___${normalizeText(c.practica)}`);
      }
    }
  });

  let totalOSPrometidasMes = 0;
  let totalOSPrometidasUrgencias = 0;
  let totalOSPrometidasRutina = 0;
  let totalPracticasPrometidasMes = 0;
  let esDenominadorCompleto = false;

  // 3a. UNIFICACIÓN AUDITADA DE JORNADAS OPERATIVAS DEL MES (dailyHistory + tatSummaries):
  // Garantiza que el denominador contemple SIEMPRE el acumulado de todas las OS del mes en curso y de meses anteriores.
  const monthDaysMap = new Map<string, {
    fecha: string;
    fechaFormateada: string;
    osTotales: number;
    osTotalesUrgencia?: number;
    osTotalesRutina?: number;
    practicasTotales: number;
    practicasListas?: number;
    practicasNoListas?: number;
    osAfectadas?: number;
    hasDetailedRecords: boolean;
  }>();

  dailyHistory.forEach((d) => {
    const parsed = parseMonthYearFromDate(d.fecha);
    if (parsed && parsed.mes === selectedMonth && parsed.año === selectedYear) {
      const hasRecords = !!(d.records && Array.isArray(d.records) && d.records.length > 0);
      monthDaysMap.set(d.fecha, {
        fecha: d.fecha,
        fechaFormateada: d.fechaFormateada || formatISOToDisplayDate(d.fecha),
        osTotales: d.osTotales || 0,
        osTotalesUrgencia: (d as any).osTotalesUrgencia,
        osTotalesRutina: (d as any).osTotalesRutina,
        practicasTotales: d.practicasTotales || 0,
        practicasListas: (d as any).practicasListas,
        practicasNoListas: (d as any).practicasNoListas,
        osAfectadas: (d as any).osConPendientes || (d as any).osAfectadas || 0,
        hasDetailedRecords: hasRecords,
      });
    }
  });

  tatSummaries.forEach((s) => {
    const parsed = parseMonthYearFromDate((s as any).fechaPrometida) || parseMonthYearFromDate(s.fecha);
    if (parsed && parsed.mes === selectedMonth && parsed.año === selectedYear) {
      const existing = monthDaysMap.get(s.fecha);
      if (!existing) {
        monthDaysMap.set(s.fecha, {
          fecha: s.fecha,
          fechaFormateada: s.fechaFormateada || formatISOToDisplayDate(s.fecha),
          osTotales: s.osTotales || 0,
          osTotalesUrgencia: s.osTotalesUrgencia,
          osTotalesRutina: s.osTotalesRutina,
          practicasTotales: s.practicasTotales || 0,
          practicasListas: s.practicasListas,
          practicasNoListas: s.practicasNoListas,
          osAfectadas: s.osAfectadas || 0,
          hasDetailedRecords: false,
        });
      } else {
        // Enriquecer datos si el resumen tiene información complementaria o más precisa
        if (s.osTotales && (existing.osTotales === 0 || !existing.hasDetailedRecords)) {
          existing.osTotales = s.osTotales;
        }
        if (s.osTotalesUrgencia !== undefined && (existing.osTotalesUrgencia === undefined || !existing.hasDetailedRecords)) {
          existing.osTotalesUrgencia = s.osTotalesUrgencia;
        }
        if (s.osTotalesRutina !== undefined && (existing.osTotalesRutina === undefined || !existing.hasDetailedRecords)) {
          existing.osTotalesRutina = s.osTotalesRutina;
        }
        if (s.practicasTotales && (existing.practicasTotales === 0 || !existing.hasDetailedRecords)) {
          existing.practicasTotales = s.practicasTotales;
        }
        if (s.practicasListas !== undefined && (existing.practicasListas === undefined || !existing.hasDetailedRecords)) {
          existing.practicasListas = s.practicasListas;
        }
        if (s.practicasNoListas !== undefined && (existing.practicasNoListas === undefined || !existing.hasDetailedRecords)) {
          existing.practicasNoListas = s.practicasNoListas;
        }
        if (s.osAfectadas !== undefined && (!existing.hasDetailedRecords || existing.osAfectadas === 0)) {
          existing.osAfectadas = s.osAfectadas;
        }
      }
    }
  });

  const allMonthDaysList = Array.from(monthDaysMap.values());
  const sumOSTotalesAllDays = allMonthDaysList.reduce((acc, d) => acc + (d.osTotales || 0), 0);
  const sumOSUrgAllDays = allMonthDaysList.reduce((acc, d) => acc + (d.osTotalesUrgencia || 0), 0);
  const sumOSRutAllDays = allMonthDaysList.reduce((acc, d) => acc + (d.osTotalesRutina || 0), 0);
  const sumPracticasAllDays = allMonthDaysList.reduce((acc, d) => acc + (d.practicasTotales || 0), 0);

  // Jerarquía auditada del Denominador institucional:
  // 1. Si disponemos de registros individuales fila por fila (delivery records con volumen real de pacientes):
  //    Utilizar el COUNT DISTINCT de OS individuales deduplicadas de todas las entregas del mes (ej. Septiembre: 11.278 OS únicas deduplicadas).
  // 2. Si no disponemos de registros individuales nominales pero existen jornadas registradas (tatSummaries o dailyHistory):
  //    Utilizar el acumulado operativo de todas las jornadas del mes en curso (ej. Octubre: 594 + 620 + 709 = 1.923 OS totales acumuladas).
  // 3. Fallback histórico a resumenList (meses históricos precargados).
  // CRÍTICO: NUNCA ASIGNAR totalOSPrometidasMes = allMonthlyOSSet.size si no hay registros nominales,
  // porque si sólo se capturaron los desvíos (casesInPeriod), allMonthlyOSSet contendría solo las órdenes con desvío
  // falseando el denominador (ej. 8 OS / 8 OS).

  const daysWithDetailedRecords = allMonthDaysList.filter((d) => d.hasDetailedRecords).length;
  const hasFullDetailedMonth =
    allMonthDaysList.length > 0 &&
    daysWithDetailedRecords === allMonthDaysList.length &&
    allMonthlyOSSet.size >= sumOSTotalesAllDays * 0.70;

  if (hasFullDetailedMonth && allMonthlyOSSet.size > 0) {
    // Caso 1: Detalle nominal completo de todas las jornadas del mes fila por fila (ej. Septiembre 2026: 11.278 OS únicas deduplicadas)
    totalOSPrometidasMes = allMonthlyOSSet.size;
    totalOSPrometidasUrgencias = allMonthlyOSUrgSet.size;
    totalOSPrometidasRutina = totalOSPrometidasMes - totalOSPrometidasUrgencias;
    totalPracticasPrometidasMes = monthlyPracticesSet.size;
    esDenominadorCompleto = true;
  } else if (sumOSTotalesAllDays > 0) {
    // Caso 2: Acumulado de jornadas operativas disponibles del mes en curso (ej. Octubre 2026: 594 + 620 + 715 + 709 + 732 + 889 + 714 = 4.973 OS totales)
    // O mes híbrido donde algunas jornadas tienen resumen y otras detalle diario.
    totalOSPrometidasMes = sumOSTotalesAllDays;
    if (sumOSUrgAllDays > 0 && sumOSRutAllDays > 0 && sumOSUrgAllDays + sumOSRutAllDays === sumOSTotalesAllDays) {
      totalOSPrometidasUrgencias = sumOSUrgAllDays;
      totalOSPrometidasRutina = sumOSRutAllDays;
    } else if (sumOSUrgAllDays > 0 && sumOSUrgAllDays <= sumOSTotalesAllDays) {
      totalOSPrometidasUrgencias = sumOSUrgAllDays;
      totalOSPrometidasRutina = totalOSPrometidasMes - totalOSPrometidasUrgencias;
    } else {
      totalOSPrometidasUrgencias = allMonthlyOSUrgSet.size > 0 ? Math.round(sumOSTotalesAllDays * 0.25) : 0;
      totalOSPrometidasRutina = totalOSPrometidasMes - totalOSPrometidasUrgencias;
    }
    totalPracticasPrometidasMes = sumPracticasAllDays > 0 ? sumPracticasAllDays : Math.round(sumOSTotalesAllDays * 9.2);
    esDenominadorCompleto = true;
  }

  // 3b. Fallback para meses históricos consolidados sin detalle diario (ej. Julio 2026 en resumenList)
  let historicalRow: ResumenMensualRow | undefined;
  if (totalOSPrometidasMes === 0 && resumenList.length > 0) {
    historicalRow = resumenList.find((r) => r.Mes === selectedMonth && r.Año === selectedYear);
    if (historicalRow && historicalRow.PacientesAtendidos && historicalRow.PacientesAtendidos > 0) {
      totalOSPrometidasMes = historicalRow.PacientesAtendidos;
      totalOSPrometidasUrgencias = Math.round(totalOSPrometidasMes * 0.25);
      totalOSPrometidasRutina = totalOSPrometidasMes - totalOSPrometidasUrgencias;
      totalPracticasPrometidasMes = Math.round(historicalRow.PacientesAtendidos * 2.85);
      if (osAfectadasUnicasMes === 0 && historicalRow.PacientesUnicosFueraPlazo) {
        osAfectadasUnicasMes = historicalRow.PacientesUnicosFueraPlazo;
      }
      if (practicasFueraPlazoUnicasMes === 0 && historicalRow.EstudiosFueraPlazo) {
        practicasFueraPlazoUnicasMes = historicalRow.EstudiosFueraPlazo;
      }
      esDenominadorCompleto = true;
    }
  }

  // 3c. Detección de corte de datos y fecha acumulada
  const isCurrentOrFutureMonth =
    selectedYear === todayDate.getFullYear() && getMonthIndex(selectedMonth) === todayDate.getMonth();
  
  // Buscar la fecha más reciente de los datos con fecha prometida en este mes
  let latestDateInMonthISO: string | null = null;
  casesInPeriod.forEach((c) => {
    const raw = c.fechaPrometida || (c as any).fechaPrometidaISO || c.fechaPrometidaTexto;
    if (raw && typeof raw === 'string') {
      const parsed = parseMonthYearFromDate(raw);
      if (parsed && parsed.mes === selectedMonth && parsed.año === selectedYear) {
        const clean = raw.trim().substring(0, 10);
        if (!latestDateInMonthISO || clean > latestDateInMonthISO) {
          latestDateInMonthISO = clean;
        }
      }
    }
  });

  dailyHistory.forEach((d) => {
    if (d.records) {
      d.records.forEach((r) => {
        const raw = r.fechaPrometida || (r as any).fechaHoraPrometida;
        if (raw && typeof raw === 'string') {
          const parsed = parseMonthYearFromDate(raw);
          if (parsed && parsed.mes === selectedMonth && parsed.año === selectedYear) {
            const clean = raw.trim().substring(0, 10);
            if (!latestDateInMonthISO || clean > latestDateInMonthISO) {
              latestDateInMonthISO = clean;
            }
          }
        }
      });
    }
  });

  tatSummaries.forEach((s) => {
    const raw = (s as any).fechaPrometida || s.fecha;
    if (raw && typeof raw === 'string') {
      const parsed = parseMonthYearFromDate(raw);
      if (parsed && parsed.mes === selectedMonth && parsed.año === selectedYear) {
        const clean = raw.trim().substring(0, 10);
        if (!latestDateInMonthISO || clean > latestDateInMonthISO) {
          latestDateInMonthISO = clean;
        }
      }
    }
  });

  const esMesParcial = isCurrentOrFutureMonth || (totalOSPrometidasMes > 0 && totalOSPrometidasMes < 4000 && !historicalRow);
  
  let textoMesParcial: string | undefined = undefined;
  if (isCurrentOrFutureMonth) {
    const formattedDate = latestDateInMonthISO
      ? formatISOToDisplayDate(latestDateInMonthISO)
      : formatDateToDisplayDDMMYYYY(todayDate);
    textoMesParcial = `Datos acumulados al ${formattedDate}`;
  } else if (esMesParcial && latestDateInMonthISO) {
    textoMesParcial = `Mes parcial — datos hasta ${formatISOToDisplayDate(latestDateInMonthISO)}`;
  }

  // 3d. Validaciones Obligatorias de Consistencia Matemática y Exclusión 016
  let esValido = true;
  let mensajeInconsistencia: string | null = null;
  let inconsistenciaClasificacion = false;

  // Verificación de que no se haya filtrado ninguna OS de calidad analítica (016)
  let has016Contamination = false;
  allMonthlyOSSet.forEach((os) => {
    if (isOSCalidadAnalitica(os)) has016Contamination = true;
  });
  casesInPeriod.forEach((c) => {
    if (isOSCalidadAnalitica(c.os)) has016Contamination = true;
  });

  if (has016Contamination) {
    esValido = false;
    mensajeInconsistencia = 'Error de consistencia: Se detectaron órdenes de Calidad Analítica (016) en el cómputo de plazos.';
  } else if (esDenominadorCompleto && totalOSPrometidasMes > 0) {
    if (osAfectadasUnicasMes > totalOSPrometidasMes) {
      esValido = false;
      mensajeInconsistencia = 'Indicador no confiable — revisar consistencia de datos (OS afectadas superan a OS totales)';
    }
  }

  // Validación de balance estricto Urgencias + Rutina = Global
  if (esDenominadorCompleto && totalOSPrometidasMes > 0 && (totalOSPrometidasUrgencias > 0 || totalOSPrometidasRutina > 0)) {
    if (totalOSPrometidasUrgencias + totalOSPrometidasRutina !== totalOSPrometidasMes) {
      if (Math.abs(totalOSPrometidasMes - (totalOSPrometidasUrgencias + totalOSPrometidasRutina)) <= 2) {
        totalOSPrometidasRutina = totalOSPrometidasMes - totalOSPrometidasUrgencias;
      } else {
        inconsistenciaClasificacion = true;
        esValido = false;
        mensajeInconsistencia = 'Inconsistencia de datos: OS Urgencias + OS Rutina no coincide con el total Global';
      }
    }
  }
  if (osAfectadasUnicasMes > 0 && (osAfectadasUnicasUrgencias > 0 || osAfectadasUnicasRutina > 0)) {
    if (osAfectadasUnicasUrgencias + osAfectadasUnicasRutina !== osAfectadasUnicasMes) {
      if (Math.abs(osAfectadasUnicasMes - (osAfectadasUnicasUrgencias + osAfectadasUnicasRutina)) <= 1) {
        osAfectadasUnicasRutina = osAfectadasUnicasMes - osAfectadasUnicasUrgencias;
      } else {
        inconsistenciaClasificacion = true;
        esValido = false;
        mensajeInconsistencia = 'Inconsistencia de datos: OS fuera de plazo Urgencias + Rutina no coincide con el total Global';
      }
    }
  }

  const desgloseJornadasMes = Array.from(monthDaysMap.values())
    .map((day) => {
      const dayDelays = casesInPeriod.filter((c) => {
        const fp = c.fechaPrometida || '';
        return fp === day.fecha || fp.startsWith(day.fecha);
      });
      const dayAffectedOS = new Set(dayDelays.map((c) => normalizeOSCode(c.os))).size;

      return {
        fecha: day.fecha,
        fechaFormateada: day.fechaFormateada || formatISOToDisplayDate(day.fecha),
        osTotales: day.osTotales || 0,
        osAfectadas: dayAffectedOS > 0 ? dayAffectedOS : (day.osAfectadas || 0),
        practicasPrometidas: day.practicasTotales || 0,
        practicasListas: day.practicasListas || 0,
        practicasNoListas: day.practicasNoListas || 0,
      };
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  // 4. Cálculo del Porcentaje Institucional (% Pacientes / OS Fuera de Plazo)
  // Fórmula Global: (COUNT DISTINCT(OS con al menos 1 práctica fuera de plazo) / COUNT DISTINCT(OS totales prometidas en el mes)) * 100
  let porcentajeFueraPlazo: number | null = null;
  let porcentajeFueraPlazoTexto = 'Dato pendiente';
  let detalleCalculoOS = 'Falta denominador de pacientes prometidos';

  if (!esValido && !inconsistenciaClasificacion) {
    porcentajeFueraPlazoTexto = 'Indicador no confiable — revisar consistencia de datos';
    detalleCalculoOS = `${osAfectadasUnicasMes.toLocaleString('es-AR')} OS afectadas / ${totalOSPrometidasMes.toLocaleString('es-AR')} OS totales`;
  } else if (inconsistenciaClasificacion) {
    porcentajeFueraPlazoTexto = 'Inconsistencia de datos';
    detalleCalculoOS = 'Discrepancia en clasificación Urgencias / Rutina';
  } else if (historicalRow && typeof historicalRow.PorcentajeFueraPlazo === 'number') {
    porcentajeFueraPlazo = historicalRow.PorcentajeFueraPlazo;
    porcentajeFueraPlazoTexto = `${porcentajeFueraPlazo.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} %`;
    detalleCalculoOS = `${osAfectadasUnicasMes.toLocaleString('es-AR')} OS afectadas / ${totalOSPrometidasMes.toLocaleString('es-AR')} OS totales`;
  } else if (esDenominadorCompleto && totalOSPrometidasMes > 0) {
    const rawPct = (osAfectadasUnicasMes / totalOSPrometidasMes) * 100;
    porcentajeFueraPlazo = Math.round(rawPct * 100) / 100;
    porcentajeFueraPlazoTexto = `${porcentajeFueraPlazo.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} %`;
    detalleCalculoOS = `${osAfectadasUnicasMes.toLocaleString('es-AR')} OS afectadas / ${totalOSPrometidasMes.toLocaleString('es-AR')} OS totales`;
  } else if (totalOSPrometidasMes > 0) {
    porcentajeFueraPlazo = 0;
    porcentajeFueraPlazoTexto = '0,00 %';
    detalleCalculoOS = `0 OS afectadas / ${totalOSPrometidasMes.toLocaleString('es-AR')} OS totales`;
  } else {
    porcentajeFueraPlazo = null;
    porcentajeFueraPlazoTexto = 'Pendiente de carga';
    detalleCalculoOS = `Sin registros con fecha prometida en ${selectedMonth} ${selectedYear}`;
  }

  // 4b. Indicador TAT URGENCIAS: (OS únicas de Urgencia fuera de plazo / OS únicas totales de Urgencia) * 100
  let porcentajeFueraPlazoUrgencias: number | null = null;
  let porcentajeFueraPlazoTextoUrgencias = 'Dato pendiente';
  let detalleCalculoOSUrgencias = 'Falta denominador de Urgencias';

  if (esDenominadorCompleto && totalOSPrometidasUrgencias > 0) {
    const rawPctUrg = (osAfectadasUnicasUrgencias / totalOSPrometidasUrgencias) * 100;
    porcentajeFueraPlazoUrgencias = Math.round(rawPctUrg * 100) / 100;
    porcentajeFueraPlazoTextoUrgencias = `${porcentajeFueraPlazoUrgencias.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} %`;
    detalleCalculoOSUrgencias = `${osAfectadasUnicasUrgencias.toLocaleString('es-AR')} OS fuera de plazo / ${totalOSPrometidasUrgencias.toLocaleString('es-AR')} OS totales`;
  } else if (totalOSPrometidasUrgencias === 0 && osAfectadasUnicasUrgencias === 0 && totalOSPrometidasMes > 0) {
    porcentajeFueraPlazoUrgencias = 0;
    porcentajeFueraPlazoTextoUrgencias = '0,00 %';
    detalleCalculoOSUrgencias = '0 OS fuera de plazo / 0 OS totales';
  } else if (totalOSPrometidasUrgencias === 0 && osAfectadasUnicasUrgencias === 0) {
    porcentajeFueraPlazoUrgencias = null;
    porcentajeFueraPlazoTextoUrgencias = 'Pendiente de carga';
    detalleCalculoOSUrgencias = 'Sin datos de urgencias cargados';
  } else if (osAfectadasUnicasUrgencias > 0) {
    detalleCalculoOSUrgencias = `${osAfectadasUnicasUrgencias.toLocaleString('es-AR')} OS fuera de plazo (Falta denominador)`;
  }

  // 4c. Indicador TAT RUTINA: (OS únicas de Rutina fuera de plazo / OS únicas totales de Rutina) * 100
  let porcentajeFueraPlazoRutina: number | null = null;
  let porcentajeFueraPlazoTextoRutina = 'Dato pendiente';
  let detalleCalculoOSRutina = 'Falta denominador de Rutina';

  if (esDenominadorCompleto && totalOSPrometidasRutina > 0) {
    const rawPctRut = (osAfectadasUnicasRutina / totalOSPrometidasRutina) * 100;
    porcentajeFueraPlazoRutina = Math.round(rawPctRut * 100) / 100;
    porcentajeFueraPlazoTextoRutina = `${porcentajeFueraPlazoRutina.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} %`;
    detalleCalculoOSRutina = `${osAfectadasUnicasRutina.toLocaleString('es-AR')} OS fuera de plazo / ${totalOSPrometidasRutina.toLocaleString('es-AR')} OS totales`;
  } else if (totalOSPrometidasRutina === 0 && osAfectadasUnicasRutina === 0 && totalOSPrometidasMes > 0) {
    porcentajeFueraPlazoRutina = 0;
    porcentajeFueraPlazoTextoRutina = '0,00 %';
    detalleCalculoOSRutina = '0 OS fuera de plazo / 0 OS totales';
  } else if (totalOSPrometidasRutina === 0 && osAfectadasUnicasRutina === 0) {
    porcentajeFueraPlazoRutina = null;
    porcentajeFueraPlazoTextoRutina = 'Pendiente de carga';
    detalleCalculoOSRutina = 'Sin datos de rutina cargados';
  } else if (osAfectadasUnicasRutina > 0) {
    detalleCalculoOSRutina = `${osAfectadasUnicasRutina.toLocaleString('es-AR')} OS fuera de plazo (Falta denominador)`;
  }

  // 5. Promedio de Demora en Días Calendario para los casos del período (Global, Urgencias, Rutina)
  let promedioDemoraDiasPeriodo = 0;
  let promedioDemoraDiasUrgencias = 0;
  let promedioDemoraDiasRutina = 0;

  if (historicalRow && typeof historicalRow.MedianaRetraso === 'number' && casesInPeriod.length === 0) {
    promedioDemoraDiasPeriodo = historicalRow.MedianaRetraso;
    promedioDemoraDiasUrgencias = historicalRow.MedianaRetraso;
    promedioDemoraDiasRutina = historicalRow.MedianaRetraso;
  } else if (casesInPeriod.length > 0) {
    const calcDelay = (c: TATCase) => {
      if (
        c.estadoSeguimiento === 'CERRADO' ||
        c.estadoSeguimiento === 'Cerrado manualmente' ||
        c.estadoSeguimiento === 'Cerrado automáticamente'
      ) {
        return c.tiempoAtrasoDias || 1;
      }
      return calculateDelayDays(c.fechaPrometida, todayDate) || c.tiempoAtrasoDias || 1;
    };

    const delays = casesInPeriod.map(calcDelay);
    const sum = delays.reduce((acc, d) => acc + d, 0);
    promedioDemoraDiasPeriodo = Math.round((sum / delays.length) * 10) / 10;

    const casesUrg = casesInPeriod.filter((c) => getTipoAtencion(c.os) === 'URGENCIA');
    if (casesUrg.length > 0) {
      const delaysUrg = casesUrg.map(calcDelay);
      promedioDemoraDiasUrgencias = Math.round((delaysUrg.reduce((a, b) => a + b, 0) / delaysUrg.length) * 10) / 10;
    }

    const casesRut = casesInPeriod.filter((c) => getTipoAtencion(c.os) === 'RUTINA');
    if (casesRut.length > 0) {
      const delaysRut = casesRut.map(calcDelay);
      promedioDemoraDiasRutina = Math.round((delaysRut.reduce((a, b) => a + b, 0) / delaysRut.length) * 10) / 10;
    }
  }

  return {
    casosEnProcesoActuales,
    casosEnProcesoUrgencias,
    casosEnProcesoRutina,
    porcentajeFueraPlazo,
    porcentajeFueraPlazoTexto,
    totalOSPrometidasMes,
    osAfectadasUnicasMes,
    totalPracticasPrometidasMes,
    practicasFueraPlazoUnicasMes,
    detalleCalculoOS,
    // Desglose Urgencias vs Rutina
    totalOSPrometidasUrgencias,
    osAfectadasUnicasUrgencias,
    porcentajeFueraPlazoUrgencias,
    porcentajeFueraPlazoTextoUrgencias,
    detalleCalculoOSUrgencias,
    totalOSPrometidasRutina,
    osAfectadasUnicasRutina,
    porcentajeFueraPlazoRutina,
    porcentajeFueraPlazoTextoRutina,
    detalleCalculoOSRutina,
    promedioDemoraDiasPeriodo,
    promedioDemoraDiasUrgencias,
    promedioDemoraDiasRutina,
    inconsistenciaClasificacion,
    mes: selectedMonth,
    año: selectedYear,
    esDenominadorCompleto,
    esMesParcial,
    textoMesParcial,
    esValido,
    mensajeInconsistencia,
    rulesVersion: '1.1',
    fechaCalculo: nowFormatted,
    jornadasCargadasCount: monthDaysMap.size,
    desgloseJornadasMes,
  };
}

/**
 * Genera la serie histórica auditable de meses para la sección "Evolución Mensual de Fuera de Plazo"
 * Refleja el cálculo institucional de OS / Pacientes afectadas sobre OS totales prometidas.
 * RulesVersion: 1.1
 */
export function calculateMonthlyTATHistory(
  allCases: TATCase[],
  dailyHistory: DailyDeliveryEntry[] = [],
  resumenList: ResumenMensualRow[] = [],
  todayDate: Date = new Date(),
  tatSummaries: TATDailySummary[] = []
): MonthlyTATMetric[] {
  const history: MonthlyTATMetric[] = [];
  const nowFormatted = formatToDDMMYYYYHHmm(todayDate);
  const operationalCases = allCases.filter(
    (c) => !c.excludedFromOperationalMetrics && !isPreImplementationBreach(c) && !isOSCalidadAnalitica(c.os) && !isActoBioquimico(c.practica)
  );

  // Recopilar todos los períodos presentes en resumenList, dailyHistory o tatSummaries
  const periodKeys = new Set<string>();

  resumenList.forEach((r) => {
    if (r.EstadoCarga !== 'Pendiente de carga' && r.PacientesAtendidos && r.PacientesAtendidos > 0) {
      periodKeys.add(`${r.Año}-${String(getMonthIndex(r.Mes) + 1).padStart(2, '0')}`);
    }
  });

  dailyHistory.forEach((d) => {
    if (d.records && Array.isArray(d.records)) {
      d.records.forEach((r) => {
        const parsed = parseMonthYearFromDate(r.fechaPrometida) || parseMonthYearFromDate((r as any).fechaHoraPrometida);
        if (parsed) {
          periodKeys.add(`${parsed.año}-${String(getMonthIndex(parsed.mes) + 1).padStart(2, '0')}`);
        }
      });
    }
    const parsed = parseMonthYearFromDate(d.fecha);
    if (parsed) {
      periodKeys.add(`${parsed.año}-${String(getMonthIndex(parsed.mes) + 1).padStart(2, '0')}`);
    }
  });

  tatSummaries.forEach((s) => {
    const parsed = parseMonthYearFromDate(s.fecha);
    if (parsed) {
      periodKeys.add(`${parsed.año}-${String(getMonthIndex(parsed.mes) + 1).padStart(2, '0')}`);
    }
  });

  // Asegurar que meses con casos TAT operativos se evalúen por su FECHA PROMETIDA
  operationalCases.forEach((c) => {
    const parsed = extractPromisedMonthYear(c);
    if (parsed) {
      periodKeys.add(`${parsed.año}-${String(getMonthIndex(parsed.mes) + 1).padStart(2, '0')}`);
    }
  });

  // Si no hay períodos cargados, agregar al menos el mes corriente
  if (periodKeys.size === 0) {
    const currYear = todayDate.getFullYear();
    periodKeys.add(`${currYear}-${String(todayDate.getMonth() + 1).padStart(2, '0')}`);
  }

  // Excluir estrictamente cualquier período anterior al inicio formal TAT (Septiembre 2026 / 2026-09-01).
  // Los registros previos corresponden a pruebas y no representan evolución, tendencias ni promedios oficiales.
  const sortedKeys = Array.from(periodKeys)
    .filter((key) => key >= TAT_OFFICIAL_START_PERIOD)
    .sort();

  sortedKeys.forEach((key) => {
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const monthName = MONTH_NAMES_LIST[monthNum - 1];

    const kpi = calculateTATPeriodKPIs(allCases, monthName, year, dailyHistory, resumenList, todayDate, tatSummaries);

    // Solo incluir meses que tengan denominador de OS válido y mayor a 0
    if (kpi.esDenominadorCompleto && kpi.totalOSPrometidasMes > 0 && kpi.porcentajeFueraPlazo !== null) {
      history.push({
        mes: monthName,
        año: year,
        monthKey: `${monthName} ${year}`,
        totalOSPrometidas: kpi.totalOSPrometidasMes,
        osAfectadasUnicas: kpi.osAfectadasUnicasMes,
        totalPracticasPrometidas: kpi.totalPracticasPrometidasMes,
        practicasFueraPlazoUnicas: kpi.practicasFueraPlazoUnicasMes,
        porcentajeCalculado: kpi.porcentajeFueraPlazo,
        totalOSPrometidasUrgencias: kpi.totalOSPrometidasUrgencias,
        osAfectadasUnicasUrgencias: kpi.osAfectadasUnicasUrgencias,
        porcentajeCalculadoUrgencias: kpi.porcentajeFueraPlazoUrgencias,
        totalOSPrometidasRutina: kpi.totalOSPrometidasRutina,
        osAfectadasUnicasRutina: kpi.osAfectadasUnicasRutina,
        porcentajeCalculadoRutina: kpi.porcentajeFueraPlazoRutina,
        promedioDemoraDias: kpi.promedioDemoraDiasPeriodo,
        rulesVersion: '1.1',
        fechaCalculo: nowFormatted,
        esDenominadorCompleto: true,
        casosEnPeriodoCount: kpi.practicasFueraPlazoUnicasMes,
        jornadasCargadasCount: kpi.jornadasCargadasCount,
      });
    }
  });

  return history;
}

/**
 * Calcula el Promedio Histórico de % Fuera de Plazo para una ventana de N meses (ej. 3, 6, 12 meses)
 * Solo incluye meses con denominador completo y comparable en base a OS únicas.
 */
export function calculateHistoricalTATAverage(
  history: MonthlyTATMetric[],
  windowMonths: number = 6,
  series: 'GLOBAL' | 'URGENCIA' | 'RUTINA' = 'GLOBAL'
): {
  average: number | null;
  averageFormatted: string;
  monthsCount: number;
  validMonths: MonthlyTATMetric[];
  titleTexto: string;
} {
  const completeMonths = history.filter((m) => {
    if (!m.esDenominadorCompleto) return false;
    const pKey = `${m.año}-${String(getMonthIndex(m.mes) + 1).padStart(2, '0')}`;
    if (pKey < TAT_OFFICIAL_START_PERIOD) return false;
    if (series === 'URGENCIA') return m.porcentajeCalculadoUrgencias !== null && m.porcentajeCalculadoUrgencias !== undefined;
    if (series === 'RUTINA') return m.porcentajeCalculadoRutina !== null && m.porcentajeCalculadoRutina !== undefined;
    return m.porcentajeCalculado !== null;
  });
  const slice = completeMonths.slice(-windowMonths);

  if (slice.length === 0) {
    return {
      average: null,
      averageFormatted: 'N/D',
      monthsCount: 0,
      validMonths: [],
      titleTexto: 'Sin meses oficiales disponibles',
    };
  }

  let totalBreachesOS = 0;
  let totalPromisedOS = 0;

  if (series === 'URGENCIA') {
    totalBreachesOS = slice.reduce((acc, m) => acc + (m.osAfectadasUnicasUrgencias || 0), 0);
    totalPromisedOS = slice.reduce((acc, m) => acc + (m.totalOSPrometidasUrgencias || 0), 0);
  } else if (series === 'RUTINA') {
    totalBreachesOS = slice.reduce((acc, m) => acc + (m.osAfectadasUnicasRutina || 0), 0);
    totalPromisedOS = slice.reduce((acc, m) => acc + (m.totalOSPrometidasRutina || 0), 0);
  } else {
    totalBreachesOS = slice.reduce((acc, m) => acc + m.osAfectadasUnicas, 0);
    totalPromisedOS = slice.reduce((acc, m) => acc + m.totalOSPrometidas, 0);
  }

  const avg = totalPromisedOS > 0
    ? Math.round((totalBreachesOS / totalPromisedOS) * 10000) / 100
    : 0;

  const averageFormatted = `${avg.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;

  const titleTexto =
    slice.length === 1
      ? `Promedio disponible: ${slice[0].monthKey} — ${averageFormatted}`
      : `Promedio últimos ${slice.length} meses: ${averageFormatted}`;

  return {
    average: avg,
    averageFormatted,
    monthsCount: slice.length,
    validMonths: slice,
    titleTexto,
  };
}

