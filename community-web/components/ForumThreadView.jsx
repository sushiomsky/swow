'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet, apiSend } from '../lib/api';

function userHeaders() {
  if (typeof window === 'undefined') return {};
  const userId = localStorage.getItem('communityUserId');
  return userId ? { 'x-user-id': userId } : {};
}

export default function ForumThreadView({ threadId }) {
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      const token = localStorage.getItem('communityToken');
      await apiSend(`/forum/threads/${threadId}/posts`, 'POST', { body: reply.trim() }, token, userHeaders());
      setReply('');
      await load();
    } catch (err) {
      setError(err.message || 'Failed to send reply.');
    } finally {
      setBusy(false);
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
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Replies</h2>
        {posts.map((post) => (
          <article key={post.post_id} className="rounded border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="whitespace-pre-wrap text-sm text-zinc-200">{post.body}</p>
            <p className="mt-2 text-xs text-zinc-500">by {post.author_name}</p>
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
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button disabled={busy || thread.is_locked} className="rounded bg-indigo-600 px-4 py-2 text-sm disabled:opacity-60">
            {busy ? 'Sending...' : 'Post Reply'}
          </button>
        </form>
      </section>
    </div>
  );
}
