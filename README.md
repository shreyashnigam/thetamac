# Thetamac — Arithmetic Speed Game

<p align="center">
  <strong>A premium, lightning-fast, and minimalist speed-math drill inspired by Zetamac.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-TypeScript-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/Bundler-Vite-646CFF" alt="Vite">
  <img src="https://img.shields.io/badge/Styling-Vanilla_CSS-1572B6" alt="Vanilla CSS">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

---

## ✨ Features

*   🎯 **Customizable Arithmetic Drills:** Configure custom numeric ranges for Addition, Subtraction, Multiplication, and Division.
*   🔄 **Zetamac-Style Reverse Logic:**
    *   **Subtraction** acts as Addition in reverse, guaranteeing clean, positive results.
    *   **Division** acts as Multiplication in reverse, ensuring perfect integer results with no remainders.
    *   *Intelligent Settings Dependency:* Shared range sliders/inputs remain active if either operation utilizing those ranges is checked.
*   📊 **Visual Speed Analytics:** View a detailed performance report with an interactive, responsive SVG line chart detailing your Problems-Per-Minute (PPM) consistency over the duration of your run.
*   🎤 **Hands-Free Voice Mode:** Built-in web speech recognition system allowing users to solve equations entirely using voice dictation with an English word-to-number fallback engine.
*   📱 **Scroll-Free Mobile Experience:** Designed dark-mode-first with high-contrast theme toggles and a fully locked viewport (`position: fixed`) preventing vertical scroll, bounce, or input-focus shifting on mobile.

---

## 🛠️ Technology Stack

*   **Core Logic:** TypeScript (Typed strict configurations)
*   **Module Bundler:** Vite 8+
*   **Layout & Styling:** Responsive Vanilla CSS (CSS Grid, Flexbox, Variable-driven HSL Color Systems)
*   **Speech System:** Native browser `webkitSpeechRecognition` API

---

## 🚀 Getting Started

### 📋 Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### 📥 Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/shreyashnigam/thetamac.git
   cd thetamac
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### ⚡ Development Server

Run the local development server:
```bash
npm run dev
```
Open the provided URL (typically `http://localhost:5173`) in your browser.

### 🏗️ Production Build

To compile and package the project for production, generating a high-performance, tree-shaken browser bundle:
```bash
npm run build
```
You can preview the production bundle locally with:
```bash
npm run preview
```

---

## 📐 Math Rules & Range Logic

*   **Addition:** Operands are selected randomly from their configured bounds: `[add1-min, add1-max]` and `[add2-min, add2-max]`.
*   **Subtraction:** Derived from the Addition bounds. Sum of both operands is calculated, and users solve for one of the original terms, keeping answers non-negative.
*   **Multiplication:** Operands are selected randomly from `[mul1-min, mul1-max]` and `[mul2-min, mul2-max]`.
*   **Division:** Derived from Multiplication bounds. Product is generated, and users divide by one of the multipliers, guaranteeing whole-number outcomes.

---

## 📄 License

This project is licensed under the MIT License.
