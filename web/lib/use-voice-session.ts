"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCommittableTranscript, SILENCE_MS } from "../../lib/speech-text.js";
import { cancelSpeak, isSpeaking } from "./speak";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export type VoicePhase = "idle" | "listening" | "speaking" | "blocked";

export type UseVoiceSessionOptions = {
  enabled: boolean;
  /** Mic only while the user holds the PTT control (avoids speaker echo). */
  pushToTalk?: boolean;
  /** When true, do not commit transcripts (agent streaming). Barge-in still fires. */
  blockCommits?: boolean;
  onCommit: (text: string) => void | Promise<void>;
  onBargeIn?: () => void;
};

export function useVoiceSession({
  enabled,
  pushToTalk = false,
  blockCommits = false,
  onCommit,
  onBargeIn,
}: UseVoiceSessionOptions) {
  const [listening, setListening] = useState(false);
  const [pttActive, setPttActiveState] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<VoicePhase>("idle");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTranscriptRef = useRef("");
  const enabledRef = useRef(enabled);
  const pushToTalkRef = useRef(pushToTalk);
  const pttActiveRef = useRef(false);
  const blockCommitsRef = useRef(blockCommits);
  const onCommitRef = useRef(onCommit);
  const onBargeInRef = useRef(onBargeIn);
  const restartingRef = useRef(false);

  enabledRef.current = enabled;
  pushToTalkRef.current = pushToTalk;
  pttActiveRef.current = pttActive;
  blockCommitsRef.current = blockCommits;
  onCommitRef.current = onCommit;
  onBargeInRef.current = onBargeIn;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const commitPending = useCallback(async () => {
    clearSilenceTimer();
    const text = pendingTranscriptRef.current.trim();
    pendingTranscriptRef.current = "";
    setTranscriptDraft("");
    if (!isCommittableTranscript(text)) {
      return;
    }
    await onCommitRef.current(text);
  }, [clearSilenceTimer]);

  const scheduleCommit = useCallback(() => {
    if (pushToTalkRef.current) {
      return;
    }
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      void commitPending();
    }, SILENCE_MS);
  }, [clearSilenceTimer, commitPending]);

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const agentSpeaking = isSpeaking();
      const blocked = blockCommitsRef.current;

      if (agentSpeaking || blocked) {
        if (isCommittableTranscript(trimmed)) {
          cancelSpeak();
          onBargeInRef.current?.();
          pendingTranscriptRef.current = trimmed;
          setTranscriptDraft(trimmed);
          if (isFinal) {
            scheduleCommit();
          }
        }
        return;
      }

      pendingTranscriptRef.current = trimmed;
      setTranscriptDraft(trimmed);
      if (isFinal || trimmed.length > pendingTranscriptRef.current.length - 1) {
        scheduleCommit();
      }
    },
    [scheduleCommit],
  );

  const startRecognition = useCallback(() => {
    const Recognition = window.webkitSpeechRecognition;
    if (!Recognition || !enabledRef.current) {
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pl-PL";

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const part = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalText += part;
        } else {
          interim += part;
        }
      }
      const combined = (finalText || interim).trim();
      if (combined) {
        handleTranscript(combined, Boolean(finalText));
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Brak dostępu do mikrofonu. Zezwól w ustawieniach Chrome.");
        setListening(false);
        setPhase("idle");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(`Rozpoznawanie mowy: ${event.error ?? "błąd"}`);
      }
    };

    recognition.onend = () => {
      if (!enabledRef.current) {
        setListening(false);
        setPhase("idle");
        return;
      }
      if (pushToTalkRef.current && !pttActiveRef.current) {
        setListening(false);
        setPhase(isSpeaking() ? "speaking" : blockCommitsRef.current ? "blocked" : "idle");
        return;
      }
      if (restartingRef.current) {
        return;
      }
      restartingRef.current = true;
      setTimeout(() => {
        restartingRef.current = false;
        if (enabledRef.current) {
          try {
            recognition.start();
          } catch {
            startRecognition();
          }
        }
      }, 250);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setPhase("listening");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się uruchomić rozpoznawania mowy");
    }
  }, [handleTranscript]);

  const stopRecognitionOnly = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
      recognitionRef.current = null;
    }
    setListening(false);
    if (!isSpeaking() && !blockCommitsRef.current) {
      setPhase("idle");
    }
  }, [clearSilenceTimer]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    pendingTranscriptRef.current = "";
    setTranscriptDraft("");
    pttActiveRef.current = false;
    setPttActiveState(false);
    enabledRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    cancelSpeak();
    setListening(false);
    setPhase("idle");
  }, [clearSilenceTimer]);

  const start = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    if (!window.webkitSpeechRecognition) {
      setError("Tryb głosowy wymaga Chrome (webkitSpeechRecognition).");
      return;
    }

    enabledRef.current = true;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;
    } catch {
      setError("Brak dostępu do mikrofonu.");
      return;
    }

    if (!pushToTalkRef.current) {
      startRecognition();
    }
  }, [startRecognition]);

  const setPttActive = useCallback(
    (active: boolean) => {
      if (!enabledRef.current || !pushToTalkRef.current) {
        return;
      }

      pttActiveRef.current = active;
      setPttActiveState(active);

      if (active) {
        startRecognition();
        return;
      }

      void commitPending();
      stopRecognitionOnly();
    },
    [commitPending, startRecognition, stopRecognitionOnly],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (pushToTalk) {
      pttActiveRef.current = false;
      setPttActiveState(false);
      stopRecognitionOnly();
      return;
    }
    startRecognition();
  }, [enabled, pushToTalk, startRecognition, stopRecognitionOnly]);

  useEffect(() => {
    if (blockCommits) {
      setPhase(isSpeaking() ? "speaking" : "blocked");
    } else if (listening || pttActive) {
      setPhase(isSpeaking() ? "speaking" : "listening");
    }
  }, [blockCommits, listening, pttActive]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    void start();
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start/stop are stable enough; enabled is the driver
  }, [enabled]);

  return {
    start,
    stop,
    listening,
    pttActive,
    setPttActive,
    transcriptDraft,
    error,
    phase,
    setSpeakingPhase: (speaking: boolean) => {
      setPhase(
        speaking
          ? "speaking"
          : listening || pttActiveRef.current
            ? "listening"
            : blockCommitsRef.current
              ? "blocked"
              : "idle",
      );
    },
  };
}
