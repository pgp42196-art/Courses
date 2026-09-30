(() => {
  "use strict";

  // Passcode to open the site. Change it here.
  // Note: this is a vibe lock, not real security. Anyone who reads the page source can see it.
  const PASSCODE = "open";

  const KEY = "quizmaxxing.v1";
  const UNLOCK_KEY = "quizmaxxing.unlocked";
  const ACCENTS = ["var(--pink)", "var(--lilac)", "var(--cyan)", "var(--lime)", "var(--warn)"];
  const LETTERS = "ABCDEFGHIJ";

  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $("#app");

  /* ---------------- storage ---------------- */
  const safe = {
    get(store, k) { try { return store.getItem(k); } catch { return null; } },
    set(store, k, v) { try { store.setItem(k, v); return true; } catch { return false; } },
    del(store, k) { try { store.removeItem(k); } catch { /* ignore */ } }
  };
  const ls = (() => { try { return window.localStorage; } catch { return null; } })();
  const ss = (() => { try { return window.sessionStorage; } catch { return null; } })();

  const defaults = () => ({
    attempts: [],
    custom: [],
    prefs: {},
    settings: { sound: true, confetti: true, calm: false }
  });
  let db = defaults();
  function load() {
    const raw = ls && safe.get(ls, KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      db = Object.assign(defaults(), parsed);
      db.settings = Object.assign(defaults().settings, parsed.settings || {});
    } catch { /* corrupted, start fresh */ }
  }
  function save() {
    if (!ls || !safe.set(ls, KEY, JSON.stringify(db))) {
      toast("Couldn't save to this browser (storage is blocked or full).");
    }
  }

  /* ---------------- text helpers ---------------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (s) => esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?;:'"`()]/g, "").replace(/\s+/g, " ").trim();
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const clock = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const scoreClass = (p) => (p >= 80 ? "s-top" : p >= 50 ? "s-mid" : "s-low");
  const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; };
  const niceDate = (iso) => {
    const d = new Date(iso), now = new Date();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (dayKey(d) === dayKey(now)) return `Today ${time}`;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (dayKey(d) === dayKey(y)) return `Yesterday ${time}`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + time;
  };
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const hashIdx = (s, n) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % n; };
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  }

  /* ---------------- quiz data ---------------- */
  function normalizeQuiz(raw, where) {
    const at = where ? ` (${where})` : "";
    if (!raw || typeof raw !== "object") throw new Error(`Quiz${at} must be an object with a title and questions.`);
    if (!raw.title) throw new Error(`Quiz${at} is missing a "title".`);
    if (!Array.isArray(raw.questions) || !raw.questions.length) throw new Error(`"${raw.title}" needs a "questions" list with at least one question.`);
    const id = String(raw.id || raw.title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const questions = raw.questions.map((q, i) => normalizeQuestion(q, `"${raw.title}" question ${i + 1}`));
    return {
      id,
      title: String(raw.title),
      emoji: raw.emoji || "📝",
      description: raw.description || "",
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      difficulty: ["easy", "medium", "hard"].includes(raw.difficulty) ? raw.difficulty : "",
      timeLimit: Number(raw.timeLimit) > 0 ? Math.round(Number(raw.timeLimit)) : 0,
      sample: !!raw.sample,
      questions
    };
  }
  function normalizeQuestion(q, where) {
    if (!q || typeof q !== "object") throw new Error(`${where} must be an object.`);
    const text = q.q ?? q.question;
    if (!text) throw new Error(`${where} is missing its text ("q").`);
    const base = { q: String(text), explanation: q.explanation ? String(q.explanation) : "", hint: q.hint ? String(q.hint) : "" };
    let { answer } = q;
    if (answer === undefined) throw new Error(`${where} is missing "answer".`);
    if (typeof answer === "boolean") {
      return { ...base, type: "tf", options: ["True", "False"], answer: [answer ? 0 : 1] };
    }
    if (Array.isArray(q.options) && q.options.length) {
      const options = q.options.map(String);
      const toIdx = (a) => {
        if (typeof a === "number") return a;
        if (/^\d+$/.test(String(a))) return Number(a);
        const found = options.findIndex((o) => norm(o) === norm(a));
        return found;
      };
      const multi = Array.isArray(answer);
      const idx = (multi ? answer : [answer]).map(toIdx);
      if (idx.some((n) => n < 0 || n >= options.length || !Number.isInteger(n))) {
        throw new Error(`${where}: "answer" must be the position of a real option (0 = first option).`);
      }
      if (options.length < 2) throw new Error(`${where} needs at least 2 options.`);
      return { ...base, type: multi ? "multi" : "single", options, answer: [...new Set(idx)].sort((a, b) => a - b) };
    }
    const accepted = (Array.isArray(answer) ? answer : [answer]).map(String).filter((s) => s.trim());
    if (!accepted.length) throw new Error(`${where}: type-in answers can't be empty.`);
    return { ...base, type: "text", options: [], answer: accepted };
  }

  let builtIn = [];
  let builtInErrors = [];
  function loadBuiltIn() {
    builtIn = []; builtInErrors = [];
    (Array.isArray(window.QUIZ_DATA) ? window.QUIZ_DATA : []).forEach((raw, i) => {
      try { builtIn.push(normalizeQuiz(raw, `quizzes.js #${i + 1}`)); }
      catch (e) { builtInErrors.push(e.message); console.warn(e.message); }
    });
  }
  const allQuizzes = () => [
    ...builtIn,
    ...db.custom.map((c) => { try { return { ...normalizeQuiz(c), custom: true }; } catch { return null; } }).filter(Boolean)
  ];
  const findQuiz = (id) => allQuizzes().find((q) => q.id === id);

  function isCorrect(q, given) {
    if (given === undefined || given === null) return false;
    if (q.type === "text") {
      const g = norm(given);
      if (!g) return false;
      return q.answer.some((a) => { const n = norm(a); return n === g || (n.length >= 5 && lev(n, g) <= 1); });
    }
    const arr = Array.isArray(given) ? given.slice().sort((a, b) => a - b) : [given];
    return arr.length === q.answer.length && arr.every((v, i) => v === q.answer[i]);
  }
  const hasAnswer = (q, given) => q.type === "text" ? !!String(given ?? "").trim() : Array.isArray(given) ? given.length > 0 : given !== undefined && given !== null;
  const answerText = (q, idxOrText) => {
    if (q.type === "text") return String(idxOrText ?? "");
    const arr = Array.isArray(idxOrText) ? idxOrText : [idxOrText];
    return arr.map((i) => q.options[i]).join(", ");
  };

  /* ---------------- stats / xp ---------------- */
  function levelInfo(xp) {
    let lvl = 1, need = 100, left = xp;
    while (left >= need) { left -= need; lvl++; need = Math.round(need * 1.25); }
    return { lvl, into: left, need };
  }
  const totalXp = () => db.attempts.reduce((s, a) => s + (a.xp || 0), 0);
  function dayStreak() {
    const days = new Set(db.attempts.map((a) => dayKey(a.date)));
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const fullRuns = (quizId) => db.attempts.filter((a) => a.quizId === quizId && a.kind === "full");
  const bestFor = (quizId) => { const r = fullRuns(quizId); return r.length ? Math.max(...r.map((a) => a.pct)) : null; };

  const ACHIEVEMENTS = [
    { id: "first", e: "🐣", name: "First blood", desc: "Finish your first quiz", test: (A) => A.length >= 1 },
    { id: "perfect", e: "👑", name: "Flawless", desc: "Score 100% on a full quiz", test: (A) => A.some((a) => a.kind === "full" && a.pct === 100) },
    { id: "combo5", e: "🔥", name: "On fire", desc: "Get a 5-answer streak", test: (A) => A.some((a) => a.bestStreak >= 5) },
    { id: "ten", e: "🧃", name: "Locked in", desc: "Finish 10 quizzes", test: (A) => A.length >= 10 },
    { id: "streak3", e: "📆", name: "Daily grind", desc: "Quiz 3 days in a row", test: () => dayStreak() >= 3 },
    { id: "comeback", e: "📈", name: "Glow up", desc: "Beat your old score on a quiz by 25+ points", test: (A) => {
      const by = {};
      return A.filter((a) => a.kind === "full").some((a) => {
        const prev = by[a.quizId];
        by[a.quizId] = Math.min(prev ?? 101, a.pct);
        return prev !== undefined && a.pct - prev >= 25;
      });
    } },
    { id: "speed", e: "⚡", name: "Speedrun", desc: "80%+ on a full quiz, under 8s per question", test: (A) => A.some((a) => a.kind === "full" && a.pct >= 80 && a.timeSec / a.total < 8) },
    { id: "owl", e: "🦉", name: "Night owl", desc: "Finish a quiz between midnight and 4am", test: (A) => A.some((a) => new Date(a.date).getHours() < 4) }
  ];
  const unlockedIds = () => new Set(ACHIEVEMENTS.filter((x) => x.test(db.attempts.slice().reverse())).map((x) => x.id));

  const TIERS = [
    [100, "flawless. you ate. 👑", "no crumbs left"],
    [90, "absolutely ate 💅", "one or two slips, still iconic"],
    [75, "lowkey goated 🐐", "solid run, a little polish and it's perfect"],
    [60, "passing, but make it mid 😌", "you got this, run it back"],
    [40, "kinda cooked 🍳", "review the misses and try again"],
    [0, "fully cooked 💀", "it's okay bestie, retry the wrong ones"]
  ];
  const tierFor = (p) => TIERS.find(([min]) => p >= min);

  /* ---------------- sound ---------------- */
  let actx = null;
  function beep(notes) {
    if (!db.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime;
      notes.forEach(([freq, dur, type = "triangle", vol = 0.12]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(actx.destination);
        o.start(t); o.stop(t + dur);
        t += dur * 0.7;
      });
    } catch { /* no audio, no problem */ }
  }
  const sfx = {
    tap: () => beep([[660, 0.05, "sine", 0.05]]),
    right: () => beep([[660, 0.09], [990, 0.16]]),
    wrong: () => beep([[190, 0.22, "sawtooth", 0.06]]),
    combo: () => beep([[660, 0.07], [880, 0.07], [1320, 0.18]]),
    done: () => beep([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]]),
    unlock: () => beep([[440, 0.08], [880, 0.2]])
  };

  /* ---------------- confetti ---------------- */
  const canvas = $("#confetti");
  const cctx = canvas.getContext("2d");
  let bits = [], raf = 0;
  function confetti(n = 140) {
    if (!db.settings.confetti || db.settings.calm || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
    const cols = ["#ff4fa3", "#9b7bff", "#52eeff", "#c8ff4d", "#ffc94d"];
    for (let i = 0; i < n; i++) {
      bits.push({
        x: canvas.width * (0.2 + Math.random() * 0.6), y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 26 * devicePixelRatio, vy: (-Math.random() * 22 - 8) * devicePixelRatio,
        s: (6 + Math.random() * 8) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: cols[i % cols.length], life: 0
      });
    }
    if (!raf) tick();
  }
  function tick() {
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    bits = bits.filter((b) => b.life < 200 && b.y < canvas.height + 40);
    bits.forEach((b) => {
      b.life++; b.vy += 0.7 * devicePixelRatio; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      cctx.save(); cctx.translate(b.x, b.y); cctx.rotate(b.r); cctx.fillStyle = b.c;
      cctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); cctx.restore();
    });
    raf = bits.length ? requestAnimationFrame(tick) : 0;
    if (!raf) cctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* ---------------- toast + modal ---------------- */
  function toast(msg, ms = 2600) {
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    $("#toast-root").appendChild(el);
    setTimeout(() => el.remove(), ms);
  }
  let modalKeyHandler = null;
  function openModal(html, onMount) {
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal-back" data-close-back><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const back = root.firstElementChild;
    back.addEventListener("click", (e) => { if (e.target === back) closeModal(); });
    modalKeyHandler = (e) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", modalKeyHandler);
    onMount && onMount(back.firstElementChild);
    const first = back.querySelector("[autofocus], button, input");
    first && first.focus();
  }
  function closeModal() {
    $("#modal-root").innerHTML = "";
    if (modalKeyHandler) document.removeEventListener("keydown", modalKeyHandler);
    modalKeyHandler = null;
  }
  const isModalOpen = () => !!$("#modal-root").firstElementChild;
  function confirmBox({ title, body, yes = "Yes", no = "Cancel", danger = false, onYes }) {
    openModal(`
      <h2>${esc(title)}</h2>
      <p class="muted">${esc(body)}</p>
      <div class="modal-actions">
        <button class="btn ghost" data-m="no">${esc(no)}</button>
        <button class="btn ${danger ? "danger" : "lime"}" data-m="yes" autofocus>${esc(yes)}</button>
      </div>`, (m) => {
      m.querySelector('[data-m="no"]').onclick = closeModal;
      m.querySelector('[data-m="yes"]').onclick = () => { closeModal(); onYes(); };
    });
  }

  /* ---------------- gate ---------------- */
  const isUnlocked = () => (ss && safe.get(ss, UNLOCK_KEY) === "1") || (ls && safe.get(ls, UNLOCK_KEY) === "1");
  function renderGate() {
    document.title = "Quizmaxxing";
    app.innerHTML = `
      <section class="gate">
        <div class="gate-card" id="gate-card">
          <div class="lock" aria-hidden="true">🔐</div>
          <div class="sticker" style="justify-self:center">members only</div>
          <h1>quiz<span class="hl-pink">maxxing</span></h1>
          <p class="muted">Drop the passcode to get in.</p>
          <form id="gate-form" autocomplete="off">
            <label class="label" for="pass">Passcode</label>
            <input class="field center" id="pass" type="password" placeholder="••••" autofocus>
            <label class="toggle-row" style="border:0;padding:4px 0;justify-content:center;gap:10px;cursor:pointer">
              <span class="switch"><input type="checkbox" id="remember"><i></i></span>
              <small class="muted">Remember this device</small>
            </label>
            <button class="btn lime big" type="submit">Let me in →</button>
            <div class="err" id="gate-err" role="alert"></div>
          </form>
        </div>
      </section>`;
    const form = $("#gate-form");
    $("#pass").focus();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = $("#pass").value.trim().toLowerCase();
      if (val === PASSCODE.toLowerCase()) {
        ss && safe.set(ss, UNLOCK_KEY, "1");
        if ($("#remember").checked && ls) safe.set(ls, UNLOCK_KEY, "1");
        sfx.unlock(); confetti(90);
        route();
      } else {
        sfx.wrong();
        const card = $("#gate-card");
        card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
        $("#gate-err").textContent = val ? "Nope, wrong passcode. Try again." : "Type the passcode first.";
        $("#pass").select();
      }
    });
  }
  function lockNow() {
    ss && safe.del(ss, UNLOCK_KEY); ls && safe.del(ls, UNLOCK_KEY);
    stopTimer(); session = null;
    renderGate();
  }

  /* ---------------- shell ---------------- */
  const TABS = [["quizzes", "Quizzes"], ["dashboard", "Dashboard"], ["add", "Add quiz"], ["settings", "Settings"]];
  function shell(active, inner) {
    const xp = totalXp(), L = levelInfo(xp);
    return `
      <header class="topbar"><div class="topbar-inner">
        <a class="logo" href="#quizzes">quiz<b>maxxing</b></a>
        <nav class="tabs" aria-label="Main">
          ${TABS.map(([id, label]) => `<a class="tab" href="#${id}" ${id === active ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
        </nav>
        <div class="lvl" title="${xp} XP total">
          <span class="lvl-badge">LV ${L.lvl}</span>
          <span class="lvl-bar" aria-hidden="true"><i style="width:${pct(L.into, L.need)}%"></i></span>
          <span class="mono muted">${L.into}/${L.need} XP</span>
        </div>
      </div></header>
      <div class="wrap">${inner}</div>`;
  }

  function currentTab() {
    const h = location.hash.replace("#", "");
    return TABS.some(([id]) => id === h) ? h : "quizzes";
  }
  function route() {
    if (!isUnlocked()) return renderGate();
    if (session) return renderPlayer();
    closeModal();
    const tab = currentTab();
    ({ quizzes: renderLibrary, dashboard: renderDashboard, add: renderAdd, settings: renderSettings })[tab]();
    document.title = `Quizmaxxing · ${TABS.find(([id]) => id === tab)[1]}`;
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => {
    if (session && !session.done) {
      const target = location.hash;
      history.replaceState(null, "", "#quizzes");
      askQuit(() => { location.hash = target; route(); });
      return;
    }
    session = null;
    route();
  });

  /* ---------------- library ---------------- */
  const lib = { q: "", tag: "", diff: "", sort: "default" };
  function renderLibrary() {
    const quizzes = allQuizzes();
    const tags = [...new Set(quizzes.flatMap((q) => q.tags))].sort();
    const filtered = quizzes.filter((q) => {
      if (lib.tag && !q.tags.includes(lib.tag)) return false;
      if (lib.diff && q.difficulty !== lib.diff) return false;
      if (lib.q) {
        const hay = norm(`${q.title} ${q.description} ${q.tags.join(" ")}`);
        if (!hay.includes(norm(lib.q))) return false;
      }
      return true;
    });
    const sorters = {
      default: () => 0,
      az: (a, b) => a.title.localeCompare(b.title),
      played: (a, b) => fullRuns(b.id).length - fullRuns(a.id).length,
      weak: (a, b) => (bestFor(a.id) ?? -1) - (bestFor(b.id) ?? -1)
    };
    filtered.sort(sorters[lib.sort] || sorters.default);

    const cards = filtered.map((q) => {
      const runs = db.attempts.filter((a) => a.quizId === q.id);
      const best = bestFor(q.id);
      const accent = ACCENTS[hashIdx(q.id, ACCENTS.length)];
      return `
        <article class="qcard" style="--accent:${accent}">
          ${runs.length ? "" : '<span class="badge-new">NEW</span>'}
          <div class="qcard-top">
            <div class="qemoji" aria-hidden="true">${esc(q.emoji)}</div>
            <div style="min-width:0;display:grid;gap:4px">
              <h3>${esc(q.title)}</h3>
              <span class="label">${q.questions.length} questions${q.timeLimit ? ` · ${clock(q.timeLimit)} timer` : ""}</span>
            </div>
          </div>
          ${q.description ? `<p class="desc">${fmt(q.description)}</p>` : ""}
          <div class="meta">
            ${q.difficulty ? `<span class="chip ${q.difficulty}">${q.difficulty}</span>` : ""}
            ${q.custom ? '<span class="chip">added by you</span>' : ""}
            ${q.tags.map((t) => `<span class="chip">#${esc(t)}</span>`).join("")}
          </div>
          <div class="best">
            ${best === null
              ? `<span class="muted">${runs.length ? `${runs.length} practice run${runs.length > 1 ? "s" : ""}, no full run yet` : "Not attempted yet"}</span><strong class="muted">–</strong>`
              : `<span>Best of ${fullRuns(q.id).length} run${fullRuns(q.id).length > 1 ? "s" : ""}</span><strong><span class="score-pill ${scoreClass(best)}">${best}%</span></strong>`}
          </div>
          <div class="qcard-actions">
            <button class="btn lime" data-act="setup" data-id="${esc(q.id)}">${runs.length ? "Run it back ↻" : "Take quiz →"}</button>
            <button class="btn ghost sm" data-act="quickpractice" data-id="${esc(q.id)}" title="Practice mode with instant feedback">Practice</button>
          </div>
        </article>`;
    }).join("");

    app.innerHTML = shell("quizzes", `
      <div class="view-head">
        <div>
          <span class="sticker">the quiz drop</span>
          <h1>Pick a quiz, <span class="hl-lime">lock in.</span></h1>
          <p class="muted">${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"} loaded · ${db.attempts.length} attempt${db.attempts.length === 1 ? "" : "s"} so far</p>
        </div>
        <button class="btn pink" data-act="random" ${quizzes.length ? "" : "disabled"}>🎲 Surprise me</button>
      </div>
      ${builtInErrors.length ? `<div class="hint"><b>Some quizzes in quizzes.js couldn't load:</b><br>${builtInErrors.map(esc).join("<br>")}</div>` : ""}
      <div class="toolbar">
        <input class="field" id="lib-search" type="search" placeholder="Search quizzes…" value="${esc(lib.q)}" aria-label="Search quizzes">
        <select class="field" id="lib-diff" aria-label="Difficulty">
          <option value="">Any difficulty</option>
          ${["easy", "medium", "hard"].map((d) => `<option value="${d}" ${lib.diff === d ? "selected" : ""}>${d}</option>`).join("")}
        </select>
        <select class="field" id="lib-sort" aria-label="Sort">
          <option value="default" ${lib.sort === "default" ? "selected" : ""}>Default order</option>
          <option value="az" ${lib.sort === "az" ? "selected" : ""}>A → Z</option>
          <option value="played" ${lib.sort === "played" ? "selected" : ""}>Most played</option>
          <option value="weak" ${lib.sort === "weak" ? "selected" : ""}>Needs work first</option>
        </select>
      </div>
      ${tags.length ? `<div class="chips">
        <button class="chip" data-act="tag" data-tag="" aria-pressed="${!lib.tag}">all</button>
        ${tags.map((t) => `<button class="chip" data-act="tag" data-tag="${esc(t)}" aria-pressed="${lib.tag === t}">#${esc(t)}</button>`).join("")}
      </div>` : ""}
      ${filtered.length ? `<div class="grid">${cards}</div>` : `
        <div class="empty">
          <div class="big-emoji">🫥</div>
          <h3>${quizzes.length ? "Nothing matches that filter" : "No quizzes yet"}</h3>
          <p>${quizzes.length ? "Try another search or tag." : "Add one from the Add quiz tab."}</p>
          ${quizzes.length ? '<button class="btn sm" data-act="clearfilters">Clear filters</button>' : '<a class="btn lime sm" href="#add">Add a quiz</a>'}
        </div>`}
    `);

    const search = $("#lib-search");
    search.addEventListener("input", () => {
      lib.q = search.value;
      const pos = search.selectionStart;
      renderLibrary();
      const s2 = $("#lib-search"); s2.focus(); s2.setSelectionRange(pos, pos);
    });
    $("#lib-diff").onchange = (e) => { lib.diff = e.target.value; renderLibrary(); };
    $("#lib-sort").onchange = (e) => { lib.sort = e.target.value; renderLibrary(); };
  }

  /* ---------------- setup modal ---------------- */
  function openSetup(quiz, forceMode) {
    const p = Object.assign({ mode: "exam", shuffleQ: true, shuffleO: true, timer: true, count: quiz.questions.length }, db.prefs[quiz.id] || {});
    if (forceMode) p.mode = forceMode;
    p.count = Math.min(p.count || quiz.questions.length, quiz.questions.length);
    const n = quiz.questions.length;
    openModal(`
      <div class="modal-head">
        <div class="qemoji" style="--accent:${ACCENTS[hashIdx(quiz.id, ACCENTS.length)]}">${esc(quiz.emoji)}</div>
        <div style="display:grid;gap:4px;min-width:0"><span class="label">Set up your run</span><h2>${esc(quiz.title)}</h2></div>
      </div>
      <div class="opt-group">
        <span class="label">Mode</span>
        <div class="seg" role="radiogroup">
          <label><input type="radio" name="mode" value="exam" id="mode-exam" ${p.mode === "exam" ? "checked" : ""}><span class="seg-box"><b>📝 Exam</b><span>Answers revealed at the end. The real test.</span></span></label>
          <label><input type="radio" name="mode" value="practice" id="mode-practice" ${p.mode === "practice" ? "checked" : ""}><span class="seg-box"><b>🧠 Practice</b><span>Instant feedback, explanations, streaks, 50/50.</span></span></label>
        </div>
      </div>
      <div>
        <div class="toggle-row"><div><b>Shuffle questions</b><small>Random order each run</small></div><span class="switch"><input type="checkbox" id="opt-sq" ${p.shuffleQ ? "checked" : ""}><i></i></span></div>
        <div class="toggle-row"><div><b>Shuffle answers</b><small>No memorising positions</small></div><span class="switch"><input type="checkbox" id="opt-so" ${p.shuffleO ? "checked" : ""}><i></i></span></div>
        ${quiz.timeLimit ? `<div class="toggle-row"><div><b>Timer (${clock(quiz.timeLimit)})</b><small>Auto-submits when time runs out</small></div><span class="switch"><input type="checkbox" id="opt-timer" ${p.timer ? "checked" : ""}><i></i></span></div>` : ""}
        ${n > 1 ? `<div class="toggle-row" style="display:grid;gap:8px"><div><b>Questions</b><small>Fewer than all = quick round (won't count for your best score)</small></div>
          <div class="range-row"><input type="range" id="opt-count" min="1" max="${n}" value="${p.count}"><span class="mono" id="count-out" style="min-width:4.5em;text-align:right">${p.count} / ${n}</span></div></div>` : ""}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" data-m="cancel">Cancel</button>
        <button class="btn lime big" data-m="go">Start →</button>
      </div>`, (m) => {
      const cnt = m.querySelector("#opt-count");
      cnt && (cnt.oninput = () => { m.querySelector("#count-out").textContent = `${cnt.value} / ${n}`; });
      m.querySelector('[data-m="cancel"]').onclick = closeModal;
      m.querySelector('[data-m="go"]').onclick = () => {
        const opts = {
          mode: m.querySelector('input[name="mode"]:checked').value,
          shuffleQ: m.querySelector("#opt-sq").checked,
          shuffleO: m.querySelector("#opt-so").checked,
          timer: m.querySelector("#opt-timer") ? m.querySelector("#opt-timer").checked : false,
          count: cnt ? Number(cnt.value) : n
        };
        db.prefs[quiz.id] = opts; save();
        closeModal();
        startQuiz(quiz, opts);
      };
    });
  }

  /* ---------------- player ---------------- */
  let session = null;
  let timerId = 0;
  function startQuiz(quiz, opts, onlyIdx) {
    let order = onlyIdx ? onlyIdx.slice() : quiz.questions.map((_, i) => i);
    if (opts.shuffleQ) order = shuffle(order);
    if (!onlyIdx && opts.count < order.length) order = order.slice(0, opts.count);
    const optOrders = {};
    order.forEach((qi) => {
      const q = quiz.questions[qi];
      const base = q.options.map((_, i) => i);
      optOrders[qi] = opts.shuffleO && q.type !== "tf" ? shuffle(base) : base;
    });
    const kind = onlyIdx ? "retry" : order.length < quiz.questions.length ? "quick" : "full";
    session = {
      quiz, opts, order, optOrders, kind,
      mode: opts.mode,
      answers: {}, checked: {}, flagged: new Set(), hintsShown: new Set(), fifty: {}, fiftyLeft: 2,
      pos: 0, lastPos: -1, start: Date.now(),
      timeLimit: opts.timer && quiz.timeLimit && kind !== "retry" ? quiz.timeLimit : 0,
      streak: 0, bestStreak: 0, done: false
    };
    document.title = `${quiz.title} · Quizmaxxing`;
    startTimer();
    renderPlayer();
  }
  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      if (!session || session.done) return stopTimer();
      const el = $("#timer");
      const elapsed = (Date.now() - session.start) / 1000;
      if (session.timeLimit) {
        const left = session.timeLimit - elapsed;
        if (el) { el.textContent = `⏱ ${clock(left)}`; el.classList.toggle("hot", left <= 30); }
        if (left <= 0) { toast("⏰ Time's up! Submitting…"); finishQuiz(); }
      } else if (el) el.textContent = `⏱ ${clock(elapsed)}`;
    }, 250);
  }
  function stopTimer() { clearInterval(timerId); timerId = 0; }

  const curQ = () => session.quiz.questions[session.order[session.pos]];

  function renderPlayer() {
    const s = session, q = curQ(), qi = s.order[s.pos];
    const total = s.order.length;
    const given = s.answers[s.pos];
    const practice = s.mode === "practice";
    const checked = !!s.checked[s.pos];
    const perm = s.optOrders[qi];
    const removed = s.fifty[s.pos] || [];
    const answeredCount = s.order.filter((_, i) => hasAnswer(s.quiz.questions[s.order[i]], s.answers[i])).length;
    const enter = s.lastPos !== s.pos;
    s.lastPos = s.pos;
    const elapsed = (Date.now() - s.start) / 1000;

    let body = "";
    if (q.type === "text") {
      body = `<div class="opt-group">
        <label class="label" for="type-answer">Type your answer</label>
        <input class="field" id="type-answer" autocomplete="off" spellcheck="false" placeholder="Your answer…" value="${esc(given || "")}" ${checked ? "disabled" : ""}>
        ${checked ? `<div class="opt ${isCorrect(q, given) ? "correct" : "incorrect"}" style="pointer-events:none"><span class="key">${isCorrect(q, given) ? "✓" : "✗"}</span><span class="otext">Accepted: ${esc(q.answer.join(" / "))}</span></div>` : ""}
      </div>`;
    } else {
      const sel = new Set(Array.isArray(given) ? given : given !== undefined ? [given] : []);
      body = `<div class="options" role="${q.type === "multi" ? "group" : "radiogroup"}">
        ${perm.map((orig, d) => {
          let cls = "";
          if (sel.has(orig)) cls += " selected";
          if (checked) {
            if (q.answer.includes(orig)) cls += " correct";
            else if (sel.has(orig)) cls += " incorrect";
          } else if (removed.includes(orig)) cls += " gone";
          const mark = checked ? (q.answer.includes(orig) ? "✓" : sel.has(orig) ? "✗" : "") : "";
          return `<button class="opt${cls}" data-act="pick" data-orig="${orig}" ${checked ? "disabled" : ""} role="${q.type === "multi" ? "checkbox" : "radio"}" aria-checked="${sel.has(orig)}">
            <span class="key">${LETTERS[d]}</span><span class="otext">${fmt(q.options[orig])}</span>${mark ? `<span class="tick">${mark}</span>` : ""}
          </button>`;
        }).join("")}
      </div>`;
    }

    let explain = "";
    if (checked) {
      const ok = isCorrect(q, given);
      const skipped = !hasAnswer(q, given);
      explain = `<div class="explain ${ok ? "" : "bad"}">
        <b>${ok ? "✅ Correct!" : skipped ? "⏭️ Skipped" : "❌ Not quite"}</b>
        ${!ok ? `<span>Answer: <strong>${fmt(q.type === "text" ? q.answer[0] : answerText(q, q.answer))}</strong></span>` : ""}
        ${q.explanation ? `<span class="muted">${fmt(q.explanation)}</span>` : ""}
      </div>`;
    }

    const isLast = s.pos === total - 1;
    const needCheck = practice && !checked && (q.type === "multi" || q.type === "text");
    const canFifty = practice && !checked && q.type === "single" && q.options.length >= 3 && s.fiftyLeft > 0 && !removed.length;

    app.innerHTML = `
      <div class="player">
        <div class="player-top">
          <button class="icon-btn" data-act="quit" aria-label="Quit quiz" title="Quit">✕</button>
          <span class="title">${esc(s.quiz.emoji)} ${esc(s.quiz.title)}</span>
          ${practice ? `<span class="pill ${s.streak >= 3 ? "fire" : ""}" title="Current streak">🔥 ${s.streak}</span>` : ""}
          <span class="pill" id="timer">⏱ ${s.timeLimit ? clock(s.timeLimit - elapsed) : clock(elapsed)}</span>
          <button class="btn pink sm" data-act="submit">Submit</button>
        </div>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${answeredCount}"><i style="width:${pct(answeredCount, total)}%"></i></div>
        <div class="dots">
          ${s.order.map((qIdx, i) => {
            const qq = s.quiz.questions[qIdx];
            let c = "dot";
            if (practice && s.checked[i]) c += isCorrect(qq, s.answers[i]) ? " right" : " wrong";
            else if (hasAnswer(qq, s.answers[i])) c += " answered";
            if (i === s.pos) c += " current";
            if (s.flagged.has(i)) c += " flagged";
            return `<button class="${c}" data-act="goto" data-i="${i}" aria-label="Question ${i + 1}">${i + 1}</button>`;
          }).join("")}
        </div>
        <section class="qbox ${enter ? "enter" : ""}" style="${enter ? "" : "animation:none"}">
          <div class="qhead">
            <span class="label">Question ${s.pos + 1} of ${total}</span>
            <span class="chips">
              ${q.type === "multi" ? '<span class="chip">select all that apply</span>' : ""}
              ${q.type === "tf" ? '<span class="chip">true or false</span>' : ""}
              ${q.type === "text" ? '<span class="chip">type it</span>' : ""}
            </span>
          </div>
          <div class="qtext">${fmt(q.q)}</div>
          ${s.hintsShown.has(s.pos) && q.hint ? `<div class="hint">💡 ${fmt(q.hint)}</div>` : ""}
          ${body}
          ${explain}
          <div class="qfoot">
            <div class="left">
              <button class="btn ghost sm" data-act="flag" aria-pressed="${s.flagged.has(s.pos)}">${s.flagged.has(s.pos) ? "🚩 Flagged" : "🏳️ Flag"}</button>
              ${q.hint && !s.hintsShown.has(s.pos) && !checked ? '<button class="btn ghost sm" data-act="hint">💡 Hint</button>' : ""}
              ${canFifty ? `<button class="btn ghost sm" data-act="fifty">✂️ 50/50 (${s.fiftyLeft})</button>` : ""}
            </div>
            <div class="right">
              <button class="btn sm" data-act="prev" ${s.pos === 0 ? "disabled" : ""}>← Back</button>
              ${needCheck ? `<button class="btn cyan" data-act="check" ${hasAnswer(q, given) ? "" : "disabled"} id="check-btn">Check</button>` : ""}
              ${isLast
                ? `<button class="btn lime" data-act="submit">Finish 🏁</button>`
                : `<button class="btn lime" data-act="next">Next →</button>`}
            </div>
          </div>
        </section>
        <p class="kbd-hint">${q.type === "text" ? "" : `<kbd>A</kbd>–<kbd>${LETTERS[q.options.length - 1]}</kbd> or <kbd>1</kbd>–<kbd>${q.options.length}</kbd> pick · `}<kbd>Enter</kbd> ${practice ? "check / next" : "next"} · <kbd>←</kbd><kbd>→</kbd> move · <kbd>F</kbd> flag${q.hint ? " · <kbd>H</kbd> hint" : ""}</p>
      </div>`;

    const input = $("#type-answer");
    if (input) {
      input.addEventListener("input", () => {
        s.answers[s.pos] = input.value;
        const cb = $("#check-btn"); if (cb) cb.disabled = !input.value.trim();
      });
      if (!checked && !isModalOpen()) input.focus();
    }
  }

  function pick(orig) {
    const s = session, q = curQ();
    if (s.checked[s.pos]) return;
    sfx.tap();
    if (q.type === "multi") {
      const cur = new Set(s.answers[s.pos] || []);
      cur.has(orig) ? cur.delete(orig) : cur.add(orig);
      s.answers[s.pos] = [...cur].sort((a, b) => a - b);
    } else {
      s.answers[s.pos] = orig;
      if (s.mode === "practice") return check();
    }
    renderPlayer();
  }
  function check() {
    const s = session, q = curQ();
    if (s.checked[s.pos] || !hasAnswer(q, s.answers[s.pos])) return;
    s.checked[s.pos] = true;
    const ok = isCorrect(q, s.answers[s.pos]);
    if (ok) {
      s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
      if ([3, 5, 10, 15, 20].includes(s.streak)) { comboPop(s.streak); sfx.combo(); } else sfx.right();
    } else { s.streak = 0; sfx.wrong(); }
    renderPlayer();
  }
  function comboPop(n) {
    if (db.settings.calm) return toast(`🔥 ${n} in a row!`);
    const words = { 3: "COMBO x3", 5: "ON FIRE x5", 10: "UNSTOPPABLE x10", 15: "GODLIKE x15", 20: "LEGENDARY x20" };
    const el = document.createElement("div");
    el.className = "combo-pop"; el.textContent = words[n] || `x${n}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
    if (n >= 5) confetti(50);
  }
  function go(delta) {
    const s = session;
    const next = s.pos + delta;
    if (next < 0 || next >= s.order.length) return;
    s.pos = next; renderPlayer(); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function askQuit(onYes) {
    confirmBox({
      title: "Quit this quiz?", body: "Your answers from this run won't be saved.",
      yes: "Quit", no: "Keep going", danger: true,
      onYes: () => { stopTimer(); session = null; onYes ? onYes() : (location.hash = "#quizzes", route()); }
    });
  }
  function askSubmit() {
    const s = session;
    const unanswered = s.order.filter((qi, i) => !hasAnswer(s.quiz.questions[qi], s.answers[i])).length;
    const flagged = s.flagged.size;
    if (!unanswered && !flagged) return finishQuiz();
    const bits = [];
    if (unanswered) bits.push(`${unanswered} unanswered question${unanswered > 1 ? "s" : ""} (they count as wrong)`);
    if (flagged) bits.push(`${flagged} flagged for review`);
    confirmBox({ title: "Submit now?", body: `You have ${bits.join(" and ")}.`, yes: "Submit", no: "Go back", onYes: finishQuiz });
  }

  function finishQuiz() {
    const s = session;
    if (!s || s.done) return;
    s.done = true; stopTimer(); closeModal();
    const timeSec = Math.min((Date.now() - s.start) / 1000, s.timeLimit || Infinity);
    const items = s.order.map((qi, i) => {
      const q = s.quiz.questions[qi];
      const given = s.answers[i];
      const answered = hasAnswer(q, given);
      return {
        qIdx: qi, q: q.q, type: q.type,
        given: answered ? answerText(q, given) : "",
        correct: q.type === "text" ? q.answer.join(" / ") : answerText(q, q.answer),
        ok: isCorrect(q, given), skipped: !answered,
        flagged: s.flagged.has(i), explanation: q.explanation
      };
    });
    let run = 0, best = 0;
    items.forEach((it) => { run = it.ok ? run + 1 : 0; best = Math.max(best, run); });
    const correct = items.filter((i) => i.ok).length;
    const p = pct(correct, items.length);
    const prevBest = bestFor(s.quiz.id);
    const xp = correct * 10 + Math.max(best, s.bestStreak) * 2 + (p === 100 && items.length >= 3 ? 50 : 0) + (s.kind === "full" ? 10 : 0);
    const before = unlockedIds();
    const lvlBefore = levelInfo(totalXp()).lvl;
    const attempt = {
      id: uid(), quizId: s.quiz.id, quizTitle: s.quiz.title, emoji: s.quiz.emoji,
      date: new Date().toISOString(), mode: s.mode, kind: s.kind,
      total: items.length, correct, pct: p, timeSec: Math.round(timeSec),
      bestStreak: Math.max(best, s.bestStreak), xp, hints: s.hintsShown.size, items,
      opts: s.opts
    };
    db.attempts.unshift(attempt);
    save();
    const newly = [...unlockedIds()].filter((id) => !before.has(id));
    const lvlAfter = levelInfo(totalXp()).lvl;
    const retryQuiz = s.quiz;
    session = null;
    renderResults(attempt, { fresh: true, prevBest, quiz: retryQuiz });
    sfx.done();
    if (p >= 75) confetti(p === 100 ? 220 : 120);
    let delay = 700;
    if (lvlAfter > lvlBefore) { setTimeout(() => { toast(`⬆️ Level up! You're LV ${lvlAfter} now`); sfx.unlock(); }, delay); delay += 900; }
    newly.forEach((id) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      setTimeout(() => { toast(`${a.e} Badge unlocked: ${a.name}`); sfx.unlock(); }, delay);
      delay += 900;
    });
  }

  /* ---------------- results ---------------- */
  let reviewFilter = "all";
  function renderResults(a, { fresh = false, prevBest = null } = {}) {
    reviewFilter = fresh ? "all" : reviewFilter;
    const [, tier, sub] = tierFor(a.pct);
    const quiz = findQuiz(a.quizId);
    const wrong = a.items.filter((i) => !i.ok);
    const isPB = fresh && a.kind === "full" && (prevBest === null || a.pct > prevBest);
    const R = 72, C = 2 * Math.PI * R;
    const ringColor = a.pct >= 80 ? "var(--good)" : a.pct >= 50 ? "var(--warn)" : "var(--bad)";
    const kindLabel = { full: "full run", quick: "quick round", retry: "retry of misses" }[a.kind] || a.kind;

    const list = a.items.filter((it) => reviewFilter === "all" || (reviewFilter === "wrong" && !it.ok) || (reviewFilter === "right" && it.ok) || (reviewFilter === "flagged" && it.flagged));

    app.innerHTML = shell("dashboard", `
      <div class="view-head">
        <div>
          <span class="sticker">${fresh ? "results are in" : `from ${esc(niceDate(a.date))}`}</span>
          <h1>${esc(a.emoji)} ${esc(a.quizTitle)}</h1>
          <p class="muted">${a.mode === "practice" ? "Practice" : "Exam"} mode · ${kindLabel}</p>
        </div>
      </div>
      <section class="result-hero">
        <div class="ring">
          <svg viewBox="0 0 170 170" aria-hidden="true">
            <circle cx="85" cy="85" r="${R}" style="fill:none;stroke:var(--card-2);stroke-width:16"></circle>
            <circle id="ring-arc" cx="85" cy="85" r="${R}" style="fill:none;stroke:${ringColor};stroke-width:16;stroke-linecap:round;stroke-dasharray:${C};stroke-dashoffset:${C};transition:stroke-dashoffset 1.2s cubic-bezier(.3,1,.4,1)"></circle>
          </svg>
          <div class="val"><div><strong class="mono" id="ring-num">${fresh ? 0 : a.pct}%</strong><span>${a.correct}/${a.total}</span></div></div>
        </div>
        <div class="result-copy">
          ${isPB ? '<span class="sticker" style="background:var(--lime)">🏆 new personal best</span>' : ""}
          <div class="tier">${esc(tier)}</div>
          <p class="muted">${esc(sub)}${prevBest !== null && fresh && a.kind === "full" ? ` · previous best ${prevBest}%` : ""}</p>
          <div class="row-actions">
            ${quiz ? `<button class="btn lime" data-act="rerun" data-id="${esc(quiz.id)}" data-aid="${esc(a.id)}">↻ Run it back</button>` : ""}
            ${quiz && wrong.length ? `<button class="btn pink" data-act="retrywrong" data-aid="${esc(a.id)}">🎯 Retry the ${wrong.length} I missed</button>` : ""}
            <a class="btn ghost" href="#dashboard">Dashboard</a>
          </div>
        </div>
      </section>
      <div class="stat-row">
        <div class="stat"><span class="label">Score</span><strong>${a.correct}/${a.total}</strong></div>
        <div class="stat"><span class="label">Time</span><strong>${clock(a.timeSec)}</strong></div>
        <div class="stat"><span class="label">Per question</span><strong>${Math.round(a.timeSec / a.total)}s</strong></div>
        <div class="stat"><span class="label">Best streak</span><strong>🔥 ${a.bestStreak}</strong></div>
        <div class="stat"><span class="label">XP earned</span><strong class="hl-lime">+${a.xp}</strong></div>
      </div>
      <section class="panel">
        <div class="filter-row">
          <h2>Review</h2>
          <div class="chips">
            ${[["all", `all ${a.items.length}`], ["wrong", `missed ${wrong.length}`], ["right", `correct ${a.correct}`], ["flagged", `flagged ${a.items.filter((i) => i.flagged).length}`]]
              .map(([k, l]) => `<button class="chip" data-act="rvfilter" data-f="${k}" aria-pressed="${reviewFilter === k}">${l}</button>`).join("")}
          </div>
        </div>
        <div class="review">
          ${list.length ? list.map((it) => {
            const n = a.items.indexOf(it) + 1;
            return `<div class="rv ${it.ok ? "" : it.skipped ? "skipped wrong" : "wrong"}">
              <span class="label">Q${n} ${it.ok ? "· ✅ correct" : it.skipped ? "· ⏭️ skipped" : "· ❌ missed"}${it.flagged ? " · 🚩 flagged" : ""}</span>
              <div class="rv-q">${fmt(it.q)}</div>
              <div class="ans">
                ${!it.skipped ? `<span class="you ${it.ok ? "right" : "wrong"}">You: ${fmt(it.given)}</span>` : ""}
                ${!it.ok ? `<span>Answer: <strong>${fmt(it.correct)}</strong></span>` : ""}
              </div>
              ${it.explanation ? `<div class="ex">💬 ${fmt(it.explanation)}</div>` : ""}
            </div>`;
          }).join("") : '<p class="muted">Nothing in this filter.</p>'}
        </div>
      </section>`);
    currentResult = a;
    if (fresh) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const arc = $("#ring-arc"); if (arc) arc.style.strokeDashoffset = C * (1 - a.pct / 100);
      }));
      const num = $("#ring-num"), t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 1100);
        if (num) num.textContent = Math.round(a.pct * (1 - Math.pow(1 - k, 3))) + "%";
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else {
      const arc = $("#ring-arc"); if (arc) arc.style.strokeDashoffset = C * (1 - a.pct / 100);
    }
    window.scrollTo(0, 0);
  }
  let currentResult = null;

  /* ---------------- dashboard ---------------- */
  function chartSvg(runs) {
    const W = 640, H = 220, L = 38, Rr = 20, T = 16, B = 30;
    const iw = W - L - Rr, ih = H - T - B;
    const pts = runs.map((a, i) => ({
      x: L + (runs.length === 1 ? iw / 2 : (i / (runs.length - 1)) * iw),
      y: T + ih - (a.pct / 100) * ih, a
    }));
    const grid = [0, 25, 50, 75, 100].map((v) => {
      const y = T + ih - (v / 100) * ih;
      return `<line x1="${L}" x2="${W - Rr}" y1="${y}" y2="${y}" style="stroke:var(--line);stroke-width:1;${v ? "stroke-dasharray:3 5" : ""}"></line>
        <text x="${L - 8}" y="${y + 4}" text-anchor="end">${v}%</text>`;
    }).join("");
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = pts.length > 1 ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${T + ih} L${pts[0].x.toFixed(1)},${T + ih} Z` : "";
    const step = Math.max(1, Math.ceil(runs.length / 8));
    const xl = pts.map((p, i) => (i % step === 0 || i === pts.length - 1) ? `<text x="${p.x}" y="${H - 8}" text-anchor="middle">#${i + 1}</text>` : "").join("");
    const last = pts[pts.length - 1];
    const dotColor = (p) => (p >= 80 ? "var(--good)" : p >= 50 ? "var(--warn)" : "var(--bad)");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Score trend for your last ${runs.length} attempts">
      <defs><linearGradient id="g-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--pink);stop-opacity:.4"></stop><stop offset="1" style="stop-color:var(--pink);stop-opacity:0"></stop></linearGradient></defs>
      ${grid}
      ${area ? `<path d="${area}" style="fill:url(#g-area)"></path>` : ""}
      ${pts.length > 1 ? `<path d="${line}" style="fill:none;stroke:var(--pink);stroke-width:3;stroke-linejoin:round;stroke-linecap:round"></path>` : ""}
      ${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4.5" style="fill:${dotColor(p.a.pct)};stroke:var(--card);stroke-width:2"><title>${esc(p.a.quizTitle)}: ${p.a.pct}% (${esc(niceDate(p.a.date))})</title></circle>`).join("")}
      <circle cx="${last.x}" cy="${last.y}" r="8" style="fill:none;stroke:var(--fg);stroke-width:2"></circle>
      <text x="${Math.min(last.x, W - Rr - 4)}" y="${Math.max(last.y - 14, 12)}" text-anchor="end" style="fill:var(--fg);font-weight:700">${last.a.pct}%</text>
      ${xl}
    </svg>`;
  }

  function renderDashboard() {
    const A = db.attempts;
    const quizzes = allQuizzes();
    if (!A.length) {
      app.innerHTML = shell("dashboard", `
        <div class="view-head"><div><span class="sticker">your stats</span><h1>Dashboard</h1></div></div>
        <div class="empty">
          <div class="big-emoji">📊</div>
          <h3>No attempts yet</h3>
          <p>Finish a quiz and your scores, streaks, trend chart and reruns show up here.</p>
          <a class="btn lime" href="#quizzes">Pick a quiz →</a>
        </div>
        ${badgesPanel()}`);
      return;
    }
    const avg = Math.round(A.reduce((s, a) => s + a.pct, 0) / A.length);
    const best = Math.max(...A.map((a) => a.pct));
    const streak = dayStreak();
    const recent = A.slice(0, 20).reverse();

    const byQuiz = {};
    A.forEach((a) => { (byQuiz[a.quizId] = byQuiz[a.quizId] || []).push(a); });
    const perQuiz = Object.entries(byQuiz).map(([id, runs]) => {
      const full = runs.filter((r) => r.kind === "full");
      return {
        id, runs, title: runs[0].quizTitle, emoji: runs[0].emoji,
        best: full.length ? Math.max(...full.map((r) => r.pct)) : null,
        last: runs[0], avg: Math.round(runs.reduce((s, r) => s + r.pct, 0) / runs.length),
        exists: !!quizzes.find((q) => q.id === id)
      };
    }).sort((a, b) => new Date(b.last.date) - new Date(a.last.date));

    const miss = {};
    A.forEach((a) => a.items.forEach((it) => {
      const k = `${a.quizId}::${it.q}`;
      const m = (miss[k] = miss[k] || { q: it.q, quiz: a.quizTitle, emoji: a.emoji, seen: 0, missed: 0, correct: it.correct });
      m.seen++; if (!it.ok) m.missed++;
    }));
    const nemesis = Object.values(miss).filter((m) => m.missed > 0)
      .sort((a, b) => b.missed / b.seen - a.missed / a.seen || b.missed - a.missed).slice(0, 5);

    app.innerHTML = shell("dashboard", `
      <div class="view-head">
        <div><span class="sticker">your stats</span><h1>Dashboard</h1><p class="muted">Every run is saved. Tap Rerun on anything to go again.</p></div>
      </div>
      <div class="tiles">
        <div class="tile"><span class="label">Quizzes taken</span><strong>${A.length}</strong><small class="muted">${A.filter((a) => a.kind === "full").length} full runs</small></div>
        <div class="tile"><span class="label">Average score</span><strong>${avg}%</strong><small class="muted">across all attempts</small></div>
        <div class="tile"><span class="label">Best score</span><strong>${best}%</strong><small class="muted">${A.filter((a) => a.pct === 100).length} perfect run${A.filter((a) => a.pct === 100).length === 1 ? "" : "s"}</small></div>
        <div class="tile"><span class="label">Day streak</span><strong>${streak}🔥</strong><small class="muted">${streak ? "keep it alive" : "quiz today to start one"}</small></div>
      </div>
      <div class="two-col">
        <section class="panel">
          <div class="panel-head"><h2>Score trend</h2><span class="label">last ${recent.length} attempt${recent.length === 1 ? "" : "s"}</span></div>
          <div class="chart-wrap">${chartSvg(recent)}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Nemesis questions</h2><span class="label">most missed</span></div>
          ${nemesis.length ? `<ul class="nemesis">${nemesis.map((m) => `
            <li><span class="label">${esc(m.emoji)} ${esc(m.quiz)} · missed ${m.missed}/${m.seen}</span>
              <span>${fmt(m.q)}</span>
              <span class="muted" style="font-size:.85rem">Answer: ${fmt(m.correct)}</span>
              <span class="bar-mini"><i style="width:${pct(m.missed, m.seen)}%"></i></span></li>`).join("")}</ul>`
          : '<p class="muted">No misses at all. Suspicious. 👀</p>'}
        </section>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>By quiz</h2><span class="label">${perQuiz.length} quiz${perQuiz.length === 1 ? "" : "zes"} played</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Quiz</th><th>Runs</th><th>Best</th><th>Avg</th><th>Last</th><th></th></tr></thead>
          <tbody>${perQuiz.map((r) => `<tr>
            <td><b>${esc(r.emoji)} ${esc(r.title)}</b></td>
            <td class="num">${r.runs.length}</td>
            <td class="num">${r.best === null ? "–" : `<span class="score-pill ${scoreClass(r.best)}">${r.best}%</span>`}</td>
            <td class="num">${r.avg}%</td>
            <td class="num muted">${esc(niceDate(r.last.date))}</td>
            <td class="actions">${r.exists ? `<button class="btn lime sm" data-act="setup" data-id="${esc(r.id)}">↻ Rerun</button>` : '<span class="muted">quiz removed</span>'}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>History</h2><span class="label">${A.length} attempt${A.length === 1 ? "" : "s"}</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>When</th><th>Quiz</th><th>Mode</th><th>Score</th><th>Time</th><th></th></tr></thead>
          <tbody>${A.slice(0, histLimit).map((a) => `<tr>
            <td class="num muted">${esc(niceDate(a.date))}</td>
            <td>${esc(a.emoji)} ${esc(a.quizTitle)}</td>
            <td><span class="chip">${a.mode === "practice" ? "practice" : "exam"}${a.kind !== "full" ? ` · ${a.kind === "retry" ? "retry" : "quick"}` : ""}</span></td>
            <td class="num"><span class="score-pill ${scoreClass(a.pct)}">${a.pct}%</span> <span class="muted">${a.correct}/${a.total}</span></td>
            <td class="num">${clock(a.timeSec)}</td>
            <td class="actions">
              <button class="btn ghost sm" data-act="view" data-aid="${esc(a.id)}">Review</button>
              ${findQuiz(a.quizId) ? `<button class="btn sm" data-act="rerun" data-id="${esc(a.quizId)}" data-aid="${esc(a.id)}">↻ Rerun</button>` : ""}
              <button class="icon-btn" data-act="delattempt" data-aid="${esc(a.id)}" aria-label="Delete attempt" title="Delete attempt">🗑</button>
            </td></tr>`).join("")}</tbody>
        </table></div>
        ${A.length > histLimit ? `<button class="btn ghost sm" data-act="more" style="justify-self:center">Show more</button>` : ""}
      </section>
      ${badgesPanel()}`);
  }
  let histLimit = 15;
  function badgesPanel() {
    const got = unlockedIds();
    return `<section class="panel">
      <div class="panel-head"><h2>Badges</h2><span class="label">${got.size}/${ACHIEVEMENTS.length} unlocked</span></div>
      <div class="badges">${ACHIEVEMENTS.map((x) => `<div class="ach ${got.has(x.id) ? "" : "locked"}"><span class="e">${x.e}</span><div><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></div></div>`).join("")}</div>
    </section>`;
  }

  /* ---------------- add quiz ---------------- */
  const TEMPLATE = `{
  "title": "Biology Chapter 3",
  "emoji": "🧬",
  "description": "Cells and organelles",
  "tags": ["biology"],
  "difficulty": "medium",
  "timeLimit": 300,
  "questions": [
    { "q": "Powerhouse of the cell?", "options": ["Nucleus", "Mitochondria", "Ribosome"], "answer": 1, "explanation": "Mitochondria make ATP." },
    { "q": "Which are organelles?", "options": ["Golgi body", "Glucose", "Lysosome"], "answer": [0, 2] },
    { "q": "Plant cells have cell walls.", "answer": true },
    { "q": "What molecule carries genetic info?", "answer": ["DNA", "deoxyribonucleic acid"] }
  ]
}`;
  let draft = null;
  function parseDraft(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error(`That isn't valid JSON yet: ${e.message}. Check for missing commas or quotes.`); }
    const list = Array.isArray(data) ? data : [data];
    if (!list.length) throw new Error("The list is empty.");
    return list.map((raw, i) => ({ raw, quiz: normalizeQuiz(raw, list.length > 1 ? `#${i + 1}` : "") }));
  }
  function renderAdd() {
    const text = draft ?? TEMPLATE;
    app.innerHTML = shell("add", `
      <div class="view-head"><div><span class="sticker">feed the machine</span><h1>Add a quiz</h1>
        <p class="muted">Paste quiz JSON (one quiz or a list), or upload a .json file. It's saved in this browser.</p></div></div>
      <div class="two-col">
        <section class="panel">
          <div class="panel-head"><h2>Quiz JSON</h2>
            <label class="btn ghost sm file-label">📁 Upload .json<input type="file" id="upload" accept=".json,application/json,text/plain"></label></div>
          <textarea class="field" id="json-in" spellcheck="false" aria-label="Quiz JSON">${esc(text)}</textarea>
          <div class="err" id="add-err" role="alert"></div>
          <div id="add-preview"></div>
          <div class="row-actions">
            <button class="btn cyan" data-act="validate">Check it</button>
            <button class="btn lime" data-act="savequiz">Save quiz</button>
            <button class="btn ghost sm" data-act="template">Reset to example</button>
          </div>
        </section>
        <section class="panel docs">
          <h2>Format cheat sheet</h2>
          <p>The question type comes from <code>answer</code>:</p>
          <ul>
            <li><b>Single choice</b>: <code>"answer": 1</code> (0 = first option)</li>
            <li><b>Multi select</b>: <code>"answer": [0, 2]</code></li>
            <li><b>True / false</b>: <code>"answer": true</code>, no options</li>
            <li><b>Type-in</b>: <code>"answer": "DNA"</code> or a list of accepted answers, no options. Small typos are accepted.</li>
          </ul>
          <p>Optional on every question: <code>explanation</code>, <code>hint</code>. Optional on the quiz: <code>emoji</code>, <code>description</code>, <code>tags</code>, <code>difficulty</code> (easy/medium/hard), <code>timeLimit</code> in seconds.</p>
          <p>Wrap text in backticks for <code>\`code\`</code> and double asterisks for <b>**bold**</b>.</p>
          <p class="muted">Quizzes added to <code>quizzes.js</code> in the repo show up for everyone who opens the site. Quizzes saved here live in this browser only.</p>
        </section>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>Your added quizzes</h2><span class="label">${db.custom.length} saved here</span></div>
        ${db.custom.length ? `<div class="custom-list">${db.custom.map((c, i) => `
          <div class="custom-item"><span>${esc(c.emoji || "📝")} ${esc(c.title)}</span>
            <span class="label" style="flex:none">${(c.questions || []).length} q</span>
            <button class="btn ghost sm" data-act="editcustom" data-i="${i}">Edit</button>
            <button class="btn danger sm" data-act="delcustom" data-i="${i}">Delete</button></div>`).join("")}</div>`
          : '<p class="muted">Nothing yet. Paste some JSON above and hit Save quiz.</p>'}
      </section>`);
    const ta = $("#json-in");
    ta.addEventListener("input", () => { draft = ta.value; $("#add-err").textContent = ""; $("#add-preview").innerHTML = ""; });
    $("#upload").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { draft = String(r.result); ta.value = draft; validateDraft(); };
      r.readAsText(f);
    });
  }
  function validateDraft() {
    const err = $("#add-err"), prev = $("#add-preview");
    try {
      const list = parseDraft($("#json-in").value);
      err.textContent = "";
      prev.innerHTML = `<p class="ok">✓ Looks good: ${list.map(({ quiz }) => `${esc(quiz.emoji)} ${esc(quiz.title)} (${quiz.questions.length} questions: ${
        Object.entries(quiz.questions.reduce((m, q) => (m[q.type] = (m[q.type] || 0) + 1, m), {}))
          .map(([t, n]) => `${n} ${{ single: "single", multi: "multi", tf: "true/false", text: "type-in" }[t]}`).join(", ")})`).join("; ")}</p>`;
      return list;
    } catch (e) {
      err.textContent = e.message; prev.innerHTML = "";
      sfx.wrong();
      return null;
    }
  }
  function saveDraft() {
    const list = validateDraft();
    if (!list) return;
    const builtIds = new Set(builtIn.map((q) => q.id));
    for (const { raw, quiz } of list) {
      if (builtIds.has(quiz.id)) { $("#add-err").textContent = `"${quiz.title}" has the same id as a quiz in quizzes.js. Give it a different "id" or title.`; return; }
      const i = db.custom.findIndex((c) => normalizeQuiz(c).id === quiz.id);
      if (i >= 0) db.custom[i] = raw; else db.custom.push(raw);
    }
    save();
    draft = null;
    sfx.right(); confetti(80);
    toast(list.length > 1 ? `Saved ${list.length} quizzes 🎉` : `Saved "${list[0].quiz.title}" 🎉`);
    location.hash = "#quizzes";
  }

  /* ---------------- settings ---------------- */
  function renderSettings() {
    const st = db.settings;
    app.innerHTML = shell("settings", `
      <div class="view-head"><div><span class="sticker">control room</span><h1>Settings</h1></div></div>
      <section class="panel">
        <h2>Vibes</h2>
        <div>
          <div class="toggle-row"><div><b>Sound effects</b><small>Blips for right, wrong, combos</small></div><span class="switch"><input type="checkbox" id="set-sound" ${st.sound ? "checked" : ""}><i></i></span></div>
          <div class="toggle-row"><div><b>Confetti</b><small>For good scores and new quizzes</small></div><span class="switch"><input type="checkbox" id="set-confetti" ${st.confetti ? "checked" : ""}><i></i></span></div>
          <div class="toggle-row"><div><b>Calm mode</b><small>Turns off most animation</small></div><span class="switch"><input type="checkbox" id="set-calm" ${st.calm ? "checked" : ""}><i></i></span></div>
        </div>
      </section>
      <section class="panel">
        <h2>Your data</h2>
        <p class="muted">Scores and added quizzes are stored in this browser. Export a backup to move them to another device.</p>
        <div class="row-actions">
          <button class="btn cyan" data-act="export">⬇️ Export backup</button>
          <label class="btn file-label">⬆️ Import backup<input type="file" id="import" accept=".json,application/json"></label>
          <button class="btn danger" data-act="reset">Reset progress</button>
        </div>
        <textarea class="field" id="export-out" hidden readonly aria-label="Backup data" style="min-height:120px"></textarea>
      </section>
      <section class="panel">
        <h2>Lock</h2>
        <p class="muted">Lock the site so the passcode is needed again.</p>
        <div class="row-actions"><button class="btn pink" data-act="lock">🔒 Lock now</button></div>
      </section>`);
    const bind = (id, key, after) => { $(id).onchange = (e) => { db.settings[key] = e.target.checked; save(); after && after(); }; };
    bind("#set-sound", "sound", () => db.settings.sound && sfx.right());
    bind("#set-confetti", "confetti", () => db.settings.confetti && confetti(60));
    bind("#set-calm", "calm", applyCalm);
    $("#import").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const data = JSON.parse(String(r.result));
          if (!Array.isArray(data.attempts) || !Array.isArray(data.custom)) throw new Error();
          const ids = new Set(db.attempts.map((a) => a.id));
          db.attempts = [...db.attempts, ...data.attempts.filter((a) => !ids.has(a.id))].sort((a, b) => new Date(b.date) - new Date(a.date));
          const cids = new Set(db.custom.map((c) => c.title));
          db.custom = [...db.custom, ...data.custom.filter((c) => !cids.has(c.title))];
          save(); toast("Backup imported ✅"); renderSettings();
        } catch { toast("That file isn't a Quizmaxxing backup."); }
      };
      r.readAsText(f);
    });
  }
  function exportData() {
    const json = JSON.stringify({ app: "quizmaxxing", exported: new Date().toISOString(), attempts: db.attempts, custom: db.custom }, null, 2);
    try {
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `quizmaxxing-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { /* fall through to the text box */ }
    const out = $("#export-out");
    out.value = json; out.hidden = false;
    navigator.clipboard?.writeText(json).then(() => toast("Backup downloaded and copied to clipboard"), () => { out.select(); toast("Backup is in the box below. Copy it somewhere safe."); });
  }
  function applyCalm() { document.body.classList.toggle("calm", !!db.settings.calm); }

  /* ---------------- actions ---------------- */
  const actions = {
    setup: (d) => { const q = findQuiz(d.id); q ? openSetup(q) : toast("That quiz isn't loaded anymore."); },
    quickpractice: (d) => { const q = findQuiz(d.id); q && openSetup(q, "practice"); },
    random: () => { const qs = allQuizzes(); openSetup(qs[Math.floor(Math.random() * qs.length)]); },
    tag: (d) => { lib.tag = d.tag; renderLibrary(); },
    clearfilters: () => { Object.assign(lib, { q: "", tag: "", diff: "" }); renderLibrary(); },
    pick: (d) => pick(Number(d.orig)),
    check: () => check(),
    next: () => {
      const s = session, q = curQ();
      if (s.mode === "practice" && !s.checked[s.pos] && hasAnswer(q, s.answers[s.pos])) return check();
      go(1);
    },
    prev: () => go(-1),
    goto: (d) => { session.pos = Number(d.i); renderPlayer(); },
    flag: () => { const s = session; s.flagged.has(s.pos) ? s.flagged.delete(s.pos) : s.flagged.add(s.pos); renderPlayer(); },
    hint: () => { session.hintsShown.add(session.pos); sfx.tap(); renderPlayer(); },
    fifty: () => {
      const s = session, q = curQ();
      const wrongs = shuffle(q.options.map((_, i) => i).filter((i) => !q.answer.includes(i)));
      s.fifty[s.pos] = wrongs.slice(0, Math.max(1, Math.floor(q.options.length / 2)));
      s.fiftyLeft--; sfx.tap(); renderPlayer();
    },
    submit: () => askSubmit(),
    quit: () => askQuit(),
    rerun: (d) => {
      const q = findQuiz(d.id); if (!q) return toast("That quiz isn't loaded anymore.");
      const a = db.attempts.find((x) => x.id === d.aid);
      if (a && a.opts && a.kind !== "retry") startQuiz(q, a.opts); else openSetup(q);
    },
    retrywrong: (d) => {
      const a = db.attempts.find((x) => x.id === d.aid); const q = a && findQuiz(a.quizId);
      if (!q) return toast("That quiz isn't loaded anymore.");
      const idx = a.items.filter((i) => !i.ok).map((i) => i.qIdx).filter((i) => q.questions[i] && q.questions[i].q === a.items.find((x) => x.qIdx === i).q);
      if (!idx.length) return toast("The quiz changed since this run, so the missed questions can't be matched.");
      startQuiz(q, { mode: "practice", shuffleQ: true, shuffleO: true, timer: false, count: idx.length }, idx);
    },
    rvfilter: (d) => { reviewFilter = d.f; renderResults(currentResult); },
    view: (d) => { const a = db.attempts.find((x) => x.id === d.aid); a && renderResults(a); },
    more: () => { histLimit += 25; renderDashboard(); },
    delattempt: (d) => confirmBox({
      title: "Delete this attempt?", body: "It'll be removed from your history and stats.", yes: "Delete", danger: true,
      onYes: () => { db.attempts = db.attempts.filter((a) => a.id !== d.aid); save(); renderDashboard(); }
    }),
    validate: () => validateDraft(),
    savequiz: () => saveDraft(),
    template: () => { draft = null; renderAdd(); },
    editcustom: (d) => { draft = JSON.stringify(db.custom[Number(d.i)], null, 2); renderAdd(); window.scrollTo(0, 0); },
    delcustom: (d) => {
      const c = db.custom[Number(d.i)];
      confirmBox({
        title: `Delete "${c.title}"?`, body: "The quiz is removed from this browser. Past scores stay in your history.", yes: "Delete", danger: true,
        onYes: () => { db.custom.splice(Number(d.i), 1); save(); renderAdd(); }
      });
    },
    export: () => exportData(),
    reset: () => confirmBox({
      title: "Reset all progress?", body: "Every score, streak and badge is wiped from this browser. Added quizzes stay. Export a backup first if you might want it back.",
      yes: "Wipe it", danger: true,
      onYes: () => { db.attempts = []; db.prefs = {}; save(); toast("Progress reset. Fresh start ✨"); renderSettings(); }
    }),
    lock: () => lockNow()
  };
  app.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (link && link.getAttribute("href") === location.hash) { e.preventDefault(); session = null; route(); return; }
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el.dataset, el); }
  });

  document.addEventListener("keydown", (e) => {
    if (!session || session.done || isModalOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
    const q = curQ();
    const typing = e.target && e.target.id === "type-answer";
    if (e.key === "Enter") {
      e.preventDefault();
      const s = session;
      if (s.mode === "practice" && !s.checked[s.pos] && hasAnswer(q, s.answers[s.pos])) return check();
      if (s.pos === s.order.length - 1) return askSubmit();
      return go(1);
    }
    if (typing) return;
    const k = e.key.toLowerCase();
    if (e.key === "ArrowRight") return go(1);
    if (e.key === "ArrowLeft") return go(-1);
    if (k === "f") return actions.flag();
    if (k === "h" && q.hint) return actions.hint();
    if (q.type === "text") return;
    let d = -1;
    if (/^[1-9]$/.test(k)) d = Number(k) - 1;
    else if (k.length === 1 && LETTERS.toLowerCase().includes(k)) d = LETTERS.toLowerCase().indexOf(k);
    const perm = session.optOrders[session.order[session.pos]];
    if (d >= 0 && d < perm.length) {
      const orig = perm[d];
      if ((session.fifty[session.pos] || []).includes(orig)) return;
      pick(orig);
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (session && !session.done) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------------- boot ---------------- */
  load();
  loadBuiltIn();
  applyCalm();
  route();
})();
