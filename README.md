# 🧠 brain dump

My private, very aesthetic course notes site ✨ Log in, make a course, dump your notes (Markdown works), get confetti.

- 🔐 login required, and every note is private to your account
- 📚 color-coded courses with emoji
- ✍️ note editor with live preview and a mood tag for each note
- 🔥 study streak counter
- 🎉 confetti on every save, obviously

It's plain HTML, CSS and JavaScript (no build step). It's hosted free on **GitHub Pages**, and **Supabase** (free) handles login and storage.

---

## Try it right now (demo mode)

With `config.js` left empty, the site runs in **demo mode**: any email and password logs you in, and notes are saved only in that browser. It's good for checking out the vibe, but it isn't really private and you can't reach the notes from another device.

## Turn on real logins (about 10 minutes, all free)

### 1. Make a Supabase project
1. Go to <https://supabase.com> → sign up → **New project**. Pick any name and password.
2. When it's ready, open **SQL Editor** → **New query**, paste everything from [`supabase-setup.sql`](supabase-setup.sql), and click **Run**.
3. Open **Project Settings → API** (on newer dashboards, **Project Settings → Data API** plus **API Keys**). Copy the **Project URL** and the **anon public** key.

### 2. Put the keys in `config.js`
```js
supabaseUrl: "https://YOUR-PROJECT.supabase.co",
supabaseAnonKey: "eyJhbGciOi...",
```
The anon key is meant to be public. Your data is protected by the row-level security rules in the SQL file.

### 3. Tell Supabase where the site lives
Supabase → **Authentication → URL Configuration** → set **Site URL** to
`https://pgp42196-art.github.io/Courses/`

### 4. Publish on GitHub Pages
1. Merge this branch into `main`.
2. On GitHub, open the repo → **Settings → Pages**.
3. Under **Source**, pick **Deploy from a branch** → branch `main`, folder `/ (root)` → **Save**.
4. Wait about a minute, then open <https://pgp42196-art.github.io/Courses/> 🎉

### 5. Make it just yours (optional but recommended)
1. Sign up on your site with your email and confirm it from your inbox.
2. In Supabase → **Authentication → Sign In / Providers**, turn **off** "Allow new users to sign up".
3. In `config.js`, set `allowSignup: false` to hide the sign-up button.

Now only you can log in. 💅

---

## Files
| File | What it does |
|---|---|
| `index.html` | the page shell |
| `style.css` | all the drip (colors, fonts, animations) |
| `app.js` | login, courses, notes, editor |
| `config.js` | site name and your Supabase keys |
| `supabase-setup.sql` | database tables and privacy rules |

Want to change the vibe? Edit the color variables at the top of `style.css` or `siteName` in `config.js`.
