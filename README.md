# quizmaxxing

A passcode-locked mock quiz site with a Gen Z look. It's plain HTML, CSS and JS with no build step, hosted on GitHub Pages at <https://pgp42196-art.github.io/Courses/>.

**Passcode:** `open`. With online sync set up, the passcode is checked by Supabase and never appears in the code. In local mode it's `PASSCODE` at the top of `app.js`, which anyone reading the page source can see.

## Features
- **Quiz library:** search, tag and difficulty filters, sorting, best score on each card, and a "Surprise me" button
- **Two modes:** Exam (answers revealed at the end) and Practice (instant feedback, explanations, combo streaks, 50/50 lifelines)
- **Question types:** single choice, multi-select, true/false, and type-in answers (small typos are accepted)
- **Extras:** optional timer with auto-submit, shuffled questions and answers, quick rounds, hints, flagging, and keyboard shortcuts
- **Results:** animated score, personal-best detection, full answer review with filters, and "retry only the ones I missed"
- **Dashboard:** stats, score trend chart, most-missed questions, per-quiz bests, full history with review and rerun, XP levels and badges
- **Add quiz:** paste JSON or upload a `.json` file in the site. It's saved in that browser.
- **Settings:** sound, confetti and calm mode, backup export/import, progress reset, and a lock button

- **✨ AI maker:** paste questions, notes, a chapter or just a topic (or attach PDFs and screenshots). Claude turns it into a quiz, marks any answers it had to work out itself, and you publish it with one tap.
- **Online sync:** once Supabase is set up (below), scores, quizzes and settings sync across every device. The passcode is checked by the server, so it's real protection.

## Go fully online (about 10 minutes, free)
Until this is done the site runs in **local mode**: the passcode is checked in the page and progress stays in one browser.

1. **Make a Supabase project.** Sign up at <https://supabase.com> and click **New project**. Any name and database password is fine.
2. **Create the tables.** Open **SQL Editor → New query**, paste everything from [`supabase-setup.sql`](supabase-setup.sql), and click **Run**.
3. **Create your login.** Go to **Authentication → Users → Add user → Create new user**.
   - Email: any email you like (it's only used as a username)
   - Password: `quizmaxxing-open` (that's `quizmaxxing-` + your passcode)
   - Tick **Auto Confirm User**
4. **Copy your keys.** Open **Project Settings → API** (on newer dashboards: **Data API** for the URL and **API Keys** for the key). Copy the **Project URL** and the **anon / publishable** key.
5. **Fill in `config.js`** with the URL, the key, and the email from step 3, then push. Or send all three to Claude and it'll do it for you.

After that the passcode is still `open`. Change it any time in **Settings → Change passcode**. Anything you already did in local mode gets uploaded the first time you log in.

## AI maker setup
The AI maker uses your own Claude API key. Create one at <https://platform.claude.com/settings/keys> and add a little credit under Billing. A quiz usually costs a few cents. Paste the key on the AI maker tab. With online sync on, it's stored in your database (only your login can read it) and works on all your devices.

No API key? Tap **Copy prompt for Claude.ai**, paste it into a normal Claude chat with your material, and paste the reply into **Add quiz**.

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

## Hosting
GitHub Pages deploys from the `claude/zealous-wozniak-c0sx1b` branch (repo **Settings → Pages**). Every push updates the site within a minute.

`vendor/` holds pinned copies of `@supabase/supabase-js` 2.117.2 and a browser bundle of `@anthropic-ai/sdk` 0.131.0, so the site doesn't depend on a CDN.
