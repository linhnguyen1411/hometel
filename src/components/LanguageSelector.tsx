import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { Language } from '../i18n/translations';

interface LanguageSelectorProps {
  variant?: 'compact' | 'sidebar';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'compact' }) => {
  const { language, setLanguage, languages, currentLangInfo, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: Language) => {
    setLanguage(code);
    setIsOpen(false);
  };

  if (variant === 'sidebar') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-xl transition-all border border-slate-700/50"
          title="Change language / Đổi ngôn ngữ"
        >
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{currentLangInfo.flag}</span>
            <span className="font-semibold text-slate-200">{currentLangInfo.nativeName}</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 mb-1.5 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 py-1">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-bold text-slate-400 border-b border-slate-800">
              {t('lang.label', 'Select Language')}
            </div>
            {languages.map((item) => (
              <button
                key={item.code}
                onClick={() => handleSelect(item.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                  language === item.code
                    ? 'bg-blue-600/30 text-blue-400 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{item.flag}</span>
                  <span>{item.nativeName}</span>
                </div>
                {language === item.code && <Check className="w-3.5 h-3.5 text-blue-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Compact header dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors shadow-2xs"
        title="Change language / Đổi ngôn ngữ"
      >
        <span className="text-sm leading-none">{currentLangInfo.flag}</span>
        <span className="hidden sm:inline font-semibold">{currentLangInfo.short}</span>
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 py-1 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-blue-500" />
            <span>{t('lang.label', 'Ngôn ngữ / Language')}</span>
          </div>
          {languages.map((item) => (
            <button
              key={item.code}
              onClick={() => handleSelect(item.code)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                language === item.code
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm leading-none">{item.flag}</span>
                <div>
                  <div className="leading-tight">{item.nativeName}</div>
                  <div className="text-[10px] text-slate-400 leading-none">{item.name}</div>
                </div>
              </div>
              {language === item.code && <Check className="w-3.5 h-3.5 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
