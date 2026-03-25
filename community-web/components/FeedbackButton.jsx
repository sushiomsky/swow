'use client';

import { useState } from 'react';
import FeedbackModal from './FeedbackModal';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="feedback-fab"
        onClick={() => setOpen(true)}
        title="Send Feedback"
        aria-label="Send feedback"
      >
        💬
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
