# Regulyze — Deploy Checklist

Two **separate** systems serve Regulyze. A `git push` only deploys ONE of them.
Forgetting the other is the #1 cause of "I changed it but nothing happened" bugs.

| What you changed | Where it lives | How it goes live |
|---|---|---|
| `app/index.html`, `admin/index.html`, CSS, JS | GitHub Pages | **Automatic** — push to `main` → live at regulyze.in in ~2 min |
| Anything in `supabase/functions/*/index.ts` | Supabase Edge Functions | **Manual** — must deploy in Supabase dashboard. A git push does NOT deploy it. |
| Anything in `supabase/migrations/*.sql` | Supabase Postgres | **Manual** — paste into Supabase → SQL Editor → Run |

---

## Before every deploy

1. **Did you edit an edge function?** (`supabase/functions/...`)
   - If yes → after pushing to GitHub, ALSO deploy it:
     Supabase dashboard → Edge Functions → [function name] → Edit → paste new code → **Deploy**
   - The git push alone changes nothing on the live function.

2. **Did you edit a migration / need a DB change?** (`supabase/migrations/...`)
   - Paste the SQL into Supabase → SQL Editor → **Run**
   - Confirm you are in the **Regulyze** project (`afttrokqchfcpjcekuyh`), NOT another project.

3. **Did you change a price?** (`PRICE_PAISE` in create-order)
   - Price is now defined in **create-order only** (verify-payment reads it from the order).
   - Also update the display price in `app/index.html` `PLANS` so the UI matches.
   - Deploy create-order (manual, step 1).

4. **Did you add a new secret?** (e.g. a new API key)
   - Supabase → Edge Functions → [function] → Secrets → add it.
   - Secrets are per-project — confirm you are in the Regulyze project.

5. **Bump the build comment** in `app/index.html`:
   `<!-- REGULYZE-BUILD-vX.Y -->` — so you can confirm the live site updated.

---

## After deploy — verify it's actually live

- **Frontend:** hard-refresh regulyze.in (Cmd/Ctrl + Shift + R) and check the build version comment in page source.
- **Edge function:** trigger the feature once and check Supabase → Edge Functions → [name] → Logs.
- **Migration:** re-run a `SELECT` to confirm the table/column/function exists.

---

## Project identity (avoid the wrong-project trap)

- Regulyze Supabase project ID: **`afttrokqchfcpjcekuyh`**
- Supabase URL: `https://afttrokqchfcpjcekuyh.supabase.co`
- Always confirm the project name in the dashboard top-left before pasting SQL or secrets.
  (Pasting into the wrong project has caused "function not found" / "table missing" errors before.)

---

## Edge functions and their deploy triggers

| Function | Deploy when you change… | verify_jwt |
|---|---|---|
| `ai-suggest` | ingredient AI logic, rate limits | true |
| `extract-ingredients` | label-scan logic, rate limits | true |
| `create-order` | plan prices, discount logic | true |
| `verify-payment` | payment verification, plan grant, activity log | true |
| `send-otp` | OTP send (SMS/email) | false |
| `verify-otp-custom` | OTP verify / password reset | false |
| `admin-create-user` | admin user creation | true |
| `sync-regulations` | regulation-data sync (Google Sheet → Supabase) | false |
