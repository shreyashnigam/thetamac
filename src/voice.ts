/* ==========================================================================
   THETAMAC — SPEECH RECOGNITION & PARSING MODULE
   ========================================================================== */

import { state } from './state';

/**
 * Word-to-number mapping dictionary for standard English numerals.
 */
const wordToNumMap: Record<string, number> = {
  zero: 0, oh: 0, o: 0,
  one: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
};

const magnitudeMap: Record<string, number> = {
  hundred: 100,
  thousand: 1000
};

const numberVocabulary = new Set([
  ...Object.keys(wordToNumMap),
  ...Object.keys(magnitudeMap),
  'and'
]);

function getSpeechRecognitionClass(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isVoiceModeSupported(): boolean {
  return getSpeechRecognitionClass() !== null;
}

/**
 * Parse a written-English phrase into a number.
 * Handles strings like "one hundred thirty seven" or "forty-five" or digit lists like "four five".
 */
export function parseNumberFromText(text: string): number | null {
  const cleaned = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation, hyphens to spaces
    .replace(/\band\b/g, ' ')     // strip word "and"
    .trim();

  if (!cleaned) return null;

  // 1. Direct digits match check
  const digitMatches = cleaned.match(/\d+/g);
  if (digitMatches && digitMatches.length > 0) {
    // Use the last group of numbers spoken
    return parseInt(digitMatches[digitMatches.length - 1], 10);
  }

  // 2. Token parsing for English words
  const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return null;

  // Handle consecutive separate single digits if they are spelled out, e.g. "four five" -> 45
  // If ALL tokens are single digit words (0-9) and length > 1, we concatenate them
  const isDigitSequence = tokens.length > 1 && tokens.every(token => {
    const val = wordToNumMap[token];
    return val !== undefined && val >= 0 && val <= 9;
  });

  if (isDigitSequence) {
    const concatenated = tokens.map(token => wordToNumMap[token]).join('');
    return parseInt(concatenated, 10);
  }

  // Standard sum-of-numerals parsing
  let total = 0;
  let currentAccumulator = 0;
  let validWordFound = false;

  for (const token of tokens) {
    if (wordToNumMap[token] !== undefined) {
      currentAccumulator += wordToNumMap[token];
      validWordFound = true;
    } else if (magnitudeMap[token] !== undefined) {
      const magnitude = magnitudeMap[token];
      if (currentAccumulator === 0) {
        currentAccumulator = 1; // "hundred" defaults to 100
      }
      currentAccumulator *= magnitude;
      total += currentAccumulator;
      currentAccumulator = 0;
      validWordFound = true;
    }
  }

  total += currentAccumulator;
  return validWordFound ? total : null;
}

/**
 * Returns every number-like phrase in the transcript so filler words or a
 * repeated equation do not prevent the spoken answer from being detected.
 */
function extractNumberPhrases(text: string): string[] {
  const cleaned = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  if (!cleaned) return [];

  const phrases: string[] = [];
  const tokens = cleaned.split(/\s+/);
  let currentPhrase: string[] = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token) || numberVocabulary.has(token)) {
      currentPhrase.push(token);
      continue;
    }

    if (currentPhrase.length > 0) {
      phrases.push(currentPhrase.join(' '));
      currentPhrase = [];
    }
  }

  if (currentPhrase.length > 0) {
    phrases.push(currentPhrase.join(' '));
  }

  return phrases;
}

function transcriptMatchesAnswer(rawTranscript: string, targetAnswer: number): boolean {
  const parsedFullTranscript = parseNumberFromText(rawTranscript);
  if (parsedFullTranscript === targetAnswer) {
    return true;
  }

  return extractNumberPhrases(rawTranscript).some((phrase) => {
    const parsedPhrase = parseNumberFromText(phrase);
    return parsedPhrase === targetAnswer;
  });
}

/**
 * Clean and process speech transcripts to check for correct answers.
 */
function processTranscript(rawTranscript: string, onCorrect: (answer: number) => void): boolean {
  if (!state.game.isPlaying) return false;

  const targetAnswer = state.game.currentQuestion?.answer;
  if (targetAnswer === undefined || targetAnswer === null) return false;

  // Post the raw heard phrase to UI log
  const transcriptLog = document.getElementById('transcript-val');
  if (transcriptLog) {
    transcriptLog.textContent = rawTranscript.trim();
  }

  if (transcriptMatchesAnswer(rawTranscript, targetAnswer)) {
    onCorrect(targetAnswer);
    return true;
  }

  return false;
}

/**
 * Initializes the webkitSpeechRecognition engine.
 */
export function initVoiceMode(onCorrect: (answer: number) => void): void {
  if (typeof window === 'undefined') return;

  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) {
    console.warn('Speech recognition is not supported in this browser.');
    return;
  }

  try {
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      state.voice.isListening = true;
      updateVoiceUI();
    };

    recognition.onresult = (event: any) => {
      const startIndex = Math.max(event.resultIndex ?? 0, state.voice.lastProcessedIndex + 1);

      for (let i = startIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? '';
        if (!transcript.trim()) continue;

        if (processTranscript(transcript, onCorrect)) {
          state.voice.lastProcessedIndex = i;
          break;
        }

        if (result.isFinal) {
          state.voice.lastProcessedIndex = i;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error encountered:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        state.voice.enabled = false;
        state.voice.isListening = false;
        updateVoiceUI();
        alert('Microphone permission denied. Please allow microphone access to use Voice Mode.');
      } else if (event.error === 'audio-capture') {
        state.voice.enabled = false;
        state.voice.isListening = false;
        updateVoiceUI();
        alert('No microphone was found. Please connect a microphone to use Voice Mode.');
      }
    };

    recognition.onend = () => {
      state.voice.isListening = false;
      // Automated restart loop if voice mode is still enabled and game is playing
      if (state.voice.enabled && state.game.isPlaying) {
        try {
          state.voice.lastProcessedIndex = -1;
          recognition.start();
        } catch (e) {
          console.error('Failed to restart speech recognition:', e);
        }
      } else {
        updateVoiceUI();
      }
    };

    state.voice.recognition = recognition;
  } catch (err) {
    console.error('Speech recognition initialization failed:', err);
  }
}

/**
 * Starts speech transcription engine.
 */
export function startListening(): void {
  if (!state.voice.recognition) return;
  state.voice.enabled = true;
  state.voice.lastProcessedIndex = -1;
  document.body.classList.add('voice-mode-active');
  
  // Clear any old logs
  const transcriptLog = document.getElementById('transcript-val');
  if (transcriptLog) transcriptLog.textContent = 'Listening...';

  try {
    state.voice.recognition.start();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'InvalidStateError') {
      state.voice.isListening = true;
      updateVoiceUI();
      return;
    }

    console.warn('Unable to start speech recognition:', err);
    state.voice.enabled = false;
    state.voice.isListening = false;
    document.body.classList.remove('voice-mode-active');
    updateVoiceUI();
    alert('Voice Mode could not start. Please try again in a browser that supports speech recognition.');
  }
}

/**
 * Stops speech transcription engine.
 */
export function stopListening(): void {
  state.voice.enabled = false;
  document.body.classList.remove('voice-mode-active');
  if (!state.voice.recognition) return;
  try {
    state.voice.recognition.stop();
  } catch (err) {
    // If already stopped, do nothing
  }
  state.voice.isListening = false;
  updateVoiceUI();
}

/**
 * Updates the microphone UI button, active class glows, and voice indicator pulses.
 */
export function updateVoiceUI(): void {
  const btn = document.getElementById('voice-toggle-btn') as HTMLButtonElement;
  const statusText = document.getElementById('voice-status-text');
  const transcriptLogContainer = document.getElementById('voice-transcript-log');
  const wave = btn?.querySelector('.mic-wave') as HTMLElement;

  if (!btn || !statusText) return;

  btn.style.display = state.game.isPlaying && state.voice.recognition ? 'flex' : 'none';

  if (state.voice.enabled && state.voice.isListening) {
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('voice-active');
    statusText.textContent = 'Voice Mode Active';
    if (transcriptLogContainer) transcriptLogContainer.style.display = 'flex';
    if (wave) wave.style.display = 'block';
  } else if (state.voice.enabled) {
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.add('voice-active');
    statusText.textContent = 'Connecting Mic...';
    if (transcriptLogContainer) transcriptLogContainer.style.display = 'flex';
    if (wave) wave.style.display = 'block';
  } else {
    btn.setAttribute('aria-pressed', 'false');
    btn.classList.remove('voice-active');
    statusText.textContent = 'Enable Voice Mode';
    if (transcriptLogContainer) transcriptLogContainer.style.display = 'none';
    if (wave) wave.style.display = 'none';
  }
}
