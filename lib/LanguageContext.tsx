'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations, TranslationKey } from './i18n';

interface LanguageContextProps {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('id');

  useEffect(() => {
    const storedLang = localStorage.getItem('lenskeep_language') as Language;
    if (storedLang && (storedLang === 'id' || storedLang === 'en')) {
      setLanguage(storedLang);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    if (lang === 'id' || lang === 'en') {
      setLanguage(lang);
      localStorage.setItem('lenskeep_language', lang);
    }
  };

  const t = (key: TranslationKey): string => {
    const dict = translations[language] || translations['id'];
    return dict[key] || translations['id'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextProps => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
