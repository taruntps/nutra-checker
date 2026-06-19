# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Regulyze** — a FSSAI nutraceutical compliance checker (by TPS Xperts). Users enter a product formulation (ingredients + dosages) and the app checks it against Indian nutraceutical regulations (FSSR 2011, Schedules I–IV, GMP additive lists, NSF closure lists, RDA 2020) and generates a compliance report, label checklist, and downloadable PDF.

Live at **regulyze.in** (see `CNAME`). Admin panel at `admin/index.html`.

## Architecture: single-file static SPA

The **entire application is one file: `app/index.html`** (~6,900 lines) — all HTML, CSS, and JavaScript are inline. There is **no framework, no build step, no bundler, no `package.json`, and no tests.** Plain vanilla JS in `<script>` blocks.

Implications when editing:
- Edits are made directly to `app/index.html`. Nothing to compile.
- Everything shares one global scope — be careful with variable/function names.
- Track meaningful changes via the `<!-- REGULYZE-BUILD-vX.Y -->` comment near the top of `<head>`. Bump it when shipping significant changes.
- The single-file size makes full reads expensive — use `grep` to locate functions/constants by name, then read targeted line ranges.

## External systems

### 1. Supabase (primary backend — fully migrated)

`SUPA_URL` and `SUPA_ANON` are hardcoded in `app/index.html` (~line 6633) and `admin/index.html` (~line 165). The Supabase JS client is `SB = supabase.createClient(SUPA_URL, SUPA_ANON)`.

**All backend logic runs as Supabase Edge Functions** (Deno/TypeScript, in `supabase/functions/`):

| Function | Purpose | Auth required |
|---|---|---|
| `ai-suggest` | Resolves unknown ingredient names via Claude API | User JWT |
| `extract-ingredients` | Parses label image/PDF via Claude vision | User JWT |
| `create-order` | Creates a Razorpay order server-side | User JWT |
| `verify-payment` | Verifies Razorpay signature + upgrades plan | User JWT |
| `send-otp` | Sends OTP via 2Factor.in (SMS) + Resend (email) | None (pre-login) |
| `verify-otp-custom` | Validates OTP; resets password | None (pre-login) |
| `admin-create-user` | Admin-only: creates user with plan | Admin JWT |

Edge functions call `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Deno env. Secrets `ANTHROPIC_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `TWOFACTOR_API_KEY`, `RESEND_API_KEY` are set per-function in the Supabase dashboard.

**Key Supabase RPCs called from client JS:**
- `consume_check(p_detail, p_device)` — debits one check; returns `{ok, used, allowed, kicked, suspended}`
- `device_allowed(p_device)` — enforces 2-device session limit
- `register_device(p_device, p_label)` — registers a device on login
- `log_activity(p_event, p_detail)` — audit trail
- `resolve_login(p_login)` — resolves username → email for login
- `redeem_grant_coupon(p_code)` — coupon redemption
- `otp_increment_attempt(p_id, p_max)` — atomic OTP brute-force counter (SECURITY DEFINER)
- `admin_set_plan(p_user, p_plan)` — admin-only plan change (SECURITY DEFINER)
- `admin_set_status(p_user, p_status)` — admin-only status change (SECURITY DEFINER)

**Key tables:** `profiles`, `history`, `otp_sessions`, `processed_payments` (replay guard).

**Column-level security on `profiles`:** only `name`, `mobile`, `company` are writable by the `authenticated` role. All privileged columns (`plan`, `plan_checks`, `used`, `is_admin`, `status`, etc.) require service-role or a SECURITY DEFINER RPC.

### 2. Google Sheets (regulatory database)

`SHEET_ID` constant (~line 1350) points to the regulatory Google Sheet, read as CSV via the gviz endpoint. Each regulatory category is a separate tab fetched by `fetchSheet(tabName)`. `TAB_META` (~line 1044) maps tab names to citation + note text.

Sheet data is **cached in `localStorage`** with a TTL and a `DB_Version` tab check. To push new regulatory data live: edit the Sheet and bump the `DB_Version` tab value. If users report stale data, confirm `DB_Version` was bumped.

CORS fallback: direct gviz → `api.allorigins.win` → `corsproxy.io`. These third-party proxies are a fragile dependency — if regulatory data fails to load, suspect proxy rate-limiting before blaming app logic.

### 3. Third-party CDN widgets

Loaded in `<head>`: Google Identity Services (GSI), Razorpay Checkout, jsPDF + html2canvas + html2pdf.js, Tabler icons, DM Sans/Mono fonts.

## Auth flow (Supabase IIFE)

All auth lives in a large IIFE near the bottom of `app/index.html` (~line 6630–7230). It:
1. Creates `SB` client and `RG_DEVICE` fingerprint
2. Runs `rgInit()` on DOM ready: checks existing session, sets up `onAuthStateChange`, starts 60s device-kick poller
3. Overrides `window.doLogin`, `window.doSignup`, `window.doForgotPassword`, `window.startRzp`, `window.validateCoupon`, `window.getHist`, `window.saveHist`, `window.incUsed` (no-op), `window.logout`
4. `rgAfterAuth(user, isFresh)` is the single post-login entry point: loads profile, sets `currentUser`, registers device, logs activity

**Google Sign-In** is handled by `rgGoogleInit()` inside the IIFE, which uses `SB.auth.signInWithIdToken` (One Tap) and `SB.auth.signInWithOAuth` (redirect, via `window.rgGoogle`).

**Payment flow:** `window.startRzp` → `SB.functions.invoke('create-order')` → Razorpay Checkout → `SB.functions.invoke('verify-payment')` → `loadProfile()` to refresh plan.

**OTP/password reset:** `doForgotPassword` in the IIFE calls the `send-otp` and `verify-otp-custom` edge functions directly via `fetch(SUPA_URL+'/functions/v1/...')` with `Authorization: Bearer SUPA_ANON`.

## AI ingredient assist

`callAISuggestion` (~line 1800) calls the `ai-suggest` edge function with the user's JWT. Caching is intentional: **only definite answers are cached**; network/timeout failures return sentinels (`_AI_NETWORK_SENTINEL`, `_AI_TIMEOUT_SENTINEL`) and are **not** cached so they retry on next run. Do not simplify this into caching all responses.

`handleFile` (~line 5270) calls `extract-ingredients` for image/PDF label parsing, also with user JWT.

## Feature tabs

`goTab(n)` switches tabs: **0 Input**, **1 Compliance Report**, **2 Label Checklist**, **3 My History** (`renderHistTab()`), **4 RDA Checker** (`rdcInit()`), **5 Dashboard** (`renderDashboard()`).

`localStorage` keys: `tps_u_<email>` (legacy plan cache), `tps_h_<email>` (legacy history), `tps_nutra_v2` (current user session), `rg_device` (device ID).

## Running & deploying

- **Run locally:** `python3 -m http.server` in repo root, then open `http://localhost:8000/app/`. GSI and Razorpay are origin-restricted and only fully work from `regulyze.in`.
- **Deploy app:** GitHub Pages serves from repo root (`.nojekyll`, `CNAME = regulyze.in`). Push to `main` → live. No CI.
- **Deploy edge function:** paste updated `index.ts` into Supabase dashboard → Edge Functions → [function name] → Edit → Deploy.
- **Run SQL migrations:** paste files from `supabase/migrations/` into Supabase → SQL Editor → Run. Files are idempotent (`CREATE OR REPLACE`, `IF NOT EXISTS`).

## Migrations reference

| File | What it does |
|---|---|
| `20260619_security_hardening.sql` | Creates `otp_sessions` (with `attempts` column) and `processed_payments` tables |
| `20260619_profiles_column_lockdown.sql` | Revokes direct UPDATE on privileged profile columns from `authenticated` role |
| `20260619_admin_profile_rpcs.sql` | `admin_set_plan` + `admin_set_status` SECURITY DEFINER RPCs |
| `20260619_otp_atomic_attempt.sql` | `otp_increment_attempt` SECURITY DEFINER RPC (atomic brute-force counter) |
| `20260619_redact_stored_passwords.sql` | Redacts any plaintext passwords to `__PASSWORD_SET__` marker |

## Known gotchas

- **`SHEET_ID` and `GOOGLE_CLIENT_ID` are hardcoded** — public-by-design for a client-side app. The Sheet must stay publicly readable; OAuth client must list `regulyze.in` as authorized origin.
- **Data correctness lives in the Sheet.** Most "wrong result" bugs are sheet-data issues, not JS. Documented caveat: `NSF_Rejected` note — "S.No 218 absent in official FSSAI source."
- **CORS proxies are external & unreliable.** `allorigins`/`corsproxy` rate-limiting is a primary failure mode for regulatory data loading.
- **Column lockdown is in effect.** Never try to `SB.from('profiles').update({plan: ...})` from the client — it will fail silently. Use `admin_set_plan` RPC or service-role client instead.
- **OTP attempt counter is atomic.** `verify-otp-custom` uses the `otp_increment_attempt` SQL RPC (single UPDATE…RETURNING) — do not revert to read-then-write JS logic.
- **`processed_payments` is the payment replay guard.** `payment_id` is the PRIMARY KEY — duplicate inserts are intentionally rejected with 409.
- **The Render backend is fully retired.** There is no `BACKEND` constant and no fallback to `tps-xperts-backend.onrender.com`. Do not reintroduce it.
