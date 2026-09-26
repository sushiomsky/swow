'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LOCALE_KEY = 'communityLocale';
const SUPPORTED = ['de', 'en'];

const LocaleContext = createContext({ locale: 'de', setLocale: () => {} });

function readInitialLocale() {
  if (typeof window === 'undefined') return 'de';
  try {
    // 1. Explizite Wahl des Users gewinnt immer.
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (SUPPORTED.includes(stored)) return stored;
  } catch {
    // ignore storage errors
  }
  // 2. Sonst Browser-Sprache auto-erkennen: alles außer Deutsch → Englisch.
  try {
    const nav = (window.navigator.language || window.navigator.languages?.[0] || '').toLowerCase();
    if (nav.startsWith('de')) return 'de';
    return 'en';
  } catch {
    return 'de';
  }
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('de');

  useEffect(() => {
    setLocaleState(readInitialLocale());
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch {
      // ignore
    }
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (!SUPPORTED.includes(next)) return;
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
