"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatQuizQuestionsForSpeech,
  parseSpokenQuizAnswers,
  stripForSpeech,
} from "../../lib/speech-text.js";
import { MarkdownMessage } from "./markdown-message";
import { QuizForm } from "./quiz-form";
import { extractQuizQuestions, formatQuizSubmission, stripQuizBlock } from "@/lib/quiz";
import { preloadVoices, speak, cancelSpeak } from "@/lib/speak";
import { useVoiceSession } from "@/lib/use-voice-session";

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

type ChatPanelProps = {
  threadId: string;
  sessionPath?: string;
  visible: boolean;
  voiceMode: boolean;
};

export function ChatPanel({ threadId, sessionPath, visible, voiceMode }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [awaitingQuizAnswers, setAwaitingQuizAnswers] = useState(false);
  const [ttsRunning, setTtsRunning] = useState(false);
  const spokenMessageIdRef = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { thread_id: threadId },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    transport,
  });

  const isBusy = status === "streaming" || status === "submitted";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistant ? messageText(lastAssistant) : "";
  const activeQuiz = useMemo(
    () => extractQuizQuestions(lastAssistantText),
    [lastAssistantText],
  );
  const showQuizForm =
    !voiceMode &&
    activeQuiz.length > 0 &&
    lastAssistant?.id === messages.at(-1)?.id &&
    !isBusy;

  const handleCommit = useCallback(
    async (text: string) => {
      if (awaitingQuizAnswers && activeQuiz.length > 0) {
        const answers = parseSpokenQuizAnswers(text, activeQuiz);
        if (!answers) {
          if (voiceMode) {
            await speak("Powtórz odpowiedzi z numerami, na przykład jeden kropka tak, dwa kropka nie.");
          }
          return;
        }
        setAwaitingQuizAnswers(false);
        await sendMessage({ text: formatQuizSubmission(answers) });
        return;
      }
      await sendMessage({ text });
    },
    [activeQuiz, awaitingQuizAnswers, sendMessage, voiceMode],
  );

  const voice = useVoiceSession({
    enabled: voiceMode && visible,
    blockCommits: isBusy || ttsRunning,
    onCommit: handleCommit,
    onBargeIn: () => {
      cancelTtsAndStream();
    },
  });

  function cancelTtsAndStream() {
    cancelSpeak();
    setTtsRunning(false);
    if (isBusy) {
      stop();
    }
    setAwaitingQuizAnswers(false);
  }

  useEffect(() => {
    preloadVoices();
  }, []);

  useEffect(() => {
    if (!voiceMode) {
      spokenMessageIdRef.current = null;
      setAwaitingQuizAnswers(false);
      setTtsRunning(false);
    }
  }, [voiceMode]);

  useEffect(() => {
    if (!voiceMode || isBusy || !lastAssistant?.id) {
      return;
    }
    if (spokenMessageIdRef.current === lastAssistant.id) {
      return;
    }
    if (lastAssistant.id !== messages.at(-1)?.id) {
      return;
    }

    spokenMessageIdRef.current = lastAssistant.id;
    const body = stripForSpeech(lastAssistantText);
    const quizSpeech = voiceMode && activeQuiz.length > 0
      ? formatQuizQuestionsForSpeech(activeQuiz)
      : "";

    void (async () => {
      setTtsRunning(true);
      voice.setSpeakingPhase(true);
      if (body) {
        await speak(body);
      }
      if (quizSpeech && voiceMode) {
        setAwaitingQuizAnswers(true);
        await speak(quizSpeech);
      }
      setTtsRunning(false);
      voice.setSpeakingPhase(false);
    })();
  }, [voiceMode, isBusy, lastAssistant, lastAssistantText, activeQuiz, messages]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) {
      return;
    }
    setInput("");
    await sendMessage({ text });
  }

  const statusLabel = voiceMode
    ? voice.phase === "speaking"
      ? "Mówię…"
      : voice.phase === "blocked"
        ? "Agent odpowiada…"
        : awaitingQuizAnswers
          ? "Słucham odpowiedzi quizu…"
          : voice.listening
            ? "Słucham…"
            : "Głos"
    : null;

  return (
    <div className={visible ? "flex h-full min-h-0 flex-1 flex-col" : "hidden"}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {sessionPath ? (
          <p className="text-xs text-zinc-500">
            Sesja: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">docs/{sessionPath}/</code>
          </p>
        ) : null}
        {voiceMode ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              Tryb głosowy {statusLabel ? `— ${statusLabel}` : ""}
            </p>
            {voice.transcriptDraft ? (
              <p className="mt-1 text-emerald-800/80 dark:text-emerald-300/80">
                {voice.transcriptDraft}
              </p>
            ) : (
              <p className="mt-1 text-xs text-emerald-800/70 dark:text-emerald-300/70">
                Mów naturalnie. Po ~1,2 s ciszy wiadomość wyśle się sama. Przerwij agenta, mówiąc
                ponownie.
              </p>
            )}
            {voice.error ? (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{voice.error}</p>
            ) : null}
          </div>
        ) : null}
        {messages.length === 0 && !voiceMode ? (
          <p className="text-sm text-zinc-500">
            Ucz się z bazy wiedzy. Odpowiedzi agenta mają referencje [1] i tabelę Źródeł; na końcu
            pojawi się quiz.
          </p>
        ) : null}
        {messages.map((message) => {
          const text = messageText(message);
          const isAssistant = message.role === "assistant";
          const body =
            isAssistant && (showQuizForm || (voiceMode && awaitingQuizAnswers)) && message.id === lastAssistant?.id
              ? stripQuizBlock(text)
              : text;

          return (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                }`}
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                ) : (
                  <MarkdownMessage content={body} />
                )}
              </div>
            </div>
          );
        })}
        {showQuizForm ? (
          <QuizForm
            questions={activeQuiz}
            disabled={isBusy}
            onSubmit={async (quizMessage) => {
              await sendMessage({ text: quizMessage });
            }}
          />
        ) : null}
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
        ) : null}
      </div>

      {!voiceMode ? (
        <form
          onSubmit={handleSubmit}
          className="border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Wiadomość…"
              rows={2}
              className="min-h-[52px] flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit(event);
                }
              }}
            />
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={!input.trim() || isBusy}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Wyślij
              </button>
              {status === "streaming" ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                >
                  Stop
                </button>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
