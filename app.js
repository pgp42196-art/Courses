(() => {
  const cfg = window.APP_CONFIG || {};
  const SITE = cfg.siteName || 'brain dump';
  const DEMO = !(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const $app = document.getElementById('app');

  const COLORS = ['pink', 'lime', 'cyan', 'purple', 'orange', 'yellow'];
  const EMOJIS = ['📚', '💻', '🧪', '🎨', '🧠', '📈', '🌍', '🎧', '🔥', '🦋', '🍵', '🚀'];
  const MOODS = [['🤯', 'mind blown'], ['😎', 'easy'], ['😵‍💫', 'confused'], ['🔥', 'on fire'], ['😴', 'boring']];
  const HYPE = ['slay 💅', 'big brain energy 🧠', 'ate that up 🍽️', 'no cap, genius 🧢',
    'main character studying 🎬', 'W note 🏆', 'understood the assignment ✅'];
  const VIBES = ['ready to lock in? 🔒', 'your brain is literally so big 🧠', 'study mode: activated ⚡',
    'touch grass later, notes now 🌱', 'future you says thank u 🫶'];

  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const colorOf = c => (COLORS.includes(c) ? c : 'pink');

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function boom() {
    if (!window.confetti || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.75 },
      colors: ['#ff4ecd', '#b6ff3b', '#3bf0ff', '#9d5cff', '#ffe23b'] });
  }

  function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'late night study sesh 🌙';
    if (h < 12) return 'gm bestie ☀️';
    if (h < 18) return 'afternoon grind 💪';
    return 'evening era 🌆';
  }

  function streak(notes) {
    const days = new Set(notes.map(n => new Date(n.updated_at).toDateString()));
    const d = new Date();
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // still alive if you studied yesterday
    let s = 0;
    while (days.has(d.toDateString())) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }

  const snippet = md => String(md || '').replace(/[#*_`>\[\]()~|-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);

  function renderMd(md) {
    if (!window.marked || !window.DOMPurify) return esc(md).replace(/\n/g, '<br>');
    return DOMPurify.sanitize(marked.parse(md || ''));
  }

  // ---------- data stores ----------
  function supabaseStore() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const unwrap = ({ data, error }) => { if (error) throw error; return data; };
    return {
      async user() { const { data } = await sb.auth.getSession(); return data.session?.user ?? null; },
      async signIn(email, password) { unwrap(await sb.auth.signInWithPassword({ email, password })); },
      async signUp(email, password) { const d = unwrap(await sb.auth.signUp({ email, password })); return !d.session; },
      async signOut() { await sb.auth.signOut(); },
      async courses() { return unwrap(await sb.from('courses').select('*').order('created_at')); },
      async addCourse(c) { return unwrap(await sb.from('courses').insert(c).select().single()); },
      async deleteCourse(id) { unwrap(await sb.from('courses').delete().eq('id', id)); },
      async notes(courseId) {
        let q = sb.from('notes').select('*').order('updated_at', { ascending: false });
        if (courseId) q = q.eq('course_id', courseId);
        return unwrap(await q);
      },
      async note(id) { return unwrap(await sb.from('notes').select('*').eq('id', id).single()); },
      async saveNote(n) {
        const row = { ...n, updated_at: new Date().toISOString() };
        if (n.id) return unwrap(await sb.from('notes').update(row).eq('id', n.id).select().single());
        delete row.id;
        return unwrap(await sb.from('notes').insert(row).select().single());
      },
      async deleteNote(id) { unwrap(await sb.from('notes').delete().eq('id', id)); },
    };
  }

  function demoStore() {
    const KEY = 'braindump-demo';
    let db;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
    db = db || { user: null, courses: [], notes: [] };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
    const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    const now = () => new Date().toISOString();
    return {
      async user() { return db.user; },
      async signIn(email) { db.user = { email }; save(); },
      async signUp(email) { db.user = { email }; save(); return false; },
      async signOut() { db.user = null; save(); },
      async courses() { return [...db.courses]; },
      async addCourse(c) { const row = { ...c, id: id(), created_at: now() }; db.courses.push(row); save(); return row; },
      async deleteCourse(cid) {
        db.courses = db.courses.filter(c => c.id !== cid);
        db.notes = db.notes.filter(n => n.course_id !== cid);
        save();
      },
      async notes(cid) {
        return db.notes.filter(n => !cid || n.course_id === cid)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      },
      async note(nid) {
        const n = db.notes.find(x => x.id === nid);
        if (!n) throw new Error('note not found');
        return { ...n };
      },
      async saveNote(n) {
        if (n.id) {
          const i = db.notes.findIndex(x => x.id === n.id);
          db.notes[i] = { ...db.notes[i], ...n, updated_at: now() };
          save();
          return db.notes[i];
        }
        const row = { ...n, id: id(), created_at: now(), updated_at: now() };
        db.notes.push(row);
        save();
        return row;
      },
      async deleteNote(nid) { db.notes = db.notes.filter(n => n.id !== nid); save(); },
    };
  }

  const store = DEMO ? demoStore() : supabaseStore();

  // ---------- layout ----------
  function mount(inner) {
    $app.innerHTML = `
      <header class="topbar glass">
        <a href="#/" class="brand">🧠 ${esc(SITE)}</a>
        <div class="row">
          ${DEMO ? '<span class="pill warn" title="Notes are only saved in this browser">demo</span>' : ''}
          <button class="btn ghost small" id="logout">log out 👋</button>
        </div>
      </header>
      <main class="wrap">${inner}</main>`;
    document.getElementById('logout').onclick = async () => {
      await store.signOut();
      location.hash = '#/';
      toast('see ya later ✌️');
      route();
    };
    window.scrollTo(0, 0);
  }

  // ---------- views ----------
  function renderLogin() {
    let signup = false;
    const draw = () => {
      $app.innerHTML = `
        <main class="auth">
          <div class="auth-card glass">
            <div class="logo-big">🧠✨</div>
            <h1 class="title">${esc(SITE)}</h1>
            <p class="sub">${signup ? 'join the study era 🚀' : 'your study era starts here. log in bestie 💅'}</p>
            ${DEMO ? '<p class="pill warn">demo mode: any email works, notes stay in this browser</p>' : ''}
            <form id="auth">
              <label>email<input type="email" name="email" required autocomplete="email" placeholder="you@slay.com"></label>
              <label>password<input type="password" name="password" required minlength="6"
                autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="••••••••"></label>
              <button class="btn primary big" type="submit">${signup ? 'create account 🚀' : 'let me in 🔓'}</button>
            </form>
            ${cfg.allowSignup !== false
              ? `<button class="link" id="switch">${signup ? 'already have an account? log in' : 'new here? make an account'}</button>`
              : ''}
          </div>
        </main>`;
      const sw = document.getElementById('switch');
      if (sw) sw.onclick = () => { signup = !signup; draw(); };
      document.getElementById('auth').onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        try {
          if (signup) {
            const needsConfirm = await store.signUp(f.get('email'), f.get('password'));
            if (needsConfirm) { toast('check ur email to confirm 📬'); btn.disabled = false; return; }
          } else {
            await store.signIn(f.get('email'), f.get('password'));
          }
          boom();
          toast("you're in 🔥");
          route();
        } catch (err) {
          toast(`😬 ${err.message || 'login failed'}`);
          btn.disabled = false;
        }
      };
    };
    draw();
  }

  async function renderHome(user) {
    const [courses, notes] = await Promise.all([store.courses(), store.notes()]);
    const counts = {};
    notes.forEach(n => { counts[n.course_id] = (counts[n.course_id] || 0) + 1; });
    const byId = Object.fromEntries(courses.map(c => [c.id, c]));
    const name = (user.email || 'bestie').split('@')[0];
    const s = streak(notes);

    mount(`
      <section class="hero">
        <p class="eyebrow">${greeting()}</p>
        <h1 class="title">hey ${esc(name)} 👋</h1>
        <p class="sub">${pick(VIBES)}</p>
      </section>

      <section class="stats">
        <div class="stat glass"><b>${s}${s ? '🔥' : ''}</b><span>day streak</span></div>
        <div class="stat glass"><b>${courses.length}</b><span>courses</span></div>
        <div class="stat glass"><b>${notes.length}</b><span>notes</span></div>
      </section>

      <section>
        <div class="row between">
          <h2>your courses</h2>
          <button class="btn primary" id="newCourse">+ new course</button>
        </div>
        ${courses.length ? `<div class="grid">${courses.map(c => `
          <a class="card c-${colorOf(c.color)}" href="#/course/${esc(c.id)}">
            <span class="emoji">${esc(c.emoji || '📚')}</span>
            <h3>${esc(c.title)}</h3>
            <p>${counts[c.id] || 0} note${counts[c.id] === 1 ? '' : 's'}</p>
          </a>`).join('')}</div>`
          : `<div class="empty glass"><div class="big">🫥</div><p>no courses yet… add one and start the glow up</p></div>`}
      </section>

      ${notes.length ? `
      <section class="recent">
        <h2>recently cooked 🍳</h2>
        <div class="notes">${notes.slice(0, 5).map(n => noteItem(n, byId[n.course_id])).join('')}</div>
      </section>` : ''}
    `);
    document.getElementById('newCourse').onclick = courseDialog;
  }

  function noteItem(n, course) {
    return `
      <a class="note-item glass" href="#/note/${esc(n.course_id)}/${esc(n.id)}">
        <span class="mood">${esc(n.mood || '📝')}</span>
        <div>
          <h3>${esc(n.title || 'untitled 🤷')}</h3>
          ${n.body ? `<p>${esc(snippet(n.body))}</p>` : ''}
          <small>${course ? `${esc(course.emoji)} ${esc(course.title)} · ` : ''}${ago(n.updated_at)}</small>
        </div>
      </a>`;
  }

  function courseDialog() {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal glass';
    dlg.innerHTML = `
      <form method="dialog">
        <h2>new course ✨</h2>
        <label>name<input type="text" name="title" required maxlength="60" placeholder="e.g. intro to psych"></label>
        <p class="label">pick a vibe</p>
        <div class="chips">${EMOJIS.map((e, i) => `
          <label class="chip"><input type="radio" name="emoji" value="${e}" ${i ? '' : 'checked'}><span>${e}</span></label>`).join('')}
        </div>
        <p class="label">color</p>
        <div class="chips">${COLORS.map((c, i) => `
          <label class="swatch" title="${c}"><input type="radio" name="color" value="${c}" ${i ? '' : 'checked'}><span class="c-${c}"></span></label>`).join('')}
        </div>
        <div class="row end actions">
          <button class="btn ghost" value="cancel" formnovalidate>nah</button>
          <button class="btn primary" value="ok">create 🚀</button>
        </div>
      </form>`;
    document.body.append(dlg);
    dlg.showModal();
    dlg.addEventListener('close', async () => {
      if (dlg.returnValue === 'ok') {
        const f = new FormData(dlg.querySelector('form'));
        try {
          await store.addCourse({ title: f.get('title').trim(), emoji: f.get('emoji'), color: f.get('color') });
          boom();
          toast("course created, let's gooo 🚀");
          route();
        } catch (err) { toast(`😬 ${err.message}`); }
      }
      dlg.remove();
    });
  }

  async function renderCourse(id) {
    const [courses, notes] = await Promise.all([store.courses(), store.notes(id)]);
    const c = courses.find(x => x.id === id);
    if (!c) { location.hash = '#/'; return; }

    mount(`
      <a class="back" href="#/">← back to all courses</a>
      <section class="course-head card c-${colorOf(c.color)}">
        <span class="emoji">${esc(c.emoji || '📚')}</span>
        <div>
          <h1>${esc(c.title)}</h1>
          <p>${notes.length} note${notes.length === 1 ? '' : 's'} · started ${ago(c.created_at)}</p>
        </div>
      </section>
      <div class="row between">
        <a class="btn hot" href="#/note/${esc(c.id)}/new">+ new note ✍️</a>
        <button class="btn danger small" id="delCourse">delete course</button>
      </div>
      ${notes.length
        ? `<div class="notes">${notes.map(n => noteItem(n)).join('')}</div>`
        : `<div class="empty glass"><div class="big">📝</div><p>no notes yet. go write something iconic</p></div>`}
    `);
    document.getElementById('delCourse').onclick = async () => {
      if (!confirm(`delete "${c.title}" and ALL its notes? this can't be undone 😳`)) return;
      await store.deleteCourse(id);
      toast('gone. poof 💨');
      location.hash = '#/';
    };
  }

  async function renderEditor(courseId, noteId) {
    const courses = await store.courses();
    const c = courses.find(x => x.id === courseId);
    if (!c) { location.hash = '#/'; return; }
    const note = noteId && noteId !== 'new'
      ? await store.note(noteId)
      : { course_id: courseId, title: '', body: '', mood: '' };

    mount(`
      <a class="back" href="#/course/${esc(c.id)}">← ${esc(c.emoji)} ${esc(c.title)}</a>
      <input type="text" class="title-input" id="title" maxlength="120" placeholder="note title…" value="${esc(note.title)}" aria-label="Note title">
      <div class="row between toolbar">
        <div class="chips" role="radiogroup" aria-label="mood">${MOODS.map(([e, label]) => `
          <label class="chip" title="${label}"><input type="radio" name="mood" value="${e}" ${note.mood === e ? 'checked' : ''}><span>${e}</span></label>`).join('')}
        </div>
        <div class="row">
          ${note.id ? '<button class="btn danger small" id="del">delete</button>' : ''}
          <button class="btn primary" id="save">save 💾</button>
        </div>
      </div>
      <div class="tabs row">
        <button class="btn small" data-tab="write">write</button>
        <button class="btn ghost small" data-tab="preview">preview</button>
      </div>
      <div class="editor" data-tab="write">
        <div class="write">
          <textarea id="body" placeholder="# what i learned today&#10;&#10;- **key idea**: ...&#10;- \`code\` works too&#10;&#10;> quotes that go hard" aria-label="Note body">${esc(note.body)}</textarea>
        </div>
        <article class="preview glass" id="preview"></article>
      </div>
      <p class="hint">tip: markdown works · <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>S</kbd> to save</p>
    `);

    const $title = document.getElementById('title');
    const $body = document.getElementById('body');
    const $preview = document.getElementById('preview');
    const $editor = document.querySelector('.editor');
    const paint = () => { $preview.innerHTML = $body.value.trim() ? renderMd($body.value) : '<p class="muted">preview shows up here 👀</p>'; };
    paint();
    $body.addEventListener('input', paint);

    document.querySelectorAll('.tabs button').forEach(b => {
      b.onclick = () => {
        $editor.dataset.tab = b.dataset.tab;
        document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('ghost', x !== b));
      };
    });

    let saving = false;
    const save = async () => {
      if (saving) return;
      saving = true;
      try {
        const mood = document.querySelector('input[name=mood]:checked')?.value || null;
        const saved = await store.saveNote({
          id: note.id, course_id: courseId,
          title: $title.value.trim() || 'untitled 🤷', body: $body.value, mood,
        });
        if (!note.id) {
          note.id = saved.id;
          history.replaceState(null, '', `#/note/${courseId}/${saved.id}`);
        }
        boom();
        toast(pick(HYPE));
      } catch (err) {
        toast(`😬 ${err.message}`);
      } finally { saving = false; }
    };
    document.getElementById('save').onclick = save;
    $app.onkeydown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    };
    const del = document.getElementById('del');
    if (del) del.onclick = async () => {
      if (!confirm('delete this note? 🥲')) return;
      await store.deleteNote(note.id);
      toast('note deleted 🗑️');
      location.hash = `#/course/${courseId}`;
    };
  }

  // ---------- router ----------
  async function route() {
    $app.onkeydown = null;
    try {
      const user = await store.user();
      if (!user) return renderLogin();
      const [, page, a, b] = location.hash.split('/');
      if (page === 'course' && a) return await renderCourse(a);
      if (page === 'note' && a) return await renderEditor(a, b);
      return await renderHome(user);
    } catch (err) {
      console.error(err);
      toast(`😬 ${err.message || 'something broke'}`);
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
