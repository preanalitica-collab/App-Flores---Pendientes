import {
  IncumplimientoRow,
  ResumenMensualRow,
  RankingCausaRow,
  RankingEstudioRow,
  DiccionarioEntry,
} from '../types';

export const INITIAL_RESUMEN_MENSUAL: ResumenMensualRow[] = [
  {
    Mes: 'Enero',
    Año: 2026,
    EstadoCarga: 'Pendiente de carga',
    PacientesAtendidos: null,
    PacientesUnicosFueraPlazo: null,
    EstudiosFueraPlazo: null,
    MedianaRetraso: null,
    MaximoRetraso: null,
    PorcentajeFueraPlazo: null,
    PorcentajeCumplimiento: null,
  },
  {
    Mes: 'Febrero',
    Año: 2026,
    EstadoCarga: 'Pendiente de carga',
    PacientesAtendidos: null,
    PacientesUnicosFueraPlazo: null,
    EstudiosFueraPlazo: null,
    MedianaRetraso: null,
    MaximoRetraso: null,
    PorcentajeFueraPlazo: null,
    PorcentajeCumplimiento: null,
  },
  {
    Mes: 'Marzo',
    Año: 2026,
    EstadoCarga: 'Pendiente de carga',
    PacientesAtendidos: null,
    PacientesUnicosFueraPlazo: null,
    EstudiosFueraPlazo: null,
    MedianaRetraso: null,
    MaximoRetraso: null,
    PorcentajeFueraPlazo: null,
    PorcentajeCumplimiento: null,
  },
  {
    Mes: 'Abril',
    Año: 2026,
    EstadoCarga: 'Pendiente de carga',
    PacientesAtendidos: null,
    PacientesUnicosFueraPlazo: null,
    EstudiosFueraPlazo: null,
    MedianaRetraso: null,
    MaximoRetraso: null,
    PorcentajeFueraPlazo: null,
    PorcentajeCumplimiento: null,
  },
  {
    Mes: 'Mayo',
    Año: 2026,
    EstadoCarga: 'Cargado (completo)',
    PacientesAtendidos: 3850,
    PacientesUnicosFueraPlazo: 42,
    EstudiosFueraPlazo: 48,
    MedianaRetraso: 2,
    MaximoRetraso: 10,
    PorcentajeFueraPlazo: 0.55,
    PorcentajeCumplimiento: 99.45,
  },
  {
    Mes: 'Junio',
    Año: 2026,
    EstadoCarga: 'Cargado (completo)',
    PacientesAtendidos: 4020,
    PacientesUnicosFueraPlazo: 45,
    EstudiosFueraPlazo: 52,
    MedianaRetraso: 3,
    MaximoRetraso: 12,
    PorcentajeFueraPlazo: 0.48,
    PorcentajeCumplimiento: 99.52,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    EstadoCarga: 'Cargado (completo)',
    PacientesAtendidos: 4120,
    PacientesUnicosFueraPlazo: 48,
    EstudiosFueraPlazo: 56,
    MedianaRetraso: 3,
    MaximoRetraso: 14,
    PorcentajeFueraPlazo: 1.17,
    PorcentajeCumplimiento: 98.83,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    EstadoCarga: 'Cargado (parcial) - falta denominador de pacientes atendidos',
    PacientesAtendidos: null,
    PacientesUnicosFueraPlazo: 62,
    EstudiosFueraPlazo: 74,
    MedianaRetraso: 4,
    MaximoRetraso: 18,
    PorcentajeFueraPlazo: null,
    PorcentajeCumplimiento: null,
  },
  {
    Mes: 'Septiembre',
    Año: 2026,
    EstadoCarga: 'Cargado (completo)',
    PacientesAtendidos: 11278,
    PacientesUnicosFueraPlazo: 189,
    EstudiosFueraPlazo: 287,
    MedianaRetraso: 2,
    MaximoRetraso: 7,
    PorcentajeFueraPlazo: 1.68,
    PorcentajeCumplimiento: 98.32,
  },
  {
    Mes: 'Octubre',
    Año: 2026,
    EstadoCarga: 'Cargado (completo)',
    PacientesAtendidos: 1923,
    PacientesUnicosFueraPlazo: 11,
    EstudiosFueraPlazo: 19,
    MedianaRetraso: 2,
    MaximoRetraso: 6,
    PorcentajeFueraPlazo: 0.57,
    PorcentajeCumplimiento: 99.43,
  },
  {
    Mes: 'Noviembre',
    Año: 2026,
    EstadoCarga: 'Pendiente de carga',
    PacientesAtendidos: null,
    PacientesUnicosFueraPlazo: null,
    EstudiosFueraPlazo: null,
    MedianaRetraso: null,
    MaximoRetraso: null,
    PorcentajeFueraPlazo: null,
    PorcentajeCumplimiento: null,
  },
  {
    Mes: 'Diciembre',
    Año: 2026,
    EstadoCarga: 'Pendiente de carga',
    PacientesAtendidos: null,
    PacientesUnicosFueraPlazo: null,
    EstudiosFueraPlazo: null,
    MedianaRetraso: null,
    MaximoRetraso: null,
    PorcentajeFueraPlazo: null,
    PorcentajeCumplimiento: null,
  },
];

export const INITIAL_RANKING_CAUSAS: RankingCausaRow[] = [
  // Julio 2026 (56 estudios con desvío)
  {
    Mes: 'Julio',
    Año: 2026,
    Causa: 'Falta de reactivo / insumo',
    Cantidad: 16,
    PorcentajeTotal: 28.57,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Causa: 'Derivación a laboratorio externo',
    Cantidad: 14,
    PorcentajeTotal: 25.0,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Causa: 'Falla técnica de equipamiento',
    Cantidad: 10,
    PorcentajeTotal: 17.86,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Causa: 'Repetición por control de calidad analítico',
    Cantidad: 7,
    PorcentajeTotal: 12.5,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Causa: 'Demora en validación médica',
    Cantidad: 5,
    PorcentajeTotal: 8.93,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Causa: 'Causa no registrada / revisar carga',
    Cantidad: 4,
    PorcentajeTotal: 7.14,
  },

  // Agosto 2026 (74 estudios con desvío)
  {
    Mes: 'Agosto',
    Año: 2026,
    Causa: 'Derivación a laboratorio externo',
    Cantidad: 22,
    PorcentajeTotal: 29.73,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Causa: 'Falta de reactivo / insumo',
    Cantidad: 19,
    PorcentajeTotal: 25.68,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Causa: 'Demora en validación médica',
    Cantidad: 12,
    PorcentajeTotal: 16.22,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Causa: 'Falla técnica de equipamiento',
    Cantidad: 8,
    PorcentajeTotal: 10.81,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Causa: 'Causa no registrada / revisar carga',
    Cantidad: 7,
    PorcentajeTotal: 9.46,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Causa: 'Problema preanalítico / muestra insuficiente',
    Cantidad: 6,
    PorcentajeTotal: 8.11,
  },
];

export const INITIAL_RANKING_ESTUDIOS: RankingEstudioRow[] = [
  // Julio 2026
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Dosaje de Vitamina D (25-OH)',
    Cantidad: 12,
    PorcentajeTotal: 21.43,
    DemoraMediana: 3,
    DemoraMaxima: 7,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Anticuerpos Anti-TPO y Anti-Tiroglobulina',
    Cantidad: 8,
    PorcentajeTotal: 14.29,
    DemoraMediana: 4,
    DemoraMaxima: 8,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Insulina Basal y Curva Post-Carga',
    Cantidad: 7,
    PorcentajeTotal: 12.5,
    DemoraMediana: 2,
    DemoraMaxima: 5,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Urocultivo con Antibiograma Automatizado',
    Cantidad: 6,
    PorcentajeTotal: 10.71,
    DemoraMediana: 3,
    DemoraMaxima: 6,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Cariotipo en Sangre Periférica',
    Cantidad: 5,
    PorcentajeTotal: 8.93,
    DemoraMediana: 9,
    DemoraMaxima: 14,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Dosaje de Hormona Antimulleriana (AMH)',
    Cantidad: 5,
    PorcentajeTotal: 8.93,
    DemoraMediana: 5,
    DemoraMaxima: 10,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Electroforesis de Proteínas e Inmunofijación',
    Cantidad: 4,
    PorcentajeTotal: 7.14,
    DemoraMediana: 4,
    DemoraMaxima: 8,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Perfil Lipídico Completo y Apolipoproteínas',
    Cantidad: 3,
    PorcentajeTotal: 5.36,
    DemoraMediana: 2,
    DemoraMaxima: 4,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Dosaje de Cortisol Libre Urinario 24hs',
    Cantidad: 3,
    PorcentajeTotal: 5.36,
    DemoraMediana: 3,
    DemoraMaxima: 5,
  },
  {
    Mes: 'Julio',
    Año: 2026,
    Estudio: 'Screening de Alergias Específicas (IgE Panel)',
    Cantidad: 3,
    PorcentajeTotal: 5.36,
    DemoraMediana: 6,
    DemoraMaxima: 11,
  },

  // Agosto 2026
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Dosaje de Vitamina D (25-OH)',
    Cantidad: 15,
    PorcentajeTotal: 20.27,
    DemoraMediana: 4,
    DemoraMaxima: 9,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Dosaje de Hormona Antimulleriana (AMH)',
    Cantidad: 11,
    PorcentajeTotal: 14.86,
    DemoraMediana: 6,
    DemoraMaxima: 12,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Screening de Alergias Específicas (IgE Panel)',
    Cantidad: 9,
    PorcentajeTotal: 12.16,
    DemoraMediana: 7,
    DemoraMaxima: 15,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Anticuerpos Anti-TPO y Anti-Tiroglobulina',
    Cantidad: 8,
    PorcentajeTotal: 10.81,
    DemoraMediana: 4,
    DemoraMaxima: 8,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Cariotipo en Sangre Periférica',
    Cantidad: 7,
    PorcentajeTotal: 9.46,
    DemoraMediana: 10,
    DemoraMaxima: 18,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Urocultivo con Antibiograma Automatizado',
    Cantidad: 6,
    PorcentajeTotal: 8.11,
    DemoraMediana: 3,
    DemoraMaxima: 6,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Electroforesis de Proteínas e Inmunofijación',
    Cantidad: 6,
    PorcentajeTotal: 8.11,
    DemoraMediana: 5,
    DemoraMaxima: 10,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Insulina Basal y Curva Post-Carga',
    Cantidad: 5,
    PorcentajeTotal: 6.76,
    DemoraMediana: 2,
    DemoraMaxima: 4,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Dosaje de Cortisol Libre Urinario 24hs',
    Cantidad: 4,
    PorcentajeTotal: 5.41,
    DemoraMediana: 3,
    DemoraMaxima: 7,
  },
  {
    Mes: 'Agosto',
    Año: 2026,
    Estudio: 'Perfil Lipídico Completo y Apolipoproteínas',
    Cantidad: 3,
    PorcentajeTotal: 4.05,
    DemoraMediana: 2,
    DemoraMaxima: 4,
  },
];

export const INITIAL_DICCIONARIO: DiccionarioEntry[] = [
  {
    termino: 'Plazo Prometido de Entrega (TAT Prometido)',
    definicion:
      'Fecha y hora comprometida formalmente con el paciente o médico prescriptor para la entrega del informe de resultados validado.',
    formula: 'Fecha/Hora emisión de comprobante de atención + TAT estándar por tipo de estudio',
    fuenteRegla: 'ISO 15189:2022 Cláusula 7.4 (Procesos post-analíticos) y Catálogo de Prestaciones',
    impactoGestion:
      'Base contractual del servicio. Un desvío compromete la oportunidad del diagnóstico clínico.',
  },
  {
    termino: 'Incumplimiento de Plazo',
    definicion:
      'Cualquier estudio cuya Fecha Real de validación médica o entrega es posterior a la Fecha Prometida (Días de Retraso ≥ 1).',
    formula: 'Días de Retraso = Fecha Real - Fecha Prometida (en días corridos)',
    fuenteRegla: 'Manual de Calidad del Laboratorio - Procedimiento PG-CAL-08',
    impactoGestion:
      'Genera no conformidad menor o mayor según la criticidad clínica del estudio y el retraso acumulado.',
  },
  {
    termino: '% Cumplimiento de Plazos',
    definicion:
      'Proporción de pacientes atendidos cuyos estudios fueron entregados dentro del plazo prometido sin ningún retraso.',
    formula:
      '% Cumplimiento = 100 - % Pacientes fuera de plazo = 100 - [(Pacientes únicos fuera de plazo / Pacientes atendidos) × 100]',
    fuenteRegla: 'Indicador Clave de Desempeño (KPI) - Dirección / ISO 9001:2015 Cláusula 9.1.2',
    impactoGestion:
      'Requiere obligatoriamente el denominador "Pacientes atendidos". Si falta, debe figurar "Dato pendiente".',
  },
  {
    termino: 'Mediana de Demora vs Promedio',
    definicion:
      'Valor central del conjunto ordenado de días de retraso. Se utiliza la mediana para evitar que valores extremos (outliers por derivaciones complejas) distorsionen la tendencia típica.',
    formula: 'Percentil 50 de la serie de Días de Retraso del período',
    fuenteRegla: 'Buenas Prácticas Estadísticas en Gestión de Laboratorios Clínicos (CLSI C54-A)',
    impactoGestion:
      'Muestra la demora real que experimenta la mayoría de los casos afectados.',
  },
  {
    termino: 'Causa - Validada (categoría estándar)',
    definicion:
      'Tipificación estandarizada y normalizada del factor raíz que originó el desvío temporal.',
    formula: 'Mapeo unívoco desde "Causa Normalizada" a taxonomía estándar del Laboratorio',
    fuenteRegla: 'Procedimiento de Gestión de Desvíos Analíticos y Logísticos',
    impactoGestion:
      'Permite estratificación Pareto para priorizar acciones correctivas de alto impacto.',
  },
  {
    termino: 'Categoría "Causa no registrada / revisar carga"',
    definicion:
      'Registros de incumplimiento en los que el operador no seleccionó una causa tipificada al cargar el desvío.',
    formula: 'Registros con campo Causa vacío o no estandarizado',
    fuenteRegla: 'Control de calidad de datos de registro',
    impactoGestion:
      'No debe eliminarse ni ocultarse: visibiliza la necesidad de reforzar el proceso de carga con el equipo técnico.',
  },
  {
    termino: 'Notificación - Registro',
    definicion:
      'Indica exclusivamente si existe una anotación escrita o constancia digital en el sistema de gestión.',
    formula: 'Valores: "Con registro" vs "Sin registro"',
    fuenteRegla: 'Protocolo de Comunicación con el Paciente (COM-PAC-02)',
    impactoGestion:
      'REGLA: "Sin registro" NO equivale a "paciente no notificado", solo refleja ausencia de evidencia documental.',
  },
  {
    termino: 'Estado OS (Orden de Servicio)',
    definicion:
      'Estado operativo de resolución y cierre del incidente en el sistema de gestión.',
    formula: 'Valores válidos: "Cerrado", "En Proceso", o vacío',
    fuenteRegla: 'Flujo de Trabajo del LIS / Seguimiento Operativo',
    impactoGestion:
      'REGLA OBLIGATORIA: Un valor vacío se muestra como "Sin estado definido", NUNCA como "Pendiente".',
  },
  {
    termino: 'Entregas de Hoy — Regla de Exclusión "Acto Bioquímico"',
    definicion:
      'El registro administrativo "Acto Bioquímico" no constituye una determinación analítica o examen clínico de laboratorio pendiente de resultado.',
    formula:
      'Exclusión estricta case-insensitive y sin importar acentos o espacios (trim/normalize): estudio !== "ACTO BIOQUÍMICO"',
    fuenteRegla: 'Protocolo Operativo de Entregas de la Jornada / Validación Metodológica LIS',
    impactoGestion:
      'CRÍTICO: Debe excluirse al 100% de previstos, listos, pendientes, en riesgo, fuera de plazo, rankings, porcentajes y análisis de IA para no alterar la tasa real de cumplimiento.',
  },
  {
    termino: 'Entregas de Hoy — Estado Operativo de la Orden (OS)',
    definicion:
      'Una Orden de Servicio se clasifica a nivel paciente como "Completamente Lista" únicamente cuando todas sus determinaciones analíticas válidas están en estado LISTO.',
    formula:
      'OS Lista = Todos sus estudios válidos ∈ {ENVIADO POR E-MAIL, IMPRESO ARCHIVO, CONSULTADO ONLINE, ENTREGADO, NO APLICA / FINALIZADO}. Si ≥1 estudio está en {SIN INFORME, EN PROCESO, ESPERANDO EN UNIDAD, NO REALIZADO (no antibiograma), CUARENTENA}, la OS es "Con Pendientes".',
    fuenteRegla: 'Monitoreo Intradía de Calidad y Entregas',
    impactoGestion:
      'Garantiza que no se informe al médico o paciente que una orden está completada cuando aún resta validar determinaciones clave.',
  },
  {
    termino: 'Entregas de Hoy — Regla de Antibiogramas (Microbiología)',
    definicion:
      'Los estudios de tipo ANTIBIOGRAMA condicionados al resultado del cultivo que registran "NO REALIZADO" (por cultivo sin desarrollo o no requerido) se clasifican como "FINALIZADA / NO APLICA" y se consideran LISTOS a efectos del cumplimiento de la OS.',
    formula:
      'Si estudio contiene "antibiograma" (case/accent-insensitive) Y estado === "NO REALIZADO" → Estado = "FINALIZADA / NO APLICA" (Grupo: LISTO). No genera alerta, no incrementa pendientes y no retrasa la OS.',
    fuenteRegla: 'Regla de Negocio de Microbiología Clínica / Protocolo de Validación LIS',
    impactoGestion:
      'Elimina falsos pendientes en Microbiología y evita penalizaciones artificiales en la tasa de entrega del día.',
  },
];

// Helper to generate realistic incident rows adhering strictly to DB rules
function generateIncumplimientos(): IncumplimientoRow[] {
  const rows: IncumplimientoRow[] = [];

  // -------------------------------------------------------------
  // JULIO 2026 - 56 Estudios, 48 Pacientes Únicos
  // -------------------------------------------------------------
  const causasJulio = [
    { c: 'Falta de reactivo / insumo', count: 16 },
    { c: 'Derivación a laboratorio externo', count: 14 },
    { c: 'Falla técnica de equipamiento', count: 10 },
    { c: 'Repetición por control de calidad analítico', count: 7 },
    { c: 'Demora en validación médica', count: 5 },
    { c: 'Causa no registrada / revisar carga', count: 4 },
  ];

  const estudiosJulio = [
    'Dosaje de Vitamina D (25-OH)',
    'Anticuerpos Anti-TPO y Anti-Tiroglobulina',
    'Insulina Basal y Curva Post-Carga',
    'Urocultivo con Antibiograma Automatizado',
    'Cariotipo en Sangre Periférica',
    'Dosaje de Hormona Antimulleriana (AMH)',
    'Electroforesis de Proteínas e Inmunofijación',
    'Perfil Lipídico Completo y Apolipoproteínas',
    'Dosaje de Cortisol Libre Urinario 24hs',
    'Screening de Alergias Específicas (IgE Panel)',
  ];

  let jPacIndex = 1001;
  let rowId = 1;

  causasJulio.forEach(({ c, count }) => {
    for (let i = 0; i < count; i++) {
      // 48 unique patients for 56 studies -> some share patient ID
      const pacId = `PAC-${jPacIndex}`;
      if (rowId % 7 !== 0) {
        jPacIndex++;
      }

      const estudio = estudiosJulio[(rowId * 3 + i) % estudiosJulio.length];
      let delay = 1;
      if (c === 'Cariotipo en Sangre Periférica' || c === 'Derivación a laboratorio externo') {
        delay = 4 + ((rowId * 2 + i) % 11); // up to 14
      } else if (c === 'Falta de reactivo / insumo') {
        delay = 2 + ((rowId + i) % 6);
      } else if (c === 'Falla técnica de equipamiento') {
        delay = 1 + ((rowId + i) % 4);
      } else {
        delay = 1 + (i % 3);
      }

      const dayNum = 1 + ((rowId * 2) % 27);
      const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      const promDay = dayNum + 2;
      const promStr = promDay < 10 ? `0${promDay}` : `${promDay}`;
      const realDay = promDay + delay;
      const realStr = realDay < 10 ? `0${realDay}` : `${realDay}`;

      const notifReg: 'Con registro' | 'Sin registro' = (rowId + i) % 3 === 0 ? 'Sin registro' : 'Con registro';
      const estadoOS: 'Cerrado' | 'En Proceso' | 'Sin estado definido' =
        rowId % 5 === 0 ? 'Sin estado definido' : rowId % 4 === 0 ? 'En Proceso' : 'Cerrado';

      rows.push({
        id: `INC-2026-07-${String(rowId).padStart(3, '0')}`,
        Mes: 'Julio',
        Año: 2026,
        FechaRegistro: `2026-07-${dayStr}`,
        IDPaciente: pacId,
        NombrePaciente: `Paciente Auditado #${jPacIndex}`,
        ExamenEstudio: estudio,
        FechaPrometida: `2026-07-${promStr}`,
        FechaReal: `2026-07-${realStr}`,
        DiasRetraso: delay,
        CausaNormalizada: c === 'Causa no registrada / revisar carga' ? 'Sin dato ingresado en LIS' : `${c} [Log #${rowId}]`,
        CausaValidada: c,
        EstadoNotificacion:
          notifReg === 'Con registro'
            ? 'Contacto telefónico documentado por Secretaría'
            : 'Pendiente de confirmación documental',
        NotificacionRegistro: notifReg,
        EstadoOS: estadoOS,
        Observaciones: `Lote de procesamiento estándar. Desvío tipificado en reporte de calidad.`,
        Seguimiento1: estadoOS === 'Cerrado' ? 'Informe entregado con disculpas institucionales.' : 'En seguimiento por jefatura técnica.',
        Seguimiento2: estadoOS === 'Cerrado' ? 'Cierre conforme en sistema.' : undefined,
      });

      rowId++;
    }
  });

  // -------------------------------------------------------------
  // AGOSTO 2026 - 74 Estudios, 62 Pacientes Únicos
  // -------------------------------------------------------------
  const causasAgosto = [
    { c: 'Derivación a laboratorio externo', count: 22 },
    { c: 'Falta de reactivo / insumo', count: 19 },
    { c: 'Demora en validación médica', count: 12 },
    { c: 'Falla técnica de equipamiento', count: 8 },
    { c: 'Causa no registrada / revisar carga', count: 7 },
    { c: 'Problema preanalítico / muestra insuficiente', count: 6 },
  ];

  const estudiosAgosto = [
    'Dosaje de Vitamina D (25-OH)',
    'Dosaje de Hormona Antimulleriana (AMH)',
    'Screening de Alergias Específicas (IgE Panel)',
    'Anticuerpos Anti-TPO y Anti-Tiroglobulina',
    'Cariotipo en Sangre Periférica',
    'Urocultivo con Antibiograma Automatizado',
    'Electroforesis de Proteínas e Inmunofijación',
    'Insulina Basal y Curva Post-Carga',
    'Dosaje de Cortisol Libre Urinario 24hs',
    'Perfil Lipídico Completo y Apolipoproteínas',
  ];

  let aPacIndex = 2001;
  let aRowId = 1;

  causasAgosto.forEach(({ c, count }) => {
    for (let i = 0; i < count; i++) {
      const pacId = `PAC-${aPacIndex}`;
      if (aRowId % 6 !== 0) {
        aPacIndex++;
      }

      const estudio = estudiosAgosto[(aRowId * 2 + i) % estudiosAgosto.length];
      let delay = 1;
      if (c === 'Cariotipo en Sangre Periférica' || estudio.includes('Alergias')) {
        delay = 5 + ((aRowId * 3 + i) % 14); // up to 18
      } else if (c === 'Derivación a laboratorio externo') {
        delay = 3 + ((aRowId + i) % 10);
      } else if (c === 'Falta de reactivo / insumo') {
        delay = 2 + ((aRowId + i) % 7);
      } else if (c === 'Demora en validación médica') {
        delay = 1 + ((aRowId + i) % 5);
      } else {
        delay = 1 + (i % 4);
      }

      const dayNum = 1 + ((aRowId * 2) % 27);
      const dayStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      const promDay = dayNum + 2;
      const promStr = promDay < 10 ? `0${promDay}` : `${promDay}`;
      const realDay = promDay + delay;
      const realStr = realDay < 10 ? `0${realDay}` : `${realDay}`;

      const notifReg: 'Con registro' | 'Sin registro' = (aRowId + i) % 4 === 0 ? 'Sin registro' : 'Con registro';
      const estadoOS: 'Cerrado' | 'En Proceso' | 'Sin estado definido' =
        aRowId % 4 === 0 ? 'Sin estado definido' : aRowId % 3 === 0 ? 'En Proceso' : 'Cerrado';

      rows.push({
        id: `INC-2026-08-${String(aRowId).padStart(3, '0')}`,
        Mes: 'Agosto',
        Año: 2026,
        FechaRegistro: `2026-08-${dayStr}`,
        IDPaciente: pacId,
        NombrePaciente: `Paciente Auditado #${aPacIndex}`,
        ExamenEstudio: estudio,
        FechaPrometida: `2026-08-${promStr}`,
        FechaReal: `2026-08-${realStr}`,
        DiasRetraso: delay,
        CausaNormalizada: c === 'Causa no registrada / revisar carga' ? 'Sin causal explícita' : `${c} [Obs Reg ${aRowId}]`,
        CausaValidada: c,
        EstadoNotificacion:
          notifReg === 'Con registro'
            ? 'Mensaje automatizado y re-programación informada'
            : 'Sin constancia cargada en registro',
        NotificacionRegistro: notifReg,
        EstadoOS: estadoOS,
        Observaciones: `Caso auditado en reunión de calidad analítica.`,
        Seguimiento1: estadoOS === 'En Proceso' ? 'Esperando recepción de derivación externa.' : 'Gestión finalizada.',
        Seguimiento2: estadoOS === 'Sin estado definido' ? 'Alerta: Sin asignación de estado de cierre.' : undefined,
      });

      aRowId++;
    }
  });

  return rows;
}

export const INITIAL_INCUMPLIMIENTOS: IncumplimientoRow[] = generateIncumplimientos();
