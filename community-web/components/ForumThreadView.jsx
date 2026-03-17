'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '../lib/api';
import { useCommunitySession } from '../providers/CommunitySessionProvider';
import { toUserErrorMessage } from '../lib/errorUtils';
import ErrorText from './ErrorText';

export default function ForumThreadView({ threadId }) {
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
      setError('Reply cannot be empty.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (!isAuthenticated) {
        setError('Sign in required to post replies.');
        return;
      }
      await api.createForumPost(threadId, { body: reply.trim() });
      setReply('');
      await load();
    } catch (err) {
      setError(toUserErrorMessage(err, 'Failed to send reply.'));
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
        setModerationStatus(value ? 'Thread pinned.' : 'Thread unpinned.');
      } else if (operation === 'lock') {
        await api.moderateForumThreadLock(threadId, value);
        setModerationStatus(value ? 'Thread locked.' : 'Thread unlocked.');
      } else if (operation === 'delete') {
        await api.moderateForumThreadDelete(threadId, 'Moderated by staff');
        setModerationStatus('Thread deleted.');
        router.push('/community/forum');
        return;
      }
      await load();
    } catch (moderationError) {
      setError(toUserErrorMessage(moderationError, 'Moderation action failed.'));
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
      setModerationStatus('Post deleted.');
      await load();
    } catch (moderationError) {
      setError(toUserErrorMessage(moderationError, 'Unable to delete post.'));
    } finally {
      setModerationBusy(false);
    }
  };

  if (!thread) {
    return (
      <section className="card">
        <p className="text-sm text-zinc-400">Thread not found or unavailable.</p>
        <Link href="/community/forum" className="mt-3 inline-block text-sm text-indigo-300">← Back to forum</Link>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <Link href="/community/forum" className="text-sm text-indigo-300">← Back to forum</Link>
        <h1 className="mt-2 text-2xl font-bold">{thread.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-zinc-300">{thread.body}</p>
        <p className="mt-3 text-xs text-zinc-500">
          in {thread.category_name} • by {thread.author_name}
        </p>
        {canModerate && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              disabled={moderationBusy}
              className="rounded border border-zinc-600 px-2 py-1"
              onClick={() => moderateThread('pin', !thread.pinned)}
            >
              {thread.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              disabled={moderationBusy}
              className="rounded border border-zinc-600 px-2 py-1"
              onClick={() => moderateThread('lock', !thread.is_locked)}
            >
              {thread.is_locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              disabled={moderationBusy}
              className="rounded border border-rose-600 px-2 py-1 text-rose-300"
              onClick={() => {
                if (window.confirm('Delete this thread and all replies?')) {
                  moderateThread('delete');
                }
              }}
            >
              Delete thread
            </button>
          </div>
        )}
        {moderationStatus && <p className="mt-2 text-xs text-emerald-300">{moderationStatus}</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Replies</h2>
        {posts.map((post) => (
          <article key={post.post_id} className="rounded border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="whitespace-pre-wrap text-sm text-zinc-200">{post.body}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">by {post.author_name}</p>
              {canModerate && (
                <button
                  disabled={moderationBusy}
                  className="rounded border border-rose-600 px-2 py-1 text-xs text-rose-300"
                  onClick={() => deletePost(post.post_id)}
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
        {!posts.length && <p className="text-sm text-zinc-500">No replies yet.</p>}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Add Reply</h2>
        <form onSubmit={submitReply} className="mt-3 space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="min-h-24 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Write your reply..."
            disabled={thread.is_locked}
          />
          {thread.is_locked && <p className="text-sm text-amber-300">This thread is locked by moderators.</p>}
          <ErrorText message={error} />
          <button disabled={busy || thread.is_locked} className="rounded bg-indigo-600 px-4 py-2 text-sm disabled:opacity-60">
            {busy ? 'Sending...' : 'Post Reply'}
          </button>
        </form>
      </section>
    </div>
  );
}
