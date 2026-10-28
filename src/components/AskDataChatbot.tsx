import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  User,
  Bot,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { ResumenMensualRow, RankingCausaRow, RankingEstudioRow, DiccionarioEntry } from '../types';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AskDataChatbotProps {
  resumenList?: ResumenMensualRow[];
  rankingCausas?: RankingCausaRow[];
  rankingEstudios?: RankingEstudioRow[];
  diccionario?: DiccionarioEntry[];
}

const SAMPLE_QUESTIONS = [
  '¿Cuál es el mes con más pacientes fuera de plazo?',
  '¿Cuáles son las 3 causas principales de desvío?',
  '¿Qué prestaciones tuvieron mayores demoras?',
  '¿Cuántos casos continúan sin estado definido?',
  '¿Qué significa Notificación Sin Registro?',
  'Resumen ejecutivo para reunión de calidad ISO 15189',
];

export const AskDataChatbot: React.FC<AskDataChatbotProps> = ({
  resumenList = [],
  rankingCausas = [],
  rankingEstudios = [],
  diccionario = [],
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: '¡Hola! Soy el asistente analítico de **Confiabilidad del Laboratorio**.\n\nPuedo responder cualquier consulta ejecutiva sobre los datos consolidados de plazos de entrega, causas de desvíos, prestaciones afectadas y estado de seguimiento bajo normas ISO 9001 e ISO 15189:2022.\n\n*¿Qué aspecto del desempeño del laboratorio deseas consultar?*',
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      // Build context strictly from sheets
      const fullContext = {
        resumenMensual: resumenList,
        rankingCausas,
        rankingEstudios,
        diccionario,
        mesesConDatos: ['Julio 2026', 'Agosto 2026'],
        mesesPendientes: ['Enero a Junio 2026', 'Septiembre a Diciembre 2026'],
      };

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          fullDatabaseContext: fullContext,
          history: messages.slice(-6),
        }),
      });

      const data = await response.json();
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'No se pudo generar una respuesta.',
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Error sending chat message:', err);
      const errMsg: Message = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text: 'Ocurrió un inconveniente al consultar la base de datos. Por favor intenta nuevamente.',
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'init-1',
        sender: 'assistant',
        text: 'Conversación reiniciada. Puedes formular una nueva consulta sobre la base de plazos de entrega.',
        timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[650px] mb-6 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#5F285F]/50 border border-[#744174]/60 flex items-center justify-center text-[#E9DDE9]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-[16px] text-white">Pregúntale a tus Datos</h3>
              <span className="bg-[#5F285F]/40 text-[#E9DDE9] border border-[#744174]/50 text-[12px] px-2.5 py-0.5 rounded-md font-bold uppercase">
                IA Conversacional
              </span>
            </div>
            <p className="text-[13px] text-slate-300">
              Respuestas fundamentadas exclusivamente en la base de datos oficial del laboratorio
            </p>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
          title="Limpiar conversación"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-2 text-[13px]">
          <span className="text-slate-600 font-bold whitespace-nowrap text-[13px]">
            Consultas sugeridas:
          </span>
          {SAMPLE_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="bg-white hover:bg-[#F7F2F7] text-slate-700 hover:text-[#5F285F] border border-slate-200 hover:border-[#E9DDE9] px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap font-semibold transition shadow-xs cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${
              m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                m.sender === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-[#5F285F] text-white shadow-xs'
              }`}
            >
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-none shadow-xs'
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-xs'
              }`}
            >
              <div className="whitespace-pre-line prose-sm text-[14px]">{m.text}</div>
              <div
                className={`mt-1.5 text-[12px] font-medium ${
                  m.sender === 'user' ? 'text-slate-400 text-right' : 'text-slate-400'
                }`}
              >
                {m.timestamp}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#5F285F] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-[13.5px] text-slate-600 flex items-center gap-2 shadow-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-[#5F285F]" />
              <span>Consultando tablas y reglas del laboratorio...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3.5 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre causas, demoras, estudios, comparaciones mensuales o normativa..."
            className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-[14px] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5F285F] focus:border-[#5F285F] focus:bg-white"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-[#5F285F] hover:bg-[#452045] disabled:bg-slate-200 text-white disabled:text-slate-400 px-4 py-2.5 rounded-xl text-[14px] font-bold flex items-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Consultar</span>
          </button>
        </form>
        <p className="text-[12.5px] text-slate-500 mt-2 text-center">
          Cumplimiento estricto: Respuestas 100% basadas en la base oficial. Nombres e IDs de pacientes no son
          expuestos.
        </p>
      </div>
    </div>
  );
};
