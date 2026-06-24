# PROJECT_CONTEXT.md

> **Living document.** Update this file whenever business workflows, features, user roles, plans, integrations, or compliance rules materially change. Do not update for cosmetic edits. Derived from actual implementation (`app/index.html`, `supabase/`, `build/`, `.github/workflows/`) — not assumptions.

---

## Project Overview

- **Project name:** Regulyze (operated by TPS Xperts Group)
- **Domain:** https://regulyze.in
- **Purpose:** A regulatory compliance and regulatory-intelligence platform for nutraceuticals, health supplements, dietary supplements and functional foods. It checks a product formulation against regulatory requirements and flags compliance risk before launch, and publishes a public SEO library of per-ingredient regulatory intelligence.
- **Business objectives:**
  1. Let manufacturers/regulatory teams validate formulations against **India FSSAI** (FSS Health Supplements, Nutraceuticals… Regulations 2022) — Schedules I–IV, GMP/Codex additive lists, RDA limits — and produce a defensible, cited report.
  2. Drive organic acquisition via a public **Ingredient Intelligence Database** (~817 SEO pages) that funnels anonymous visitors into the paid app.
  3. Monetise via tiered plans (per-check quotas) sold through Razorpay.
- **Framework coverage today:** India — FSSAI only (`PRIMARY_FRAMEWORK = "india-fssai"`). FDA, EFSA, UK, GCC, ASEAN are described as "expanding" in marketing copy but are **not implemented**.

---

## Users

### User types
- **Anonymous visitors** — see the marketing homepage, public ingredient pages (SEO), and the `/explore-ingredients/` dummy preview. Every app action prompts sign-in.
- **Authenticated users** — registered accounts on a plan (default `free`). Run formulation checks, use AI extraction/suggestion, view history, upgrade plans.
- **Admin users** — `profiles.is_admin = true` / `is_admin()` RPC. Use `/admin/` to create accounts and set plans/status for other users.

### Roles & permissions (enforced in Supabase, not just UI)
| Capability | Anonymous | Authenticated | Admin | Service role (Edge Functions) |
|---|---|---|---|---|
| Read public ingredient pages | ✓ | ✓ | ✓ | n/a (static) |
| Read `regulation_data` (anon key) | ✓ | ✓ | ✓ | ✓ |
| Run formulation check (consumes quota) | — | ✓ | ✓ | — |
| AI suggest / extract | — | ✓ (daily cap) | ✓ | executes |
| Edit own `name/mobile/company` | — | ✓ | ✓ | ✓ |
| Change `plan/plan_checks/used/status/is_admin/...` | — | **blocked** | via admin RPCs | ✓ |
| Create users / set plans | — | — | ✓ (`admin-create-user`, `admin_set_plan/status`) | ✓ |

> Column-level lockdown (`20260619_profiles_column_lockdown.sql`) means even a logged-in user with row access cannot write privileged columns — only the service role (Edge Functions) and admin SECURITY-DEFINER RPCs can.

---

## Features

### Modules
1. **Marketing site** (`index.html`) — homepage, hero report mockup, pricing, hamburger mobile nav.
2. **SaaS app** (`app/index.html`, single file) — Auth (email/password, Google OAuth, custom OTP reset/signup), dashboard with usage KPIs, formulation checker, history, plan-gate/upgrade modal, profile editor.
3. **Admin panel** (`admin/index.html`) — admin-only user creation & plan/status management (noindex, robots-disallowed).
4. **Public Ingredient Intelligence Database** (`/ingredients/**`) — generated hub, category, detail, A–Z directory and search pages. Fully public for SEO.
5. **Anonymous preview** (`explore-ingredients/index.html`) — `noindex` dummy mirroring the hub; every CTA routes to `/app/?auth=signin`.
6. **Data pipeline** (`build/`) — fetch → normalize → validate → render the ingredient pages from Supabase `regulation_data`.

### Key workflows
- **Formulation check:** user enters/uploads a formulation → app matches each ingredient against `regulation_data` (Supabase-first, Google Sheet fallback) → unknown ingredients optionally resolved by `ai-suggest` (Claude) → labels parsed by `extract-ingredients` (Claude vision) → result rendered; a check decrements `profiles.used` against `plan_checks` (via `consume_check`).
- **Plan upgrade:** plan-gate appears when free checks exhausted → `create-order` prices the plan server-side (optionally applies a coupon) → Razorpay checkout → `verify-payment` validates signature + amount + replay-guard → upgrades `profiles.plan`.
- **Auth / OTP:** `send-otp` issues a crypto 6-digit code to email (Resend) + SMS (2Factor.in); `verify-otp-custom` validates with atomic attempt counting for reset/signup.
- **Regulation data sync:** editor edits the Google Sheet → Apps Script trigger POSTs each tab to `sync-regulations` (shared-secret auth) → replaces rows in `regulation_data`.
- **Ingredient page publishing:** manual GitHub Action runs `build/generate.mjs` → pushes dataset + rendered pages to `data/ingredients-refresh` review branch → human merges to `main` → GitHub Pages serves.

### Business processes
- **Plans (per-check quotas):** free (5, ₹0), basic (10, ₹499), pro (50, ₹1499), monthly (₹2999 / 30 days), unlimited (₹9999 / 180 days), enterprise (custom / ₹0 placeholder). Quotas mirrored in `admin_set_plan` and the app `PLANS` table.
- **Coupons/grants:** discount coupons re-priced server-side in `create-order`/`verify-payment`; free/grant coupons via `redeem_grant_coupon`.

---

## Integrations

### Internal
- **Static front-end ↔ Supabase:** browser SPA uses the public anon key for Auth and read-only `regulation_data`; all privileged actions go through Edge Functions.
- **Build pipeline ↔ Supabase:** `build/lib/fetch.mjs` paginated anon-key REST reads of `regulation_data` (read-only).
- **Ingredient site ↔ app:** intentionally **decoupled** — public pages never write to Supabase or touch app state. The only link is CTAs pointing to `/app/?auth=signin`.

### External
| Service | Use | Where |
|---|---|---|
| **Supabase** | Postgres DB, Auth, Edge Functions, RLS | project `afttrokqchfcpjcekuyh` |
| **Razorpay** | Payments / plan upgrades | `create-order`, `verify-payment` |
| **Anthropic Claude** | AI ingredient resolution + label vision extraction | `ai-suggest`, `extract-ingredients` |
| **Resend** | Transactional email OTP | `send-otp` |
| **2Factor.in** | SMS OTP | `send-otp` |
| **Google Sheets + Apps Script** | Source of truth for FSSAI regulation tables | `google-apps-script/sync-regulations.gs` → `sync-regulations` |
| **GitHub Pages** | Static hosting (custom domain `regulyze.in`) | repo root + `/ingredients/` |
| **GA4 + Microsoft Clarity** | Analytics on all pages | `G-5EV0X8LPMN`, `xadtpvu8h4` |

---

## Business Rules

### Critical constraints
- **Supabase regulation data is read-only from the pipeline.** No writes, schema changes, or RLS changes from the build.
- **Google Sheet structure & Apps Script sync are frozen** — tab names/columns are contractually mapped in `build/config.mjs` (`TAB_ROLES`/`FIELD_MAP`).
- **No auto-deployment.** The CI Action only opens a review branch; merge to `main` is manual.
- **Ingredient pages stay public + un-gated** to preserve Google SEO. Auth guards must not be re-added.
- **Pricing is decided server-side.** The browser can never set its own payment amount.
- **Privileged profile columns are service-role-only.** Plan/quota/admin flags are never client-writable.

### Compliance / operational
- All regulatory output is **"Indicative only — not a substitute for legal/regulatory advice"** (shown in footers).
- Payment replay protection via `processed_payments` (payment_id PK).
- OTP brute-force protection: max 3 sends / 10 min per email; max 5 verify attempts (atomic).
- AI endpoints require a logged-in user + per-user daily cap (anti credit-drain).
- Stored plaintext passwords have been redacted to a marker; new accounts never store plaintext.

---

## Current Limitations

### Known gaps
- **Single framework live:** only India FSSAI is implemented despite multi-region marketing claims.
- **Manual publishing loop:** ingredient refresh requires a manual Action run + human merge.
- **No automated tests** in the repo (no test runner, no CI test step).
- **Dual data path:** app reads `regulation_data` with a Google Sheet fallback — two sources can drift.
- **`additive` category is built but gated out** of `LIVE_CATEGORIES` (not published).

### Technical limitations
- Front-end is three large hand-maintained single-file HTML pages (`index.html`, `app/index.html`, `admin/`) — no component framework, so changes are manual and regression-prone.
- The Supabase anon key (public by design) and project ref are committed in source.
- Edge Functions use permissive CORS (`Access-Control-Allow-Origin: *`).

---

## Future Opportunities

- **Add a second framework (FDA or EFSA)** through config-only extension to validate the "extensible frameworks" design and match marketing.
- **Automate the publish cadence** (the workflow already has a commented weekly cron) with a still-manual merge gate.
- **Introduce a lightweight test layer** for `normalize.mjs`/`validate.mjs` (the highest-risk, data-shaping code).
- **Consolidate the regulation source** to Supabase-only once sync reliability is proven, removing the Sheet fallback drift.
- **Tighten Edge Function CORS** to the known origins (`regulyze.in`).
- **Componentize the app** (or at least extract shared JS) to reduce single-file maintenance risk.
