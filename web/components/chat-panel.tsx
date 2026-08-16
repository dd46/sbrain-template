"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useState } from "react";
import { MarkdownMessage } from "./markdown-message";
import { QuizForm } from "./quiz-form";
import { extractQuizQuestions, stripQuizBlock } from "@/lib/quiz";

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
};

export function ChatPanel({ threadId, sessionPath, visible }: ChatPanelProps) {
  const [input, setInput] = useState("");

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
  const showQuiz =
    activeQuiz.length > 0 &&
    lastAssistant?.id === messages.at(-1)?.id &&
    !isBusy;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isBusy) {
      return;
    }
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className={visible ? "flex h-full min-h-0 flex-1 flex-col" : "hidden"}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {sessionPath ? (
          <p className="text-xs text-zinc-500">
            Sesja: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">docs/{sessionPath}/</code>
          </p>
        ) : null}
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Ucz się z bazy wiedzy. Odpowiedzi agenta mają referencje [1] i tabelę Źródeł; na końcu
            pojawi się quiz.
          </p>
        ) : null}
        {messages.map((message) => {
          const text = messageText(message);
          const isAssistant = message.role === "assistant";
          const body = isAssistant && showQuiz && message.id === lastAssistant?.id
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
        {showQuiz ? (
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
    </div>
  );
}
