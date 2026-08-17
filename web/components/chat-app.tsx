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

export type ChatMode = "text" | "voice";
export type VoiceInputMode = "handsfree" | "ptt";

const VOICE_INPUT_MODE_KEY = "sbrain-voice-input-mode";

function readVoiceInputMode(): VoiceInputMode {
  if (typeof window === "undefined") {
    return "ptt";
  }
  const stored = window.localStorage.getItem(VOICE_INPUT_MODE_KEY);
  return stored === "handsfree" ? "handsfree" : "ptt";
}

export function ChatApp() {
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("text");
  const [voiceInputMode, setVoiceInputMode] = useState<VoiceInputMode>("ptt");
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
    setVoiceInputMode(readVoiceInputMode());
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
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">docs/conversations/</code>{" "}
            po pierwszej wiadomości. Pamięć wątku znika po restarcie serwera chatu.
          </p>
        </div>

        <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Tryb</p>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-200/70 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                mode === "text"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Czat
            </button>
            <button
              type="button"
              onClick={() => setMode("voice")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                mode === "voice"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Głos
            </button>
          </div>
          {mode === "voice" ? (
            <>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                Chrome + mikrofon. Bez słuchawek wybierz „Przytrzymaj i mów”, żeby głośnik nie
                przerywał odpowiedzi agenta.
              </p>
              <p className="mb-2 mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Wejście głosowe
              </p>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-200/70 p-1 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setVoiceInputMode("ptt");
                    window.localStorage.setItem(VOICE_INPUT_MODE_KEY, "ptt");
                  }}
                  className={`rounded-md px-2 py-2 text-xs font-medium ${
                    voiceInputMode === "ptt"
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Przytrzymaj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceInputMode("handsfree");
                    window.localStorage.setItem(VOICE_INPUT_MODE_KEY, "handsfree");
                  }}
                  className={`rounded-md px-2 py-2 text-xs font-medium ${
                    voiceInputMode === "handsfree"
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Wolne ręce
                </button>
              </div>
            </>
          ) : null}
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
            voiceMode={mode === "voice"}
            pushToTalk={mode === "voice" && voiceInputMode === "ptt"}
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
