import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, SUPPORTED_LANGUAGES, LanguageOption, translations } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  currentLangInfo: LanguageOption;
  languages: LanguageOption[];
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('homtel_language') as Language;
      if (saved && ['vi', 'en', 'ko', 'zh', 'ja'].includes(saved)) {
        return saved;
      }
    }
    return 'vi';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('homtel_language', lang);
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const currentLangInfo = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  const t = (key: string, fallback?: string): string => {
    const dict = translations[language] || translations['vi'];
    if (dict && dict[key]) {
      return dict[key];
    }
    // Fallback to Vietnamese or English
    if (translations['vi'] && translations['vi'][key]) {
      return translations['vi'][key];
    }
    if (translations['en'] && translations['en'][key]) {
      return translations['en'][key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      currentLangInfo,
      languages: SUPPORTED_LANGUAGES,
      t
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
