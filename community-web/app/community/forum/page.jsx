'use client';

import ForumBoard from '../../../components/ForumBoard';
import { useLocale } from '../../../providers/LocaleProvider';

const T = {
  de: {
    title: 'Forum',
    intro: 'Diskutiere Strategien, teile Spielgeschichten und finde Mitspieler.'
  },
  en: {
    title: 'Forum',
    intro: 'Discuss strategies, share game stories and find fellow players.'
  }
};

export default function ForumPage() {
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="text-sm text-zinc-400">
        {t.intro}
      </p>
      <ForumBoard />
    </div>
  );
}
