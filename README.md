# quizmaxxing

A passcode-locked mock quiz site with a Gen Z look. It's plain HTML, CSS and JS with no build step, so it runs on GitHub Pages or straight from the folder.

**Passcode:** `open`. To change it, edit `PASSCODE` at the top of `app.js`. This lock only keeps casual visitors out: anyone who reads the page source can see the passcode.

## Features
- **Quiz library:** search, tag and difficulty filters, sorting, best score on each card, and a "Surprise me" button
- **Two modes:** Exam (answers revealed at the end) and Practice (instant feedback, explanations, combo streaks, 50/50 lifelines)
- **Question types:** single choice, multi-select, true/false, and type-in answers (small typos are accepted)
- **Extras:** optional timer with auto-submit, shuffled questions and answers, quick rounds, hints, flagging, and keyboard shortcuts
- **Results:** animated score, personal-best detection, full answer review with filters, and "retry only the ones I missed"
- **Dashboard:** stats, score trend chart, most-missed questions, per-quiz bests, full history with review and rerun, XP levels and badges
- **Add quiz:** paste JSON or upload a `.json` file in the site. It's saved in that browser.
- **Settings:** sound, confetti and calm mode, backup export/import, progress reset, and a lock button

Scores are saved in the browser's localStorage, so they're per device. Use Settings → Export backup to move them to another device.

## Adding quizzes
Add them to `quizzes.js` so everyone who opens the site sees them. The format is documented at the top of that file:

```js
{ id: "bio-ch3", title: "Biology Ch 3", emoji: "🧬", tags: ["bio"], difficulty: "medium", timeLimit: 300,
  questions: [
    { q: "Powerhouse of the cell?", options: ["Nucleus", "Mitochondria"], answer: 1, explanation: "..." },
    { q: "Pick the organelles", options: ["Golgi", "Glucose", "Lysosome"], answer: [0, 2] },
    { q: "Plant cells have walls.", answer: true },
    { q: "Molecule that carries genes?", answer: ["DNA"] }
  ] }
```

## Hosting on GitHub Pages
Merge into `main`, then go to repo **Settings → Pages → Deploy from a branch → `main` / root**.
