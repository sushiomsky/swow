'use client';

import { useLocale } from '../providers/LocaleProvider';

export default function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex items-center gap-1 text-sm" role="group" aria-label="Sprache / Language">
      <button
        type="button"
        onClick={() => setLocale('de')}
        aria-pressed={locale === 'de'}
        className={locale === 'de' ? 'font-bold text-white' : 'text-zinc-400 hover:text-white'}
      >
        DE
      </button>
      <span className="text-zinc-600" aria-hidden="true">|</span>
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={locale === 'en' ? 'font-bold text-white' : 'text-zinc-400 hover:text-white'}
      >
        EN
      </button>
    </div>
  );
}
