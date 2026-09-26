'use client';

import { useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';

const T = {
  de: {
    types: [
      { value: 'bug', label: '🐛 Fehler melden', placeholder: 'Was ist schiefgelaufen? Schritte zum Nachstellen…' },
      { value: 'feature', label: '💡 Wunsch', placeholder: 'Was würdest du dir wünschen? Warum?' },
      { value: 'general', label: '💬 Allgemeines Feedback', placeholder: 'Gedanken, Ideen oder Vorschläge…' }
    ],
    loginFirst: 'Bitte melde dich an, um Feedback zu senden.',
    titleShort: 'Titel muss mindestens 5 Zeichen haben.',
    descShort: 'Beschreibung muss mindestens 10 Zeichen haben.',
    submitFail: 'Feedback konnte nicht gesendet werden.',
    done: '✅ Feedback gesendet!',
    thanks: 'Danke, dass du Wizard of Wor verbesserst.',
    viewIssue: (n) => `Issue #${n} auf GitHub ansehen →`,
    close: 'Schließen',
    sendTitle: 'Feedback senden',
    shortSummary: 'Kurze Zusammenfassung',
    submitting: 'Wird gesendet…',
    submit: 'Feedback senden',
    loginHint: 'Du musst angemeldet sein, um Feedback zu senden.'
  },
  en: {
    types: [
      { value: 'bug', label: '🐛 Bug Report', placeholder: 'What went wrong? Steps to reproduce…' },
      { value: 'feature', label: '💡 Feature Request', placeholder: 'What would you like to see? Why?' },
      { value: 'general', label: '💬 General Feedback', placeholder: 'Any thoughts, ideas, or suggestions…' }
    ],
    loginFirst: 'Please log in to submit feedback.',
    titleShort: 'Title must be at least 5 characters.',
    descShort: 'Description must be at least 10 characters.',
    submitFail: 'Failed to submit feedback.',
    done: '✅ Feedback Submitted!',
    thanks: 'Thank you for helping improve Wizard of Wor.',
    viewIssue: (n) => `View Issue #${n} on GitHub →`,
    close: 'Close',
    sendTitle: 'Send Feedback',
    shortSummary: 'Short summary',
    submitting: 'Submitting…',
    submit: 'Submit Feedback',
    loginHint: 'You need to be logged in to submit feedback.'
  }
};

export default function FeedbackModal({ open, onClose }) {
  const { api, isAuthenticated } = useCommunitySession();
  const { locale } = useLocale();
  const t = T[locale] || T.de;
  const [type, setType] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const reset = () => {
    setType('general');
    setTitle('');
    setDescription('');
    setResult(null);
    setError('');
    setBusy(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setError(t.loginFirst);
      return;
    }
    if (title.length < 5) { setError(t.titleShort); return; }
    if (description.length < 10) { setError(t.descShort); return; }

    setBusy(true);
    setError('');
    try {
      const res = await api.submitFeedback({
        type,
        title,
        description,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err?.details?.error || err?.message || t.submitFail);
    } finally {
      setBusy(false);
    }
  };

  const selectedType = t.types.find(x => x.value === type);

  return (
    <div className="feedback-backdrop" onClick={handleClose}>
      <div className="feedback-modal" onClick={e => e.stopPropagation()}>
        <button className="feedback-close" onClick={handleClose} aria-label={t.close}>✕</button>

        {result ? (
          <div className="feedback-success">
            <h3>{t.done}</h3>
            <p>{t.thanks}</p>
            {result.issue_url && (
              <a href={result.issue_url} target="_blank" rel="noopener noreferrer" className="feedback-issue-link">
                {t.viewIssue(result.issue_number)}
              </a>
            )}
            <button className="feedback-btn" onClick={handleClose}>{t.close}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3>{t.sendTitle}</h3>

            <div className="feedback-types">
              {t.types.map(x => (
                <button
                  key={x.value}
                  type="button"
                  className={`feedback-type-btn ${type === x.value ? 'active' : ''}`}
                  onClick={() => setType(x.value)}
                >
                  {x.label}
                </button>
              ))}
            </div>

            <input
              className="feedback-input"
              type="text"
              placeholder={t.shortSummary}
              aria-label={t.shortSummary}
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
              required
            />

            <textarea
              className="feedback-textarea"
              placeholder={selectedType?.placeholder || '…'}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              maxLength={5000}
              required
            />

            {error && <p className="feedback-error">{error}</p>}

            <button className="feedback-btn" type="submit" disabled={busy}>
              {busy ? t.submitting : t.submit}
            </button>

            {!isAuthenticated && (
              <p className="feedback-hint">{t.loginHint}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
