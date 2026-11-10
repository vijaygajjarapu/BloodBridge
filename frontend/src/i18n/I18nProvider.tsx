import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGES, isLanguageCode, type LanguageCode } from './languages';
import { en, type TranslationKey, type Translations } from './locales/en';
import { hi } from './locales/hi';
import { te } from './locales/te';
import { ta } from './locales/ta';
import { ml } from './locales/ml';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/api/client';

const DICTS: Record<LanguageCode, Translations> = { en, hi, te, ta, ml };
const STORAGE_KEY = 'bb.language';

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: TFunction;
}

const readStored = (): LanguageCode | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(v) ? v : null;
  } catch {
    return null;
  }
};

/** First visit: use the browser's language if we have it (e.g. "te-IN" -> Telugu) */
const fromBrowser = (): LanguageCode => {
  try {
    const code = (navigator.language || '').slice(0, 2).toLowerCase();
    return isLanguageCode(code) ? code : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

export const translate = (language: LanguageCode, key: TranslationKey, vars?: Record<string, string | number>) => {
  const text = DICTS[language]?.[key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m)) : text;
};

const I18nContext = createContext<I18nValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => undefined,
  t: (key, vars) => translate(DEFAULT_LANGUAGE, key, vars),
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [language, setLang] = useState<LanguageCode>(() => readStored() || fromBrowser());

  // Signed in on a new device with no choice saved here: use the language saved on the account
  useEffect(() => {
    const saved = (user as { language?: string } | null)?.language;
    if (!readStored() && isLanguageCode(saved)) setLang(saved);
  }, [user]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(
    (code: LanguageCode) => {
      setLang(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        /* private mode: the choice lasts for this visit */
      }
      // Remember it on the account too, so alerts can later be sent in this language
      if (isAuthenticated) apiClient.put('/profile/language', { language: code }).catch(() => undefined);
    },
    [isAuthenticated],
  );

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: (key, vars) => translate(language, key, vars) }),
    [language, setLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
/** Shortcut: const t = useT(); t('nav.dashboard') */
export const useT = () => useContext(I18nContext).t;
export { LANGUAGES };
