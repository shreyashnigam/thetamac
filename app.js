/* ==========================================================================
   THETAMAC — APPLICATION STATE & LOGIC ENGINE
   ========================================================================== */

// 1. Core State Definition
const state = {
  // Configurable settings
  settings: {
    duration: 120, // in seconds
    operations: ['add', 'sub', 'mul', 'div'],
    ranges: {
      add: { min: 2, max: 100 },
      sub: { min: 2, max: 100 },
      mul: { min: 2, max: 12 },
      div: { min: 2, max: 12 }
    }
  },
  
  // Game session variables
  game: {
    isPlaying: false,
    timer: null,
    timeLeft: 120,
    score: 0,
    currentQuestion: null,
    questionStartTime: 0,
    
    // Keystroke statistics for accuracy calculations
    questionHadMistake: false,
    totalQuestionsSolved: 0,
    mistakeCount: 0,
    
    // Log of every solved question: { category, duration, hadMistake }
    log: []
  },
  
  // Audio Feedback
  audio: {
    enabled: true,
    context: null
  },
  
  // Voice Mode (Web Speech API)
  voice: {
    enabled: false,
    recognition: null,
    isListening: false,
    lastProcessedIndex: -1
  }
};

// 2. Elements Cache
const el = {
  // Navigation Screens
  settingsPanel: document.getElementById('settings-panel'),
  gamePanel: document.getElementById('game-panel'),
  resultsPanel: document.getElementById('results-panel'),
  
  // Settings Form Inputs
  settingsForm: document.getElementById('settings-form'),
  durationSelect: document.getElementById('game-duration'),
  startBtn: document.getElementById('start-btn'),
  themeToggle: document.getElementById('theme-toggle'),
  soundToggle: document.getElementById('sound-toggle'),
  
  // Active Game Elements
  timerVal: document.getElementById('timer-val'),
  scoreVal: document.getElementById('score-val'),
  problemText: document.getElementById('problem-text'),
  answerInput: document.getElementById('answer-input'),
  quitBtn: document.getElementById('quit-btn'),
  
  // Voice Controls in Game
  voiceToggleBtn: document.getElementById('voice-toggle-btn'),
  voiceStatusText: document.getElementById('voice-status-text'),
  voiceTranscriptLog: document.getElementById('voice-transcript-log'),
  transcriptVal: document.getElementById('transcript-val'),
  
  // Results Elements
  summaryScore: document.getElementById('summary-score'),
  summaryPPM: document.getElementById('summary-ppm'),
  summaryAccuracy: document.getElementById('summary-accuracy'),
  analyticsTableBody: document.getElementById('analytics-table-body'),
  chartParent: document.getElementById('chart-parent'),
  restartBtn: document.getElementById('restart-btn'),
  customizeBtn: document.getElementById('customize-btn')
};

/* ==========================================================================
   INITIALIZATION & SETUP
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSettingsFormEvents();
  initGameEvents();
  initVoiceMode();
  
  // Focus settings panel initial entry
  el.settingsPanel.style.display = 'block';
});

// Theme Toggle (Default to Dark)
function initTheme() {
  const savedTheme = localStorage.getItem('thetamac-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  el.themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('thetamac-theme', newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  const sun = el.themeToggle.querySelector('.sun-icon');
  const moon = el.themeToggle.querySelector('.moon-icon');
  if (theme === 'light') {
    sun.style.display = 'none';
    moon.style.display = 'block';
  } else {
    sun.style.display = 'block';
    moon.style.display = 'none';
  }
}

// Sound Beep Settings
el.soundToggle.addEventListener('click', () => {
  state.audio.enabled = !state.audio.enabled;
  const soundOn = el.soundToggle.querySelector('.sound-on-icon');
  const soundOff = el.soundToggle.querySelector('.sound-off-icon');
  if (state.audio.enabled) {
    soundOn.style.display = 'block';
    soundOff.style.display = 'none';
    playBeep(600, 0.05); // test beep
  } else {
    soundOn.style.display = 'none';
    soundOff.style.display = 'block';
  }
});

// Initialize Settings Panel event listeners
function initSettingsFormEvents() {
  // Selectively enable/disable range boxes based on checkbox states
  const opCheckboxes = ['add', 'sub', 'mul', 'div'];
  opCheckboxes.forEach(op => {
    const check = document.getElementById(`op-${op}`);
    const rangeBox = document.getElementById(`range-box-${op}`);
    
    // Toggle active ranges initially
    if (!check.checked) rangeBox.classList.add('disabled');
    
    // Watch changes
    check.addEventListener('change', () => {
      if (check.checked) {
        rangeBox.classList.remove('disabled');
      } else {
        rangeBox.classList.add('disabled');
      }
    });
  });

  // Handle Form Submission -> Start Game
  el.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Read and save settings
    const activeOps = Array.from(document.querySelectorAll('input[name="operations"]:checked')).map(cb => cb.value);
    
    if (activeOps.length === 0) {
      alert('Please select at least one operation to practice!');
      return;
    }
    
    state.settings.operations = activeOps;
    state.settings.duration = parseInt(el.durationSelect.value, 10);
    
    // Read ranges
    activeOps.forEach(op => {
      const minVal = parseInt(document.getElementById(`${op}-min`).value, 10);
      const maxVal = parseInt(document.getElementById(`${op}-max`).value, 10);
      state.settings.ranges[op] = {
        min: Math.min(minVal, maxVal),
        max: Math.max(minVal, maxVal)
      };
    });

    startGame();
  });
}

function initGameEvents() {
  // Quit Session midway
  el.quitBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to end this session?')) {
      endGame(true); // End but don't show results or show partial
    }
  });

  // Real-time input evaluation
  el.answerInput.addEventListener('input', (e) => {
    if (!state.game.isPlaying) return;
    
    const userVal = el.answerInput.value.trim();
    const targetAns = state.game.currentQuestion.answer.toString();
    
    // Verify prefix matching for mistake tracking
    if (userVal.length > 0) {
      if (!targetAns.startsWith(userVal)) {
        state.game.questionHadMistake = true;
      }
    }
    
    // Perfect Match evaluation
    if (userVal === targetAns) {
      handleCorrectAnswer();
    }
  });

  // Setup restart buttons
  el.restartBtn.addEventListener('click', () => {
    startGame();
  });

  el.customizeBtn.addEventListener('click', () => {
    showPanel(el.settingsPanel);
  });
}

/* ==========================================================================
   ARITHMETIC ENGINE (ZETAMAC REPLICATION)
   ========================================================================== */

function generateQuestion() {
  const ops = state.settings.operations;
  const activeOp = ops[Math.floor(Math.random() * ops.length)];
  const range = state.settings.ranges[activeOp];
  
  let num1, num2, text, answer;

  switch (activeOp) {
    case 'add':
      num1 = getRandomInt(range.min, range.max);
      num2 = getRandomInt(range.min, range.max);
      text = `${num1} + ${num2}`;
      answer = num1 + num2;
      break;
      
    case 'sub': {
      // Subtraction is addition in reverse
      // Generate components in range, sum them, subtract one
      const a = getRandomInt(range.min, range.max);
      const b = getRandomInt(range.min, range.max);
      const sum = a + b;
      
      // 50% chance of sum - a = b or sum - b = a
      if (Math.random() < 0.5) {
        text = `${sum} − ${a}`;
        answer = b;
      } else {
        text = `${sum} − ${b}`;
        answer = a;
      }
      break;
    }
      
    case 'mul':
      num1 = getRandomInt(range.min, range.max);
      num2 = getRandomInt(range.min, range.max);
      text = `${num1} × ${num2}`;
      answer = num1 * num2;
      break;
      
    case 'div': {
      // Division is multiplication in reverse
      // Generate components in range, multiply them, divide product
      const a = getRandomInt(range.min, range.max);
      const b = getRandomInt(range.min, range.max);
      const prod = a * b;
      
      // 50% chance of prod / a = b or prod / b = a
      if (Math.random() < 0.5) {
        text = `${prod} ÷ ${a}`;
        answer = b;
      } else {
        text = `${prod} ÷ ${b}`;
        answer = a;
      }
      break;
    }
  }

  state.game.currentQuestion = {
    category: activeOp,
    text: text,
    answer: answer
  };
  
  state.game.questionHadMistake = false;
  state.game.questionStartTime = performance.now();
  
  // Render question text
  el.problemText.textContent = text;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ==========================================================================
   GAME LOOP CONTROLLERS
   ========================================================================== */

function startGame() {
  // Ensure AudioContext is initialized (browser policy triggers on user click)
  initAudio();
  
  // Reset Game variables
  state.game.isPlaying = true;
  state.game.timeLeft = state.settings.duration;
  state.game.score = 0;
  state.game.totalQuestionsSolved = 0;
  state.game.mistakeCount = 0;
  state.game.log = [];
  
  // Setup inputs
  el.scoreVal.textContent = '0';
  el.timerVal.textContent = state.game.timeLeft;
  el.timerVal.classList.remove('timer-warning');
  el.answerInput.value = '';
  
  // Transition View
  showPanel(el.gamePanel);
  
  // Focus answer input immediately
  setTimeout(() => el.answerInput.focus(), 150);
  
  // Generate first question
  generateQuestion();
  
  // Start 1s interval timer
  if (state.game.timer) clearInterval(state.game.timer);
  state.game.timer = setInterval(tick, 1000);

  // Restart speech if Voice Mode is active
  if (state.voice.enabled && state.voice.recognition && !state.voice.isListening) {
    startListening();
  }
}

function tick() {
  state.game.timeLeft--;
  el.timerVal.textContent = state.game.timeLeft;
  
  // Under 10 seconds warning
  if (state.game.timeLeft <= 10) {
    el.timerVal.classList.add('timer-warning');
  }
  
  if (state.game.timeLeft <= 0) {
    endGame(false);
  }
}

function handleCorrectAnswer() {
  const endTime = performance.now();
  const timeTaken = (endTime - state.game.questionStartTime) / 1000; // in seconds
  
  // Log statistics
  state.game.log.push({
    category: state.game.currentQuestion.category,
    duration: timeTaken,
    hadMistake: state.game.questionHadMistake,
    secondResolved: state.settings.duration - state.game.timeLeft
  });
  
  if (state.game.questionHadMistake) {
    state.game.mistakeCount++;
  }
  
  // Score mechanics
  state.game.score++;
  state.game.totalQuestionsSolved++;
  el.scoreVal.textContent = state.game.score;
  
  // Sound Feedback (Rising major fifth synth beep)
  if (state.audio.enabled) {
    playSuccessBeep();
  }
  
  // Visual feedback flash
  el.answerInput.classList.add('input-success');
  setTimeout(() => {
    el.answerInput.classList.remove('input-success');
  }, 200);
  
  // Reset fields & generate next
  el.answerInput.value = '';
  generateQuestion();
}

function endGame(wasQuitted = false) {
  state.game.isPlaying = false;
  if (state.game.timer) clearInterval(state.game.timer);
  
  // Halt microphone if listening
  if (state.voice.isListening) {
    stopListening();
  }
  
  if (wasQuitted) {
    showPanel(el.settingsPanel);
    return;
  }
  
  // Process analytics and render
  processAnalytics();
  showPanel(el.resultsPanel);
}

// Seamless slide/fade panel navigation
function showPanel(panelToShow) {
  const panels = [el.settingsPanel, el.gamePanel, el.resultsPanel];
  panels.forEach(p => {
    if (p === panelToShow) {
      p.style.display = 'block';
    } else {
      p.style.display = 'none';
    }
  });
}

/* ==========================================================================
   WEB AUDIO API SOUND GENERATOR
   ========================================================================== */

function initAudio() {
  if (!state.audio.context) {
    state.audio.context = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audio.context.state === 'suspended') {
    state.audio.context.resume();
  }
}

function playBeep(frequency, duration) {
  if (!state.audio.context) return;
  
  try {
    const osc = state.audio.context.createOscillator();
    const gainNode = state.audio.context.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(state.audio.context.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, state.audio.context.currentTime);
    
    // Smooth envelope decay to avoid sharp clicks
    gainNode.gain.setValueAtTime(0.04, state.audio.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, state.audio.context.currentTime + duration);
    
    osc.start();
    osc.stop(state.audio.context.currentTime + duration);
  } catch (err) {
    console.error('Sound generation failed', err);
  }
}

function playSuccessBeep() {
  // A ultra-premium dual synth beep (523Hz -> 784Hz)
  playBeep(650, 0.08);
  setTimeout(() => {
    if (state.game.isPlaying && state.audio.enabled) {
      playBeep(980, 0.12);
    }
  }, 40);
}

/* ==========================================================================
   WEB SPEECH API & VOICE PARSING (VOICE MODE)
   ========================================================================== */

function initVoiceMode() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    // Hide or disable voice capability on non-supporting browsers
    el.voiceToggleBtn.disabled = true;
    el.voiceStatusText.textContent = 'Voice Mode (Not supported in browser)';
    el.voiceToggleBtn.title = 'Web Speech Recognition is not supported by your browser. Please use Chrome or Safari.';
    return;
  }
  
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = 'en-US';
  
  state.voice.recognition = rec;
  
  // Toggle listener
  el.voiceToggleBtn.addEventListener('click', () => {
    if (state.voice.isListening) {
      state.voice.enabled = false;
      stopListening();
    } else {
      initAudio(); // Enable audio context
      state.voice.enabled = true;
      startListening();
    }
  });

  // Speech processing events
  rec.onstart = () => {
    state.voice.isListening = true;
    el.voiceToggleBtn.setAttribute('aria-pressed', 'true');
    el.voiceToggleBtn.querySelector('.mic-wave').style.display = 'block';
    el.voiceStatusText.textContent = 'Voice Mode: Listening';
    el.voiceTranscriptLog.style.display = 'flex';
    el.transcriptVal.textContent = 'Speak now...';
    state.voice.lastProcessedIndex = -1;
  };
  
  rec.onresult = (event) => {
    if (!state.game.isPlaying) return;
    
    let interimTranscript = '';
    let resultIndex = event.resultIndex;
    
    // Check if we've already resolved a question in this segment to prevent duplicate triggers
    if (resultIndex <= state.voice.lastProcessedIndex) {
      return;
    }
    
    for (let i = resultIndex; i < event.results.length; ++i) {
      const transcriptSeg = event.results[i][0].transcript;
      interimTranscript += transcriptSeg;
      
      // Parse speech chunk
      const spokenNumber = parseNumberFromText(transcriptSeg);
      
      if (spokenNumber !== null) {
        el.transcriptVal.textContent = `${spokenNumber} ("${transcriptSeg.trim()}")`;
        
        // Match evaluation
        const targetAns = state.game.currentQuestion.answer;
        if (spokenNumber === targetAns) {
          state.voice.lastProcessedIndex = i; // Lock this segment
          handleCorrectAnswer();
          break;
        }
      } else {
        el.transcriptVal.textContent = transcriptSeg.trim() || '...';
      }
    }
  };
  
  rec.onerror = (event) => {
    console.error('Speech Recognition Error', event.error);
    if (event.error === 'not-allowed') {
      alert('Microphone permission was denied. Please allow microphone access to use Voice Mode.');
      state.voice.enabled = false;
      stopListening();
    }
  };
  
  rec.onend = () => {
    state.voice.isListening = false;
    // Reconnect recognition automatically if user did not explicitly toggle off and game is playing
    if (state.voice.enabled && state.game.isPlaying) {
      try {
        state.voice.recognition.start();
      } catch (err) {
        console.warn('Re-start of SpeechRecognition failed', err);
      }
    } else {
      el.voiceToggleBtn.setAttribute('aria-pressed', 'false');
      el.voiceToggleBtn.querySelector('.mic-wave').style.display = 'none';
      el.voiceStatusText.textContent = 'Enable Voice Mode';
      el.voiceTranscriptLog.style.display = 'none';
    }
  };
}

function startListening() {
  if (!state.voice.recognition) return;
  try {
    state.voice.recognition.start();
  } catch (err) {
    console.warn('Speech start error', err);
  }
}

function stopListening() {
  if (!state.voice.recognition) return;
  state.voice.recognition.stop();
}

/**
 * Robust double-layered speech number extractor.
 * Extracts standard digits or offline spoken word structures.
 */
function parseNumberFromText(text) {
  if (!text) return null;
  text = text.toLowerCase().replace(/and/g, ' ').replace(/-/g, ' ').trim();
  
  // 1. Direct Regex Digit Extraction (e.g. "forty five" -> "45")
  const digitMatch = text.match(/\d+/);
  if (digitMatch) {
    return parseInt(digitMatch[0], 10);
  }
  
  // 2. Custom Offline word-to-number dictionary parser fallback
  const units = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16,
    'seventeen': 17, 'eighteen': 18, 'nineteen': 19
  };
  const tens = {
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
  };
  const scales = {
    'hundred': 100, 'thousand': 1000
  };
  
  const words = text.split(/\s+/);
  let total = 0;
  let current = 0;
  let hasValue = false;
  
  for (let word of words) {
    if (units[word] !== undefined) {
      current += units[word];
      hasValue = true;
    } else if (tens[word] !== undefined) {
      current += tens[word];
      hasValue = true;
    } else if (scales[word] !== undefined) {
      let scale = scales[word];
      if (scale === 100) {
        current = (current || 1) * 100;
      } else {
        total += (current || 1) * scale;
        current = 0;
      }
      hasValue = true;
    }
  }
  
  return hasValue ? (total + current) : null;
}

/* ==========================================================================
   ANALYTICS GENERATOR & SHADCN CHART DRAWING
   ========================================================================== */

function processAnalytics() {
  const duration = state.settings.duration;
  const log = state.game.log;
  const solvedCount = state.game.totalQuestionsSolved;
  
  // 1. Calculate General Scoreboard Details
  el.summaryScore.textContent = solvedCount;
  
  const ppm = solvedCount > 0 ? ((solvedCount / duration) * 60).toFixed(1) : '0.0';
  el.summaryPPM.textContent = ppm;
  
  // Accuracy percentage mapping (questions solved with zero mistakes vs total resolved)
  const perfectQuestions = solvedCount - state.game.mistakeCount;
  const accuracy = solvedCount > 0 ? Math.round((perfectQuestions / solvedCount) * 100) : 100;
  el.summaryAccuracy.textContent = `${accuracy}%`;
  
  // 2. Build Category Table Data Breakdown
  // Categories: add, sub, mul, div
  const categories = {
    add: { name: 'Addition', count: 0, totalTime: 0, class: 'add' },
    sub: { name: 'Subtraction', count: 0, totalTime: 0, class: 'sub' },
    mul: { name: 'Multiplication', count: 0, totalTime: 0, class: 'mul' },
    div: { name: 'Division', count: 0, totalTime: 0, class: 'div' }
  };
  
  // Accumulate logs
  log.forEach(item => {
    if (categories[item.category]) {
      categories[item.category].count++;
      categories[item.category].totalTime += item.duration;
    }
  });
  
  // Inject rows (Filtering columns down to Category, Solved, and Avg Speed)
  el.analyticsTableBody.innerHTML = '';
  
  state.settings.operations.forEach(opKey => {
    const data = categories[opKey];
    const avgTime = data.count > 0 ? `${(data.totalTime / data.count).toFixed(2)}s` : '—';
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="op-row-name">
          <span class="op-row-dot ${data.class}"></span>
          ${data.name}
        </div>
      </td>
      <td class="text-right font-semibold">${data.count}</td>
      <td class="text-right font-medium color-secondary">${avgTime}</td>
    `;
    el.analyticsTableBody.appendChild(row);
  });
  
  // 3. Render Shadcn-Style Responsive SVG line chart (PPM consistency)
  renderConsistencyChart();
}

/**
 * Custom SVG chart generator.
 * Employs SVG cubic bezier connections, fine dashed grids, point hover highlights,
 * and custom tooltips to replicate high-end shadcn charts.
 */
function renderConsistencyChart() {
  const duration = state.settings.duration;
  const log = state.game.log;
  
  // Divide duration into 10-second intervals (e.g. 120s -> 12 intervals, 60s -> 6 intervals)
  const intervalSize = 10;
  const numIntervals = Math.max(1, Math.floor(duration / intervalSize));
  
  // Compute resolved count and PPM rate inside each 10s interval
  const intervalCounts = Array(numIntervals).fill(0);
  log.forEach(item => {
    const sec = item.secondResolved;
    // Cap in bounds just in case of slight timing delays
    const idx = Math.min(numIntervals - 1, Math.floor(sec / intervalSize));
    if (idx >= 0) {
      intervalCounts[idx]++;
    }
  });
  
  // Map counts inside intervals to Local PPM (solved_in_interval * 60 / intervalSize)
  const ppmData = intervalCounts.map(count => count * (60 / intervalSize));
  
  // Define SVG canvas coordinates (Responsive rendering aspect ratios)
  const width = 500;
  const height = 220;
  const paddingLeft = 32;
  const paddingRight = 12;
  const paddingTop = 15;
  const paddingBottom = 25;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  // Calculate Axes limits
  // Y Max = max PPM scored, padded upwards (with minimum of 30 PPM for visual consistency)
  const maxVal = Math.max(...ppmData, 30);
  const yMax = Math.ceil(maxVal / 10) * 10; // Round to nearest 10
  
  // 1. Calculate Cartesian Coordinate Points for each interval
  const points = [];
  for (let i = 0; i < numIntervals; i++) {
    const val = ppmData[i];
    
    // X distributes linearly across intervals
    // If only 1 interval, place in center. Otherwise spread.
    const x = paddingLeft + (numIntervals > 1 ? (i / (numIntervals - 1)) * chartWidth : chartWidth / 2);
    // Y scales linearly (SVG coordinate origin is top-left, so subtract from chartHeight)
    const y = paddingTop + chartHeight - (val / yMax) * chartHeight;
    
    points.push({ x, y, val, interval: (i + 1) * intervalSize });
  }
  
  // Build dynamic chart lines path
  let pathD = '';
  let areaD = '';
  
  if (points.length > 0) {
    // Generate simple linear path with high performance
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
    
    // Close area under line for the gradient fill path
    areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }
  
  // Define horizontal grid-lines (Y ticks)
  let yGridHtml = '';
  const numGridLines = 4;
  for (let i = 0; i <= numGridLines; i++) {
    const ratio = i / numGridLines;
    const yVal = Math.round(ratio * yMax);
    const yCoord = paddingTop + chartHeight - ratio * chartHeight;
    
    yGridHtml += `
      <!-- Grid line -->
      <line class="chart-grid-line" x1="${paddingLeft}" y1="${yCoord}" x2="${width - paddingRight}" y2="${yCoord}" stroke-dasharray="3 3" />
      <!-- Y Axis Label -->
      <text class="chart-axis-text" x="${paddingLeft - 8}" y="${yCoord + 3}" text-anchor="end">${yVal}</text>
    `;
  }
  
  // Define horizontal interval markings (X ticks, show every other tick to avoid clutter)
  let xGridHtml = '';
  const step = numIntervals > 8 ? 2 : 1;
  for (let i = 0; i < numIntervals; i += step) {
    const p = points[i];
    xGridHtml += `
      <text class="chart-axis-text" x="${p.x}" y="${height - 8}" text-anchor="middle">${p.interval}s</text>
    `;
  }
  
  // Define coordinate point circle connectors
  let jointsHtml = '';
  points.forEach((p, idx) => {
    jointsHtml += `
      <circle 
        class="chart-line-joint" 
        cx="${p.x}" 
        cy="${p.y}" 
        r="4.5" 
        data-index="${idx}"
        data-x="${p.x}"
        data-y="${p.y}"
        data-val="${p.val.toFixed(0)}"
        data-time="${p.interval}s"
      />
    `;
  });
  
  // Assemble complete inline SVG Document
  const svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" class="svg-chart">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-color)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--accent-color)" stop-opacity="0.00"/>
        </linearGradient>
      </defs>
      
      <!-- Grid System -->
      <g>${yGridHtml}</g>
      <g>${xGridHtml}</g>
      
      <!-- Gradient Area Fill -->
      ${areaD ? `<path d="${areaD}" fill="url(#chartGradient)"></path>` : ''}
      
      <!-- Core Trend Line -->
      ${pathD ? `<path d="${pathD}" class="chart-line"></path>` : ''}
      
      <!-- Joint Dots -->
      <g>${jointsHtml}</g>
    </svg>
    
    <!-- Hover Tooltip overlay element -->
    <div id="graph-tooltip" class="chart-tooltip">
      <span class="tooltip-time" id="tooltip-time">0-10s</span>
      <span class="tooltip-value" id="tooltip-value">0 PPM</span>
    </div>
  `;
  
  el.chartParent.innerHTML = svgHtml;
  
  // Bind hover interactions to joint points
  initChartHoverEvents();
}

function initChartHoverEvents() {
  const joints = el.chartParent.querySelectorAll('.chart-line-joint');
  const tooltip = el.chartParent.querySelector('#graph-tooltip');
  const tTime = tooltip.querySelector('#tooltip-time');
  const tVal = tooltip.querySelector('#tooltip-value');
  
  joints.forEach(joint => {
    joint.addEventListener('mouseover', (e) => {
      const x = parseFloat(joint.getAttribute('data-x'));
      const y = parseFloat(joint.getAttribute('data-y'));
      const val = joint.getAttribute('data-val');
      const time = joint.getAttribute('data-time');
      
      tTime.textContent = `Interval: ${time}`;
      tVal.textContent = `Speed: ${val} PPM`;
      
      // Calculate tooltip position (absolute positioned inside parent container)
      const containerWidth = el.chartParent.clientWidth;
      const svgWidth = 500; // viewBox width
      const scaleRatio = containerWidth / svgWidth;
      
      const px = x * scaleRatio;
      const py = y * scaleRatio;
      
      // Position floating above the circle point
      tooltip.style.left = `${px}px`;
      tooltip.style.top = `${py - 55}px`;
      tooltip.style.transform = `translateX(-50%)`;
      tooltip.style.opacity = '1';
    });
    
    joint.addEventListener('mouseout', () => {
      tooltip.style.opacity = '0';
    });
  });
}
