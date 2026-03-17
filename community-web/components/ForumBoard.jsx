'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../lib/api';
import { useCommunitySession } from '../providers/CommunitySessionProvider';

export default function ForumBoard() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [threads, setThreads] = useState([]);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { api, isAuthenticated } = useCommunitySession();

  const threadQuery = useMemo(() => {
    return `/forum/threads?category=${encodeURIComponent(selectedCategory)}&page=${page}&limit=20`;
  }, [selectedCategory, page]);

  useEffect(() => {
    apiGet('/forum/categories')
      .then((rows) => {
        setCategories(Array.isArray(rows) ? rows : []);
        if (rows?.length && !rows.find((c) => c.slug === selectedCategory)) {
          setSelectedCategory(rows[0].slug);
        }
      })
      .catch(() => setCategories([]));
  }, [selectedCategory]);

  useEffect(() => {
    apiGet(threadQuery)
      .then((data) => setThreads(data.rows || []))
      .catch(() => setThreads([]));
  }, [threadQuery]);

  const createThread = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Title and message are required.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (!isAuthenticated) {
        setError('Sign in required to create a thread.');
        return;
      }
      await api.createForumThread({
        category_slug: selectedCategory,
        title: title.trim(),
        body: body.trim()
      });
      setTitle('');
      setBody('');
      const refreshed = await apiGet(threadQuery);
      setThreads(refreshed.rows || []);
    } catch (err) {
      setError(err.message || 'Failed to create thread.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Categories</h2>
        <div className="space-y-2">
          {categories.map((category) => (
            <button
              key={category.category_id}
              onClick={() => { setPage(1); setSelectedCategory(category.slug); }}
              className={`w-full rounded border px-3 py-2 text-left text-sm ${
                selectedCategory === category.slug
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-zinc-700 bg-zinc-950'
              }`}
            >
              <p className="font-semibold">{category.name}</p>
              <p className="mt-1 text-xs text-zinc-400">{category.description}</p>
              <p className="mt-1 text-xs text-zinc-500">{category.thread_count} threads</p>
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-4">
        <section className="card">
          <h2 className="text-lg font-semibold">New Thread</h2>
          <p className="mt-1 text-xs text-zinc-400">Sign in to create a thread.</p>
          <form onSubmit={createThread} className="mt-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Thread title"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-24 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="What do you want to discuss?"
            />
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <button disabled={busy} className="rounded bg-indigo-600 px-4 py-2 text-sm disabled:opacity-60">
              {busy ? 'Posting...' : 'Create Thread'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="mb-3 text-lg font-semibold">Threads</h2>
          <div className="space-y-3">
            {threads.map((thread) => (
              <article key={thread.thread_id} className="rounded border border-zinc-800 bg-zinc-950/70 p-3">
                <Link href={`/community/forum/${thread.thread_id}`} className="text-base font-semibold text-indigo-300">
                  {thread.pinned ? '📌 ' : ''}{thread.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-300">{thread.body}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  by {thread.author_name} • {thread.reply_count} replies
                </p>
              </article>
            ))}
            {!threads.length && <p className="text-sm text-zinc-500">No threads yet in this category.</p>}
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <button className="rounded border border-zinc-700 px-3 py-1" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <span>Page {page}</span>
            <button className="rounded border border-zinc-700 px-3 py-1" onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </section>
      </div>
    </div>
  );
}
