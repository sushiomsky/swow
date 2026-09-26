'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const LOCALES = ['de', 'en'];
export const DEFAULT_LOCALE = 'de';
const COOKIE_KEY = 'wow-locale';

function readLocale() {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.match(/(?:^|;\s*)wow-locale=(de|en)/);
  if (match) return match[1];
  const nav = typeof navigator !== 'undefined' ? (navigator.language || '').toLowerCase() : '';
  if (nav.startsWith('de')) return 'de';
  return 'en';
}

const LocaleContext = createContext({ locale: DEFAULT_LOCALE, setLocale: () => {} });

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const initial = readLocale();
    setLocaleState(initial);
    document.documentElement.lang = initial;
  }, []);

  const setLocale = useCallback((next) => {
    if (!LOCALES.includes(next)) return;
    setLocaleState(next);
    document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
