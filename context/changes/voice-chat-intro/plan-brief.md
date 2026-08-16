# Hands-free voice chat — Plan Brief

> Full plan: `context/changes/voice-chat-intro/plan.md`

## What & Why

Text chat works in the browser, but learning while looking at a keyboard is the wrong loop. Add a **Głos** option: after one mic permission, the app detects end of speech, sends the transcript as a normal chat turn, and reads the answer aloud. No click to start or stop each utterance.

## Starting Point

Next.js `useChat` → LangGraph text stream, markdown + quiz form, lazy `docs/conversations/` on first user message. No audio APIs in `web/`.

## Desired End State

Sidebar **Czat | Głos**. In Głos (Chrome), continuous listen → ~1.2 s silence → `sendMessage({ text })` → streamed markdown + spoken learning body. Barge-in interrupts TTS. Quiz is spoken, not a form.

## Key Decisions Made

| Decision | Choice | Why |
| -------- | ------ | --- |
| STT | Web Speech API, `pl-PL` | Zero extra models; already on localhost Chrome |
| TTS | `speechSynthesis` | System Polish voice; no cloud audio |
| Entry | Sidebar toggle | Mode click OK; per-utterance click is not |
| Silence | ~1.2 s | Balances pause-in-sentence vs snappy send |
| Barge-in | Stop TTS + in-flight stream | Hands-free correction |
| Quiz | Spoken answers → `formatQuizSubmission` | Form is unusable without a pointer |
| TTS text | Strip Źródła / quiz / markdown | Tables are unlistenable |
| Tests | Unit helpers only | No Playwright (same as langgraph-chat) |

## Scope

**In scope:** Client voice session, strip/parse helpers, toggle, spoken quiz, README.

**Out of scope:** Whisper/cloud TTS, push-to-talk, Firefox STT, audio `/api` routes, wake-word, Playwright, auth/deploy.

## Architecture / Approach

```
[Głos] getUserMedia + webkitSpeechRecognition
  → silence 1.2s → sendMessage({ text }) → existing POST /api/chat
  → stream markdown (UI) + stripForSpeech → speechSynthesis
  → user talks → cancel TTS / stop() → listen again
```

LangGraph and Neo4j stay unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Helpers + tests | strip / commit / quiz parse | Over-stripping useful spoken content |
| 2. Listen loop | Silence → send | SpeechRecognition `onend` restart loops |
| 3. TTS + barge-in | Speak + interrupt | Echo: TTS transcribed as the user |
| 4. Toggle + quiz + docs | UX + spoken quiz | Quiz parse too brittle in Polish |

**Prerequisites:** Chrome, mic, existing `npm run chat` stack (Neo4j + LLM for a live loop).
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Chrome-only STT; Safari/Firefox will show an explicit error.
- Speaker+mic echo is best-effort (`echoCancellation` + ignore commits while TTS plays).
- `webkitSpeechRecognition` quality for Polish is “good enough,” not exam-grade.

## Success Criteria (Summary)

- In Głos, a full turn happens without clicking talk/stop.
- Replies are heard without Źródła tables; quizzes can be answered by voice.
- Text chat path and conversation persistence stay the same.
