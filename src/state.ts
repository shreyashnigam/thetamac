/* ==========================================================================
   THETAMAC — CORE STATE CONTAINER
   ========================================================================== */

import type { GlobalState } from './types';

export const state: GlobalState = {
  // Configured preferences
  settings: {
    duration: 120, // default 120s
    operations: ['add', 'sub', 'mul', 'div'],
    ranges: {
      add: {
        op1: { min: 2, max: 100 },
        op2: { min: 2, max: 100 }
      },
      mul: {
        op1: { min: 2, max: 12 },
        op2: { min: 2, max: 100 }
      }
    }
  },

  // Dynamic session details
  game: {
    isPlaying: false,
    timeLeft: 120,
    score: 0,
    currentQuestion: null,
    questionStartTime: 0,
    questionHadMistake: false,
    totalQuestionsSolved: 0,
    mistakeCount: 0,
    log: []
  },

  // Speech Dictation Mode
  voice: {
    enabled: false,
    recognition: null,
    isListening: false,
    lastProcessedIndex: -1
  }
};

/**
 * Resets the active session data back to default values.
 * Called immediately before commencing any speed run.
 */
export function resetGameState(): void {
  state.game.isPlaying = true;
  state.game.timeLeft = state.settings.duration;
  state.game.score = 0;
  state.game.currentQuestion = null;
  state.game.questionStartTime = 0;
  state.game.questionHadMistake = false;
  state.game.totalQuestionsSolved = 0;
  state.game.mistakeCount = 0;
  state.game.log = [];
  
  // Reset Voice state indices
  state.voice.lastProcessedIndex = -1;
}
