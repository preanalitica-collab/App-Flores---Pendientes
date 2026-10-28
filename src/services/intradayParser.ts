import { IntradayRecord } from '../types';

/**
 * Normaliza cualquier texto removiendo tildes, diacríticos y convirtiendo a minúsculas
 */
function localNormalize(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determina si un estudio corresponde a Acto Bioquímico
 */
export function isActoBioquimicoLocal(studyName: string | null | undefined): boolean {
  if (!studyName) return false;
  const norm = localNormalize(studyName);
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
 * Infers the laboratory sector based on study name or LIS code.
 */
export function inferLaboratorySector(studyName: string): string {
  const s = studyName.toLowerCase();

  if (
    s.includes('hemograma') ||
    s.includes('eritrosedimentacion') ||
    s.includes('reticulocitos') ||
    s.includes('linfocitos') ||
    s.includes('linfocitograma') ||
    s.includes('globulos')
  ) {
    return 'Hematología';
  }

  if (
    s.includes('tiempo de protrombina') ||
    s.includes('tromboplastina') ||
    s.includes('kptt') ||
    s.includes('coagulograma') ||
    s.includes('coagulacion') ||
    s.includes('fibrinogeno') ||
    s.includes('rin') ||
    s.includes('sangria') ||
    s.includes('dimero d')
  ) {
    return 'Hemostasia / Coagulación';
  }

  if (
    s.includes('urocultivo') ||
    s.includes('antibiograma') ||
    s.includes('hemocultivo') ||
    s.includes('coprocultivo') ||
    s.includes('micologico') ||
    s.includes('cultivo') ||
    s.includes('exudado') ||
    s.includes('espermocultivo') ||
    s.includes('esputo') ||
    s.includes('ureaplasma') ||
    s.includes('mycoplasma') ||
    s.includes('gonococo') ||
    s.includes('chlamydia') ||
    s.includes('streptococcus') ||
    s.includes('strepttest') ||
    s.includes('mantoux') ||
    s.includes('ppd') ||
    s.includes('baciloscopia') ||
    s.includes('clostridium')
  ) {
    return 'Microbiología / Bacteriología';
  }

  if (
    s.includes('tsh') ||
    s.includes('tiroxina') ||
    s.includes('t4') ||
    s.includes('t3') ||
    s.includes('triiodotironina') ||
    s.includes('insulina') ||
    s.includes('homa') ||
    s.includes('cortisol') ||
    s.includes('prolactina') ||
    s.includes('fsh') ||
    s.includes('lh') ||
    s.includes('estradiol') ||
    s.includes('progesterona') ||
    s.includes('testosterona') ||
    s.includes('dhea') ||
    s.includes('glae') ||
    s.includes('acth') ||
    s.includes('17-hidroxi') ||
    s.includes('androstenediona') ||
    s.includes('parathormona') ||
    s.includes('pth') ||
    s.includes('calcitonina') ||
    s.includes('somatotrofina') ||
    s.includes('gh') ||
    s.includes('antimulleriana') ||
    s.includes('ham') ||
    s.includes('ferritina') ||
    s.includes('ferremia') ||
    s.includes('transferrina') ||
    s.includes('folico') ||
    s.includes('vitamina') ||
    s.includes('beta hcg') ||
    s.includes('papp-a') ||
    s.includes('free bhcg') ||
    s.includes('ca 15-3') ||
    s.includes('ca 19-9') ||
    s.includes('ca 125') ||
    s.includes('cea') ||
    s.includes('alfafetoproteina') ||
    s.includes('psa') ||
    s.includes('prostatico') ||
    s.includes('atpo') ||
    s.includes('tiroglobulina') ||
    s.includes('atg')
  ) {
    return 'Endocrinología / Inmunoanálisis';
  }

  if (
    s.includes('hiv') ||
    s.includes('hepatitis') ||
    s.includes('chagas') ||
    s.includes('toxoplasma') ||
    s.includes('rubeola') ||
    s.includes('citomegalovirus') ||
    s.includes('vdrl') ||
    s.includes('fta/abs') ||
    s.includes('herpes') ||
    s.includes('fan') ||
    s.includes('latex') ||
    s.includes('rosse') ||
    s.includes('anti ccp') ||
    s.includes('citrulinado') ||
    s.includes('proteina c reactiva') ||
    s.includes('dna') ||
    s.includes('anti ro') ||
    s.includes('anti la') ||
    s.includes('inmunoglobulina') ||
    s.includes('transglutaminasa') ||
    s.includes('gliadina') ||
    s.includes('complemento') ||
    s.includes('coombs') ||
    s.includes('screening neonatal') ||
    s.includes('grupo sanguineo') ||
    s.includes('rh')
  ) {
    return 'Serología / Inmunología';
  }

  if (
    s.includes('orina completa') ||
    s.includes('parasitologico') ||
    s.includes('test de graham') ||
    s.includes('somf') ||
    s.includes('sangre oculta') ||
    s.includes('materia fecal') ||
    s.includes('primera porcion') ||
    s.includes('orina 24') ||
    s.includes('microalbuminuria') ||
    s.includes('clearence') ||
    s.includes('orina espontanea') ||
    s.includes('espermograma') ||
    s.includes('percoll') ||
    s.includes('fragmentacion')
  ) {
    return 'Orinas, Fecal y Andrología';
  }

  if (
    s.includes('cannabinoides') ||
    s.includes('benzodiazepinas') ||
    s.includes('cocaina') ||
    s.includes('etosuximida') ||
    s.includes('valproico') ||
    s.includes('litio') ||
    s.includes('oxcarbazepina')
  ) {
    return 'Toxicología / Monitorización TDM';
  }

  if (isActoBioquimicoLocal(studyName)) {
    return 'Administración';
  }

  return 'Química Clínica / Bioquímica';
}

/**
 * Extrae el código de estudio del LIS si existe (e.g., "660475 - Hemograma Completo" -> "660475")
 */
export function extractStudyCode(rawName: string): string | undefined {
  if (!rawName) return undefined;
  const trimmed = rawName.trim().replace(/^="?|"$/g, '');
  const matchPrefix = trimmed.match(/^([A-Za-z0-9_]{2,10})\s*-\s*(.+)$/);
  if (matchPrefix && matchPrefix[1]) {
    return matchPrefix[1].trim();
  }
  const matchParens = trimmed.match(/\(([A-Za-z0-9_]{2,10})\)/);
  if (matchParens && matchParens[1]) {
    return matchParens[1].trim();
  }
  return undefined;
}

/**
 * Normaliza el nombre del estudio removiendo códigos numéricos al frente (e.g., "660475 - Hemograma Completo" -> "Hemograma Completo")
 */
export function cleanStudyName(rawName: string): string {
  if (!rawName) return '';
  const trimmed = rawName.trim().replace(/^="?|"$/g, '');
  // Match pattern "123456 - Name" or "ABC - Name"
  const match = trimmed.match(/^(?:[A-Za-z0-9_]{2,10}\s*-\s*)(.+)$/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

export function getTodayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parsea una línea de CSV/TSV/Separador de punto y coma con detección inteligente de cabeceras
 * y protección de integridad ISO 15189 contra desplazamientos de columnas.
 */
export function parseRawIntradayCSV(csvText: string, defaultDate = getTodayLocalDateString()): IntradayRecord[] {
  if (!csvText || !csvText.trim()) return [];

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('unid') ||
    firstLine.includes('sede') ||
    firstLine.includes('o.s.') ||
    firstLine.includes('os') ||
    firstLine.includes('examen') ||
    firstLine.includes('estudio') ||
    firstLine.includes('status') ||
    firstLine.includes('estado');

  // Detect delimiter
  const detectDelimiter = (sample: string): string => {
    if (sample.includes(';')) return ';';
    if (sample.includes('\t')) return '\t';
    return ',';
  };

  const delimiter = detectDelimiter(lines[0]);

  // Dynamic header column resolution
  let headerSedeIdx = 0;
  let headerRecepIdx = 1;
  let headerOSIdx = 2;
  let headerBarcodeIdx = 3;
  let headerStudyIdx = 4;
  let headerPromiseIdx = 5;
  let headerStatusIdx = 6;
  let headerSectorIdx = 7;

  if (hasHeader) {
    const headerCols = lines[0].split(delimiter).map((c) => c.trim().toLowerCase().replace(/^="?|"$/g, ''));
    headerCols.forEach((col, idx) => {
      if (col.includes('unid') || col.includes('sede') || col.includes('sucursal')) headerSedeIdx = idx;
      else if (col.includes('recep')) headerRecepIdx = idx;
      else if (col.includes('o.s') || col.includes('orden') || col.includes('paciente')) headerOSIdx = idx;
      else if (col.includes('cód') || col.includes('cod') || col.includes('barra') || col.includes('barcode')) headerBarcodeIdx = idx;
      else if (col.includes('examen') || col.includes('estudio') || col.includes('practica') || col.includes('determinacion')) headerStudyIdx = idx;
      else if (col.includes('fecha') || col.includes('promesa') || col.includes('entrega')) headerPromiseIdx = idx;
      else if (col.includes('status') || col.includes('estado')) headerStatusIdx = idx;
      else if (col.includes('sec') || col.includes('ruta') || col.includes('sector')) headerSectorIdx = idx;
    });
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const records: IntradayRecord[] = [];

  dataLines.forEach((line, index) => {
    if (!line.trim()) return;

    let cols = line.split(delimiter).map((c) => c.trim().replace(/^="?|"$/g, ''));

    // Skip empty lines or pure delimiter lines
    if (cols.every((c) => !c)) return;

    let sede = 'Sede Central - Flores';
    let recepcionista = '';
    let osCode = `OS-96000-${index + 1}`;
    let patientName = `Paciente ${index + 1}`;
    let barcode = '';
    let rawStudy = 'Determinación General';
    let rawPromise = `${defaultDate} - 18:00:00`;
    let status = 'SIN INFORME';

    if (hasHeader) {
      // Use resolved header indices
      if (headerSedeIdx < cols.length && cols[headerSedeIdx]) sede = cols[headerSedeIdx];
      if (headerRecepIdx < cols.length && cols[headerRecepIdx]) recepcionista = cols[headerRecepIdx];
      
      const osCol = headerOSIdx < cols.length ? cols[headerOSIdx] : '';
      if (headerBarcodeIdx < cols.length && cols[headerBarcodeIdx]) barcode = cols[headerBarcodeIdx];
      if (headerStudyIdx < cols.length && cols[headerStudyIdx]) rawStudy = cols[headerStudyIdx];
      if (headerPromiseIdx < cols.length && cols[headerPromiseIdx]) rawPromise = cols[headerPromiseIdx];
      if (headerStatusIdx < cols.length && cols[headerStatusIdx]) status = cols[headerStatusIdx];

      // Extract OS and Patient name from "014-67764-8 - Moreno Crespin Gonzalo"
      if (osCol.includes(' - ')) {
        const parts = osCol.split(' - ');
        osCode = parts[0].trim();
        patientName = parts.slice(1).join(' - ').trim();
      } else if (osCol) {
        osCode = osCol.trim();
        patientName = `Paciente (${osCol.trim()})`;
      }
    } else if (cols.length >= 7) {
      // Standard 7-8 column layout without explicit header
      sede = cols[0] || sede;
      recepcionista = cols[1] || '';
      const osCol = cols[2] || '';
      barcode = cols[3] || '';
      rawStudy = cols[4] || rawStudy;
      rawPromise = cols[5] || rawPromise;
      status = cols[6] || status;

      if (osCol.includes(' - ')) {
        const parts = osCol.split(' - ');
        osCode = parts[0].trim();
        patientName = parts.slice(1).join(' - ').trim();
      } else if (osCol) {
        osCode = osCol.trim();
        patientName = `Paciente (${osCol.trim()})`;
      }
    } else if (cols.length >= 4) {
      // Short layout: OS / Patient / Study / Status
      osCode = cols[0] || osCode;
      patientName = cols[1] || patientName;
      rawStudy = cols[2] || rawStudy;
      status = cols[3] || status;
    }

    // Protection against column-shift anomalies:
    // If status looks like a numeric study code (e.g., "660543 - I...") and rawStudy is empty or scrambled
    if (/^\d{5,7}\s*-/.test(status) && !/^\d{5,7}\s*-/.test(rawStudy)) {
      rawStudy = status;
      status = 'SIN INFORME';
    }

    // Clean study name and extract code
    const cleanedStudy = cleanStudyName(rawStudy);
    const studyCode = extractStudyCode(rawStudy);

    // Extract Promise Date & Time (e.g., "18/08/2026 - 18:00:00" -> Date "2026-08-18", Time "18:00")
    let fechaPrometida = defaultDate;
    let horaPrometida = '18:00';

    if (rawPromise) {
      // Match DD/MM/YYYY
      const dateMatch = rawPromise.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        fechaPrometida = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
      } else if (rawPromise.match(/\d{4}-\d{2}-\d{2}/)) {
        const isoMatch = rawPromise.match(/\d{4}-\d{2}-\d{2}/);
        if (isoMatch) fechaPrometida = isoMatch[0];
      }

      // Match HH:mm
      const timeMatch = rawPromise.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        horaPrometida = `${timeMatch[1]}:${timeMatch[2]}`;
      }
    }

    const sector = inferLaboratorySector(rawStudy);

    // Calculate synthetic cut state evolution for time-travel cut simulation
    const isReady =
      status === 'ENVIADO POR E-MAIL' ||
      status === 'IMPRESO ARCHIVO' ||
      status === 'CONSULTADO ONLINE' ||
      status === 'IMPRESO' ||
      status === 'ENTREGADO';

    let estadoCorte14: string | undefined = undefined;
    let estadoCorte16: string | undefined = undefined;
    let estadoCorte17: string | undefined = undefined;
    let estadoCorte18: string | undefined = undefined;

    if (isReady) {
      // If it was delivered early in the day (e.g. barcode / morning), simulate progression
      const hashVal = (index * 7 + osCode.length) % 10;
      if (hashVal < 3) {
        // Ready by 14:00
        estadoCorte14 = status;
        estadoCorte16 = status;
        estadoCorte17 = status;
        estadoCorte18 = status;
      } else if (hashVal < 6) {
        // Ready by 16:00
        estadoCorte14 = 'EN PROCESO';
        estadoCorte16 = status;
        estadoCorte17 = status;
        estadoCorte18 = status;
      } else if (hashVal < 8) {
        // Ready by 17:00
        estadoCorte14 = 'EN PROCESO';
        estadoCorte16 = 'EN PROCESO';
        estadoCorte17 = status;
        estadoCorte18 = status;
      } else {
        // Ready at 18:00
        estadoCorte14 = 'SIN INFORME';
        estadoCorte16 = 'EN PROCESO';
        estadoCorte17 = 'RESULTADO EN INTERFACE';
        estadoCorte18 = status;
      }
    } else {
      // Pending
      estadoCorte14 = status === 'ESPERANDO EN UNIDAD' ? 'ESPERANDO EN UNIDAD' : 'SIN INFORME';
      estadoCorte16 = status;
      estadoCorte17 = status;
      estadoCorte18 = status;
    }

    // Generate anonymous ID
    const anonId = `PAC-${(1000 + (index % 400)).toString()}`;

    records.push({
      id: `intra-raw-${index + 1}-${barcode || Date.now()}`,
      os: osCode,
      codigoBarra: barcode || undefined,
      idPacienteAnon: anonId,
      nombrePaciente: patientName,
      estudio: cleanedStudy || rawStudy,
      codigoEstudio: studyCode,
      nombreEstudio: cleanedStudy || rawStudy,
      sede: sede,
      sector: sector,
      recepcionista: recepcionista || undefined,
      estado: status,
      fechaPrometida: fechaPrometida,
      horaPrometida: horaPrometida,
      estadoCorte14,
      estadoCorte16,
      estadoCorte17,
      estadoCorte18,
    });
  });

  return records;
}

/**
 * Scans raw CSV/text and detects the most prevalent promise date (in ISO format YYYY-MM-DD).
 */
export function detectPrimaryDateFromCSV(csvText: string): string | null {
  if (!csvText || !csvText.trim()) return null;
  const lines = csvText.trim().split(/\r?\n/).slice(0, 150);
  const dateCounts = new Map<string, number>();

  for (const line of lines) {
    if (!line.trim()) continue;
    // Match DD/MM/YYYY
    const dmy = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmy) {
      const iso = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
      dateCounts.set(iso, (dateCounts.get(iso) || 0) + 1);
      continue;
    }
    // Match YYYY-MM-DD
    const ymd = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (ymd) {
      const iso = `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
      dateCounts.set(iso, (dateCounts.get(iso) || 0) + 1);
    }
  }

  if (dateCounts.size === 0) return null;

  let bestDate: string | null = null;
  let maxCount = -1;
  dateCounts.forEach((count, d) => {
    if (count > maxCount) {
      maxCount = count;
      bestDate = d;
    }
  });

  return bestDate;
}

