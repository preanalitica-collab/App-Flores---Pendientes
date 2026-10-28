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
 * Determina si un estudio corresponde a Acto Bioquímico (debe ser excluido según reglas institucionales)
 */
export function isActoBioquimicoTAT(studyName: string | null | undefined): boolean {
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
 * Determina si una OS corresponde a Calidad Analítica (prefijo 016)
 */
export function isOSCalidadAnaliticaTAT(osCode: string | null | undefined): boolean {
  if (!osCode) return false;
  const clean = osCode.trim().replace(/^="?|"$/g, '');
  return clean.startsWith('016') || clean.startsWith('16-') || clean.startsWith('016-');
}

/**
 * Infers the laboratory sector based on study name or LIS code.
 */
export function inferTATSector(studyName: string): string {
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
    s.includes('cardiolipinas') ||
    s.includes('lupico') ||
    s.includes('celiaquia') ||
    s.includes('transglutaminasa') ||
    s.includes('gliadina') ||
    s.includes('endomisio') ||
    s.includes('inmunoglobulina') ||
    s.includes('igg') ||
    s.includes('iga') ||
    s.includes('igm') ||
    s.includes('ige') ||
    s.includes('complemento') ||
    s.includes('c3') ||
    s.includes('c4') ||
    s.includes('pcr ultrasensible') ||
    s.includes('proteina c reactiva') ||
    s.includes('aso') ||
    s.includes('antiestreptolisina')
  ) {
    return 'Inmunoserología / Serología';
  }

  if (
    s.includes('orina completa') ||
    s.includes('sedimento urinario') ||
    s.includes('orina de 24') ||
    s.includes('microalbuminuria') ||
    s.includes('proteinuria') ||
    s.includes('clearence') ||
    s.includes('creatininuria') ||
    s.includes('calciuria') ||
    s.includes('fosfaturia') ||
    s.includes('uricosuria') ||
    s.includes('sodio urinario') ||
    s.includes('potasio urinario') ||
    s.includes('parasitologico') ||
    s.includes('som') ||
    s.includes('sangre oculta') ||
    s.includes('graham') ||
    s.includes('moco fecal') ||
    s.includes('leucocitos en materia fecal') ||
    s.includes('copro')
  ) {
    return 'Orinas y Parasitología';
  }

  if (s.includes('cargas virales') || s.includes('pcr') || s.includes('genotipificacion') || s.includes('hpv')) {
    return 'Biología Molecular';
  }

  return 'Química Clínica / Bioquímica';
}

/**
 * Devuelve la fecha local de hoy en formato ISO (YYYY-MM-DD)
 */
export function getTodayTATDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Detecta la fecha principal prometida en un archivo matutino TAT
 */
export function detectPrimaryDateFromTATCSV(csvText: string): string | null {
  if (!csvText || !csvText.trim()) return null;

  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const dateCounts = new Map<string, number>();

  for (let i = 1; i < Math.min(lines.length, 250); i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Look for DD/MM/YYYY
    const ddmmyyyyMatch = line.match(/\b(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(20\d{2})\b/);
    if (ddmmyyyyMatch) {
      const iso = `${ddmmyyyyMatch[3]}-${ddmmyyyyMatch[2]}-${ddmmyyyyMatch[1]}`;
      dateCounts.set(iso, (dateCounts.get(iso) || 0) + 1);
      continue;
    }

    // Look for YYYY-MM-DD
    const isoMatch = line.match(/\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b/);
    if (isoMatch) {
      const iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      dateCounts.set(iso, (dateCounts.get(iso) || 0) + 1);
    }
  }

  let maxCount = 0;
  let primaryDate: string | null = null;
  dateCounts.forEach((count, date) => {
    if (count > maxCount) {
      maxCount = count;
      primaryDate = date;
    }
  });

  return primaryDate;
}

/**
 * Parsea el archivo matutino LIS para el Módulo TAT.
 * Flujo completamente independiente del parser de Entregas Diarias.
 * Garantiza:
 * - Detección inteligente de delimitadores (;, \t, ,)
 * - Identificación dinámica de columnas LIS
 * - Exclusión estricta de Acto Bioquímico y OS 016
 * - Preservación de trazabilidad para seguimiento de plazos
 */
export function parseRawTATCSV(csvText: string, defaultDate = getTodayTATDateString()): IntradayRecord[] {
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

  const detectDelimiter = (sample: string): string => {
    if (sample.includes(';')) return ';';
    if (sample.includes('\t')) return '\t';
    return ',';
  };

  const delimiter = detectDelimiter(lines[0]);

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

    const cols = line.split(delimiter).map((c) => c.trim().replace(/^="?|"$/g, ''));
    if (cols.every((c) => !c)) return;

    let sede = 'Sede Central - Flores';
    let recepcionista = '';
    let osCode = `OS-TAT-${index + 1}`;
    let patientName = `Paciente ${index + 1}`;
    let barcode = '';
    let rawStudy = 'Determinación General';
    let rawPromise = `${defaultDate} - 18:00:00`;
    let status = 'SIN INFORME';

    if (hasHeader) {
      if (headerSedeIdx < cols.length && cols[headerSedeIdx]) sede = cols[headerSedeIdx];
      if (headerRecepIdx < cols.length && cols[headerRecepIdx]) recepcionista = cols[headerRecepIdx];

      const osCol = headerOSIdx < cols.length ? cols[headerOSIdx] : '';
      if (headerBarcodeIdx < cols.length && cols[headerBarcodeIdx]) barcode = cols[headerBarcodeIdx];
      if (headerStudyIdx < cols.length && cols[headerStudyIdx]) rawStudy = cols[headerStudyIdx];
      if (headerPromiseIdx < cols.length && cols[headerPromiseIdx]) rawPromise = cols[headerPromiseIdx];
      if (headerStatusIdx < cols.length && cols[headerStatusIdx]) status = cols[headerStatusIdx];

      if (osCol.includes(' - ')) {
        const parts = osCol.split(' - ');
        osCode = parts[0].trim();
        patientName = parts.slice(1).join(' - ').trim();
      } else if (osCol) {
        osCode = osCol.trim();
        patientName = `Paciente (${osCol.trim()})`;
      }
    } else if (cols.length >= 7) {
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
    }

    // Exclusión determinística institucional: OS 016 (Calidad Analítica)
    if (isOSCalidadAnaliticaTAT(osCode)) {
      return;
    }

    // Exclusión determinística institucional: Acto Bioquímico
    if (isActoBioquimicoTAT(rawStudy)) {
      return;
    }

    // Extraer fecha y hora prometida
    let fechaPrometida = defaultDate;
    let horaPrometida = '18:00';

    if (rawPromise) {
      const ddmmyyyy = rawPromise.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        fechaPrometida = `${year}-${month}-${day}`;
      } else {
        const yyyymmdd = rawPromise.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (yyyymmdd) {
          fechaPrometida = `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
        }
      }

      const timeMatch = rawPromise.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        horaPrometida = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
      }
    }

    const sector = inferTATSector(rawStudy);
    const idPacienteAnon = `PAC-${Math.abs(
      osCode.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
    )
      .toString()
      .substring(0, 5)}`;

    records.push({
      id: `${fechaPrometida}_${osCode}_${rawStudy}_${barcode}`,
      sede,
      recepcionista,
      os: osCode,
      idPacienteAnon,
      nombrePaciente: patientName,
      codigoBarra: barcode,
      estudio: rawStudy,
      fechaPrometida,
      horaPrometida,
      estado: status.toUpperCase().trim(),
      sector,
    });
  });

  return records;
}
