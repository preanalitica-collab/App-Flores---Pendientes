import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
  LayoutDashboard,
  HeartHandshake,
  TestTube2,
  Activity,
  Award,
  Sparkles,
  BookOpen,
  Lock,
  Zap,
  PieChart,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { ActiveModule, UserSession } from '../types';
import { FloresLogo } from './FloresLogo';

interface NavbarProps {
  activeModule: ActiveModule;
  setActiveModule: (mod: ActiveModule) => void;
  onOpenDictionary: () => void;
  onOpenDataSync?: () => void;
  userSession?: UserSession;
  setUserSession?: (session: UserSession) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeModule,
  setActiveModule,
  onOpenDictionary,
  userSession = {
    email: 'preanalitica@labflores.com.ar',
    role: 'Coordinador de Calidad / Dirección',
    isAuthorizedForSensitiveData: true,
  },
  setUserSession = (_session: UserSession) => {},
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const usersList = [
    {
      email: 'preanalitica@labflores.com.ar',
      role: 'Coordinador de Calidad / Preanalítica',
      label: 'Usuario A (Preanalítica)',
      isAuthorized: true,
    },
    {
      email: 'calidad@labflores.com.ar',
      role: 'Supervisión de Calidad / Dirección',
      label: 'Usuario B (Calidad)',
      isAuthorized: true,
    },
    {
      email: 'invitado@laboratorio.com',
      role: 'Visualizador General',
      label: 'Invitado',
      isAuthorized: false,
    },
  ];

  const handleSelectUser = (u: typeof usersList[0]) => {
    setUserSession({
      email: u.email,
      role: u.role,
      isAuthorizedForSensitiveData: u.isAuthorized,
    });
    setIsUserMenuOpen(false);
  };

  const isMoreModuleActive = [
    'placeholder_experiencia',
    'placeholder_preanalitica',
    'placeholder_analitica',
    'placeholder_iso15189',
  ].includes(activeModule);

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Header - Institutional & Compact */}
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Logo & Identity: [LOGO FLORES] | SISTEMA DE CONFIABILIDAD DEL LABORATORIO */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <FloresLogo height={42} variant="full-color" />

            {/* Subtle vertical separator */}
            <div className="h-10 w-px bg-slate-200 hidden sm:block shrink-0" />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-[18px] font-extrabold tracking-tight text-slate-900 leading-tight uppercase">
                  SISTEMA DE CONFIABILIDAD DEL LABORATORIO
                </h1>
                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[12px] px-2 py-0.5 rounded-md font-semibold tracking-wide hidden lg:inline-block">
                  ISO 9001 & ISO 15189:2022
                </span>
              </div>
              <p className="text-[13px] sm:text-[13.5px] text-slate-500 font-medium mt-0.5">
                Gestión operativa, calidad y seguimiento
              </p>
            </div>
          </div>

          {/* Quick Actions & Auth */}
          <div className="flex flex-wrap items-center gap-2.5 text-[14px]">
            {/* Dictionary of rules */}
            <button
              onClick={onOpenDictionary}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition text-[14px] font-semibold cursor-pointer shadow-2xs"
              title="Consultar Diccionario de Reglas y Fórmulas"
            >
              <BookOpen className="w-4 h-4 text-[#744174]" />
              <span>Reglas & Glosario</span>
            </button>

            {/* AI Assistant Quick Toggle - Brand Primary Color */}
            <button
              onClick={() => setActiveModule('asistente')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl transition text-[14px] font-semibold cursor-pointer shadow-2xs ${
                activeModule === 'asistente'
                  ? 'bg-[#5F285F] text-white shadow-xs'
                  : 'bg-[#F7F2F7] hover:bg-[#E9DDE9] text-[#5F285F] border border-[#E9DDE9]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#5F285F]" />
              <span>Pregúntale a tus datos</span>
            </button>

            {/* User Session Switcher (Multi-User Selection) */}
            <div className="relative flex items-center pl-2 border-l border-slate-200 space-x-2" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition cursor-pointer ${
                  userSession.isAuthorizedForSensitiveData
                    ? 'bg-[#F7F2F7] text-[#5F285F] border border-[#E9DDE9]'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
                title="Cambiar usuario activo para verificar acceso multi-usuario"
              >
                <Lock className="w-3.5 h-3.5 text-[#744174]" />
                <span className="hidden xl:inline">{userSession.email}</span>
                <span className="font-bold text-[12.5px] uppercase bg-white px-2 py-0.5 rounded-md border border-[#E9DDE9] shadow-2xs">
                  {userSession.isAuthorizedForSensitiveData ? 'Autorizado' : 'Invitado'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                    Cambiar Usuario Autorizado
                  </div>
                  <div className="py-1 space-y-1">
                    {usersList.map((u) => {
                      const isSelected = userSession.email === u.email;
                      return (
                        <button
                          key={u.email}
                          onClick={() => handleSelectUser(u)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs flex flex-col transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#F7F2F7] text-[#5F285F] font-bold border border-[#E9DDE9]'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="font-bold text-slate-900">{u.label}</span>
                          <span className="text-[11.5px] text-slate-500 truncate">{u.email}</span>
                          <span className="text-[10.5px] text-slate-400 mt-0.5">{u.role}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs - Institutional Flores Purple Styling */}
      <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1600px] w-full mx-auto flex items-center justify-between py-1 text-[14px] font-medium">
          {/* Primary Active Navigation Tabs */}
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar py-0.5">
            {/* 1. Entregas Diarias */}
            <button
              onClick={() => setActiveModule('entregas_hoy')}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl transition whitespace-nowrap text-[14px] cursor-pointer ${
                activeModule === 'entregas_hoy'
                  ? 'bg-[#5F285F] text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Zap className={`w-4 h-4 ${activeModule === 'entregas_hoy' ? 'text-white' : 'text-[#744174]'}`} />
              <span>Entregas Diarias</span>
            </button>

            {/* 2. Gráficos de Entregas (Tortas) */}
            <button
              onClick={() => setActiveModule('entregas_graficos')}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl transition whitespace-nowrap text-[14px] cursor-pointer ${
                activeModule === 'entregas_graficos'
                  ? 'bg-[#5F285F] text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <PieChart className={`w-4 h-4 ${activeModule === 'entregas_graficos' ? 'text-white' : 'text-[#744174]'}`} />
              <span>Gráficos de Entregas</span>
            </button>

            {/* 2. Módulo TAT: Seguimiento de Prácticas Vencidas */}
            <button
              onClick={() => setActiveModule('plazos')}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl transition whitespace-nowrap text-[14px] cursor-pointer ${
                activeModule === 'plazos'
                  ? 'bg-[#5F285F] text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Clock className={`w-4 h-4 ${activeModule === 'plazos' ? 'text-white' : 'text-[#744174]'}`} />
              <span>TAT</span>
            </button>

            {/* 3. Resumen Ejecutivo */}
            <button
              onClick={() => setActiveModule('resumen')}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl transition whitespace-nowrap text-[14px] cursor-pointer ${
                activeModule === 'resumen'
                  ? 'bg-[#5F285F] text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${activeModule === 'resumen' ? 'text-white' : 'text-[#744174]'}`} />
              <span>Resumen Ejecutivo</span>
            </button>
          </div>

          {/* Secondary / Upcoming Modules Menu */}
          <div className="relative pl-2 shrink-0" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[14px] transition cursor-pointer ${
                isMoreModuleActive
                  ? 'bg-[#5F285F] text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Módulos en desarrollo para el sistema de calidad"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Otros Módulos</span>
              <span className={`text-[12px] px-1.5 py-0.5 rounded-full font-bold ${
                isMoreModuleActive ? 'bg-[#452045] text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                4
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown for Secondary Modules */}
            {isMoreOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-[14px]">
                <div className="px-3.5 py-2 text-slate-500 font-bold text-[12px] uppercase tracking-wider border-b border-slate-100">
                  Próximos Módulos del Sistema
                </div>

                <button
                  onClick={() => {
                    setActiveModule('placeholder_experiencia');
                    setIsMoreOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 transition cursor-pointer ${
                    activeModule === 'placeholder_experiencia' ? 'bg-[#F7F2F7] text-[#5F285F] font-bold' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <HeartHandshake className="w-4 h-4 text-[#744174]" />
                    <span>Experiencia del Paciente</span>
                  </div>
                  <span className="text-[12px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Pronto</span>
                </button>

                <button
                  onClick={() => {
                    setActiveModule('placeholder_preanalitica');
                    setIsMoreOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 transition cursor-pointer ${
                    activeModule === 'placeholder_preanalitica' ? 'bg-[#F7F2F7] text-[#5F285F] font-bold' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <TestTube2 className="w-4 h-4 text-[#744174]" />
                    <span>Calidad Preanalítica</span>
                  </div>
                  <span className="text-[12px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Pronto</span>
                </button>

                <button
                  onClick={() => {
                    setActiveModule('placeholder_analitica');
                    setIsMoreOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 transition cursor-pointer ${
                    activeModule === 'placeholder_analitica' ? 'bg-[#F7F2F7] text-[#5F285F] font-bold' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-[#744174]" />
                    <span>Calidad Analítica</span>
                  </div>
                  <span className="text-[12px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Pronto</span>
                </button>

                <button
                  onClick={() => {
                    setActiveModule('placeholder_iso15189');
                    setIsMoreOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50 transition cursor-pointer ${
                    activeModule === 'placeholder_iso15189' ? 'bg-[#F7F2F7] text-[#5F285F] font-bold' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-[#744174]" />
                    <span>ISO 15189</span>
                  </div>
                  <span className="text-[12px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Pronto</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
