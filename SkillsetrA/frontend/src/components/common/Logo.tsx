import React from 'react'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  lightText?: boolean
  subtitle?: string
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  lightText = false,
  subtitle,
}) => {
  const sizeClasses = {
    sm: 'h-7 w-auto',
    md: 'h-9 w-auto',
    lg: 'h-11 w-auto',
    xl: 'h-14 w-auto',
  }

  const containerSizes = {
    sm: 'w-8 h-8 p-1',
    md: 'w-10 h-10 p-1.5',
    lg: 'w-14 h-14 p-2',
    xl: 'w-18 h-18 p-2.5',
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`relative flex items-center justify-center rounded-xl bg-white p-1 shadow-sm border border-emerald-100/80 ${containerSizes[size]}`}>
        <img
          src="/logo.png"
          alt="SkillsetrA Logo"
          className={`${sizeClasses[size]} object-contain filter drop-shadow-xs`}
        />
      </div>
      {showText && (
        <div>
          <div className="flex items-center gap-1">
            <span className={`font-extrabold tracking-tight ${size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl'} ${lightText ? 'text-white' : 'text-slate-900'}`}>
              Skillsetr<span className="text-emerald-500">A</span>
            </span>
          </div>
          {subtitle && (
            <span className={`text-[10px] font-bold uppercase tracking-widest block -mt-0.5 ${lightText ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
