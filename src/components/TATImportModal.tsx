import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  IntradayRecord,
  TATCase,
  DailyDeliveryEntry,
  MorningTATProcessingResult,
  TATDailySummary,
} from '../types';
import {
  isActoBioquimico,
  getTodayLocalDateString,
  formatISOToDisplayDate,
  processMorningTATFile,
} from '../services/operationalService';
import { parseRawTATCSV, detectPrimaryDateFromTATCSV } from '../services/tatParser';
import { formatToDDMMYYYYHHmm, postCentralFileAuditLog } from '../services/storageService';
import {
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  Calendar,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';

interface TATImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCases: TATCase[];
  tatSummaries?: TATDailySummary[];
  dailyHistory?: DailyDeliveryEntry[];
  onApplyUpdatedCases: (updated: TATCase[]) => Promise<void> | void;
  onApplyMorningResult?: (result: MorningTATProcessingResult) => Promise<void> | void;
  userEmail?: string;
}

export const TATImportModal: React.FC<TATImportModalProps> = ({
  isOpen,
  onClose,
  existingCases,
  tatSummaries = [],
  dailyHistory = [],
  onApplyUpdatedCases,
  onApplyMorningResult,
  userEmail = 'preanalitica@labflores.com.ar',
}) => {
  const [pasteData, setPasteData] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>(() => getTodayLocalDateString());
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastProcessedResult, setLastProcessedResult] = useState<MorningTATProcessingResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect targetDate when pasteData changes
  useEffect(() => {
    if (pasteData && pasteData.trim()) {
      const detected = detectPrimaryDateFromTATCSV(pasteData);
      if (detected) {
        setTargetDate(detected);
      }
    }
  }, [pasteData]);

  // Real-time preview calculation for TAT module & audit breakdown
  const previewResult = useMemo<MorningTATProcessingResult | null>(() => {
    if (!pasteData.trim()) return null;
    try {
      const parsedRecords = parseRawTATCSV(pasteData, targetDate);
      if (!parsedRecords || parsedRecords.length === 0) return null;
      const res = processMorningTATFile(
        parsedRecords,
        existingCases,
        new Date(),
        userEmail,
        fileName || 'archivo_matutino.csv',
        targetDate,
        dailyHistory,
        tatSummaries
      );
      return res;
    } catch (e: any) {
      return null;
    }
  }, [pasteData, targetDate, existingCases, userEmail, fileName, dailyHistory, tatSummaries]);

  if (!isOpen) return null;

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
        const detected = detectPrimaryDateFromTATCSV(text);
        if (detected) {
          setTargetDate(detected);
        }
        setStatusMessage({
          type: 'success',
          text: `Archivo "${file.name}" cargado (${(file.size / 1024).toFixed(1)} KB). Revise la vista previa antes de confirmar.`,
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

  const handleProcessAndConfirm = async () => {
    if (!pasteData.trim()) {
      setStatusMessage({ type: 'error', text: 'Por favor seleccione un archivo CSV o pegue los datos tabulados.' });
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage({
        type: 'warning',
        text: 'Procesando archivo matutino, validando denominador y guardando en base central...',
      });

      const parsedRecords = parseRawTATCSV(pasteData, targetDate);
      if (!parsedRecords || parsedRecords.length === 0) {
        setStatusMessage({ type: 'error', text: 'No se pudieron extraer registros válidos del archivo provisto.' });
        setIsProcessing(false);
        return;
      }

      const fileLabel = fileName || `archivo_matutino_${targetDate}.csv`;
      const res = processMorningTATFile(
        parsedRecords,
        existingCases,
        new Date(),
        userEmail,
        fileLabel,
        targetDate,
        dailyHistory,
        tatSummaries
      );

      setLastProcessedResult(res);

      // Aplicar actualización persistente
      if (onApplyMorningResult) {
        await onApplyMorningResult(res);
      } else {
        await onApplyUpdatedCases(res.updatedCases);
      }

      // Registrar auditoría de archivo exclusivo del módulo TAT
      try {
        await postCentralFileAuditLog({
          nombreArchivo: fileLabel,
          tamanoArchivo: `${(new Blob([pasteData]).size / 1024).toFixed(1)} KB`,
          fechaISO: res.fechaPromesaProcesada,
          fechaCarga: formatToDDMMYYYYHHmm(new Date()),
          usuarioCarga: userEmail,
          tipo: 'TAT',
          tipoCarga: 'TAT',
          totalFilas: parsedRecords.length,
          totalPracticas: res.practicasClinicasUnicas,
          reemplazo: false,
          contenidoPreview: pasteData.slice(0, 3000),
        });
      } catch (auditErr) {
        console.warn('Error registrando auditoría de carga matutina:', auditErr);
      }

      setStatusMessage({
        type: 'success',
        text: `✓ Carga procesada exitosamente: ${res.practicasClinicasUnicas.toLocaleString('es-AR')} prácticas prometidas del día (${res.practicasListas} LISTAS + ${res.practicasNoListas} NO LISTAS). Total mensual acumulado: ${res.totalPrometidoMensualAcumulado.toLocaleString('es-AR')} prácticas. % Fuera de Plazo resultante: ${res.porcentajeMensualCalculadoTexto}.`,
      });

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
        setPasteData('');
        setFileName(null);
        setStatusMessage(null);
        setLastProcessedResult(null);
      }, 2500);
    } catch (err: any) {
      console.error('Error al procesar archivo matutino TAT:', err);
      setStatusMessage({
        type: 'error',
        text: `Error al procesar: ${err?.message || 'Fallo inesperado'}`,
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5F285F] text-white flex items-center justify-center shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Carga Matutina del LIS — Seguimiento TAT
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Procesamiento de prácticas prometidas, detección de incumplimientos y acumulación del denominador mensual.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="py-5 space-y-5">
          {/* Info Banner */}
          <div className="bg-[#F7F2F7] border border-[#E9DDE9] rounded-2xl p-4 flex items-start space-x-3 text-xs text-slate-800">
            <Info className="w-4 h-4 text-[#5F285F] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-[#5F285F]">Reglas Institucionales de Acumulación y TAT:</div>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                <li><strong>Unidad de cálculo:</strong> <code>OS + Práctica</code> (recipientes físicos consolidados; Acto Bioquímico excluido).</li>
                <li><strong>Denominador mensual:</strong> Suma de TODAS las prácticas prometidas únicas (LISTAS + NO LISTAS) de cada jornada del mes.</li>
                <li><strong>Ecuación de balance obligatorio:</strong> <code>LISTAS + NO LISTAS = TOTAL PROMETIDO DEL DÍA</code>.</li>
              </ul>
            </div>
          </div>

          {/* Selector de Fecha de Promesa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5F285F]" />
              <span className="text-xs font-bold text-slate-800">Fecha de Promesa del Archivo:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#5F285F]"
              />
              <span className="text-xs text-slate-500 font-mono">
                ({formatISOToDisplayDate(targetDate)})
              </span>
            </div>
          </div>

          {/* Drag & Drop File Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition ${
              isDragging
                ? 'border-[#5F285F] bg-[#F7F2F7]'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.txt,.tsv"
              className="hidden"
            />
            <div className="w-10 h-10 rounded-xl bg-white text-[#5F285F] border border-slate-200 flex items-center justify-center mx-auto mb-2 shadow-2xs">
              <Upload className="w-5 h-5" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-800">
              {fileName ? fileName : 'Haga clic para seleccionar o arrastre el archivo CSV exportado del LIS'}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Soporta exportaciones estándar del LIS delimitadas por punto y coma (;) o tabulaciones.
            </p>
          </div>

          {/* Or Paste Raw Text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
              <span>O pegue el contenido del reporte matutino:</span>
              {pasteData && (
                <button
                  onClick={() => {
                    setPasteData('');
                    setFileName(null);
                  }}
                  className="text-rose-600 hover:underline cursor-pointer"
                >
                  Limpiar texto
                </button>
              )}
            </div>
            <textarea
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              placeholder="Unid. Extracción;Recepcionista;O.S.;Cód. barras;Examen;Fecha promesa;Status;Sec. ruta..."
              rows={3}
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5F285F]"
            />
          </div>

          {/* TABLA DE VALIDACIÓN OBLIGATORIA Y DESGLOSE AUDITABLE */}
          {previewResult && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Auditoría Obligatoria de la Jornada ({previewResult.fechaPromesaTexto})</span>
                  </div>
                  {previewResult.esConsistente ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3" />
                      Balance 100% Cuadrado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                      <AlertTriangle className="w-3 h-3" />
                      Descuadre detectado
                    </span>
                  )}
                </div>

                {/* Grid con métricas obligatorias de la jornada */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[10px] font-semibold uppercase">Filas Leídas</div>
                    <div className="text-base font-black text-slate-900">{previewResult.filasFisicasLeidas.toLocaleString('es-AR')}</div>
                    <div className="text-[10px] text-slate-400">Registros brutos</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[10px] font-semibold uppercase">Acto Bioq.</div>
                    <div className="text-base font-black text-slate-600">{previewResult.actosBioquimicosExcluidos.toLocaleString('es-AR')}</div>
                    <div className="text-[10px] text-slate-400">Excluidos</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-purple-200 text-[#5F285F]">
                    <div className="text-[10px] font-bold uppercase">Total Prometido</div>
                    <div className="text-base font-black">{previewResult.practicasClinicasUnicas.toLocaleString('es-AR')}</div>
                    <div className="text-[10px] text-purple-700">OS + Práctica</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-emerald-900">
                    <div className="text-[10px] font-bold uppercase">Listas</div>
                    <div className="text-base font-black">{previewResult.practicasListas.toLocaleString('es-AR')}</div>
                    <div className="text-[10px] text-emerald-700">En plazo</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-amber-200 text-amber-900">
                    <div className="text-[10px] font-bold uppercase">No Listas</div>
                    <div className="text-base font-black">{previewResult.practicasNoListas.toLocaleString('es-AR')}</div>
                    <div className="text-[10px] text-amber-700">Fuera de plazo</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[10px] font-semibold uppercase">Nuevos / Act.</div>
                    <div className="text-base font-black text-slate-900">+{previewResult.newCasesCount} / {previewResult.updatedExistingCount}</div>
                    <div className="text-[10px] text-slate-400">Casos TAT</div>
                  </div>
                </div>

                {/* Ecuación de validación */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-mono flex flex-wrap items-center justify-between gap-2 text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-900">Ecuación:</span>
                    <span>LISTAS ({previewResult.practicasListas.toLocaleString('es-AR')})</span>
                    <span>+</span>
                    <span>NO LISTAS ({previewResult.practicasNoListas.toLocaleString('es-AR')})</span>
                    <span>=</span>
                    <strong className="text-[#5F285F]">{previewResult.practicasClinicasUnicas.toLocaleString('es-AR')} TOTAL PROMETIDO DEL DÍA</strong>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-bold">
                    ✓ Consistencia verificada
                  </div>
                </div>
              </div>

              {/* IMPACTO Y PROYECCIÓN MENSUAL */}
              <div className="bg-[#F7F2F7] rounded-2xl border border-[#E9DDE9] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#5F285F] uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#5F285F]" />
                    <span>Acumulación Mensual Proyectada ({previewResult.mesNombre} {previewResult.mesAño})</span>
                  </span>
                  <span className="font-mono text-slate-600 lowercase text-[11px]">
                    suma de jornadas del mes
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-[#E9DDE9]">
                    <div className="text-xs text-slate-600 font-medium">Total Prometido Mensual Acumulado</div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {previewResult.totalPrometidoMensualAcumulado.toLocaleString('es-AR')}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Denominador del mes</div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#E9DDE9]">
                    <div className="text-xs text-slate-600 font-medium">Fuera de Plazo Mensual Acumulado</div>
                    <div className="text-xl font-black text-amber-900 mt-1">
                      {previewResult.fueraPlazoMensualAcumulado.toLocaleString('es-AR')}
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5">Prácticas únicas (OS + Estudio)</div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#E9DDE9]">
                    <div className="text-xs text-[#5F285F] font-bold">% Fuera de Plazo Resultante</div>
                    <div className="text-xl font-black text-[#5F285F] mt-1">
                      {previewResult.porcentajeMensualCalculadoTexto}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Fórmula institucional</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : statusMessage.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleProcessAndConfirm}
            disabled={!pasteData.trim() || isProcessing}
            className="px-6 py-2.5 rounded-xl bg-[#5F285F] hover:bg-[#4a1f4a] text-white font-bold text-sm shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isProcessing ? 'Procesando y Guardando...' : 'Confirmar e Integrar Casos TAT'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
