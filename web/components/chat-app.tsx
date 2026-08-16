"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatPanel } from "./chat-panel";

type ThreadInfo = {
  id: string;
  sessionSlug?: string;
  sessionPath?: string;
};

type ThreadListResponse = {
  threads: ThreadInfo[];
};

export function ChatApp() {
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshThreads = useCallback(async () => {
    const response = await fetch("/api/threads");
    if (!response.ok) {
      throw new Error("Failed to load threads");
    }
    const data = (await response.json()) as ThreadListResponse;
    setThreads(data.threads);
    return data.threads;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const list = await refreshThreads();
        if (cancelled) {
          return;
        }
        if (list.length > 0) {
          setActiveThreadId(list[0]?.id ?? null);
        } else {
          const created = await createThreadRequest();
          if (!cancelled) {
            setActiveThreadId(created.id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to initialize chat");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [refreshThreads]);

  async function createThreadRequest(): Promise<ThreadInfo> {
    const response = await fetch("/api/threads", { method: "POST" });
    if (!response.ok) {
      throw new Error("Failed to create thread");
    }
    const thread = (await response.json()) as ThreadInfo;
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    return thread;
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Ładowanie…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h1 className="text-base font-semibold">Second Brain</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Każdy wątek zapisuje się w{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">docs/conversations/</code>.
            Pamięć wątku (MemorySaver) znika po restarcie serwera chatu.
          </p>
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={() => void createThreadRequest().catch((err) => setError(err.message))}
            className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Nowy wątek
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {threads.map((thread, index) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setActiveThreadId(thread.id)}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${
                thread.id === activeThreadId
                  ? "bg-white shadow-sm dark:bg-zinc-900"
                  : "text-zinc-600 hover:bg-white/70 dark:text-zinc-300 dark:hover:bg-zinc-900/70"
              }`}
            >
              Wątek {threads.length - index}
              {thread.sessionSlug ? (
                <span className="mt-1 block truncate font-mono text-[10px] text-zinc-400">
                  {thread.sessionSlug}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-black">
        {threads.map((thread) => (
          <ChatPanel
            key={thread.id}
            threadId={thread.id}
            sessionPath={thread.sessionPath}
            visible={thread.id === activeThreadId}
          />
        ))}
        {!activeThread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Wybierz wątek lub utwórz nowy.
          </div>
        ) : null}
      </main>
    </div>
  );
}
