export type QuizQuestion = {
  number: number;
  text: string;
};

/** Extract numbered quiz questions from the tail of an assistant message. */
export function extractQuizQuestions(markdown: string): QuizQuestion[] {
  const lines = markdown.split("\n");
  let quizStart = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (/^#{1,3}\s*quiz/i.test(line) || /^quiz\s*[—-]/i.test(line)) {
      quizStart = i + 1;
    }
  }

  const scanFrom = quizStart >= 0 ? quizStart : Math.max(0, lines.length - 12);
  const questions: QuizQuestion[] = [];

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

  const seen = new Set<number>();
  return questions.filter((q) => {
    if (seen.has(q.number)) {
      return false;
    }
    seen.add(q.number);
    return true;
  });
}

export function formatQuizSubmission(answers: Map<number, string>): string {
  const lines = ["Odpowiedzi quizu:", ""];
  for (const [number, answer] of [...answers.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`${number}. ${answer.trim()}`);
  }
  return lines.join("\n");
}

export function stripQuizBlock(markdown: string): string {
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
