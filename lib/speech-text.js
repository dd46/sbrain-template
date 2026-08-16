/** @typedef {{ number: number, text: string }} QuizQuestion */

export const SILENCE_MS = 1200;

const MIN_COMMIT_CHARS = 3;

function extractQuizQuestions(markdown) {
  const lines = markdown.split("\n");
  let quizStart = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (/^#{1,3}\s*quiz/i.test(line) || /^quiz\s*[—-]/i.test(line)) {
      quizStart = i + 1;
    }
  }

  const scanFrom = quizStart >= 0 ? quizStart : Math.max(0, lines.length - 12);
  /** @type {QuizQuestion[]} */
  const questions = [];

  for (let i = scanFrom; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (!line || line.startsWith("### Źródła") || line.startsWith("|")) {
      if (questions.length > 0 && line.startsWith("###")) {
        break;
      }
      continue;
    }
    const match = line.match(/^(\d+)\.\s+(.+)$/);
    if (!match) {
      if (questions.length > 0) {
        break;
      }
      continue;
    }
    const text = match[2]?.trim() ?? "";
    const inQuizSection = quizStart >= 0 && i >= quizStart;
    if (!inQuizSection && !text.endsWith("?")) {
      continue;
    }
    questions.push({ number: Number(match[1]), text });
  }

  if (questions.length === 0) {
    return [];
  }

  const seen = new Set();
  return questions.filter((q) => {
    if (seen.has(q.number)) {
      return false;
    }
    seen.add(q.number);
    return true;
  });
}

function stripQuizBlock(markdown) {
  const questions = extractQuizQuestions(markdown);
  if (questions.length === 0) {
    return markdown;
  }
  const firstLine = markdown
    .split("\n")
    .findIndex((line) => line.trim().match(/^(\d+)\.\s+.+\?$/));
  if (firstLine <= 0) {
    return markdown;
  }
  return markdown
    .split("\n")
    .slice(0, firstLine)
    .join("\n")
    .trimEnd();
}

function stripSourcesBlock(markdown) {
  const lines = markdown.split("\n");
  const idx = lines.findIndex((line) => line.trim().startsWith("### Źródła"));
  if (idx < 0) {
    return markdown;
  }
  return lines.slice(0, idx).join("\n").trimEnd();
}

function unwrapMarkdownForSpeech(text) {
  let out = text;
  out = out.replace(/\[\[([^\]]+)\]\]/g, (_m, path) => {
    const label = String(path).split("/").pop() ?? path;
    return label.replace(/_/g, " ");
  });
  out = out.replace(/\[(\d+)\]/g, "");
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/\*([^*]+)\*/g, "$1");
  out = out.replace(/^#{1,6}\s+/gm, "");
  out = out.replace(/^[-*]\s+/gm, "");
  out = out.replace(/^\d+\.\s+/gm, "");
  out = out.replace(/\|/g, " ");
  out = out.replace(/`([^`]+)`/g, "$1");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

export function stripForSpeech(markdown) {
  if (!markdown?.trim()) {
    return "";
  }
  let body = stripSourcesBlock(markdown);
  body = stripQuizBlock(body);
  return unwrapMarkdownForSpeech(body);
}

export function formatQuizQuestionsForSpeech(questions) {
  if (!questions.length) {
    return "";
  }
  const intro = questions.length === 1 ? "Quiz. " : `Quiz. ${questions.length} pytania. `;
  const parts = questions.map((q) => `Pytanie ${q.number}. ${q.text}`);
  return intro + parts.join(" ");
}

export function isCommittableTranscript(text) {
  const trimmed = String(text ?? "").trim();
  if (trimmed.length < MIN_COMMIT_CHARS) {
    return false;
  }
  const letters = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length >= MIN_COMMIT_CHARS;
}

/**
 * @param {string} transcript
 * @param {QuizQuestion[]} questions
 * @returns {Map<number, string> | null}
 */
export function parseSpokenQuizAnswers(transcript, questions) {
  if (!questions.length) {
    return null;
  }
  const trimmed = String(transcript ?? "").trim();
  if (!trimmed) {
    return null;
  }

  /** @type {Map<number, string>} */
  const answers = new Map();

  const numbered = [...trimmed.matchAll(/(?:^|\n|\s)(\d+)[.)]\s*([^]+?)(?=(?:\s\d+[.)]\s)|$)/g)];
  if (numbered.length > 0) {
    for (const match of numbered) {
      const num = Number(match[1]);
      const answer = match[2]?.trim() ?? "";
      if (questions.some((q) => q.number === num) && answer) {
        answers.set(num, answer);
      }
    }
  }

  if (answers.size === 0 && questions.length === 1) {
    answers.set(questions[0].number, trimmed);
  }

  if (answers.size === 0) {
    const parts = trimmed.split(/\s+(?=\d+[.)]\s*)/).filter(Boolean);
    if (parts.length >= questions.length) {
      for (let i = 0; i < questions.length; i += 1) {
        const part = parts[i]?.replace(/^\d+[.)]\s*/, "").trim() ?? "";
        if (part) {
          answers.set(questions[i].number, part);
        }
      }
    }
  }

  const allAnswered = questions.every((q) => {
    const a = answers.get(q.number);
    return a && a.trim().length >= MIN_COMMIT_CHARS;
  });

  return allAnswered ? answers : null;
}

export { extractQuizQuestions };
