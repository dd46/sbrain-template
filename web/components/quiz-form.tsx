"use client";

import { useMemo, useState } from "react";
import { formatQuizSubmission, type QuizQuestion } from "@/lib/quiz";

type QuizFormProps = {
  questions: QuizQuestion[];
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void> | void;
};

export function QuizForm({ questions, disabled = false, onSubmit }: QuizFormProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const allFilled = useMemo(
    () => questions.every((q) => (answers[q.number] ?? "").trim().length > 0),
    [answers, questions],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!allFilled || disabled || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      const map = new Map<number, string>();
      for (const q of questions) {
        map.set(q.number, answers[q.number] ?? "");
      }
      await onSubmit(formatQuizSubmission(map));
      setAnswers({});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        Quiz
      </p>
      <div className="space-y-2">
        {questions.map((question) => (
          <label key={question.number} className="block text-sm">
            <span className="mb-1 block font-medium">
              {question.number}. {question.text}
            </span>
            <input
              type="text"
              value={answers[question.number] ?? ""}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [question.number]: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-zinc-950"
              disabled={disabled || submitting}
            />
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={!allFilled || disabled || submitting}
        className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-amber-600"
      >
        Wyślij odpowiedzi
      </button>
    </form>
  );
}
