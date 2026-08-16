---
change_id: voice-chat-intro
title: Hands-free voice mode for the local chat UI
status: completed
created: 2026-08-16
updated: 2026-08-16
archived_at: null
---

## Notes

dodaj opcje zeby zamist czat przejsc do mozliwosci interakcji z agentem tylko przez dzwiek nie powinno byc klikania zeby zaczac ani przestac mowic - aplikacja powinna sama zobaczyc ze uzytkownik nic nie mowi i zaczac wysylac wiadomosci. Powinna tez odpowiadac na wiadomosci głosowo

Decisions from /10x-plan:
- STT: Web Speech API (Chrome, pl-PL). TTS: speechSynthesis (system Polish voice).
- Toggle Czat / Głos in the sidebar; once in Głos, no per-utterance click. OS mic permission once.
- ~1.0–1.5 s silence → send transcript via existing `sendMessage({ text })`.
- Barge-in: interrupt TTS (and in-flight stream) when the user speaks.
- Voice quiz: speak questions, collect answers by voice (no form).
- TTS reads learning body only (strip markdown / Źródła / quiz).
- Tests: unit tests for text helpers; voice UI is manual. No Playwright.
