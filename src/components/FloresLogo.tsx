import React from 'react';

export interface FloresLogoProps {
  className?: string;
  variant?: 'full-color' | 'white' | 'dark' | 'mark-only';
  height?: number | string;
}

/**
 * Marca Institucional Tipográfica de Flores Laboratorios
 * Presentación limpia, sobria y de alta legibilidad sin isotipos ni símbolos gráficos.
 */
export const FloresLogo: React.FC<FloresLogoProps> = ({
  className = '',
  variant = 'full-color',
}) => {
  const isWhite = variant === 'white';
  const primaryColor = isWhite ? '#FFFFFF' : '#0F172A'; // Slate-900 sobrio y nítido
  const subColor = isWhite ? 'rgba(255, 255, 255, 0.85)' : '#475569'; // Slate-600 legible

  return (
    <div className={`inline-flex flex-col justify-center select-none leading-none shrink-0 ${className}`}>
      <span
        className="font-black tracking-tight text-[21px] sm:text-[23px]"
        style={{
          color: primaryColor,
          letterSpacing: '-0.025em',
          lineHeight: 1,
        }}
      >
        FLORES
      </span>
      <span
        className="text-[13px] sm:text-[14px] font-medium tracking-tight mt-0.5"
        style={{
          color: subColor,
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        Laboratorios
      </span>
    </div>
  );
};



