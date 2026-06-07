# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Regulyze** — a FSSAI nutraceutical compliance checker (by TPS Xperts). Users enter a product formulation (ingredients + dosages) and the app checks it against Indian nutraceutical regulations (FSSR 2011, Schedules I–IV, GMP additive lists, NSF closure lists, RDA 2020) and generates a compliance report, label checklist, and downloadable PDF.

Live at **regulyze.in** (see `CNAME`).

## Architecture: single-file static SPA

The **entire application is one file: `index.html`** (~6,300 lines, ~470 KB) — all HTML, CSS, and JavaScript are inline. There is **no framework, no build step, no bundler, no `package.json`, and no tests.** It is plain vanilla JS in `<script>` blocks.

Implications when editing:
- Edits are made directly to `index.html`. There is nothing to compile or transpile.
- Because everything shares one global scope, be careful with function/variable names — there is no module isolation.
- The build is tracked manually via the `<!-- REGULYZE-BUILD-vX.Y -->` comment near the top of `<head>` and aggressive `Cache-Control: no-store` meta tags. Bump the build comment when shipping meaningful changes.

### Three external systems

1. **Google Sheets = the database.** Regulatory data lives in a Google Sheet (`SHEET_ID` constant, ~line 1022) read as CSV via the gviz endpoint (`/gviz/tq?tqx=out:csv`). Each regulatory category is a separate sheet tab fetched by `fetchSheet(tabName)`. Tabs include: `GMP_Codex_Additives`, `GMP_FSSR_Additives`, `FSSR_Permitted`, `NSF_Approved`, `NSF_Rejected`, `Not_Permitted_Ingredients`, `Sched_I_*` (Vitamins/Minerals/AminoAcids/Nucleotides/Overages), `Schedule_II`, `Schedule_III_A/B`, `Sched_IV_Pre/Probiotics`, `RDA_2020`, `Trade_Name_Mapper`, `Vitamin_Conversions`, `Mineral_Conversions`. `TAB_META` (~line 1044) holds the regulatory reference citation + note shown per category.
   - Sheet data is **cached in `localStorage`** with a TTL and a `DB_Version` sheet check — when the `DB_Version` tab value changes, the cache force-refreshes. To push new regulatory data live, edit the Google Sheet and bump `DB_Version`.
   - CORS fallback: fetches try the direct gviz URL first, then proxy through `api.allorigins.win` and `corsproxy.io`. These third-party proxies are a fragile dependency — a primary failure mode is "data won't load."

2. **Backend on Render** — `BACKEND = 'https://tps-xperts-backend.onrender.com'` (~line 1022). Node/Express service (not in this repo) handling auth, payments, AI, and history. Endpoints called from the client: `/register`, `/verify-user`, `/send-otp`, `/reset-password`, `/ai-suggest`, `/extract-ingredients`, `/create-order`, `/verify-payment`, `/validate-coupon`, `/use-check`, `/save-history`, `/get-history`, `/log-activity`.

3. **Third-party widgets loaded from CDN** (in `<head>`): Google Identity Services (`accounts.google.com/gsi/client`) for Google Sign-In, Razorpay Checkout, jsPDF + html2canvas + html2pdf.js for PDF export, Tabler icons webfont, DM Sans/Mono fonts.

### Feature tabs

The UI is 5 tabs switched by `goTab(n)`: **0 Input**, **1 Compliance Report**, **2 Label Checklist**, **3 My History** (`renderHistTab()`), **4 RDA Checker** (`rdcInit()`).

### Auth & monetization

- Sign-up grants **5 free checks**, then a paywall ("Upgrade Your Plan") appears. Usage is metered server-side via `/use-check`.
- Auth supports Google Sign-In (`GOOGLE_CLIENT_ID` ~line 5081) and email + OTP (`/send-otp`).
- Payments via Razorpay (`/create-order` → Razorpay Checkout → `/verify-payment`) with coupon support (`/validate-coupon`).
- Client-side `localStorage` keys are prefixed `tps_u_` (user) and `tps_h_` (history).

### AI ingredient assist

`/ai-suggest` resolves unknown ingredient names against the regulatory DB. Its caching is deliberate (see comments ~line 1489): **only definite answers are cached**; transient/network/timeout failures return sentinels (`_AI_NETWORK_SENTINEL`, `_AI_TIMEOUT_SENTINEL`) and are **not** cached so they retry. Don't "simplify" this into caching all responses. `/extract-ingredients` parses a pasted formulation block into structured ingredients.

## Running & deploying

- **Run locally:** open `index.html` in a browser, or serve the folder statically (e.g. `python3 -m http.server`). No install/build. Note that Google Sign-In and Razorpay are origin-restricted, so some auth/payment flows only work fully from the deployed domain.
- **Deploy:** GitHub Pages serves `index.html` directly from the repo (`.nojekyll` disables Jekyll processing; `CNAME` sets the custom domain `regulyze.in`). Pushing to the default branch publishes. There is no CI.

## Known issues & gotchas

- **Render free tier sleeps** after inactivity — the first backend call after idle is slow (cold start). Auth, payments, history, and AI assist all depend on the backend being awake.
- **CORS proxies are external & unreliable.** If sheet data fails to load, suspect `allorigins`/`corsproxy` rate-limiting or downtime before suspecting app logic.
- **`SHEET_ID` and `GOOGLE_CLIENT_ID` are hardcoded in client JS** — expected for a client-side app (they are public-by-design), but the Sheet must remain publicly readable and the OAuth client's authorized origins must include the deploy domain.
- **Data correctness lives in the Sheet, not the code.** Most "wrong result" bugs are sheet-data issues, not JS. One documented data caveat: `NSF_Rejected` note — "S.No 218 absent in official FSSAI source."
- **Cache staleness:** if users report stale regulatory data, confirm `DB_Version` was bumped in the Sheet; otherwise clients serve the cached copy until TTL expiry.
- The single-file size makes full reads expensive — prefer `grep` to locate functions/constants by name, then read targeted line ranges.
