export type MonthName =
  | 'Enero'
  | 'Febrero'
  | 'Marzo'
  | 'Abril'
  | 'Mayo'
  | 'Junio'
  | 'Julio'
  | 'Agosto'
  | 'Septiembre'
  | 'Octubre'
  | 'Noviembre'
  | 'Diciembre';

export type LoadStatus =
  | 'Cargado (completo)'
  | 'Cargado (parcial) - falta denominador de pacientes atendidos'
  | 'Pendiente de carga';

export type EstadoOS = 'Cerrado' | 'En Proceso' | 'Sin estado definido';

export type NotificacionRegistro = 'Con registro' | 'Sin registro';

export interface IncumplimientoRow {
  id: string; // Internal unique row ID
  Mes: MonthName;
  Año: number;
  FechaRegistro: string;
  IDPaciente: string; // Restricted use
  NombrePaciente: string; // Restricted use
  ExamenEstudio: string;
  FechaPrometida: string;
  FechaReal: string;
  DiasRetraso: number;
  CausaNormalizada: string; // Original raw load text
  CausaValidada: string; // Standard validated category (used for grouping & ranking)
  EstadoNotificacion: string; // Free text
  NotificacionRegistro: NotificacionRegistro;
  EstadoOS: EstadoOS;
  Observaciones?: string;
  Seguimiento1?: string;
  Seguimiento2?: string;
}

export interface ResumenMensualRow {
  Mes: MonthName;
  Año: number;
  EstadoCarga: LoadStatus;
  PacientesAtendidos: number | null;
  PacientesUnicosFueraPlazo: number | null;
  EstudiosFueraPlazo: number | null;
  MedianaRetraso: number | null;
  MaximoRetraso: number | null;
  PorcentajeFueraPlazo: number | null; // (Pacientes únicos fuera / Atendidos) * 100
  PorcentajeCumplimiento: number | null; // 100 - PorcentajeFueraPlazo
}

export interface RankingCausaRow {
  Mes: MonthName;
  Año: number;
  Causa: string;
  Cantidad: number;
  PorcentajeTotal: number;
}

export interface RankingEstudioRow {
  Mes: MonthName;
  Año: number;
  Estudio: string;
  Cantidad: number;
  PorcentajeTotal: number;
  DemoraMediana: number;
  DemoraMaxima: number;
}

export interface DiccionarioEntry {
  termino: string;
  definicion: string;
  formula?: string;
  fuenteRegla: string;
  impactoGestion: string;
}

export interface PeriodKPIs {
  cumplimientoPorcentaje: number | null;
  cumplimientoTexto: string; // e.g. "98.83 %" or "Dato pendiente"
  cumplimientoDetalle: string; // e.g. "48 pacientes fuera de plazo / 4.120 pacientes atendidos" or "Falta denominador"
  pacientesFueraPlazo: number | null;
  estudiosFueraPlazo: number | null;
  medianaDemora: number | null;
  maximaDemora: number | null;
  estadoCarga: LoadStatus;
  totalCasosSinEstado: number;
  totalCasosEnProceso: number;
  totalCasosCerrados: number;
  totalConRegistroNotif: number;
  totalSinRegistroNotif: number;
}

export interface SeverityDistribution {
  dia1: number;
  dias2a3: number;
  dias4a7: number;
  mas7dias: number;
  total: number;
}

export type ActiveModule =
  | 'plazos'
  | 'entregas_hoy'
  | 'entregas_graficos'
  | 'resumen'
  | 'asistente'
  | 'placeholder_experiencia'
  | 'placeholder_preanalitica'
  | 'placeholder_analitica'
  | 'placeholder_iso15189'
  | string;

export type OperationalStatusGroup = 'LISTO' | 'NO_LISTO' | 'PENDIENTE' | 'DESCONOCIDO' | 'REVISAR' | 'EXCLUIDO';

/**
 * Módulo TAT Rediseñado: Seguimiento Operativo de Prácticas Vencidas
 * Entidad de caso único de seguimiento basado en la clave: OS + Práctica/Estudio
 */
export interface TATObservationHistoryEntry {
  id: string;
  timestamp: string; // ISO string
  fechaHora: string; // DD/MM/AAAA HH:mm
  usuario: string; // Email del usuario que realizó la acción
  texto: string; // Texto de la observación
}

export type EstadoSeguimientoCasoTAT =
  | 'EN PROCESO'
  | 'CERRADO'
  | 'ABIERTO'
  | 'Cerrado manualmente'
  | 'Cerrado automáticamente'
  | 'ARCHIVADO_PRE_IMPLEMENTACION';

export type TipoAtencionOS = 'URGENCIA' | 'RUTINA';

export interface TATCase {
  id: string; // Clave única determinística: `${normalizeOSCode(os)}___${normalizeText(practica)}`
  rulesVersion?: string; // e.g. "1.0"
  os: string; // Orden de Servicio original intacta para trazabilidad (ej. '014-67824-84 (E)' o '014-67824-84')
  tipoAtencion?: TipoAtencionOS; // Campo derivado: 'URGENCIA' si termina en (E), 'RUTINA' en caso contrario
  idPacienteAnon: string; // PAC-XXXX
  nombrePaciente?: string; // Nombre real (solo autorizados)
  practica: string; // Nombre de la práctica/estudio
  sede: string; // Sede / Unidad
  sector: string; // Sector técnico
  fechaPrometida: string; // YYYY-MM-DD
  fechaPrometidaTexto: string; // DD/MM/AAAA
  statusLIS: string; // Status en el LIS (ej. 'Esperando en unidad', 'En proceso', 'A firmar')
  tiempoAtrasoDias: number; // Días de atraso = Fecha actual - Fecha prometida (congelado al cerrar)
  estadoSeguimiento: EstadoSeguimientoCasoTAT; // 'EN PROCESO' | 'CERRADO' | 'ARCHIVADO_PRE_IMPLEMENTACION'
  observaciones: string; // Notas de seguimiento o acciones realizadas
  autorObservacion?: string; // Email del usuario que realizó la última observación
  fechaObservacion?: string; // DD/MM/AAAA HH:mm de la última observación
  historialObservaciones?: TATObservationHistoryEntry[]; // Historial auditable de observaciones
  fechaDeteccion: string; // DD/MM/AAAA HH:mm
  fechaUltimaActualizacion: string; // DD/MM/AAAA HH:mm
  fechaCierre?: string; // DD/MM/AAAA HH:mm (cuando pasó a CERRADO)
  usuarioCierre?: string; // Email de quien cerró el caso
  archivoOrigen?: string; // Archivo que detectó/actualizó el caso
  // Trazabilidad de Exclusión / Inicio Formal TAT 01/09/2026
  excludedFromOperationalMetrics?: boolean;
  motivoExclusion?: string;
  motivo?: string;
  fechaCorteExclusion?: string;
}

export interface TATKPISummary {
  totalCasos: number;
  casosEnProceso: number;
  casosCerrados: number;
  promedioAtrasoDias: number;
  maximoAtrasoDias: number;
}

/**
 * Registro auditable y trazable de métricas mensuales del Módulo TAT
 */
export interface MonthlyTATMetric {
  mes: MonthName;
  año: number;
  monthKey: string; // e.g. "Agosto 2026"
  totalOSPrometidas: number;
  osAfectadasUnicas: number;
  totalPracticasPrometidas: number;
  practicasFueraPlazoUnicas: number;
  porcentajeCalculado: number | null; // e.g. 0.42 (%)
  // Desglose por Tipo de Atención (Urgencias vs Rutina) - Universos y denominadores independientes
  totalOSPrometidasUrgencias?: number;
  osAfectadasUnicasUrgencias?: number;
  porcentajeCalculadoUrgencias?: number | null;
  totalOSPrometidasRutina?: number;
  osAfectadasUnicasRutina?: number;
  porcentajeCalculadoRutina?: number | null;
  promedioDemoraDias: number; // e.g. 1.8 (días calendario)
  rulesVersion: string; // "1.0"
  fechaCalculo: string; // "DD/MM/AAAA HH:mm"
  esDenominadorCompleto: boolean;
  casosEnPeriodoCount: number;
  jornadasCargadasCount?: number;
}

export interface TATPeriodKPIs {
  casosEnProcesoActuales: number;
  casosEnProcesoUrgencias?: number;
  casosEnProcesoRutina?: number;
  porcentajeFueraPlazo: number | null;
  porcentajeFueraPlazoTexto: string;
  totalOSPrometidasMes: number;
  osAfectadasUnicasMes: number;
  totalPracticasPrometidasMes: number;
  practicasFueraPlazoUnicasMes: number;
  detalleCalculoOS: string;
  // Desglose Urgencias vs Rutina
  totalOSPrometidasUrgencias: number;
  osAfectadasUnicasUrgencias: number;
  porcentajeFueraPlazoUrgencias: number | null;
  porcentajeFueraPlazoTextoUrgencias: string;
  detalleCalculoOSUrgencias: string;
  totalOSPrometidasRutina: number;
  osAfectadasUnicasRutina: number;
  porcentajeFueraPlazoRutina: number | null;
  porcentajeFueraPlazoTextoRutina: string;
  detalleCalculoOSRutina: string;
  promedioDemoraDiasPeriodo: number;
  promedioDemoraDiasUrgencias?: number;
  promedioDemoraDiasRutina?: number;
  inconsistenciaClasificacion?: boolean;
  mes: MonthName;
  año: number;
  esDenominadorCompleto: boolean;
  esMesParcial?: boolean;
  textoMesParcial?: string;
  esValido?: boolean;
  mensajeInconsistencia?: string | null;
  rulesVersion: string;
  fechaCalculo: string;
  jornadasCargadasCount: number;
  desgloseJornadasMes: {
    fecha: string;
    fechaFormateada: string;
    osTotales: number;
    osAfectadas: number;
    practicasPrometidas: number;
    practicasListas: number;
    practicasNoListas: number;
  }[];
}

export interface MorningTATProcessingResult {
  updatedCases: TATCase[];
  newCasesCount: number;
  updatedExistingCount: number;
  totalNoListasEnArchivo: number;
  // Auditoría y desglose matemático de la jornada procesada
  fechaPromesaProcesada: string; // ISO "YYYY-MM-DD"
  fechaPromesaTexto: string; // "DD/MM/AAAA"
  filasFisicasLeidas: number;
  actosBioquimicosExcluidos: number;
  osTotalesPrometidas: number; // Total OS del día
  osAfectadasFueraPlazo: number; // OS con al menos 1 práctica no lista
  practicasClinicasUnicas: number; // TOTAL PROMETIDO DEL DÍA
  practicasListas: number;
  practicasNoListas: number; // fuera de plazo detectadas
  esConsistente: boolean; // practicasListas + practicasNoListas === practicasClinicasUnicas
  // Proyección acumulada mensual
  mesNombre: MonthName;
  mesAño: number;
  totalOSPrometidasMensualAcumulado: number;
  osAfectadasMensualAcumulado: number;
  totalPrometidoMensualAcumulado: number;
  fueraPlazoMensualAcumulado: number;
  porcentajeMensualCalculado: number | null;
  porcentajeMensualCalculadoTexto: string;
  // Objeto de entrega diaria para persistencia (opcional / desacoplado)
  dailyDeliveryEntry?: DailyDeliveryEntry;
  tatSummary?: TATDailySummary;
  consolidatedPractices: ConsolidatedPractice[];
}

export interface TATDailySummary {
  fecha: string; // Formato ISO "YYYY-MM-DD"
  fechaFormateada?: string; // Formato local "DD/MM/AAAA"
  osTotales: number;
  osAfectadas: number;
  osTotalesUrgencia?: number;
  osAfectadasUrgencia?: number;
  osTotalesRutina?: number;
  osAfectadasRutina?: number;
  practicasTotales: number;
  practicasListas: number;
  practicasNoListas: number;
  nombreArchivo?: string;
  fechaCarga?: string;
  usuarioCarga?: string;
}

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

/**
 * Los 3 estados del sistema para análisis de plazos de entrega:
 * 1. Estado LIS: Estado técnico en el LIS (ej. 'Esperando en unidad', 'En proceso', 'Enviado por e-mail')
 * 2. Estado del Plazo: 'LISTA' | 'PENDIENTE_DENTRO_PLAZO' (preventivo) | 'FUERA_PLAZO' (TAT)
 * 3. Estado del Seguimiento: 'ABIERTO' | 'CERRADO_AUTOMATICO' | 'CERRADO_MANUAL' | 'REABIERTO' | 'ANULADO'
 */
export type EstadoPlazo = 'LISTA' | 'PENDIENTE_DENTRO_PLAZO' | 'FUERA_PLAZO';

export type EstadoSeguimientoTAT =
  | 'Abierto'
  | 'Cerrado manualmente'
  | 'Cerrado automáticamente'
  | 'Reabierto'
  | 'Anulado por error de datos'
  | 'ABIERTO'
  | 'CERRADO_AUTOMATICO'
  | 'CERRADO_MANUAL'
  | 'REABIERTO'
  | 'ANULADO';

export type EstadoSeguimientoStandard =
  | 'Abierto'
  | 'Cerrado manualmente'
  | 'Cerrado automáticamente'
  | 'Reabierto'
  | 'Anulado por error de datos';

export interface SeguimientoAuditoriaEntry {
  id: string;
  fechaHora: string; // DD/MM/AAAA HH:mm
  usuario: string; // Email del usuario que realizó la acción
  estadoAnterior: EstadoSeguimientoTAT | string;
  nuevoEstado: EstadoSeguimientoTAT | string;
  motivo: string; // Motivo obligatorio para cierres manuales, reaperturas o anulaciones
}

export interface IncumplimientoTAT {
  id: string; // Clave única: `${fechaPrometida}___${normalizeOSCode(os)}___${normalizeText(estudio)}`
  rulesVersion?: string; // Versión de reglas determinísticas del laboratorio (ej. "1.0")
  os: string; // Orden de Servicio normalizada original
  tipoAtencion?: TipoAtencionOS; // 'URGENCIA' | 'RUTINA'
  idPacienteAnon: string; // Identificador anonimizado (PAC-XXXX)
  nombrePaciente?: string; // Nombre real (restringido a usuarios autorizados)
  estudio: string; // Nombre completo o formateado del estudio
  codigoEstudio?: string; // Código extraído del examen (ej. "660475")
  nombreEstudio?: string; // Nombre limpio de la práctica (ej. "Hemograma Completo")
  sede: string; // Sede / Unidad de extracción
  sector: string; // Sector técnico
  recepcionista?: string; // Nombre/código del recepcionista que tomó la orden
  fechaPrometida: string; // YYYY-MM-DD
  horaPrometida: string; // HH:mm
  fechaHoraPrometidaTexto: string; // Formato "DD/MM/AAAA HH:mm"
  fechaHoraPrometidaISO?: string; // ISO string para ordenamiento
  estadoLIS: string; // Estado técnico en el LIS detectado a las 7:30
  estadoPlazo: 'FUERA_PLAZO';
  estadoSeguimiento: EstadoSeguimientoTAT | EstadoSeguimientoCasoTAT;
  sinInfoUltimaCarga?: boolean; // Flag si la práctica no vino en el último archivo; se mantiene abierta
  fechaDeteccion: string; // "DD/MM/AAAA HH:mm" del corte operativo 7:30 donde se detectó el incumplimiento
  fechaCierre?: string; // "DD/MM/AAAA HH:mm" cuando el caso fue cerrado
  usuarioCierre?: string; // Email de quien cerró el caso
  fechaCierreDeteccion?: string; // "DD/MM/AAAA HH:mm" cuando pasó a LISTO
  fechaRealEntregaLIS?: string; // "DD/MM/AAAA HH:mm" si el archivo LIS provee fecha/hora real
  fechaCierreEfectiva?: string; // Fecha y hora efectiva de cierre
  esFechaRealDesdeLIS?: boolean;
  demoraMinutos?: number;
  demoraFormateada?: string;
  // Observaciones exclusivas del Módulo TAT
  observacion?: string;
  observaciones?: string;
  causaOperativa?: string;
  autorObservacion?: string;
  fechaObservacion?: string;
  ultimaModificacionObs?: {
    usuario: string;
    fechaHora: string;
  };
  historialObservaciones?: TATObservationHistoryEntry[];
  usuarioUltimaModificacion?: string;
  fechaUltimaModificacion?: string;
  // Auditoría completa de ciclo de vida del incumplimiento
  historialSeguimiento: SeguimientoAuditoriaEntry[];
  ultimaModificacion?: {
    usuario: string;
    fechaHora: string;
  };
  fechaJornada: string; // Fecha ISO de la promesa asociada (ej. "2026-08-18")
  cantidadRecipientes?: number;
  codigosBarra?: string[];
  // Trazabilidad de Exclusión / Inicio Formal TAT 01/09/2026
  excludedFromOperationalMetrics?: boolean;
  motivoExclusion?: string;
  motivo?: string;
  fechaCorteExclusion?: string;
}

export interface IntradayRecord {
  id: string;
  os: string; // Número de Orden de Servicio (OS)
  codigoBarra?: string; // Código de barras / tubo / recipiente físico del LIS
  idPacienteAnon: string; // Identificador anonimizado p. ej. PAC-4821
  nombrePaciente?: string; // Nombre real (restringido a usuarios autorizados)
  estudio: string; // Nombre de la determinación/examen
  codigoEstudio?: string; // Código extraído
  nombreEstudio?: string; // Nombre limpio
  sede: string; // Sede/Unidad
  sector: string; // Sector o Ruta técnica
  recepcionista?: string; // Recepcionista que tomó la orden
  estado: string; // Estado actual en LIS
  fechaPrometida: string; // YYYY-MM-DD o DD/MM/YYYY
  horaPrometida: string; // HH:mm
  fechaRealEntrega?: string; // Fecha/hora real de entrega del LIS si existe
  observaciones?: string;
  // Estados según corte horario para análisis de evolución
  estadoCorte14?: string;
  estadoCorte16?: string;
  estadoCorte17?: string;
  estadoCorte18?: string;
}

/**
 * Entidad lógica "Práctica Clínica":
 * Agrupa filas físicas del LIS por (OS + Examen/Estudio)
 * independientemente del número de códigos de barras, tubos o recipientes.
 */
export interface ConsolidatedPractice {
  id: string; // Identificador único de la práctica consolidada (OS + Estudio)
  os: string; // Orden de Servicio
  idPacienteAnon: string;
  nombrePaciente?: string;
  estudio: string; // Nombre unificado del estudio
  codigoEstudio?: string;
  nombreEstudio?: string;
  sede: string;
  sector: string;
  recepcionista?: string;
  fechaPrometida: string;
  horaPrometida: string;
  fechaRealEntregaLIS?: string;
  // Trazabilidad de componentes físicos del LIS
  physicalRecords: IntradayRecord[];
  cantidadRecipientes: number; // Cantidad de tubos / muestras asociadas
  codigosBarra: string[]; // Lista de códigos de barras de los recipientes
  // Estado consolidado a nivel de práctica clínica
  estadoConsolidado: string;
  grupoConsolidado: OperationalStatusGroup; // 'LISTO' | 'NO_LISTO' | 'PENDIENTE' | 'DESCONOCIDO'
  esAntibiogramaNoAplica: boolean;
  estadosNoListosPresentes?: string[]; // Si tiene varios estados no listos en sus recipientes
  tieneMultiplesEstadosNoListos?: boolean;
  
  // Estado del Plazo (Preventivo vs TAT)
  estadoPlazo: EstadoPlazo; // 'LISTA' | 'PENDIENTE_DENTRO_PLAZO' | 'FUERA_PLAZO'
  demoraMinutos?: number;
  demoraFormateada?: string;
  tatBreachId?: string;
  estadoSeguimiento?: EstadoSeguimientoTAT;
  sinInfoUltimaCarga?: boolean;
  
  observaciones?: string;
  causaOperativa?: string;
  autorObservacion?: string;
  fechaObservacion?: string;
}

export interface DailyComparisonDetails {
  fecha: string;
  totalNuevas: number;
  totalContinuanNoListas: number;
  totalCambiaronAListas: number;
  totalAusentes: number;
  totalNuevosIncumplimientos: number;
  totalIncumplimientosResueltos: number;
  nuevasPracticas: ConsolidatedPractice[];
  cambiaronAListas: ConsolidatedPractice[];
  continuanNoListas: ConsolidatedPractice[];
  ausentes: ConsolidatedPractice[];
  cambiosEstado: Array<{
    os: string;
    estudio: string;
    estadoAnterior: string;
    nuevoEstado: string;
  }>;
}

export interface IntradayKPIs {
  rulesVersion?: string; // Versión de reglas determinísticas del laboratorio (ej. "1.0")
  fechaSeleccionada: string;
  corteSeleccionado: string;
  // Métricas de Carga e Integridad Matemática
  filasTotalesDataset: number; // Total filas físicas leídas del archivo cargado
  filasFechaSeleccionada: number; // Filas físicas correspondientes al día seleccionado
  estudiosExcluidosActoBioquimico: number; // Filas físicas de Acto Bioquímico excluidas
  recipientesCodigosBarra: number; // Cantidad de códigos de barra / recipientes físicos válidos
  practicasPrevistas: number; // Total de Prácticas Clínicas Consolidadas Válidas (OS + Estudio)
  practicasValidas: number; // Alias de practicasPrevistas
  ordenesPrevistas: number; // Cantidad de Órdenes de Servicio (OS) únicas
  osTotales: number; // Alias de ordenesPrevistas
  esBalanceCuadrado: boolean; // filasFechaSeleccionada === estudiosExcluidosActoBioquimico + totalFilasFisicasValidas
  esLoteParcial: boolean; // Advertencia si el dataset es un corte parcial

  // 1. ESTADO DE LAS PRÁCTICAS DE HOY (Nivel 2)
  practicasListas: number;
  practicasListasPct: number; // % sobre el total de prácticas válidas
  practicasNoListas: number;
  practicasNoListasPct: number; // % sobre el total de prácticas válidas
  practicasDesconocidas: number;

  // Separación de Prácticas No Listas según Hora Prometida (<= 18:00 vs > 18:00)
  practicasNoListasHasta18: number;
  practicasNoListasHasta18Pct: number; // % sobre el total de prácticas no listas
  practicasNoListasDespues18: number;
  practicasNoListasDespues18Pct: number; // % sobre el total de prácticas no listas
  practicasNoListasSinHoraValida: number;
  practicasNoListasSinHoraValidaPct: number; // % sobre el total de prácticas no listas

  // Desglose de Prácticas No Listas: Emergencias (O.S. que contienen '(E)') vs Rutina (demás O.S.)
  practicasValidasEmergencia: number;
  practicasListasEmergencia: number;
  practicasNoListasEmergencia: number;
  practicasNoListasEmergenciaPct: number; // % sobre total válidas de emergencias
  practicasNoListasEmergenciaHasta18: number;
  practicasNoListasEmergenciaHasta18Pct: number; // % sobre prácticas no listas de emergencias
  practicasNoListasEmergenciaDespues18: number;
  practicasNoListasEmergenciaDespues18Pct: number; // % sobre prácticas no listas de emergencias
  practicasNoListasEmergenciaSinHoraValida: number;
  practicasNoListasEmergenciaSinHoraValidaPct: number; // % sobre prácticas no listas de emergencias

  practicasValidasRutina: number;
  practicasListasRutina: number;
  practicasNoListasRutina: number;
  practicasNoListasRutinaPct: number; // % sobre total válidas de rutina
  practicasNoListasRutinaHasta18: number;
  practicasNoListasRutinaHasta18Pct: number; // % sobre prácticas no listas de rutina
  practicasNoListasRutinaDespues18: number;
  practicasNoListasRutinaDespues18Pct: number; // % sobre prácticas no listas de rutina
  practicasNoListasRutinaSinHoraValida: number;
  practicasNoListasRutinaSinHoraValidaPct: number; // % sobre prácticas no listas de rutina

  // 2. ¿QUÉ ESTÁ PENDIENTE? (Composición de los 5 estados No Listos)
  composicionPendientes: {
    esperandoEnUnidad: { cantidad: number; porcentaje: number };
    enProceso: { cantidad: number; porcentaje: number };
    aFirmar: { cantidad: number; porcentaje: number };
    cuarentena: { cantidad: number; porcentaje: number };
    resultadoEnInterface: { cantidad: number; porcentaje: number };
    haySuperposicionMultiplesEstados: boolean;
  };

  // 3. IMPACTO EN PACIENTES / OS (Nivel 3)
  ordenesListas: number; // OS donde todas sus prácticas están LISTAS
  osCompletamenteListas: number;
  osCompletamenteListasPct: number; // % sobre OS totales
  ordenesPendientes: number; // OS con al menos UNA práctica NO LISTA
  ordenesConPendientes: number;
  osConPendientes: number;
  osConPendientesPct: number; // % sobre OS totales

  // Separación de OS con Pendientes según Hora Prometida (<= 18:00 vs > 18:00)
  osConPendientesHasta18: number;
  osConPendientesHasta18Pct: number; // % sobre el total de OS con pendientes
  osConPendientesDespues18: number;
  osConPendientesDespues18Pct: number; // % sobre el total de OS con pendientes
  osConPendientesSinHoraValida: number;
  osConPendientesSinHoraValidaPct: number; // % sobre el total de OS con pendientes

  ordenesARevisar: number;
  porcentajeAvance: number; // (Prácticas Listas / Prácticas Válidas) * 100

  // 4. ¿QUÉ ESTÁ GENERANDO LOS PENDIENTES?
  topPracticasNoListas: { estudio: string; cantidad: number; porcentaje: number }[];
  distribucionStatus: { status: string; cantidad: number; porcentaje: number }[];
  concentracionTop3Pct: number;

  // Status desconocidos que requieren clasificación
  statusDesconocidosList: string[];

  // Validaciones obligatorias de consistencia matemática
  esConsistente: boolean; // true si cumple suma y desigualdad
  errorConsistencia: string | null; // Mensaje de error si la validación falla

  // Detalle para listado de OS con pendientes
  detalleOSPendientes: {
    os: string;
    practicasPendientes: number;
    practicasTotales: number;
    idPacienteAnon: string;
    nombrePaciente?: string;
    sede: string;
  }[];

  // Compatibilidad hacia atrás
  practicasPendientes: number; // Alias de practicasNoListas
  practicasARevisar: number;
  estudiosPrevistos: number;
  estudiosListos: number;
  estudiosPendientes: number;
  estudiosARevisar: number;
}

export interface IntradayHourlySnapshot {
  corte: string; // '14:00', '16:00', '17:00', '18:00'
  horaLabel: string;
  ordenesPrevistas: number;
  ordenesListas: number;
  ordenesConPendientes: number;
  practicasPrevistas: number;
  practicasListas: number;
  practicasPendientes: number;
  practicasNoListas: number;
  practicasARevisar: number;
  porcentajeAvance: number;
  // Alias de compatibilidad
  estudiosPrevistos: number;
  estudiosListos: number;
  estudiosPendientes: number;
  estudiosARevisar: number;
}

export interface OperationalAIInsight {
  resumenEjecutivo: string;
  // Las 5 preguntas requeridas
  cuantoFalta: {
    practicasNoListas: number;
    porcentajeNoListas: number;
    texto: string;
  };
  cuantosPacientesAfecta: {
    osAfectadas: number;
    porcentajeOSAfectadas: number;
    texto: string;
  };
  queFalta: {
    principalStatus: string;
    topEstudios: string[];
    texto: string;
  };
  dondeConcentrado: {
    sedePrincipal?: string;
    sectorPrincipal?: string;
    texto: string;
  };
  dondeIntervenirPrimero: {
    prioridades: string[];
    texto: string;
  };
  // Compatibilidad hacia atrás
  practicasFaltantes: number;
  estudiosFaltantes: number;
  ordenesIncompletas: number;
  estudiosMasRepetidos: { estudio: string; cantidad: number }[];
  concentracionSedes: { sede: string; cantidad: number; porcentaje: number }[];
  concentracionSectores: { sector: string; cantidad: number; porcentaje: number }[];
  predominioEstados: { estado: string; cantidad: number; porcentaje: number }[];
  atencionInmediata: string[];
  alertasExclusion: string;
}

export interface DailyDeliveryEntry {
  rulesVersion?: string; // Versión de reglas determinísticas del laboratorio (ej. "1.0")
  fecha: string; // Formato ISO "YYYY-MM-DD" e.g. "2026-08-18"
  fechaFormateada: string; // Formato local "18/08/2026"
  fechaActualizacion: string; // Formato "18/08/2026 18:00"
  cargadoPor?: string; // e.g. "preanalitica@labflores.com.ar"
  nombreArchivo: string; // e.g. "entregas_18_08_2026.csv"
  tamanoArchivo?: string; // e.g. "45.2 KB"
  // Indicadores de Pacientes / OS
  osTotales: number;
  osCompletamenteListas: number;
  osCompletamenteListasPct: number;
  osConPendientes: number;
  osConPendientesPct: number;
  // Desglose de OS con Pendientes según Hora Prometida
  osConPendientesHasta18?: number;
  osConPendientesHasta18Pct?: number;
  osConPendientesDespues18?: number;
  osConPendientesDespues18Pct?: number;
  osConPendientesSinHoraValida?: number;
  osConPendientesSinHoraValidaPct?: number;
  // Indicadores de Prácticas Clínicas
  practicasTotales: number;
  practicasListas: number;
  practicasListasPct: number;
  practicasNoListas: number;
  practicasNoListasPct: number;
  // Desglose de Prácticas No Listas según Hora Prometida
  practicasNoListasHasta18?: number;
  practicasNoListasHasta18Pct?: number;
  practicasNoListasDespues18?: number;
  practicasNoListasDespues18Pct?: number;
  practicasNoListasSinHoraValida?: number;
  practicasNoListasSinHoraValidaPct?: number;
  // Desglose de Prácticas No Listas: Emergencias vs Rutina
  practicasValidasEmergencia?: number;
  practicasListasEmergencia?: number;
  practicasNoListasEmergencia?: number;
  practicasNoListasEmergenciaPct?: number;
  practicasNoListasEmergenciaHasta18?: number;
  practicasNoListasEmergenciaHasta18Pct?: number;
  practicasNoListasEmergenciaDespues18?: number;
  practicasNoListasEmergenciaDespues18Pct?: number;
  practicasNoListasEmergenciaSinHoraValida?: number;
  practicasNoListasEmergenciaSinHoraValidaPct?: number;
  practicasValidasRutina?: number;
  practicasListasRutina?: number;
  practicasNoListasRutina?: number;
  practicasNoListasRutinaPct?: number;
  practicasNoListasRutinaHasta18?: number;
  practicasNoListasRutinaHasta18Pct?: number;
  practicasNoListasRutinaDespues18?: number;
  practicasNoListasRutinaDespues18Pct?: number;
  practicasNoListasRutinaSinHoraValida?: number;
  practicasNoListasRutinaSinHoraValidaPct?: number;
  filasTotales?: number;
  estudiosExcluidosActoBioquimico?: number;
  // Desglose de estados no listos
  esperandoEnUnidad: number;
  enProceso: number;
  resultadoEnInterface: number;
  aFirmar: number;
  cuarentena: number;
  // Concentración
  top5Practicas: { estudio: string; cantidad: number; porcentaje: number }[];
  top3Sectores: { sector: string; cantidad: number; porcentaje: number }[];
  // Dataset de registros asociados y archivo original
  records: IntradayRecord[];
  uniqueOSList?: string[]; // Códigos de OS deduplicados para cálculo de KPI ligero
  uniquePracticesList?: string[]; // Claves OS___Practica deduplicadas
  archivoOriginal?: string; // Contenido original del archivo LIS cargado
  tatBreaches?: IncumplimientoTAT[]; // Incumplimientos TAT creados/actualizados
  comparisonDetails?: DailyComparisonDetails; // Comparación con la carga anterior
}

export interface MonthlyPeriodMetadata {
  mes: MonthName;
  año: number;
  fechaActualizacion: string;
  cargadoPor: string;
  nombreArchivo?: string;
  estadoCarga?: string;
}

export interface DeliveryObservation {
  id: string; // Identificador único estable: `${normalizeOSCode(os)}___${normalizeText(estudio)}`
  os: string; // Orden de Servicio
  estudio: string; // Examen / Estudio
  texto: string; // Texto de la observación
  fechaHora: string; // DD/MM/AAAA HH:mm
  modificadoPor: string; // Usuario que realizó la modificación (email)
  fechaISO?: string; // Fecha de entrega asociada (opcional)
}

export interface MonthlyMasterDataset {
  rulesVersion?: string; // Versión de reglas determinísticas del laboratorio (ej. "1.0")
  resumenList: ResumenMensualRow[];
  incumplimientosList: IncumplimientoRow[];
  rankingCausasList: RankingCausaRow[];
  rankingEstudiosList: RankingEstudioRow[];
  diccionarioList: DiccionarioEntry[];
  periodMetadata?: Record<string, MonthlyPeriodMetadata>;
}

export interface DailyComparisonSummary {
  fechaActual: string;
  fechaActualFormateada: string;
  fechaAnterior: string;
  fechaAnteriorFormateada: string;
  // % OS completamente listas
  osListasActualPct: number;
  osListasAnteriorPct: number;
  varOSListasPP: number; // Variación en puntos porcentuales
  // % Prácticas listas
  practicasListasActualPct: number;
  practicasListasAnteriorPct: number;
  varPracticasListasPP: number; // Variación en puntos porcentuales
}

export interface UserSession {
  email: string;
  role: string;
  isAuthorizedForSensitiveData: boolean;
}

export interface AIAnalysisResult {
  periodo: string;
  queCambio: string;
  principalesCausas: string[];
  concentracion: string;
  severidad: string;
  recurrencia: string;
  riesgos: string[];
  prioridades: string[];
  notaMetodologica: string;
}
