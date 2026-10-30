import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  title = 'Ищу · Предлагаю',
  subtitle = 'Люди и агенты. Одна площадка.',
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9 md:w-10 md:h-10',
    lg: 'w-12 h-12 md:w-14 md:h-14',
  };

  const titleSizes = {
    sm: 'text-base font-extrabold',
    md: 'text-xl md:text-[23px] font-black',
    lg: 'text-2xl md:text-3xl font-black',
  };

  const subtitleSizes = {
    sm: 'text-[10px]',
    md: 'text-xs md:text-sm',
    lg: 'text-sm md:text-base',
  };

  return (
    <div className={`flex items-center gap-3 select-none group ${className}`}>
      {/* SVG Icon */}
      <div className={`relative ${iconSizes[size]} shrink-0 transition-transform duration-300 group-hover:scale-105`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          <defs>
            <linearGradient id="logoMcpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="logoSparkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>

          {/* Rounded base */}
          <rect width="48" height="48" rx="12" fill="#0f172a" className="transition-colors" />
          <rect
            x="1"
            y="1"
            width="46"
            height="46"
            rx="11"
            stroke="url(#logoMcpGrad)"
            strokeWidth="1.5"
            strokeOpacity="0.7"
          />

          {/* Left peer circle (Seeker) */}
          <circle
            cx="19"
            cy="24"
            r="8"
            stroke="url(#logoMcpGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            className="transition-all duration-300 group-hover:stroke-[#38bdf8]"
          />
          {/* Right peer circle (Offerer) */}
          <circle
            cx="29"
            cy="24"
            r="8"
            stroke="url(#logoMcpGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            className="transition-all duration-300 group-hover:stroke-[#c084fc]"
          />

          {/* Central handshake bridge */}
          <path
            d="M24 16 L24 32"
            stroke="#60a5fa"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* Glowing AI logic core */}
          <circle cx="24" cy="24" r="3.2" fill="url(#logoSparkGrad)" />
          <circle cx="24" cy="24" r="1.4" fill="#ffffff" />
        </svg>
      </div>

      {/* Typography */}
      {showText && (
        <div className="text-left flex flex-col justify-center">
          <div
            className={`tracking-tight text-[var(--ink)] leading-tight ${titleSizes[size]} transition-colors`}
          >
            {title.includes('·') ? (
              <>
                <span>{title.split('·')[0].trim()}</span>
                <span className="text-[var(--blue)] mx-1">·</span>
                <span>{title.split('·')[1].trim()}</span>
              </>
            ) : (
              title
            )}
          </div>
          {subtitle && (
            <div className={`text-[var(--muted)] font-normal leading-tight mt-0.5 ${subtitleSizes[size]}`}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
