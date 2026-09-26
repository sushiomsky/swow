'use client';

import { useState } from 'react';
import FeedbackModal from './FeedbackModal';
import { useLocale } from '../providers/LocaleProvider';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const label = locale === 'en' ? 'Send feedback' : 'Feedback senden';

  return (
    <>
      <button
        className="feedback-fab"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
      >
        💬
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
