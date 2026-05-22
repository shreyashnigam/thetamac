/* ==========================================================================
   THETAMAC — MATHEMATICAL QUESTION GENERATOR (ZETAMAC ALGORITHM)
   ========================================================================== */

import { state } from './state';
import type { Question, Operation } from './types';

/**
 * Returns a random integer between min and max (inclusive).
 */
export function getRandomInt(min: number, max: number): number {
  const roundedMin = Math.ceil(min);
  const roundedMax = Math.floor(max);
  return Math.floor(Math.random() * (roundedMax - roundedMin + 1)) + roundedMin;
}

/**
 * Generates an arithmetic question based strictly on active operations and ranges.
 * Implements precise Zetamac math bounds and reverse rules:
 * - Subtraction is addition in reverse (always positive results).
 * - Division is multiplication in reverse (always integer answers, no remainders).
 */
export function generateQuestion(): Question {
  const ops = state.settings.operations;
  const activeOp: Operation = ops[Math.floor(Math.random() * ops.length)];
  
  let num1 = 0;
  let num2 = 0;
  let text = '';
  let answer = 0;

  switch (activeOp) {
    case 'add': {
      const bounds = state.settings.ranges.add;
      num1 = getRandomInt(bounds.op1.min, bounds.op1.max);
      num2 = getRandomInt(bounds.op2.min, bounds.op2.max);
      text = `${num1} + ${num2}`;
      answer = num1 + num2;
      break;
    }
      
    case 'sub': {
      // Subtraction is addition in reverse
      // Operands generate from Addition range settings
      const bounds = state.settings.ranges.add;
      const op1 = getRandomInt(bounds.op1.min, bounds.op1.max);
      const op2 = getRandomInt(bounds.op2.min, bounds.op2.max);
      const sum = op1 + op2;
      
      // 50% chance of either term subtracted
      if (Math.random() < 0.5) {
        text = `${sum} − ${op1}`;
        answer = op2;
      } else {
        text = `${sum} − ${op2}`;
        answer = op1;
      }
      break;
    }
      
    case 'mul': {
      const bounds = state.settings.ranges.mul;
      num1 = getRandomInt(bounds.op1.min, bounds.op1.max);
      num2 = getRandomInt(bounds.op2.min, bounds.op2.max);
      text = `${num1} × ${num2}`;
      answer = num1 * num2;
      break;
    }
      
    case 'div': {
      // Division is multiplication in reverse
      // Divisor is always op1 (the small multiplier range)
      // Answer is always op2 (the large multiplier range)
      const bounds = state.settings.ranges.mul;
      const op1 = getRandomInt(bounds.op1.min, bounds.op1.max);
      const op2 = getRandomInt(bounds.op2.min, bounds.op2.max);
      const product = op1 * op2;
      
      text = `${product} ÷ ${op1}`;
      answer = op2;
      break;
    }
  }

  const question: Question = {
    category: activeOp,
    text,
    answer
  };

  // Update central state
  state.game.currentQuestion = question;
  state.game.questionHadMistake = false;
  state.game.questionStartTime = performance.now();

  return question;
}
