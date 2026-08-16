# Hands-free voice chat Implementation Plan

## Overview

Add a **Głos** mode next to the existing text chat. After a one-time mic permission, the app listens continuously, detects end-of-speech by silence (~1.2 s), sends the transcript through the current LangGraph path, and speaks the assistant reply. No press-to-talk. Chrome + system TTS. Backend stays text-only.

## Current State Analysis

The browser UI is text chat over LangGraph (`useChat` → `POST /api/chat` with `thread_id`). There is no microphone, SpeechRecognition, or speechSynthesis usage.

- Send path is `sendMessage({ text })` in `web/components/chat-panel.tsx`. The API extracts the last user text part (`web/app/api/chat/route.ts`) and streams the graph. Voice can reuse this unchanged.
- Sessions on disk still start on the first user message (`lib/thread-registry.js` `ensureSessionForThread`). A spoken first utterance is a user message — same contract.
- Assistant replies are markdown with `[n]` citations, a `### Źródła` table, and often a numbered quiz plus `QuizForm` (`web/lib/quiz.ts`, `web/components/quiz-form.tsx`). Speaking that raw would be unusable; the form cannot be filled without a pointer.
- `langgraph-chat` left auth, Playwright, and deploy out of scope. This change stays on localhost Chrome, no e2e browser suite.
- Local LLM is Ollama via OpenAI-compatible env. Voice does **not** add Whisper or cloud TTS.

## Desired End State

Sidebar has **Czat | Głos**. In Głos, after the OS mic prompt, the user talks without clicking. Silence of ~1.2 s commits a transcript as a chat turn. The agent reply streams as markdown (as today) and is also spoken (learning body only). Speaking during TTS/generation stops playback (and the in-flight stream) and starts a new listen/commit cycle. Quiz questions are spoken and answered by voice. `npm test` covers the pure text helpers. Chrome on localhost is the supported browser.

### Key Discoveries:

- STT/TTS stay in the client; `lib/chat-agent.js` does not gain audio tools (`web/components/chat-panel.tsx` send path).
- `webkitSpeechRecognition` fires `onend` after pauses — the listen loop must restart unless the session left voice mode or is committing.
- TTS into an open mic will echo; barge-in needs echoCancellation plus a “speaking” gate so agent audio is not sent as a user turn.
- Quiz submit contract is already text: `formatQuizSubmission` in `web/lib/quiz.ts` — voice must produce that string, not a new API.

## What We're NOT Doing

- Cloud STT/TTS, Ollama Whisper, or Xenova audio models.
- Push-to-talk, hold-to-talk, or a per-utterance record button.
- Firefox/Safari as a supported STT target (document Chrome).
- Changing LangGraph, Neo4j tools, or `/api/chat` to accept audio blobs.
- Playwright / browser e2e.
- Auth, non-localhost bind, wake-word (“hey sbrain”).
- Auto-entering voice mode on page load (toggle is required so mic is intentional).

## Implementation Approach

Keep the agent text-only. Add client helpers for “what to speak” and “what counts as a finished utterance,” a voice-session hook that owns recognition + synthesis + silence timer, and a sidebar mode flag that ChatPanel already uses for send/quiz. Persist and threads stay as they are.

## Critical Implementation Details

**Echo vs barge-in.** While `speechSynthesis` is speaking, do not commit recognition results (agent voice must not become a user message). Still watch for a user barge-in: if recognition sees a non-empty transcript that is clearly not echo (short energy spike after `echoCancellation`, or a transcript after the user started talking over TTS), call `speechSynthesis.cancel()`, `stop()` on `useChat` if streaming, then keep listening until the 1.2 s silence window and send. Headphones make this easier; document that speaker+mic is best-effort.

**Recognition lifecycle.** `webkitSpeechRecognition` with `continuous: true`, `interimResults: true`, `lang: "pl-PL"`. On `onend`, if voice mode is still on and not torn down, `start()` again. Reset the silence timer on interim/final results; on timer fire, take the best transcript, ignore if too short, then `sendMessage({ text })`.

**Busy state.** Do not start a second send while `status` is `submitted`/`streaming` unless this turn is a barge-in (then `stop()` first). After send, pause commit until the assistant finishes streaming, then TTS, then listen again.

---

## Phase 1: Speech text helpers + unit tests

### Overview

Pure functions for TTS stripping, utterance commit rules, and spoken quiz answer parsing — no browser APIs yet. Covered by `node --test`.

### Changes Required:

#### 1. Shared speech-text module

**File**: `lib/speech-text.js` (new)

**Intent**: One module both the Next client (via existing `externalDir`) and root tests can import, so TTS/quiz/commit rules are not duplicated in React.

**Contract**: Export at least: `stripForSpeech(markdown)` (drop `### Źródła` and below, drop quiz block using the same detection idea as `extractQuizQuestions` / `stripQuizBlock`, unwrap markdown to speakable Polish prose); `isCommittableTranscript(text)` (reject empty / too short / punctuation-only); `parseSpokenQuizAnswers(transcript, questions)` (map spoken “1. … 2. …” or a single answer when one question is pending) into a `Map` compatible with `formatQuizSubmission`. Silence duration constant `SILENCE_MS = 1200` exported for the hook.

#### 2. Tests

**File**: `tests/speech-text.test.js` (new); `package.json` `test` script

**Intent**: Lock strip/commit/quiz-parse without Chrome or a mic.

**Contract**: Cases: Źródła table not spoken; quiz questions stripped from TTS body; wiki-links become readable labels; short “um” / empty not committable; numbered spoken answers fill `formatQuizSubmission` shape. `npm test` lists this file.

### Success Criteria:

#### Automated Verification:

- `npm test` passes including `tests/speech-text.test.js`.
- `stripForSpeech` on a fixture with body + Źródła + quiz returns only the learning body, no pipe tables.

#### Manual Verification:

- None (no UI in this phase).

---

## Phase 2: Hands-free listen loop → existing chat send

### Overview

In voice mode, obtain mic once, run Web Speech continuously, commit on ~1.2 s silence via `sendMessage({ text })`. Text composer can hide or stay read-only; no record button.

### Changes Required:

#### 1. Voice session hook

**File**: `web/lib/use-voice-session.ts` (new) or `web/hooks/use-voice-session.ts`

**Intent**: Own `getUserMedia` (echoCancellation), `webkitSpeechRecognition`, silence timer, and restart-on-end. Expose `{ start, stop, listening, transcriptDraft, error, permission }`.

**Contract**: `start()` is called when the user switches to Głos (one permission prompt). No API to “begin utterance.” `onCommit(text)` fires after `SILENCE_MS` with a committable transcript. Unsupported browser → clear error string (Chrome required). Tear down on unmount / leaving Głos (`recognition.stop()`, tracks stopped).

#### 2. Wire to ChatPanel

**File**: `web/components/chat-panel.tsx`

**Intent**: When `voiceMode` is true, `onCommit` calls the same `sendMessage({ text })` as the form; do not send while busy unless Phase 3 barge-in later calls `stop()`.

**Contract**: New optional prop `voiceMode: boolean`. Existing textarea submit remains for Czat. Voice mode does not require clicking Send. Empty commits never hit `/api/chat`.

### Success Criteria:

#### Automated Verification:

- `web` TypeScript/build still succeeds: `npm run build` in `web/`.
- Chat route remains POST-only text; no new audio endpoint.

#### Manual Verification:

- Chrome on `http://127.0.0.1:3000`: enter Głos, grant mic once, speak a sentence, wait ~1.2 s without clicking — a user bubble appears and the agent runs.
- Switching back to Czat stops listening (browser mic indicator off).
- Very short noise does not create a turn.

---

## Phase 3: TTS + barge-in

### Overview

After a streamed assistant message completes, speak `stripForSpeech(text)`. If the user talks over TTS (or over an in-flight stream), cancel speech, `stop()` the chat stream if needed, and resume the listen/commit cycle.

### Changes Required:

#### 1. Speak helper

**File**: `web/lib/speak.ts` (new) and the voice session hook

**Intent**: Wrap `speechSynthesis` with `pl-PL` (or first Polish `SpeechSynthesisVoice`), cancelable utterance, `onend` to resume listening.

**Contract**: `speak(text)` returns a promise that resolves on end or cancel. `cancelSpeak()` is idempotent. Empty `stripForSpeech` result → skip TTS.

#### 2. Barge-in in the hook + ChatPanel

**File**: `web/lib/use-voice-session.ts`, `web/components/chat-panel.tsx`

**Intent**: While TTS or `useChat` streaming, user speech interrupts instead of waiting. Agent echo must not commit.

**Contract**: During TTS, recognition results are not committed as messages until barge-in is detected; then `cancelSpeak()`, `stop()` if `status` is streaming/submitted, then the silence timer applies to the *user* transcript only. After assistant `status === "ready"`, run TTS once per assistant message id (no double-speak on re-render).

### Success Criteria:

#### Automated Verification:

- `npm test` still passes (helpers unchanged or extended if barge-in needs a small pure predicate).
- `npm run build` in `web/` succeeds.

#### Manual Verification:

- Agent reply is heard in Polish (system voice); Źródła table is not read aloud.
- Talking over TTS stops audio and, after silence, sends a new user message.
- Headphones or echoCancellation: agent voice does not appear as a user transcript.

---

## Phase 4: Mode toggle, spoken quiz, README

### Overview

Sidebar Czat / Głos. In Głos, hide `QuizForm`; speak quiz questions and commit `formatQuizSubmission(...)` from parsed speech. Document Chrome, mic, echo.

### Changes Required:

#### 1. Toggle UX

**File**: `web/components/chat-app.tsx`

**Intent**: Mode lives at app level so all panels share one mic session; entering Głos starts the hook, leaving stops it.

**Contract**: Two-state control **Czat | Głos**. First Głos click may show the OS permission dialog — that is the only expected click for audio. Mic indicator / “słucham…” / “mówię…” status in the main pane. Thread switching keeps the mode.

#### 2. Spoken quiz

**File**: `web/components/chat-panel.tsx`, `lib/speech-text.js`

**Intent**: Same quiz questions as `extractQuizQuestions`, no form in Głos. After learning TTS, speak questions (one after another or as a short list), then treat the next committed transcript as answers.

**Contract**: Build the user message with `formatQuizSubmission` from `parseSpokenQuizAnswers`. If parse fails, keep listening (optional short TTS “powtórz numer i odpowiedź”) — do not fall back to requiring a click. Czat mode keeps `QuizForm`.

#### 3. Docs

**File**: `README.md`, optionally `web/README.md`

**Intent**: Chat UI section mentions Głos, Chrome, `pl-PL`, one mic prompt, silence commit, MemorySaver caveat unchanged.

**Contract**: Do not claim Firefox STT. Do not claim MCP is on the voice path.

### Success Criteria:

#### Automated Verification:

- README mentions voice mode and Chrome.
- `npm test` + `web` `npm run build` pass.

#### Manual Verification:

- Toggle Czat ↔ Głos without creating empty `docs/conversations/` folders.
- Full loop: speak question → hear answer → hear quiz → speak answers → next agent turn.
- Restarting `npm run chat` still clears MemorySaver threads (unchanged).

---

## Testing Strategy

### Unit Tests:

- `stripForSpeech` fixtures (Źródła, quiz, wiki-links, markdown emphasis).
- `isCommittableTranscript` rejects empty/short.
- `parseSpokenQuizAnswers` numbered list and single-answer.

### Integration Tests:

- Existing Neo4j/MCP tests unchanged. No live mic in CI.

### Manual Testing Steps:

1. `npm run chat` in Chrome, `127.0.0.1`.
2. Switch to Głos, allow microphone once.
3. Speak a sailing question; wait ~1.2 s; confirm send + spoken reply without clicking.
4. Interrupt TTS by speaking; confirm audio stops and a new turn commits after silence.
5. Complete a spoken quiz; confirm `history.md` gets the formatted answers after the first real user message.
6. Switch to Czat; mic stops; typed send still works.

## Performance Considerations

Recognition is on-device/browser; no extra GPU. Restarting SpeechRecognition on `onend` must not tight-loop (guard with a short delay). Do not TTS until the assistant stream finishes — speaking partial tokens is out of scope.

## Migration Notes

No data migration. Existing threads work in Czat. Głos is a UI mode over the same `thread_id`.

## References

- Chat send path: `web/components/chat-panel.tsx`, `web/app/api/chat/route.ts`
- Quiz: `web/lib/quiz.ts`, `web/components/quiz-form.tsx`
- Prior change: `context/changes/langgraph-chat/plan.md` (no Playwright, localhost, MemorySaver)
- Web Speech: `webkitSpeechRecognition`, `speechSynthesis` (Chrome)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Speech text helpers + unit tests

#### Automated

- [x] 1.1 `npm test` passes including `tests/speech-text.test.js`
- [x] 1.2 `stripForSpeech` on a fixture with body + Źródła + quiz returns only the learning body, no pipe tables

### Phase 2: Hands-free listen loop → existing chat send

#### Automated

- [x] 2.1 `npm run build` in `web/` succeeds
- [x] 2.2 Chat route remains POST-only text; no new audio endpoint

#### Manual

- [ ] 2.3 Chrome: Głos + one mic grant + speak + ~1.2 s silence sends a turn without clicking
- [ ] 2.4 Leaving Głos stops listening
- [ ] 2.5 Very short noise does not create a turn

### Phase 3: TTS + barge-in

#### Automated

- [x] 3.1 `npm test` still passes
- [x] 3.2 `npm run build` in `web/` succeeds

#### Manual

- [ ] 3.3 Reply is spoken in Polish; Źródła not read
- [ ] 3.4 Talking over TTS stops audio and commits a new user message after silence
- [ ] 3.5 Agent voice does not appear as a user transcript

### Phase 4: Mode toggle, spoken quiz, README

#### Automated

- [x] 4.1 README mentions voice mode and Chrome
- [x] 4.2 `npm test` + `web` `npm run build` pass

#### Manual

- [ ] 4.3 Toggle does not create empty conversation folders
- [ ] 4.4 Full spoken loop including quiz
- [ ] 4.5 Restart still clears MemorySaver threads
