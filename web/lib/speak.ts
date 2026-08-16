let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeResolve: (() => void) | null = null;

function pickPolishVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.startsWith("pl")) ??
    voices.find((v) => v.lang.startsWith("pl-PL")) ??
    null
  );
}

export function cancelSpeak(): void {
  if (typeof speechSynthesis === "undefined") {
    return;
  }
  speechSynthesis.cancel();
  activeUtterance = null;
  if (activeResolve) {
    activeResolve();
    activeResolve = null;
  }
}

export function isSpeaking(): boolean {
  return typeof speechSynthesis !== "undefined" && speechSynthesis.speaking;
}

export function speak(text: string): Promise<void> {
  if (typeof speechSynthesis === "undefined" || !text.trim()) {
    return Promise.resolve();
  }

  cancelSpeak();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickPolishVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "pl-PL";
    }
    utterance.rate = 1;

    activeUtterance = utterance;
    activeResolve = resolve;

    utterance.onend = () => {
      activeUtterance = null;
      activeResolve = null;
      resolve();
    };
    utterance.onerror = () => {
      activeUtterance = null;
      activeResolve = null;
      resolve();
    };

    speechSynthesis.speak(utterance);
  });
}

/** Chrome loads voices asynchronously on first use. */
export function preloadVoices(): void {
  if (typeof speechSynthesis === "undefined") {
    return;
  }
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => {
    speechSynthesis.getVoices();
  };
}
