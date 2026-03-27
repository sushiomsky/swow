'use client';

import { useState } from 'react';
import { useCommunitySession } from '../providers/CommunitySessionProvider';

const TYPES = [
  { value: 'bug', label: '🐛 Bug Report', placeholder: 'What went wrong? Steps to reproduce…' },
  { value: 'feature', label: '💡 Feature Request', placeholder: 'What would you like to see? Why?' },
  { value: 'general', label: '💬 General Feedback', placeholder: 'Any thoughts, ideas, or suggestions…' },
];

export default function FeedbackModal({ open, onClose }) {
  const { api, isAuthenticated } = useCommunitySession();
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
      setError('Please log in to submit feedback.');
      return;
    }
    if (title.length < 5) { setError('Title must be at least 5 characters.'); return; }
    if (description.length < 10) { setError('Description must be at least 10 characters.'); return; }

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
      setError(err?.details?.error || err?.message || 'Failed to submit feedback.');
    } finally {
      setBusy(false);
    }
  };

  const selectedType = TYPES.find(t => t.value === type);

  return (
    <div className="feedback-backdrop" onClick={handleClose}>
      <div className="feedback-modal" onClick={e => e.stopPropagation()}>
        <button className="feedback-close" onClick={handleClose} aria-label="Close">✕</button>

        {result ? (
          <div className="feedback-success">
            <h3>✅ Feedback Submitted!</h3>
            <p>Thank you for helping improve Wizard of Wor.</p>
            {result.issue_url && (
              <a href={result.issue_url} target="_blank" rel="noopener noreferrer" className="feedback-issue-link">
                View Issue #{result.issue_number} on GitHub →
              </a>
            )}
            <button className="feedback-btn" onClick={handleClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3>Send Feedback</h3>

            <div className="feedback-types">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  className={`feedback-type-btn ${type === t.value ? 'active' : ''}`}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <input
              className="feedback-input"
              type="text"
              placeholder="Short summary"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
              required
            />

            <textarea
              className="feedback-textarea"
              placeholder={selectedType?.placeholder || 'Describe…'}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              maxLength={5000}
              required
            />

            {error && <p className="feedback-error">{error}</p>}

            <button className="feedback-btn" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit Feedback'}
            </button>

            {!isAuthenticated && (
              <p className="feedback-hint">You need to be logged in to submit feedback.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
