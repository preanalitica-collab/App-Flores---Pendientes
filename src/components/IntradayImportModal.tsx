import React, { useState, useRef, useMemo, useEffect } from 'react';
import { IntradayRecord, DailyDeliveryEntry } from '../types';
import {
  isActoBioquimico,
  getTodayLocalDateString,
  formatISOToDisplayDate,
  buildDailyDeliveryEntry,
} from '../services/operationalService';
import { parseRawIntradayCSV, detectPrimaryDateFromCSV } from '../services/intradayParser';
import { formatToDDMMYYYYHHmm, postCentralFileAuditLog } from '../services/storageService';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  FileText,
  FileUp,
  Calendar,
} from 'lucide-react';
import { INITIAL_INTRADAY_RECORDS } from '../data/intradayData';

export interface ClosureAuditSummary {
  fecha: string;
  fechaFormateada: string;
  archivoReemplazado: boolean;
  nombreArchivo: string;
  filasProcesadas: number;
  practicasConsolidadas: number;
  osUnicas: number;
  fechaActualizacion: string;
}

interface IntradayImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateRecords: (records: IntradayRecord[]) => void;
  onSaveDailyEntry?: (entry: DailyDeliveryEntry) => Promise<DailyDeliveryEntry[]> | void;
  onClosureUpdated?: (summary: ClosureAuditSummary) => void;
  onSelectDate?: (dateISO: string) => void;
  dailyHistory?: DailyDeliveryEntry[];
  currentRecordsCount?: number;
  userEmail?: string;
}

export const IntradayImportModal: React.FC<IntradayImportModalProps> = ({
  isOpen,
  onClose,
  onUpdateRecords,
  onSaveDailyEntry,
  onClosureUpdated,
  onSelectDate,
  dailyHistory = [],
  currentRecordsCount = 0,
  userEmail = 'preanalitica@labflores.com.ar',
}) => {
  const [pasteData, setPasteData] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(() => getTodayLocalDateString());
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [showOverwriteConfirmation, setShowOverwriteConfirmation] = useState<boolean>(false);
  const [pendingParsedRecords, setPendingParsedRecords] = useState<IntradayRecord[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sampleCSVTemplate = `Unid. Extracción;Recepcionista;O.S.;Cód. barras;Examen;Fecha promesa;Status;Sec. ruta
Barrio Norte (Monteagudo);107 - Melody Rebeca Ale;014-67764-8 - Moreno Gonzalo;="260000240735";660475 - Hemograma Completo;18/08/2026 - 18:00:00;ENVIADO POR E-MAIL;
Barrio Norte (Monteagudo);107 - Melody Rebeca Ale;014-67764-8 - Moreno Gonzalo;="";660001 - Acto Bioquimico;18/08/2026 - 18:00:00;SIN INFORME;
Concepción;31 - Cinthya Godoy;002-67773-25 - Paterlini Nancy;="260000252497";660412 - Glucosa en Suero ;18/08/2026 - 18:00:00;CONSULTADO ONLINE;`;

  // Auto-detect targetDate when pasteData changes
  useEffect(() => {
    if (pasteData && pasteData.trim()) {
      const detected = detectPrimaryDateFromCSV(pasteData);
      if (detected) {
        setTargetDate(detected);
      }
    }
  }, [pasteData]);

  // Detect existing entry in history for targetDate
  const existingDayEntry = useMemo(() => {
    return dailyHistory.find((e) => e.fecha === targetDate) || null;
  }, [dailyHistory, targetDate]);

  // Real-time preview calculation
  const previewSummary = useMemo(() => {
    if (!pasteData.trim()) return null;
    try {
      const records = parseRawIntradayCSV(pasteData, targetDate);
      const totalRows = records.length;
      const dateRows = targetDate === 'TODAS' ? totalRows : records.filter((r) => r.fechaPrometida === targetDate).length;
      const actoRows = records.filter((r) => (targetDate === 'TODAS' || r.fechaPrometida === targetDate) && isActoBioquimico(r.estudio)).length;
      const validRows = dateRows - actoRows;
      const uniqueOS = new Set(
        records
          .filter((r) => (targetDate === 'TODAS' || r.fechaPrometida === targetDate) && !isActoBioquimico(r.estudio))
          .map((r) => r.os)
      ).size;
      const isBalanced = dateRows === actoRows + validRows;

      // Extract unique dates in data
      const datesInData = Array.from(new Set(records.map((r) => r.fechaPrometida).filter(Boolean)));

      return {
        totalRows,
        dateRows,
        actoRows,
        validRows,
        uniqueOS,
        isBalanced,
        datesInData,
      };
    } catch {
      return null;
    }
  }, [pasteData, targetDate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteData(text);
        const detected = detectPrimaryDateFromCSV(text);
        if (detected) {
          setTargetDate(detected);
        }
        setStatusMessage({
          type: 'success',
          text: `Archivo "${file.name}" leído correctamente (${(file.size / 1024).toFixed(1)} KB). Verifique la información y confirme la carga.`,
        });
      }
    };
    reader.onerror = () => {
      setStatusMessage({ type: 'error', text: `Error al leer el archivo "${file.name}".` });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const commitParsedRecords = async (
    parsed: IntradayRecord[],
    effectiveDate: string,
    fileLabel: string,
    wasReplaced: boolean
  ) => {
    try {
      setStatusMessage({
        type: 'warning',
        text: 'Guardando y sincronizando con la base de datos central en la nube...',
      });

      // Normalizar registros para que pertenezcan estrictamente a la fecha del cierre
      const recordsForDate = parsed.map((r) => ({
        ...r,
        fechaPrometida: r.fechaPrometida || effectiveDate,
      }));

      const nowFormatted = formatToDDMMYYYYHHmm(new Date());

      // Obtener datos previos de la misma fecha o de la última jornada para comparar evolución y actualizar ciclo de vida TAT
      const existingEntryForDate = dailyHistory.find((e) => e.fecha === effectiveDate);
      const previousRecords = existingEntryForDate?.records;
      const existingBreaches = existingEntryForDate?.tatBreaches;

      // Construir y recalcular completamente el cierre aplicando todas las reglas de negocio y TAT
      const entry = buildDailyDeliveryEntry(
        recordsForDate,
        effectiveDate,
        fileLabel,
        nowFormatted,
        userEmail,
        previousRecords,
        existingBreaches
      );

      // 1. Guardar en almacenamiento persistente central (Firestore + Backend)
      if (onSaveDailyEntry) {
        await onSaveDailyEntry(entry);
      }

      // 2. Registrar en auditoría de archivos
      try {
        await postCentralFileAuditLog({
          nombreArchivo: fileLabel,
          tamanoArchivo: `${(new Blob([pasteData]).size / 1024).toFixed(1)} KB`,
          fechaISO: effectiveDate,
          fechaCarga: nowFormatted,
          usuarioCarga: userEmail,
          tipo: 'ENTREGA_DIARIA',
          totalFilas: recordsForDate.length,
          totalPracticas: entry.practicasTotales,
          reemplazo: wasReplaced,
          contenidoPreview: pasteData.slice(0, 3000),
        });
      } catch (auditErr) {
        console.warn('Advertencia al registrar auditoría de archivo:', auditErr);
      }

      // 3. Actualizar estado de registros en memoria
      onUpdateRecords(recordsForDate);

      // 4. Seleccionar la fecha recién cargada/actualizada
      if (onSelectDate) {
        onSelectDate(effectiveDate);
      }

      // 5. Disparar auditoría de actualización
      if (onClosureUpdated) {
        onClosureUpdated({
          fecha: effectiveDate,
          fechaFormateada: formatISOToDisplayDate(effectiveDate),
          archivoReemplazado: wasReplaced,
          nombreArchivo: fileLabel,
          filasProcesadas: recordsForDate.length,
          practicasConsolidadas: entry.practicasTotales,
          osUnicas: entry.osTotales,
          fechaActualizacion: nowFormatted,
        });
      }

      setStatusMessage({
        type: 'success',
        text: wasReplaced
          ? `✓ Carga reemplazada y guardada correctamente en la Base de Datos para el ${formatISOToDisplayDate(effectiveDate)}.`
          : `✓ Carga guardada correctamente en la Base de Datos para el ${formatISOToDisplayDate(effectiveDate)}.`,
      });

      setTimeout(() => {
        onClose();
        setShowOverwriteConfirmation(false);
        setPendingParsedRecords(null);
        setPasteData('');
        setFileName(null);
        setStatusMessage(null);
      }, 1000);
    } catch (err: any) {
      console.error('Error al guardar en base de datos:', err);
      setStatusMessage({
        type: 'error',
        text: `Error al persistir en la base de datos: ${err?.message || 'Fallo de conexión'}. Los datos no se simularon como guardados.`,
      });
    }
  };

  const handleProcessPastedData = () => {
    if (!pasteData.trim()) {
      setStatusMessage({ type: 'error', text: 'Por favor seleccione un archivo o pegue los datos tabulados / CSV.' });
      return;
    }

    try {
      const effectiveDate = targetDate;
      const parsed = parseRawIntradayCSV(pasteData, effectiveDate);

      if (!parsed || parsed.length === 0) {
        setStatusMessage({ type: 'error', text: 'No se pudieron extraer filas válidas del texto o archivo provisto.' });
        return;
      }

      // Check if effectiveDate already exists in history
      const existing = dailyHistory.find((e) => e.fecha === effectiveDate);
      if (existing) {
        setPendingParsedRecords(parsed);
        setShowOverwriteConfirmation(true);
        return;
      }

      commitParsedRecords(parsed, effectiveDate, fileName || `entregas_${effectiveDate}.csv`, false);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Error al procesar: ${err.message}` });
    }
  };

  const handleConfirmOverwrite = () => {
    if (pendingParsedRecords) {
      commitParsedRecords(
        pendingParsedRecords,
        targetDate,
        fileName || `entregas_${targetDate}.csv`,
        true
      );
    }
  };

  const handleCancelOverwrite = () => {
    setShowOverwriteConfirmation(false);
    setPendingParsedRecords(null);
  };

  const handleResetToDefault = async () => {
    const entry18 = buildDailyDeliveryEntry(
      INITIAL_INTRADAY_RECORDS,
      '2026-08-18',
      'entregas_18_08_2026.csv',
      '18/08/2026 18:00'
    );
    if (onSaveDailyEntry) {
      await onSaveDailyEntry(entry18);
    }
    onUpdateRecords(INITIAL_INTRADAY_RECORDS);
    if (onSelectDate) {
      onSelectDate('2026-08-18');
    }
    setStatusMessage({ type: 'success', text: 'Se restauró el dataset operativo inicial del 18/08/2026.' });
    setTimeout(() => {
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#5F285F] text-white flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-[16px]">Cargar Entregas Diarias (Exportación LIS)</h3>
              <p className="text-[12.5px] text-slate-300">
                Carga de cierre de jornada con almacenamiento histórico persistente
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Target Date Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13.5px]">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-[#5F285F]" />
              <div>
                <span className="font-bold text-slate-800">Fecha correspondiente a la jornada:</span>
                <p className="text-slate-500 text-[12.5px]">Normalmente la carga se realiza al cierre del día (18:00 hs).</p>
              </div>
            </div>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3.5 py-1.5 font-bold text-slate-800 text-[13.5px] focus:ring-2 focus:ring-[#5F285F] focus:border-[#5F285F] cursor-pointer"
            />
          </div>

          {/* Overwrite Confirmation Dialog */}
          {showOverwriteConfirmation && existingDayEntry && (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 text-xs space-y-3 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-950 text-sm">
                    Ya existen datos registrados para {formatISOToDisplayDate(targetDate)}. ¿Desea reemplazar y reprocesar esta jornada?
                  </h4>
                  <p className="text-amber-900 leading-relaxed text-[12.5px]">
                    Archivo actual en base de datos: <strong>«{existingDayEntry.nombreArchivo}»</strong>
                    <br />
                    Cargado por: <strong>{existingDayEntry.cargadoPor || 'Usuario previo'}</strong> el <strong>{existingDayEntry.fechaActualizacion}</strong>.
                    <br />
                    Total de prácticas registradas: <strong>{existingDayEntry.practicasTotales}</strong> (Cumplimiento: <strong>{existingDayEntry.porcentajeCumplimiento}%</strong>).
                    <br />
                    <span className="text-amber-950 font-semibold mt-1 inline-block">
                      Si confirma, se reemplazará exclusivamente la información de esa fecha, recalculando todos sus indicadores y manteniendo intactas las demás jornadas.
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={handleCancelOverwrite}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 cursor-pointer transition text-[13px]"
                >
                  Cancelar la carga
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOverwrite}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs cursor-pointer transition text-[13px]"
                >
                  Reemplazar y reprocesar esta jornada
                </button>
              </div>
            </div>
          )}

          {/* Assurance info */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Regla de Exclusión ISO 9001:</span> El registro administrativo{' '}
              <em>"Acto Bioquímico"</em> será procesado y neutralizado automáticamente del cálculo analítico de pendientes.
            </div>
          </div>

          {/* Drag and drop / File upload box */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50'
                : 'border-slate-300 hover:border-emerald-400 bg-slate-50/70 hover:bg-white'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.tsv,.txt"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-11 h-11 rounded-full bg-[#F7F2F7] text-[#5F285F] flex items-center justify-center">
                <FileUp className="w-5 h-5 text-[#5F285F]" />
              </div>
              <div className="text-[13.5px]">
                <span className="font-bold text-slate-800">Haga clic para seleccionar archivo</span> o arrastre aquí su exportación del LIS (.csv / .tsv / .txt)
              </div>
              {fileName && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F7F2F7] text-[#5F285F] border border-[#E9DDE9] rounded-lg text-[13px] font-bold">
                  <FileText className="w-4 h-4" />
                  <span>{fileName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Paste area fallback */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[13.5px] font-semibold text-slate-700">
                O pegue el contenido de texto directo:
              </label>
              <button
                type="button"
                onClick={() => setPasteData(sampleCSVTemplate)}
                className="text-[13px] text-[#5F285F] font-bold hover:underline cursor-pointer"
              >
                Cargar plantilla de ejemplo
              </button>
            </div>
            <textarea
              rows={4}
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              placeholder={`Unid. Extracción;Recepcionista;O.S.;Cód. barras;Examen;Fecha promesa;Status;Sec. ruta\n...`}
              className="w-full font-mono text-[13px] p-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#5F285F] focus:border-[#5F285F] bg-slate-50"
            />
          </div>

          {/* Real-time Pre-validation Card */}
          {previewSummary && (
            <div className="bg-slate-900 text-white rounded-xl p-3.5 text-xs space-y-2 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Resumen de Registros a Importar
                </span>
                {previewSummary.isBalanced ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ✓ Balance Cuadrado
                  </span>
                ) : (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ✗ Desbalance Detectado
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-1">
                <div className="bg-slate-800/80 p-2 rounded-lg">
                  <div className="text-slate-400 text-[10px]">Filas Totales</div>
                  <div className="font-bold text-slate-100 text-sm">{previewSummary.totalRows}</div>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-lg">
                  <div className="text-slate-400 text-[10px]">Filas del Día</div>
                  <div className="font-bold text-slate-100 text-sm">{previewSummary.dateRows}</div>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-lg">
                  <div className="text-slate-400 text-[10px]">Acto Bioq. Excluido</div>
                  <div className="font-bold text-rose-400 text-sm">{previewSummary.actoRows}</div>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-lg">
                  <div className="text-slate-400 text-[10px]">Determinac. Válidas</div>
                  <div className="font-bold text-emerald-400 text-sm">{previewSummary.validRows}</div>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-lg col-span-2 sm:col-span-1">
                  <div className="text-slate-400 text-[10px]">OS Únicas</div>
                  <div className="font-bold text-amber-400 text-sm">{previewSummary.uniqueOS}</div>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 text-center font-mono">
                Ecuación: {previewSummary.dateRows} filas del día = {previewSummary.actoRows} Acto Bioq. + {previewSummary.validRows} determinaciones válidas
              </div>
            </div>
          )}

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-100 text-emerald-800'
                  : statusMessage.type === 'warning'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-[13px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restablecer datos iniciales</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13.5px] font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleProcessPastedData}
              disabled={!pasteData.trim()}
              className={`px-5 py-2.5 rounded-xl text-[14px] font-bold shadow-xs transition flex items-center gap-2 ${
                pasteData.trim()
                  ? 'bg-[#5F285F] hover:bg-[#452045] text-white cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Procesar e Importar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
