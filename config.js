/*
  Online sync settings (Supabase). See README.md → "Go fully online".
  Leave these empty to run in local mode: passcode "open", progress saved in this browser only.
  The anon key is meant to be public. Your data is protected by the passcode login
  and the row-level security rules in supabase-setup.sql.
*/
window.QM_CONFIG = {
  supabaseUrl: "",       // e.g. "https://abcdxyz.supabase.co"
  supabaseAnonKey: "",   // Project Settings → API → anon / publishable key
  accountEmail: ""       // the email of the one user you created in Supabase → Authentication → Users
};
