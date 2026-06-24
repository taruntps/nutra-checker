# ARCHITECTURE.md

> **Living document.** Update whenever the system structure changes: frontend, backend, DB schema, auth, APIs, integrations, infrastructure, or deployment. Derived from actual repository findings (`supabase/`, `build/`, `app/index.html`, `.github/workflows/`, `config.mjs`). Not generic.

---

## System Overview

Regulyze is a **hybrid static + serverless** system with no traditional application server:

```
┌────────────────────────── GitHub Pages (regulyze.in) ──────────────────────────┐
│  Marketing site (index.html)   SaaS app (app/index.html)   Admin (admin/)        │
│  Public ingredient pages (/ingredients/**)   Dummy preview (explore-ingredients) │
└───────────────┬───────────────────────────────────────────────┬─────────────────┘
                │ anon key (read regulation_data, Auth)          │ CTAs → /app/?auth=signin
                ▼                                                 │
┌──────────────────────── Supabase (afttrokqchfcpjcekuyh) ─────────────────────────┐
│  Postgres + RLS    Auth (email/pw, Google OAuth, custom OTP)    8 Edge Functions  │
└───────┬───────────────────┬───────────────┬──────────────┬───────────────────────┘
        │ Razorpay          │ Claude        │ Resend/2Factor│ shared-secret
        ▼                   ▼               ▼               ▼
   Payments           AI suggest/extract   OTP email+SMS   Google Sheets (Apps Script)
```

Two independent delivery paths share the repo and the Supabase project:
1. **Operational compliance engine** (the app + Edge Functions + DB) — dynamic, authenticated, transactional.
2. **Ingredient intelligence pipeline** (`build/` → static `/ingredients/`) — batch-generated, read-only, public.

---

## Frontend Architecture

- **No framework / no build step for HTML.** Vanilla HTML + inline `<style>` + inline `<script>`. Three hand-maintained single-file pages:
  - `index.html` — marketing homepage (own inline styles; hamburger drawer `<900px` via `.burger`/`.mob-nav`).
  - `app/index.html` — the entire SPA: Supabase JS v2 client, auth flows, dashboard, formulation checker, history, Razorpay checkout, plan-gate modal, profile editor. Uses Tabler Icons. Session in `localStorage` key `sb-afttrokqchfcpjcekuyh-auth-token`.
  - `admin/index.html` — admin user/plan management.
- **Generated pages** (`/ingredients/**`) use the shared stylesheet `design-system/assets/ingredients.css`; produced by `build/lib/render.mjs` string templates.
- **Anonymous funnel:** `explore-ingredients/index.html` is a `noindex` clone of the hub whose every CTA → `/app/?auth=signin`.
- Shared assets in `design-system/assets/` (CSS, logos). Other design CSS: `regulyze-ds.css`, `regulyze-v2.css`.

---

## Backend Architecture

The backend is **Supabase Edge Functions (Deno/TypeScript)** — no server process. Each function is self-contained (`supabase/functions/<name>/index.ts`), uses the service-role key (injected), and enforces its own auth.

| Function | Purpose | Auth | External secret |
|---|---|---|---|
| `create-order` | Server-priced Razorpay order (+coupons) | logged-in user | `RAZORPAY_KEY_ID/SECRET` |
| `verify-payment` | Verify signature + amount + replay-guard → upgrade plan | logged-in user | `RAZORPAY_KEY_ID/SECRET` |
| `send-otp` | Crypto 6-digit OTP to email+SMS, rate-limited | open (rate-limited) | `RESEND_API_KEY`, `TWOFACTOR_API_KEY` |
| `verify-otp-custom` | Validate OTP, set password (reset/signup); atomic attempts | open | — |
| `admin-create-user` | Admin-only account creation w/ rollback | admin | — |
| `ai-suggest` | Resolve unknown ingredient vs DB via Claude | logged-in + daily cap | `ANTHROPIC_API_KEY` |
| `extract-ingredients` | Parse label image/PDF via Claude vision | logged-in + daily cap + size cap | `ANTHROPIC_API_KEY` |
| `sync-regulations` | Replace a regulation tab's rows atomically | Bearer shared secret | `REGULATION_SYNC_SECRET` |

The **build pipeline** is the other backend-ish layer — a Node 22 ESM static generator (`build/generate.mjs` online, `build/generate-local.mjs` offline). Data flow: `fetch.mjs` → `normalize.mjs` (+`botanical-canon.mjs`) → `validate.mjs` (hard-blocks on errors) → `render.mjs` → `sitemap.mjs`. `build/config.mjs` is the single source of truth for frameworks, tab roles, field maps, and publish categories.

---

## Database Architecture

Postgres on Supabase (project `afttrokqchfcpjcekuyh`). Tables defined in `supabase/migrations/`:

| Table | Role | RLS posture |
|---|---|---|
| `profiles` | User account: `plan, plan_checks, used, status, is_admin, username, plan_expires_at, email, name, mobile, company` | RLS on; user may update only `name/mobile/company`; privileged columns service-role-only |
| `regulation_data` | `(tab_name, row_index, data jsonb)` mirror of Google Sheet tabs | public SELECT (anon read); writes service-role-only |
| `processed_payments` | `payment_id PK` replay guard | no client policies (service-role only) |
| `otp_sessions` | OTP hashes, purpose, expiry, `attempts` | RLS on, no client policies (service-role only) |
| `ai_usage` | `(user_id, call_date)` daily AI counters | no client policies (service-role only) |
| `auth.users` | Supabase-managed identities | managed |
| `history` | App formulation-check history (read via app `from('history')`) | app-scoped |

**RPCs (SECURITY DEFINER):** `is_admin()`, `admin_set_plan()`, `admin_set_status()`, `otp_increment_attempt()` (atomic OTP attempts, service-role only), `increment_ai_usage()` (atomic daily AI counter), plus app-referenced `consume_check`, `redeem_grant_coupon`.

Data-model entity shape (pipeline output) is documented in `CLAUDE.md` → Entity model shape.

---

## Authentication & Authorization

- **Auth provider:** Supabase Auth. Methods: email/password (`signInWithPassword`), **Google OAuth** (`signInWithOAuth` / `signInWithIdToken`), and a **custom OTP** flow (Edge Functions) for password reset/signup.
- **Session:** JWT in `localStorage` (`sb-<ref>-auth-token`), shared across `regulyze.in`.
- **Authorization layers (defense in depth):**
  1. RLS row policies on every sensitive table.
  2. **Column-level grants** restricting which `profiles` columns `authenticated` can write.
  3. **Service-role-only** tables (payments, OTP, AI usage) with no client policies.
  4. **SECURITY DEFINER admin RPCs** gated by `is_admin()`.
- **Admin determination:** `profiles.is_admin` via `is_admin()`; admin actions exclusively through Edge Functions / admin RPCs.

---

## APIs

- **No REST/GraphQL app server.** "APIs" are the 8 Edge Functions (POST JSON, CORS-enabled) listed in *Backend Architecture*.
- **Data read API:** Supabase auto-REST on `regulation_data` via the anon key (read-only).
- **Inbound webhook-style API:** `sync-regulations` (Bearer shared secret) called by Google Apps Script.

---

## Integrations

Razorpay (payments), Anthropic Claude (AI suggest + vision extraction), Resend (email OTP), 2Factor.in (SMS OTP), Google Sheets + Apps Script (regulation source of truth → `sync-regulations`), GitHub Pages (hosting), GA4 + Microsoft Clarity (analytics). See PROJECT_CONTEXT.md → Integrations for the business view.

---

## Infrastructure

- **Static hosting:** GitHub Pages, custom domain `regulyze.in` (`CNAME`), `.nojekyll` to bypass Jekyll, `robots.txt` disallows `/app/`, `/admin/`, `/preview/`.
- **Serverless compute:** Supabase Edge Functions (Deno runtime).
- **Database:** Supabase managed Postgres.
- **No containers, no VMs, no app server.**

---

## Hosting & Deployment

- **Front-end deploy = git merge to `main`** (GitHub Pages serves repo content). No build step for HTML; generated pages are committed artifacts.
- **Ingredient data deploy:** manual GitHub Action (`ingredients.yml`, `workflow_dispatch` only) runs `build/generate.mjs` with `SUPABASE_URL`/`SUPABASE_ANON_KEY` secrets and `PUBLISH` input → force-pushes dataset + rendered pages + sitemap to the `data/ingredients-refresh` review branch → **human merges** to `main`.
- **Edge Functions / migrations:** deployed to Supabase out-of-band (CLI / SQL editor); migrations are hand-run idempotent SQL scripts, not auto-applied by CI.

---

## CI/CD

- Single workflow: `.github/workflows/ingredients.yml` — manual trigger, `contents:write`/`pull-requests:write`, Node 22, never scheduled (cron commented out), never deploys.
- **No test/lint stages.** No other workflows.

---

## Storage

- **Regulation data:** Postgres `regulation_data` (jsonb rows) — mirror of Google Sheets.
- **Generated content:** committed HTML under `/ingredients/` + `sitemap.xml` + `data/ingredients.json` (1110-entity snapshot) in the git repo.
- **Client session:** browser `localStorage`.
- No object storage / file uploads persisted server-side (label images are sent to `extract-ingredients` transiently, not stored).

---

## Security Controls

- Server-side pricing + Razorpay signature verification + replay guard (`processed_payments`).
- OTP: crypto-random, SHA-256 hashed at rest, send rate-limit (3/10min), atomic verify-attempt cap (5).
- `profiles` column lockdown + service-role-only sensitive tables + admin-gated SECURITY DEFINER RPCs.
- Plaintext-password redaction migration; new accounts store only a marker.
- AI endpoints require auth + per-user daily caps + payload size cap.
- `robots.txt` + `noindex` keep app/admin/preview out of search.

---

## Monitoring & Logging

- **Product analytics:** GA4 + Microsoft Clarity on all pages.
- **Backend logs:** Supabase Edge Function / Postgres logs (platform-side; not in repo).
- **No application error tracking** (no Sentry/equivalent) and no uptime monitoring in the repo.

---

## Known Technical Debt

- Three large single-file HTML pages with inline CSS/JS — no componentization, high regression risk.
- Dual regulation source (Supabase + Google Sheet fallback) can drift.
- No automated tests anywhere (highest risk: `normalize.mjs`, `validate.mjs`, Edge Function pricing/auth).
- Migrations are manual idempotent scripts run by hand — no migration runner / drift detection.
- Multiple design-system CSS files (`ingredients.css`, `regulyze-ds.css`, `regulyze-v2.css`) without a documented canonical one.
- `additive` category fully built but excluded from publishing.

---

## Architectural Risks

- **Single-region framework lock-in:** only FSSAI is wired; the "extensible" claim is unproven by a second framework.
- **Manual deploy chain:** human merge gate is good for safety but slows refreshes and risks committed-artifact/source divergence.
- **Permissive CORS (`*`)** on Edge Functions broadens the callable surface.
- **Public anon key + project ref in source** — acceptable for anon-read by design, but means RLS is the *only* barrier; any RLS regression is immediately internet-exposed.
- **No tests around money/auth paths** (`verify-payment`, `verify-otp-custom`) — correctness depends on manual review.

---

## Future Architectural Recommendations

1. **Add tests for the risk core:** unit tests for `normalize.mjs`/`validate.mjs`; contract tests for `verify-payment`, `create-order`, OTP attempt logic.
2. **Lock CORS** to `https://regulyze.in` (+ localhost in dev) on all Edge Functions.
3. **Adopt a migration runner** (Supabase CLI migrations) so schema state is reproducible and drift-detectable, replacing hand-run SQL.
4. **Consolidate the regulation source** to Supabase-only once `sync-regulations` reliability is established; retire the Sheet fallback.
5. **Prove framework extensibility** by adding one more `FRAMEWORKS` entry end-to-end (config → normalize → render).
6. **Extract shared app JS** (Supabase client, auth helpers) out of `app/index.html` to cut single-file fragility.
7. **Add error tracking + uptime monitoring** for the Edge Functions and the app.
