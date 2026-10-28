import React, { useState } from 'react';
import { BookOpen, Search, ShieldCheck, HelpCircle, X, ExternalLink } from 'lucide-react';
import { DiccionarioEntry } from '../types';

interface DictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries?: DiccionarioEntry[];
}

export const DictionaryModal: React.FC<DictionaryModalProps> = ({
  isOpen,
  onClose,
  entries = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filtered = (entries || []).filter(
    (e) =>
      e?.termino?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e?.definicion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e?.fuenteRegla?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 text-[14px] text-slate-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#F7F2F7] text-[#5F285F] flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#5F285F]" />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-slate-900">
                Diccionario de Reglas de Negocio y Criterios ISO
              </h3>
              <p className="text-[13px] text-slate-500">
                Hoja Diccionario • Base Maestra de Plazos de Entrega (v2)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="my-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por término, fórmula o cláusula normativa..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:ring-2 focus:ring-[#5F285F] focus:border-[#5F285F] focus:bg-white"
          />
        </div>

        {/* List of Definitions */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {filtered.map((entry, idx) => (
            <div
              key={idx}
              className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-2 hover:bg-slate-50 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-slate-900 text-[15px]">{entry.termino}</h4>
                <span className="bg-[#F7F2F7] text-[#5F285F] border border-[#E9DDE9] text-[12.5px] px-2.5 py-0.5 rounded-md font-bold whitespace-nowrap">
                  Regla de Calidad
                </span>
              </div>

              <p className="text-slate-700 leading-relaxed text-[14px]">{entry.definicion}</p>

              {entry.formula && (
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 font-mono text-[13px] text-slate-800">
                  <span className="font-sans font-semibold text-slate-500 mr-2">Fórmula:</span>
                  {entry.formula}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px] pt-1">
                <div>
                  <span className="font-semibold text-slate-500">Fuente / Cláusula:</span>
                  <p className="text-slate-800">{entry.fuenteRegla}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Impacto en Gestión:</span>
                  <p className="text-slate-800">{entry.impactoGestion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-between text-[13px] text-slate-500">
          <span>Normas de referencia: ISO 9001:2015 / ISO 15189:2022 / CLSI C54-A</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#5F285F] text-white rounded-xl text-[14px] font-bold hover:bg-[#452045] transition cursor-pointer shadow-xs"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
