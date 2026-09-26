'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '../lib/api';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { useLocale } from '../providers/LocaleProvider';
import { toUserErrorMessage } from '../lib/errorUtils';
import ErrorText from './ErrorText';

const STRINGS = {
  de: {
    notFound: 'Thema nicht gefunden oder nicht verfügbar.',
    backToForum: '← Zurück zum Forum',
    in: 'in',
    by: 'von',
    pin: 'Anheften',
    unpin: 'Lösen',
    lock: 'Sperren',
    unlock: 'Entsperren',
    deleteThread: 'Thema löschen',
    confirmDeleteThread: 'Dieses Thema und alle Antworten löschen?',
    replies: 'Antworten',
    noReplies: 'Noch keine Antworten.',
    delete: 'Löschen',
    writeReply: 'Schreibe deine Antwort…',
    replyLabel: 'Antwort schreiben',
    lockedNote: 'Dieses Thema wurde von Moderatoren gesperrt.',
    sending: 'Wird gesendet…',
    sendReply: 'Antwort senden',
    replyEmpty: 'Antwort darf nicht leer sein.',
    signInToReply: 'Melde dich an, um zu antworten.',
    replyFailed: 'Antwort konnte nicht gesendet werden.',
    pinned: 'Thema angeheftet.',
    unpinned: 'Thema gelöst.',
    locked: 'Thema gesperrt.',
    unlocked: 'Thema entsperrt.',
    threadDeleted: 'Thema gelöscht.',
    moderationFailed: 'Moderation fehlgeschlagen.',
    postDeleted: 'Beitrag gelöscht.',
    postDeleteFailed: 'Beitrag konnte nicht gelöscht werden.'
  },
  en: {
    notFound: 'Thread not found or unavailable.',
    backToForum: '← Back to forum',
    in: 'in',
    by: 'by',
    pin: 'Pin',
    unpin: 'Unpin',
    lock: 'Lock',
    unlock: 'Unlock',
    deleteThread: 'Delete thread',
    confirmDeleteThread: 'Delete this thread and all replies?',
    replies: 'Replies',
    noReplies: 'No replies yet.',
    delete: 'Delete',
    writeReply: 'Write your reply…',
    replyLabel: 'Write reply',
    lockedNote: 'This thread was locked by moderators.',
    sending: 'Sending…',
    sendReply: 'Send reply',
    replyEmpty: 'Reply must not be empty.',
    signInToReply: 'Sign in to reply.',
    replyFailed: 'Could not send reply.',
    pinned: 'Thread pinned.',
    unpinned: 'Thread unpinned.',
    locked: 'Thread locked.',
    unlocked: 'Thread unlocked.',
    threadDeleted: 'Thread deleted.',
    moderationFailed: 'Moderation failed.',
    postDeleted: 'Post deleted.',
    postDeleteFailed: 'Could not delete post.'
  }
};

export default function ForumThreadView({ threadId }) {
  const { locale } = useLocale();
  const t = STRINGS[locale] || STRINGS.de;
  const router = useRouter();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [moderationStatus, setModerationStatus] = useState('');
  const [moderationBusy, setModerationBusy] = useState(false);
  const { api, isAuthenticated, user } = useCommunitySession();
  const canModerate = user?.role === 'admin' || user?.role === 'moderator';

  const load = async () => {
    const data = await apiGet(`/forum/threads/${threadId}`);
    setThread(data.thread || null);
    setPosts(data.posts || []);
  };

  useEffect(() => {
    load().catch(() => {
      setThread(null);
      setPosts([]);
    });
  }, [threadId]);

  const submitReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) {
      setError(t.replyEmpty);
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (!isAuthenticated) {
        setError(t.signInToReply);
        return;
      }
      await api.createForumPost(threadId, { body: reply.trim() });
      setReply('');
      await load();
    } catch (err) {
      setError(toUserErrorMessage(err, t.replyFailed));
    } finally {
      setBusy(false);
    }
  };

  const moderateThread = async (operation, value = null) => {
    if (!canModerate) return;
    setError('');
    setModerationStatus('');
    setModerationBusy(true);
    try {
      if (operation === 'pin') {
        await api.moderateForumThreadPin(threadId, value);
        setModerationStatus(value ? t.pinned : t.unpinned);
      } else if (operation === 'lock') {
        await api.moderateForumThreadLock(threadId, value);
        setModerationStatus(value ? t.locked : t.unlocked);
      } else if (operation === 'delete') {
        await api.moderateForumThreadDelete(threadId, 'Moderated by staff');
        setModerationStatus(t.threadDeleted);
        router.push('/community/forum');
        return;
      }
      await load();
    } catch (moderationError) {
      setError(toUserErrorMessage(moderationError, t.moderationFailed));
    } finally {
      setModerationBusy(false);
    }
  };

  const deletePost = async (postId) => {
    if (!canModerate) return;
    setError('');
    setModerationStatus('');
    setModerationBusy(true);
    try {
      await api.moderateForumPostDelete(threadId, postId, 'Moderated by staff');
      setModerationStatus(t.postDeleted);
      await load();
    } catch (moderationError) {
      setError(toUserErrorMessage(moderationError, t.postDeleteFailed));
    } finally {
      setModerationBusy(false);
    }
  };

  if (!thread) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-400">{t.notFound}</p>
        <Link href="/community/forum" className="mt-3 inline-block text-sm text-indigo-300">{t.backToForum}</Link>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <Link href="/community/forum" className="text-sm text-indigo-300">{t.backToForum}</Link>
        <h1 className="mt-2 text-2xl font-bold">{thread.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-zinc-300">{thread.body}</p>
        <p className="mt-3 text-xs text-zinc-500">
          {t.in} {thread.category_name} • {t.by} {thread.author_name}
        </p>
        {canModerate && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              disabled={moderationBusy}
              className="rounded border border-zinc-600 px-2 py-1"
              onClick={() => moderateThread('pin', !thread.pinned)}
            >
              {thread.pinned ? t.unpin : t.pin}
            </button>
            <button
              disabled={moderationBusy}
              className="rounded border border-zinc-600 px-2 py-1"
              onClick={() => moderateThread('lock', !thread.is_locked)}
            >
              {thread.is_locked ? t.unlock : t.lock}
            </button>
            <button
              disabled={moderationBusy}
              className="rounded border border-rose-600 px-2 py-1 text-rose-300"
              onClick={() => {
                if (window.confirm(t.confirmDeleteThread)) {
                  moderateThread('delete');
                }
              }}
            >
              {t.deleteThread}
            </button>
          </div>
        )}
        {moderationStatus && <p className="mt-2 text-xs text-emerald-300">{moderationStatus}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{t.replies}</h2>
        {posts.map((post) => (
          <article key={post.post_id} className="rounded border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="whitespace-pre-wrap text-sm text-zinc-200">{post.body}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">{t.by} {post.author_name}</p>
              {canModerate && (
                <button
                  disabled={moderationBusy}
                  className="rounded border border-rose-600 px-2 py-1 text-xs text-rose-300"
                  onClick={() => deletePost(post.post_id)}
                >
                  {t.delete}
                </button>
              )}
            </div>
          </article>
        ))}
        {!posts.length && <p className="text-sm text-zinc-500">{t.noReplies}</p>}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">{t.replies}</h2>
        <form onSubmit={submitReply} className="mt-3 space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="min-h-24 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder={t.writeReply}
            aria-label={t.replyLabel}
            disabled={thread.is_locked}
          />
          {thread.is_locked && <p className="text-sm text-amber-300">{t.lockedNote}</p>}
          <ErrorText message={error} />
          <button disabled={busy || thread.is_locked} className="rounded bg-indigo-600 px-4 py-2 text-sm disabled:opacity-60">
            {busy ? t.sending : t.sendReply}
          </button>
        </form>
      </section>
    </div>
  );
}
