/* ==========================================================================
   THETAMAC — SYSTEM ORCHESTRATOR & ENTRY POINT
   ========================================================================== */

import './style.css';
import { state, resetGameState } from './state';
import { generateQuestion } from './engine';
import { initVoiceMode, startListening, stopListening, updateVoiceUI } from './voice';
import { processAnalytics } from './analytics';
import type { Operation } from './types';

// Centralize element selectors to prevent repeated DOM queries
let settingsPanel: HTMLElement;
let gamePanel: HTMLElement;
let resultsPanel: HTMLElement;
let settingsForm: HTMLFormElement;
let answerInput: HTMLInputElement;
let problemText: HTMLElement;
let timerVal: HTMLElement;
let scoreVal: HTMLElement;
let themeToggles: NodeListOf<HTMLButtonElement>;
let headerHud: HTMLElement;
let voiceToggleBtn: HTMLButtonElement;
let quitBtn: HTMLButtonElement;
let restartBtn: HTMLButtonElement;
let customizeBtn: HTMLButtonElement;
let gameDurationSelect: HTMLSelectElement;
let startVoiceBtn: HTMLButtonElement;

let gameTimerId: number | null = null;

/**
 * Main application initialization.
 */
document.addEventListener('DOMContentLoaded', () => {
  cacheDOM();
  loadPersistedPreferences();
  bindEventHandlers();
  
  // Wire up speech feedback handler
  initVoiceMode(() => {
    handleCorrectAnswer();
  });
});

/**
 * Caches HTML DOM pointers.
 */
function cacheDOM(): void {
  settingsPanel = document.getElementById('settings-panel')!;
  gamePanel = document.getElementById('game-panel')!;
  resultsPanel = document.getElementById('results-panel')!;
  settingsForm = document.getElementById('settings-form') as HTMLFormElement;
  answerInput = document.getElementById('answer-input') as HTMLInputElement;
  problemText = document.getElementById('problem-text')!;
  timerVal = document.getElementById('timer-val')!;
  scoreVal = document.getElementById('score-val')!;
  themeToggles = document.querySelectorAll('.theme-toggle');
  headerHud = document.getElementById('header-hud')!;
  voiceToggleBtn = document.getElementById('voice-toggle-btn') as HTMLButtonElement;
  quitBtn = document.getElementById('quit-btn') as HTMLButtonElement;
  restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;
  customizeBtn = document.getElementById('customize-btn') as HTMLButtonElement;
  gameDurationSelect = document.getElementById('game-duration') as HTMLSelectElement;
  startVoiceBtn = document.getElementById('start-voice-btn') as HTMLButtonElement;
}

/**
 * Loads and restores any pre-existing light-theme or audio parameters from localStorage.
 */
function loadPersistedPreferences(): void {
  // Theme check
  const theme = localStorage.getItem('thetamac-theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    updateThemeIcons(true);
  } else {
    document.body.classList.remove('light-theme');
    updateThemeIcons(false);
  }

  // Duration check
  const persistedDuration = localStorage.getItem('thetamac-duration');
  if (persistedDuration) {
    gameDurationSelect.value = persistedDuration;
  }
}

/**
 * Binds DOM event listeners.
 */
function bindEventHandlers(): void {
  // Header buttons
  themeToggles.forEach(btn => btn.addEventListener('click', toggleTheme));

  // Form check/uncheck dynamic visual greyscaling
  const opAddCheck = document.getElementById('op-add') as HTMLInputElement;
  const opSubCheck = document.getElementById('op-sub') as HTMLInputElement;
  const opMulCheck = document.getElementById('op-mul') as HTMLInputElement;
  const opDivCheck = document.getElementById('op-div') as HTMLInputElement;

  if (opAddCheck && opSubCheck && opMulCheck && opDivCheck) {
    opAddCheck.addEventListener('change', updateRangeBlocksState);
    opSubCheck.addEventListener('change', updateRangeBlocksState);
    opMulCheck.addEventListener('change', updateRangeBlocksState);
    opDivCheck.addEventListener('change', updateRangeBlocksState);

    // Initialize range blocks opacity and disabled states
    updateRangeBlocksState();
  }

  // Save selected duration to localStorage on change
  gameDurationSelect.addEventListener('change', () => {
    localStorage.setItem('thetamac-duration', gameDurationSelect.value);
  });

  // Start Form submit (Keyboard Mode)
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.voice.enabled = false;
    startSession();
  });

  // Voice Mode Start Button
  startVoiceBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Microphone access APIs are not supported in this browser. Please try a different browser like Chrome or Safari.');
      return;
    }

    try {
      // Proactively request microphone access to ensure Voice Mode will work
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release microphone stream immediately until gameplay starts
      stream.getTracks().forEach(track => track.stop());

      state.voice.enabled = true;
      startSession();
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      alert('Microphone access is required for Voice Mode. Please ensure a microphone is connected and permission is granted in your browser settings.');
    }
  });

  // Live Answer character validator
  answerInput.addEventListener('input', handleInputEvent);

  // Voice toggle within active sessions
  voiceToggleBtn.addEventListener('click', handleVoiceButtonToggle);

  // Session navigation controls
  quitBtn.addEventListener('click', terminateSession);
  restartBtn.addEventListener('click', startSessionWithExistingRules);
  customizeBtn.addEventListener('click', showSettingsView);
}

/**
 * Enables or gray-scales operand range boxes based on operator checks.
 * Addition range remains enabled if Addition or Subtraction is checked.
 * Multiplication range remains enabled if Multiplication or Division is checked.
 */
function updateRangeBlocksState(): void {
  const opAddCheck = document.getElementById('op-add') as HTMLInputElement;
  const opSubCheck = document.getElementById('op-sub') as HTMLInputElement;
  const opMulCheck = document.getElementById('op-mul') as HTMLInputElement;
  const opDivCheck = document.getElementById('op-div') as HTMLInputElement;

  if (!opAddCheck || !opSubCheck || !opMulCheck || !opDivCheck) return;

  // 1. Addition Range Box State
  const rangeBoxAdd = document.getElementById('range-box-add');
  const blockAdd = document.getElementById('block-add');
  const addRangeEnabled = opAddCheck.checked || opSubCheck.checked;

  if (rangeBoxAdd) {
    if (addRangeEnabled) {
      rangeBoxAdd.classList.remove('disabled-block');
      rangeBoxAdd.querySelectorAll('input').forEach(inp => inp.disabled = false);
    } else {
      rangeBoxAdd.classList.add('disabled-block');
      rangeBoxAdd.querySelectorAll('input').forEach(inp => inp.disabled = true);
    }
  }

  // Handle graying out of the addition checkbox label itself if unchecked
  const addCheckboxLine = blockAdd?.querySelector('.checkbox-line');
  if (addCheckboxLine) {
    if (opAddCheck.checked) {
      addCheckboxLine.classList.remove('disabled-block');
    } else {
      addCheckboxLine.classList.add('disabled-block');
    }
  }

  // Handle graying out of subtraction block if unchecked
  const blockSub = document.getElementById('block-sub');
  if (blockSub) {
    if (opSubCheck.checked) {
      blockSub.classList.remove('disabled-block');
    } else {
      blockSub.classList.add('disabled-block');
    }
  }

  // 2. Multiplication Range Box State
  const rangeBoxMul = document.getElementById('range-box-mul');
  const blockMul = document.getElementById('block-mul');
  const mulRangeEnabled = opMulCheck.checked || opDivCheck.checked;

  if (rangeBoxMul) {
    if (mulRangeEnabled) {
      rangeBoxMul.classList.remove('disabled-block');
      rangeBoxMul.querySelectorAll('input').forEach(inp => inp.disabled = false);
    } else {
      rangeBoxMul.classList.add('disabled-block');
      rangeBoxMul.querySelectorAll('input').forEach(inp => inp.disabled = true);
    }
  }

  // Handle graying out of multiplication checkbox label if unchecked
  const mulCheckboxLine = blockMul?.querySelector('.checkbox-line');
  if (mulCheckboxLine) {
    if (opMulCheck.checked) {
      mulCheckboxLine.classList.remove('disabled-block');
    } else {
      mulCheckboxLine.classList.add('disabled-block');
    }
  }

  // Handle graying out of division block if unchecked
  const blockDiv = document.getElementById('block-div');
  if (blockDiv) {
    if (opDivCheck.checked) {
      blockDiv.classList.remove('disabled-block');
    } else {
      blockDiv.classList.add('disabled-block');
    }
  }
}

/**
 * Parses settings inputs, triggers resets, and initiates timing loops.
 */
function startSession(): void {
  // 1. Fetch checked operators
  const checkedOps: Operation[] = [];
  document.querySelectorAll<HTMLInputElement>('input[name="operations"]:checked').forEach(cb => {
    checkedOps.push(cb.value as Operation);
  });

  if (checkedOps.length === 0) {
    alert('Invalid configuration: You must choose at least one operation to start!');
    return;
  }

  // 2. Extract and validate ranges
  const add1Min = parseInt((document.getElementById('add1-min') as HTMLInputElement).value, 10);
  const add1Max = parseInt((document.getElementById('add1-max') as HTMLInputElement).value, 10);
  const add2Min = parseInt((document.getElementById('add2-min') as HTMLInputElement).value, 10);
  const add2Max = parseInt((document.getElementById('add2-max') as HTMLInputElement).value, 10);

  const mul1Min = parseInt((document.getElementById('mul1-min') as HTMLInputElement).value, 10);
  const mul1Max = parseInt((document.getElementById('mul1-max') as HTMLInputElement).value, 10);
  const mul2Min = parseInt((document.getElementById('mul2-min') as HTMLInputElement).value, 10);
  const mul2Max = parseInt((document.getElementById('mul2-max') as HTMLInputElement).value, 10);

  // Validate that min < max, if not swap them to save user from a crash
  state.settings.ranges.add.op1 = add1Min <= add1Max ? { min: add1Min, max: add1Max } : { min: add1Max, max: add1Min };
  state.settings.ranges.add.op2 = add2Min <= add2Max ? { min: add2Min, max: add2Max } : { min: add2Max, max: add2Min };
  state.settings.ranges.mul.op1 = mul1Min <= mul1Max ? { min: mul1Min, max: mul1Max } : { min: mul1Max, max: mul1Min };
  state.settings.ranges.mul.op2 = mul2Min <= mul2Max ? { min: mul2Min, max: mul2Max } : { min: mul2Max, max: mul2Min };

  // Write swapped back to form for consistency
  (document.getElementById('add1-min') as HTMLInputElement).value = state.settings.ranges.add.op1.min.toString();
  (document.getElementById('add1-max') as HTMLInputElement).value = state.settings.ranges.add.op1.max.toString();
  (document.getElementById('add2-min') as HTMLInputElement).value = state.settings.ranges.add.op2.min.toString();
  (document.getElementById('add2-max') as HTMLInputElement).value = state.settings.ranges.add.op2.max.toString();
  (document.getElementById('mul1-min') as HTMLInputElement).value = state.settings.ranges.mul.op1.min.toString();
  (document.getElementById('mul1-max') as HTMLInputElement).value = state.settings.ranges.mul.op1.max.toString();
  (document.getElementById('mul2-min') as HTMLInputElement).value = state.settings.ranges.mul.op2.min.toString();
  (document.getElementById('mul2-max') as HTMLInputElement).value = state.settings.ranges.mul.op2.max.toString();

  // 3. Fetch duration
  const durationVal = parseInt(gameDurationSelect.value, 10);
  state.settings.duration = durationVal;
  state.settings.operations = checkedOps;

  // Reset metrics
  resetGameState();

  // Switch panels
  settingsPanel.style.display = 'none';
  resultsPanel.style.display = 'none';
  gamePanel.style.display = 'flex';
  headerHud.style.display = 'flex';
  document.body.classList.add('game-active');
  if (state.voice.enabled) {
    document.body.classList.add('voice-mode-active');
  } else {
    document.body.classList.remove('voice-mode-active');
  }

  // Clear HUD values
  timerVal.textContent = state.game.timeLeft.toString();
  timerVal.classList.remove('timer-warn');
  scoreVal.textContent = '0';

  // Load first problem
  const firstQ = generateQuestion();
  problemText.textContent = firstQ.text;
  answerInput.value = '';
  
  // Refocus input
  if (!state.voice.enabled) {
    setTimeout(() => answerInput.focus(), 50);
  }

  // Toggle speech engines if enabled
  if (state.voice.enabled) {
    startListening();
  } else {
    updateVoiceUI();
  }

  // Set Interval tick
  if (gameTimerId) clearInterval(gameTimerId);
  gameTimerId = window.setInterval(tick, 1000);
}

/**
 * Immediate quick play again using identical previously specified rules.
 */
function startSessionWithExistingRules(): void {
  startSession();
}

/**
 * Core timing decrement loop.
 */
function tick(): void {
  if (!state.game.isPlaying) return;

  state.game.timeLeft--;
  timerVal.textContent = state.game.timeLeft.toString();

  if (state.game.timeLeft <= 10) {
    timerVal.classList.add('timer-warn');
  }

  if (state.game.timeLeft <= 0) {
    terminateSession();
  }
}

/**
 * Live validation check as the user types digits.
 */
function handleInputEvent(): void {
  const currentQuestion = state.game.currentQuestion;
  if (!currentQuestion) return;

  const typedVal = answerInput.value.trim();
  const targetAnswerStr = currentQuestion.answer.toString();

  // 1. Full Match Success Trigger
  if (typedVal === targetAnswerStr) {
    handleCorrectAnswer();
    return;
  }

  // 2. Mistakes tracking (if characters are inputted that don't match correct prefix path)
  if (typedVal.length > 0 && !targetAnswerStr.startsWith(typedVal)) {
    if (!state.game.questionHadMistake) {
      state.game.questionHadMistake = true;
      state.game.mistakeCount++;
    }
  }
}

/**
 * Handles logic for loading the next question and submitting the correct elapsed intervals.
 */
function handleCorrectAnswer(): void {
  const currentQuestion = state.game.currentQuestion;
  if (!currentQuestion) return;

  const now = performance.now();
  const rawSecTaken = (now - state.game.questionStartTime) / 1000;
  // Safety floor so no answer is logged as exactly 0.0 seconds
  const secTaken = Math.max(rawSecTaken, 0.01);
  const secondResolved = state.settings.duration - state.game.timeLeft;

  // Log to centralized analytic memory
  state.game.log.push({
    category: currentQuestion.category,
    duration: parseFloat(secTaken.toFixed(3)),
    hadMistake: state.game.questionHadMistake,
    secondResolved
  });

  // Score HUD updates
  state.game.score++;
  state.game.totalQuestionsSolved++;
  scoreVal.textContent = state.game.score.toString();

  // Reset inputs
  answerInput.value = '';

  // Trigger next question
  const nextQ = generateQuestion();
  problemText.textContent = nextQ.text;
  
  // Keep keypads focused
  if (!state.voice.enabled) {
    answerInput.focus();
  }
}

/**
 * Active session cleanup, timer shutdowns, and transition to analytics dashboard views.
 */
function terminateSession(): void {
  state.game.isPlaying = false;
  if (gameTimerId) {
    clearInterval(gameTimerId);
    gameTimerId = null;
  }

  // Cease microphone activities
  stopListening();

  // Transition views
  gamePanel.style.display = 'none';
  resultsPanel.style.display = 'flex';
  headerHud.style.display = 'none';
  document.body.classList.remove('game-active', 'voice-mode-active');

  // Trigger metrics compiling and charting
  processAnalytics();
}

/**
 * Voice toggle controller inside Gameplay screen.
 */
function handleVoiceButtonToggle(): void {
  if (state.voice.enabled) {
    stopListening();
  } else {
    startListening();
  }
}

/**
 * Transition back to parameters setup layout.
 */
function showSettingsView(): void {
  resultsPanel.style.display = 'none';
  gamePanel.style.display = 'none';
  settingsPanel.style.display = 'flex';
  headerHud.style.display = 'none';
}

/**
 * Toggles Light/Dark visual themes and saves preference.
 */
function toggleTheme(): void {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('thetamac-theme', isLight ? 'light' : 'dark');
  updateThemeIcons(isLight);
}

function updateThemeIcons(isLight: boolean): void {
  themeToggles.forEach(btn => {
    const sun = btn.querySelector('.sun-icon') as HTMLElement;
    const moon = btn.querySelector('.moon-icon') as HTMLElement;
    if (!sun || !moon) return;

    if (isLight) {
      sun.style.display = 'none';
      moon.style.display = 'block';
    } else {
      sun.style.display = 'block';
      moon.style.display = 'none';
    }
  });
}
