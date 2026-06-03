# HSK Vocabulary Master

A single-page web application for studying Chinese vocabulary across HSK 3.0 Levels 1–7. Match Chinese characters to their pinyin and English translations with batched quizzes, spaced repetition, and progress analytics.

## Features

- **Multi-level support** — HSK 3.0 Levels 1 through 7 (10,793 words total), selectable from a level picker with per-level progress tracking
- **Batched study** — Study in sets of 25, 50, 100, or all words at once; navigate between batches freely
- **Dual quiz modes** — Pinyin & English matching, or English-only mode
- **Text-to-speech** — Hear each word pronounced via the Web Speech API (zh-CN)
- **Smart distractors** — Wrong options are drawn from words with similar pinyin, making questions meaningfully challenging
- **Spaced repetition (SRS)** — Leitner box system (boxes 0–5) with escalating intervals; words you get wrong drop to box 0, correct answers advance
- **Wrong-answer review** — Missed words are collected automatically for focused re-practice
- **Daily streaks** — Consecutive study days tracked with milestone celebrations
- **Daily goal** — Configurable question-per-day target with a progress bar
- **Progress analytics** — Accuracy trends and daily volume charts (Chart.js), batch completion grid, SRS box distribution
- **Progress persistence** — All state saved to localStorage; resume exactly where you left off
- **Share & sync** — Export/import progress as JSON, share via URL with QR code, or transfer with a 6-character sync code
- **Dark & light themes** — Toggle with persistent preference
- **Keyboard shortcuts** — Keys 1–4 select options, Escape closes modals
- **Mobile-first design** — Responsive layout with safe-area insets, touch-optimized targets, and installable PWA behaviour

## Quick Start

### Live demo
```
https://hhhpraise.github.io/hsk-quiz/
```

### Run locally
```bash
git clone https://github.com/hhhpraise/hsk-quiz.git
cd hsk-quiz
open index.html          # macOS
# or
start index.html         # Windows
# or serve with Python
python -m http.server 8000
```

Open `http://localhost:8000` in a browser.

## How It Works

1. Pick an HSK level on the landing screen
2. Choose a batch size and quiz mode (Pinyin or English-only)
3. Read the Chinese character and select the correct translation from four options
4. Get instant visual feedback — correct answers advance you in SRS, wrong answers queue the word for review
5. Complete a batch to see your accuracy; all batches done unlocks full completion

Missed words accumulate in the **Review** queue. The **SRS panel** surfaces words due for spaced-repetition review each day.

## Tech Stack

- Vanilla JavaScript — no frameworks
- CSS custom properties for theming
- Chart.js for analytics charts
- QR Code Generator for share links
- LZ-String for URL-safe progress compression
- Font Awesome 6 for icons
- localStorage for all persistence

## Browser Support

Chrome/Edge 88+, Firefox 85+, Safari 14+, and modern mobile browsers.

## License

MIT
