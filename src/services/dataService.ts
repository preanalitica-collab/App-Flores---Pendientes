import {
  IncumplimientoRow,
  ResumenMensualRow,
  RankingCausaRow,
  RankingEstudioRow,
  MonthName,
  PeriodKPIs,
  SeverityDistribution,
} from '../types';

export function calculateMedian(numbers: number[]): number {
  if (!numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

export function getPeriodKPIs(
  mes: MonthName,
  año: number,
  resumenList: ResumenMensualRow[] = [],
  incumplimientos: IncumplimientoRow[] = []
): PeriodKPIs {
  const resumen = (resumenList || []).find((r) => r?.Mes === mes && r?.Año === año);
  const monthIncumplimientos = (incumplimientos || []).filter(
    (i) => i?.Mes === mes && i?.Año === año
  );

  if (!resumen || resumen.EstadoCarga === 'Pendiente de carga') {
    return {
      cumplimientoPorcentaje: null,
      cumplimientoTexto: 'Sin datos',
      cumplimientoDetalle: 'Período pendiente de carga',
      pacientesFueraPlazo: null,
      estudiosFueraPlazo: null,
      medianaDemora: null,
      maximaDemora: null,
      estadoCarga: 'Pendiente de carga',
      totalCasosSinEstado: 0,
      totalCasosEnProceso: 0,
      totalCasosCerrados: 0,
      totalConRegistroNotif: 0,
      totalSinRegistroNotif: 0,
    };
  }

  // Calculate unique patients from actual rows if not already in summary
  const uniquePatients = new Set(monthIncumplimientos.map((i) => i.IDPaciente || i.NombrePaciente)).size;
  const pacientesFuera = resumen.PacientesUnicosFueraPlazo ?? uniquePatients;
  const estudiosFuera = resumen.EstudiosFueraPlazo ?? monthIncumplimientos.length;

  const delays = monthIncumplimientos.map((i) => i.DiasRetraso);
  const mediana = resumen.MedianaRetraso ?? (delays.length > 0 ? calculateMedian(delays) : 0);
  const maxima = resumen.MaximoRetraso ?? (delays.length > 0 ? Math.max(...delays) : 0);

  // Status breakdown
  const totalCasosSinEstado = monthIncumplimientos.filter(
    (i) => i.EstadoOS === 'Sin estado definido' || !i.EstadoOS
  ).length;
  const totalCasosEnProceso = monthIncumplimientos.filter((i) => i.EstadoOS === 'En Proceso').length;
  const totalCasosCerrados = monthIncumplimientos.filter((i) => i.EstadoOS === 'Cerrado').length;

  const totalConRegistroNotif = monthIncumplimientos.filter(
    (i) => i.NotificacionRegistro === 'Con registro'
  ).length;
  const totalSinRegistroNotif = monthIncumplimientos.filter(
    (i) => i.NotificacionRegistro === 'Sin registro'
  ).length;

  if (resumen.EstadoCarga.startsWith('Cargado (parcial)')) {
    return {
      cumplimientoPorcentaje: null,
      cumplimientoTexto: 'Dato pendiente',
      cumplimientoDetalle: `${pacientesFuera} pacientes afectados / Denominador no cargado`,
      pacientesFueraPlazo: pacientesFuera,
      estudiosFueraPlazo: estudiosFuera,
      medianaDemora: mediana,
      maximaDemora: maxima,
      estadoCarga: resumen.EstadoCarga,
      totalCasosSinEstado,
      totalCasosEnProceso,
      totalCasosCerrados,
      totalConRegistroNotif,
      totalSinRegistroNotif,
    };
  }

  // Complete load
  const atendidos = resumen.PacientesAtendidos ?? 0;
  const cumplimiento =
    atendidos > 0
      ? Math.round((100 - (pacientesFuera / atendidos) * 100) * 100) / 100
      : null;

  return {
    cumplimientoPorcentaje: cumplimiento,
    cumplimientoTexto: cumplimiento !== null ? `${cumplimiento.toLocaleString('es-AR')}%` : 'Dato pendiente',
    cumplimientoDetalle: `${pacientesFuera} pacientes fuera de plazo / ${atendidos.toLocaleString('es-AR')} pacientes atendidos`,
    pacientesFueraPlazo: pacientesFuera,
    estudiosFueraPlazo: estudiosFuera,
    medianaDemora: mediana,
    maximaDemora: maxima,
    estadoCarga: 'Cargado (completo)',
    totalCasosSinEstado,
    totalCasosEnProceso,
    totalCasosCerrados,
    totalConRegistroNotif,
    totalSinRegistroNotif,
  };
}

export function getSeverityDistribution(
  mes: MonthName,
  año: number,
  incumplimientos: IncumplimientoRow[] = []
): SeverityDistribution {
  const items = (incumplimientos || []).filter((i) => i?.Mes === mes && i?.Año === año);
  const dist: SeverityDistribution = {
    dia1: 0,
    dias2a3: 0,
    dias4a7: 0,
    mas7dias: 0,
    total: items.length,
  };

  items.forEach((item) => {
    const d = item.DiasRetraso;
    if (d === 1) dist.dia1++;
    else if (d >= 2 && d <= 3) dist.dias2a3++;
    else if (d >= 4 && d <= 7) dist.dias4a7++;
    else if (d > 7) dist.mas7dias++;
  });

  return dist;
}

export function getTopDelaysList(
  mes: MonthName,
  año: number,
  incumplimientos: IncumplimientoRow[] = [],
  limit = 10
) {
  const items = (incumplimientos || [])
    .filter((i) => i?.Mes === mes && i?.Año === año)
    .sort((a, b) => b.DiasRetraso - a.DiasRetraso);

  return items.slice(0, limit).map((item, idx) => ({
    ranking: idx + 1,
    codigoCaso: `Caso #${String(idx + 1).padStart(2, '0')}`,
    estudio: item.ExamenEstudio,
    diasRetraso: item.DiasRetraso,
    causa: item.CausaValidada,
    fechaPrometida: item.FechaPrometida,
    fechaReal: item.FechaReal,
    estadoOS: item.EstadoOS || 'Sin estado definido',
    notificacion: item.NotificacionRegistro,
  }));
}

export function getCausesForPeriod(
  mes: MonthName,
  año: number,
  rankingCausas: RankingCausaRow[] = [],
  incumplimientos: IncumplimientoRow[] = []
): RankingCausaRow[] {
  // Use pre-aggregated sheet if present
  const preAgg = (rankingCausas || []).filter((r) => r?.Mes === mes && r?.Año === año);
  if (preAgg.length > 0) {
    return [...preAgg].sort((a, b) => b.Cantidad - a.Cantidad);
  }

  // Dynamically aggregate from raw rows if custom data loaded
  const items = (incumplimientos || []).filter((i) => i?.Mes === mes && i?.Año === año);
  const total = items.length;
  if (total === 0) return [];

  const counts: Record<string, number> = {};
  items.forEach((item) => {
    const c = item.CausaValidada || 'Causa no registrada / revisar carga';
    counts[c] = (counts[c] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([causa, cantidad]) => ({
      Mes: mes,
      Año: año,
      Causa: causa,
      Cantidad: cantidad,
      PorcentajeTotal: Math.round((cantidad / total) * 10000) / 100,
    }))
    .sort((a, b) => b.Cantidad - a.Cantidad);
}

export function getStudiesForPeriod(
  mes: MonthName,
  año: number,
  rankingEstudios: RankingEstudioRow[] = [],
  incumplimientos: IncumplimientoRow[] = []
): RankingEstudioRow[] {
  const preAgg = (rankingEstudios || []).filter((r) => r?.Mes === mes && r?.Año === año);
  if (preAgg.length > 0) {
    return [...preAgg].sort((a, b) => b.Cantidad - a.Cantidad);
  }

  const items = (incumplimientos || []).filter((i) => i?.Mes === mes && i?.Año === año);
  const total = items.length;
  if (total === 0) return [];

  const map = new Map<string, number[]>();
  items.forEach((item) => {
    const arr = map.get(item.ExamenEstudio) || [];
    arr.push(item.DiasRetraso);
    map.set(item.ExamenEstudio, arr);
  });

  return Array.from(map.entries())
    .map(([estudio, delays]) => ({
      Mes: mes,
      Año: año,
      Estudio: estudio,
      Cantidad: delays.length,
      PorcentajeTotal: Math.round((delays.length / total) * 10000) / 100,
      DemoraMediana: calculateMedian(delays),
      DemoraMaxima: Math.max(...delays),
    }))
    .sort((a, b) => b.Cantidad - a.Cantidad)
    .slice(0, 10);
}
