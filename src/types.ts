/* ==========================================================================
   THETAMAC — TYPE SYSTEM & INTERFACES
   ========================================================================== */

export type Operation = 'add' | 'sub' | 'mul' | 'div';

export interface Range {
  min: number;
  max: number;
}

export interface Settings {
  duration: number;
  operations: Operation[];
  ranges: {
    add: {
      op1: Range;
      op2: Range;
    };
    mul: {
      op1: Range;
      op2: Range;
    };
  };
}

export interface Question {
  category: Operation;
  text: string;
  answer: number;
}

export interface LogItem {
  category: Operation;
  problem: string;
  answer: number;
  duration: number; // Time spent on this exact question in seconds
  hadMistake: boolean; // Did the user type any wrong key while resolving this
  secondResolved: number; // At what point in the game timeline was it solved (seconds elapsed)
}

export interface GameState {
  isPlaying: boolean;
  timeLeft: number;
  score: number;
  currentQuestion: Question | null;
  questionStartTime: number;
  questionHadMistake: boolean;
  totalQuestionsSolved: number;
  mistakeCount: number;
  log: LogItem[];
}

export interface VoiceState {
  enabled: boolean;
  recognition: any; // webkitSpeechRecognition instance
  isListening: boolean;
  lastProcessedIndex: number;
}

export interface GlobalState {
  settings: Settings;
  game: GameState;
  voice: VoiceState;
}
