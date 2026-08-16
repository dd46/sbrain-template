import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractQuizQuestions,
  formatQuizQuestionsForSpeech,
  isCommittableTranscript,
  parseSpokenQuizAnswers,
  stripForSpeech,
} from "../lib/speech-text.js";

const FIXTURE = `Fronty to granice mas powietrza [1].

### Źródła

| # | Typ | Pewność | Źródło |
|---|-----|---------|--------|
| [1] | KB | High | [[sailing/basics/wind]] |

## Quiz — fronty

1. Co to jest front?
2. Który front jest bardziej niebezpieczny?
`;

test("stripForSpeech removes Źródła table and quiz", () => {
  const spoken = stripForSpeech(FIXTURE);
  assert.match(spoken, /Fronty to granice mas powietrza/);
  assert.doesNotMatch(spoken, /\|/);
  assert.doesNotMatch(spoken, /Źródła/i);
  assert.doesNotMatch(spoken, /Co to jest front/);
});

test("stripForSpeech unwraps wiki-links to readable labels", () => {
  const spoken = stripForSpeech("Zobacz [[sailing/basics/wind]] i [2].");
  assert.match(spoken, /wind/i);
  assert.doesNotMatch(spoken, /\[\[/);
});

test("isCommittableTranscript rejects empty and filler", () => {
  assert.equal(isCommittableTranscript(""), false);
  assert.equal(isCommittableTranscript("um"), false);
  assert.equal(isCommittableTranscript("..."), false);
  assert.equal(isCommittableTranscript("meterologia na patent"), true);
});

test("parseSpokenQuizAnswers builds formatQuizSubmission shape", () => {
  const questions = extractQuizQuestions(FIXTURE);
  assert.equal(questions.length, 2);

  const answers = parseSpokenQuizAnswers(
    "1. granica mas powietrza 2. front zimny",
    questions,
  );
  assert.ok(answers);
  assert.equal(answers.get(1), "granica mas powietrza");
  assert.equal(answers.get(2), "front zimny");
});

test("parseSpokenQuizAnswers accepts single answer for one question", () => {
  const questions = [{ number: 1, text: "Co to jest front?" }];
  const answers = parseSpokenQuizAnswers("granica dwóch mas powietrza", questions);
  assert.ok(answers);
  assert.equal(answers.get(1), "granica dwóch mas powietrza");
});

test("formatQuizQuestionsForSpeech lists questions", () => {
  const questions = extractQuizQuestions(FIXTURE);
  const spoken = formatQuizQuestionsForSpeech(questions);
  assert.match(spoken, /Pytanie 1/);
  assert.match(spoken, /Pytanie 2/);
});
