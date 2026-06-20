# Regulyze — Complete System Audit & Founder's Documentation

**Prepared for:** The Founder (non-technical)
**Scope:** Full read-only audit. No code was changed to produce this report.
**Plain-language promise:** Every technical thing below is explained the way you'd explain it to a smart friend who doesn't code.

> **One-line summary:** Regulyze is a website that checks whether a nutraceutical (health-supplement) product recipe follows Indian FSSAI rules, and produces a compliance report. It is built as a single web page plus a set of small cloud programs and a cloud database. There is no traditional "server" you rent — everything runs on Google's and Supabase's cloud.

---

# 1. Executive Summary

**What is Regulyze?**
Regulyze is an online compliance-checking tool for the Indian nutraceutical / health-supplement industry. A user types in (or uploads a photo of) a product's ingredient list and dosages. Regulyze compares it against Indian regulations (FSSAI's FSS Nutraceutical Regulations, Schedules I–IV, ICMR RDA 2020, etc.) and tells them what is compliant, what isn't, and why.

**What problem does it solve?**
Checking a supplement formula against Indian law normally requires a regulatory consultant, hours of manual cross-referencing, and deep knowledge of multiple government documents. Regulyze does this in seconds and produces a written report and a label checklist — turning a specialist, slow, expensive task into a self-service, instant one.

**Who are the users?**
- Nutraceutical manufacturers and brand owners
- Regulatory / compliance officers
- Product development teams
- Consultants who check formulas for clients

**What happens from visit to final output:**

```
Visitor lands on regulyze.in
        ↓
Signs up / logs in (email+password, or Google, or OTP)
        ↓
Gets 5 free checks (then must buy a plan)
        ↓
Enters a product formula  (types it, or uploads a label photo/PDF)
        ↓
(Optional) AI reads the photo / resolves unknown ingredient names
        ↓
Regulyze compares formula against the live regulation database (Google Sheet)
        ↓
Compliance Report generated  (pass/fail per ingredient + citations)
        ↓
Label Checklist + RDA % calculations produced
        ↓
User downloads a PDF and the check is saved to their History
        ↓
Each check is metered against their plan; Dashboard shows usage
```

---

# 2. Complete System Architecture

Think of Regulyze as **four cooperating parts**: the website (what users see), the cloud programs (the "brains" for sensitive tasks), the database (the memory), and the regulation data (the rulebook).

### 2.1 Frontend (the website users see)
- **Technology:** Plain HTML, CSS, and JavaScript — **no framework** (no React/Angular). The entire user app is **one single file**, `app/index.html` (~7,000 lines). The admin panel is one file, `admin/index.html`.
- **What it does:** Everything the user interacts with — forms, report screens, PDF download, payment popups.
- **Why it exists:** It's the product. A single-file design means there's nothing to "build/compile" — what you see in the file is what runs.
- **If it fails:** Users can't use the site. Because it's hosted on GitHub Pages (very reliable), outages are rare and usually fix themselves.
- **How to maintain:** Edits are made directly to the file and pushed to GitHub; the live site updates automatically in 1–3 minutes.

### 2.2 Backend (the cloud programs / "Edge Functions")
- **Technology:** **Supabase Edge Functions** — small programs written in TypeScript that run on demand in the cloud (Deno runtime). There are **7** of them.
- **What it does:** Handles every *sensitive* task that must not be trusted to the browser: payments, AI calls, OTP sending/verifying, admin user creation. Secret keys live here, never in the browser.
- **Why it exists:** Security. For example, the price of a plan is decided here so a user can't change it in their browser to pay ₹1.
- **If it fails:** The specific feature breaks (e.g., payments fail) but the rest of the site keeps working.
- **How to maintain:** Each function's code lives in `supabase/functions/`. To update one, you paste new code into the Supabase dashboard and click Deploy. **Important: pushing to GitHub does NOT deploy these — they are deployed separately.**

### 2.3 Database (the memory)
- **Technology:** **Supabase PostgreSQL** (a managed cloud SQL database).
- **What it does:** Stores users, their plans, usage counts, check history, coupons, OTP sessions, payment records, and an activity log.
- **Why it exists:** So accounts, plans, and history survive between visits.
- **If it fails:** Login, history, plans, and payments stop working. Supabase manages reliability and backups for you.
- **How to maintain:** Through the Supabase dashboard. Structural changes are done with SQL scripts kept in `supabase/migrations/`.

### 2.4 Regulation data (the rulebook)
- **Technology:** A **public Google Sheet**, read by the website as a live data feed.
- **What it does:** Holds every regulatory list (permitted ingredients, schedules, RDA values, conversion factors). Each regulation category is a separate tab.
- **Why it exists:** So you can update the *rules* by editing a spreadsheet — no coding needed.
- **If it fails:** The compliance check can't load its data. The site tries the Google link first, then two backup "proxy" services. If all fail, regulatory data won't load (this is the single most fragile dependency).
- **How to maintain:** Edit the sheet, then change the value in the `DB_Version` tab to force all users' browsers to refresh their cached copy.

### 2.5 Authentication (the login system)
- **Technology:** **Supabase Auth** — handles email/password, Google Sign-In, and a custom OTP (one-time code) flow for password resets.
- **If it fails:** Users can't log in. New visitors could still see the landing page.

### 2.6 File storage
- **There is essentially none.** When a user uploads a label photo/PDF, it is sent straight to the AI for reading and **not stored**. This is good for privacy and cost, and means there are no large storage bills or file backups to worry about.

### 2.7 AI provider
- **Anthropic Claude** (model: `claude-sonnet-4-6`). Used for two things only: reading uploaded label images, and resolving unknown ingredient names. (More in Section 7.)

### 2.8 Third-party integrations
Razorpay (payments), 2Factor.in (SMS OTP), Resend (email OTP), Google Sheets (rules), Google Identity (sign-in). (More in Section 8.)

### 2.9 Hosting infrastructure
- **Frontend:** GitHub Pages (free, very reliable, global).
- **Backend + Database:** Supabase cloud (project `afttrokqchfcpjcekuyh`).
- **Domain:** `regulyze.in` (configured via the `CNAME` file + your DNS provider).
- **SSL (the padlock/https):** Provided automatically by GitHub Pages.

---

# 3. Website Structure

Regulyze is small and focused. It is **not** a big multi-page site; it's a few pages, and the main app uses "tabs" inside one page.

### Public pages
| Page | URL | Who | Purpose | Depends on |
|---|---|---|---|---|
| Landing page | `regulyze.in/` (`index.html`) | Everyone | Marketing / entry point | GitHub Pages |
| App (main product) | `regulyze.in/app/` | Everyone (login required to use) | The compliance checker | Supabase, Google Sheet |

### Login / account
There is no separate login *page* — login happens in a popup overlay inside the app (`/app/`). Methods: email+password, Google, and OTP-based password reset.

### User dashboard (tabs inside `/app/`)
The app switches between these "tabs" (sections) — they are not separate URLs:
| Tab | Purpose | Role |
|---|---|---|
| Input / Compliance Tracker | Enter the formula | Logged-in user |
| Reports / Compliance Report | The pass/fail result + citations | Logged-in user |
| Label Checklist | Labeling requirements checklist | Logged-in user |
| My History | Past checks | Logged-in user |
| RDA Checker | % RDA calculator by population group | Logged-in user |
| Dashboard | Usage summary, plan status | Logged-in user |

### Admin pages
| Page | URL | Who | Purpose |
|---|---|---|---|
| Admin panel | `regulyze.in/admin/` | Admins only | Manage everything |

The admin panel has three sections (tabs): **Users**, **Activity**, **Coupons**.

### Super-admin pages
**There is no separate "super-admin" tier.** There is one admin level (see Section 4). The folders `option-1`, `option-2`, `option-3`, `theme-a`, `theme-b`, `design-system`, `sample-report`, `landing.html`, `app.html` are **old design mockups/experiments** — not part of the live product.

---

# 4. User Roles & Permissions

**Important reality check:** Your template lists Manager, Reviewer, Auditor, Consultant, etc. **Regulyze does not have those roles.** The system is deliberately simple — there are only **two roles** plus an account status. I'm telling you this plainly so you don't assume capabilities that aren't there.

| Capability | Regular User | Admin |
|---|---|---|
| Run compliance checks | ✅ (limited by plan) | ✅ |
| View own history | ✅ | ✅ |
| Edit own profile (name, mobile, company) | ✅ | ✅ |
| Change own plan / checks directly | ❌ (only via payment/coupon) | ❌ directly; ✅ via admin tools |
| See all users | ❌ | ✅ |
| Create users | ❌ | ✅ |
| Change anyone's plan | ❌ | ✅ |
| Suspend / activate accounts | ❌ | ✅ |
| Create / disable coupons | ❌ | ✅ |
| View activity log | ❌ | ✅ |

**Account status:** every user is either **active** or **suspended**. A suspended user is blocked from running checks.

**How "admin" is decided:** a hidden flag `is_admin = true` on a user's profile row. Only you/a developer can set this in the database.

**Device limit:** a user can be signed in on at most **2 devices**; a 3rd sign-in signs out the oldest. This prevents account sharing.

---

# 5. Database Documentation

The database is a Supabase PostgreSQL database. Here are the tables that matter.

| Table | Purpose | Key fields | Used by |
|---|---|---|---|
| **profiles** | One row per user. The heart of the system. | name, email, mobile, company, **plan**, **plan_checks** (allowance), **used** (count), **is_admin**, **status**, plan_expires_at | Everything |
| **history** | Saved compliance checks | user_id, formula, summary/category, created_at | "My History" tab |
| **coupons** | Discount & free-grant codes | code, kind (grant/discount), discount_type, discount_value, plan, status, used_count, max_uses | Payments, Admin |
| **otp_sessions** | Temporary one-time codes for password reset | email, otp_hash, purpose, expires_at, used, **attempts** | OTP / password reset |
| **processed_payments** | Record of every completed payment (prevents double-processing) | payment_id (unique), order_id, user_id, plan | Payment verification |
| **activity** | Audit log of events | email, name, event, detail, status, created_at | Admin → Activity |

**Relationships (text ER diagram):**

```
auth.users (Supabase's built-in login table)
   │  (one-to-one)
   ▼
profiles ──────────────┬───────────────┬──────────────────┐
   │                   │               │                  │
   ▼ (one-to-many)     ▼               ▼                  ▼
 history            activity      processed_payments   (coupons are
 (their checks)   (their events)  (their payments)      global, not
                                                          per-user)

otp_sessions  →  linked by email only (temporary, auto-expires)
```

**How data flows:** When a user logs in, the system reads their **profiles** row to know their plan and remaining checks. Each compliance check calls a database routine (`consume_check`) that increments **used** and saves to **history**. A payment writes to **processed_payments** and updates **profiles**. Every notable action writes to **activity**.

**Special database routines (called "RPCs")** — these are safe, pre-approved actions:
`consume_check` (spend one check), `device_allowed` / `register_device` (2-device limit), `log_activity` (audit), `resolve_login` (username→email), `redeem_grant_coupon` (free coupons), `otp_increment_attempt` (anti-brute-force), `admin_set_plan` / `admin_set_status` (admin actions), `is_admin` (permission check).

---

# 6. Authentication & Security

**Login process:** A user enters email+password (or clicks Google). Supabase verifies and issues a secure session token that the browser stores. Password reset uses an OTP code sent by email (and SMS once DLT is approved).

**Password storage:** Passwords are **never stored in plain text**. Supabase stores only a one-way scrambled version. (We also removed an old habit of storing plaintext — there's a migration that redacts any leftover to a `__PASSWORD_SET__` marker.)

**Session handling:** Sessions persist so users stay logged in between visits, and auto-refresh. Signing out clears them.

**Token handling:** Every sensitive cloud-program call carries the user's token so the server knows *who* is asking, and can't be tricked by the browser.

**Security measures implemented (the important ones):**
- **Server decides prices** — the browser can't choose what to pay.
- **Payment replay guard** — the same payment can't be used twice (unique `payment_id`).
- **OTP brute-force lockout** — 5 wrong code attempts burns the code; the counter is "atomic" (can't be raced).
- **Rate limiting** — max 3 OTP requests per email per 10 minutes.
- **Column lockdown** — regular users physically cannot edit their own plan/usage/admin-flag in the database; only the server can.
- **2-device limit** — stops account sharing.
- **Input is escaped** — prevents malicious text in history from running as code (XSS protection).

**What you should monitor regularly:**
- Admin → **Activity** log for unusual logins or events.
- Supabase → **Auth** for spikes in signups (possible abuse).
- Razorpay dashboard for failed/disputed payments.
- That nobody unexpected has `is_admin = true`.

---

# 7. AI System Documentation

**Which AI model:** Anthropic **Claude `claude-sonnet-4-6`** (one provider, one model). No OpenAI/Gemini.

**Where AI is used (only 2 places):**
1. **`extract-ingredients`** — reads an uploaded label photo/PDF and turns it into a clean ingredient list.
2. **`ai-suggest`** — when a typed ingredient name isn't recognized, AI suggests the correct regulatory match.

**Prompts (the instructions given to the AI):** They live **inside the edge function code** (`supabase/functions/ai-suggest/index.ts` and `extract-ingredients/index.ts`), as text near the top. To change how the AI behaves, you change that text and redeploy that function.

**AI workflow:** Browser → edge function (adds the secret AI key + the prompt) → Anthropic → result back to browser. The user's token is required, so anonymous strangers can't burn your AI budget.

**Token / cost management:**
- Image size is capped (~22 MB) to control cost and avoid abuse.
- Ingredient-name AI answers are **cached** when definite, so repeat lookups are free. (Network failures are deliberately *not* cached, so they retry.)
- Cost is pay-per-use, billed by Anthropic to whatever account owns `ANTHROPIC_API_KEY`.

**How to change AI models in future:** In each of the two functions there's a single line like `const MODEL = "claude-sonnet-4-6";`. Change that string to a newer model id and redeploy. (For a different provider entirely, a developer would rewrite those two functions.)

---

# 8. Integrations Documentation

| Integration | Purpose | Key name(s) | Where stored | If it breaks |
|---|---|---|---|---|
| **Anthropic Claude** | AI label reading + ingredient match | `ANTHROPIC_API_KEY` | Supabase function secrets | AI features fail; manual entry still works |
| **Razorpay** | Online card/UPI payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Supabase function secrets | Online payments fail; UPI/coupon still work |
| **2Factor.in** | SMS OTP delivery | `TWOFACTOR_API_KEY` | Supabase function secrets | SMS codes don't send; email codes still work |
| **Resend** | Email OTP delivery | `RESEND_API_KEY` | Supabase function secrets | Email codes don't send |
| **Google Sheets** | Live regulation database | (public sheet, no key) | Sheet ID hardcoded in app | Compliance data won't load |
| **Google Identity** | "Sign in with Google" | Google Client ID (public) | Hardcoded in app | Google login fails; email login still works |
| **GitHub Pages** | Website hosting | (your GitHub login) | GitHub | Site won't update/serve |
| **Supabase** | Backend + database + auth | Project keys | Supabase dashboard | Most of the app stops |

**How to update a key:** Supabase Dashboard → your project → **Edge Functions → Secrets** → edit the value → save. No redeploy needed (secrets are shared by all functions). For Razorpay specifically, the key id starts with `rzp_live_` for real money.

> **Note from this session:** keys were accidentally set in a *different* Supabase project ("TPS Cert") at one point. Always confirm you're in project **`afttrokqchfcpjcekuyh`** before changing anything.

---

# 9. Environment Variables (Secrets)

These are set in the Supabase project (not in the code). Values are hidden; only their purpose is explained.

| Variable | Purpose | Used by | Critical? | If missing |
|---|---|---|---|---|
| `SUPABASE_URL` | Address of your database/project | All functions | 🔴 Yes | Everything server-side fails |
| `SUPABASE_SERVICE_ROLE_KEY` | Master key letting functions bypass user restrictions safely | All functions | 🔴 Yes | All functions fail |
| `ANTHROPIC_API_KEY` | Pays for & authorizes AI | ai-suggest, extract-ingredients | 🟠 For AI | AI features 500-error |
| `RAZORPAY_KEY_ID` | Identifies your Razorpay account | create-order, verify-payment | 🟠 For payments | Online payments 500-error |
| `RAZORPAY_KEY_SECRET` | Authorizes/validates payments | create-order, verify-payment | 🔴 For payments | Payments fail / can't verify |
| `TWOFACTOR_API_KEY` | Sends SMS OTP | send-otp | 🟡 For SMS | SMS codes don't send |
| `RESEND_API_KEY` | Sends email OTP | send-otp | 🟡 For email OTP | Email codes don't send |

Two values are also **hardcoded in the website** on purpose (they're public by design): the **Supabase URL + anon key** and the **Google Sign-In Client ID** and the **Google Sheet ID**. These are safe to be public.

---

# 10. Hosting & Deployment

- **Frontend hosting:** GitHub Pages, served from the `main` branch of the GitHub repo `taruntps/nutra-checker`.
- **Backend + database hosting:** Supabase cloud.
- **Domain:** `regulyze.in`, set by the `CNAME` file + a DNS record at your domain registrar pointing to GitHub Pages.
- **SSL:** automatic via GitHub Pages.
- **CDN:** GitHub Pages serves globally via its built-in CDN. (The Google Sheet uses backup "proxy" CDNs — `allorigins`, `corsproxy` — which are the fragile bit.)

**Website deployment workflow:**
```
Developer edits app/index.html
        ↓
Pushes to GitHub (main branch)
        ↓
GitHub Pages auto-builds (1–3 min)
        ↓
Live at regulyze.in
```

**Backend (edge function) deployment workflow — DIFFERENT and manual:**
```
Developer edits supabase/functions/<name>/index.ts
        ↓
Opens Supabase dashboard → Edge Functions → <name> → Edit
        ↓
Pastes new code → clicks Deploy
        ↓
Live immediately
```

**Database change workflow:**
```
Developer writes an SQL script in supabase/migrations/
        ↓
Pastes into Supabase → SQL Editor → Run
```

> **Critical founder takeaway:** GitHub only updates the *website*. **Edge functions and database changes must be deployed by hand in Supabase.** Forgetting this caused several "it's not working" issues this session.

---

# 11. GitHub Repository Documentation

Repository: **`taruntps/nutra-checker`**, branch **`main`**.

| Folder / file | Purpose | Touch? |
|---|---|---|
| `app/index.html` | **The entire user product.** | Developers only |
| `admin/index.html` | The admin panel | Developers only |
| `supabase/functions/` | The 7 cloud programs (payments, AI, OTP, admin) | Developers only |
| `supabase/migrations/` | Database setup scripts | Developers only |
| `CLAUDE.md` | Technical guide for future developers/AI | Reference |
| `CNAME` | Sets the domain `regulyze.in` | **Never edit** |
| `.nojekyll` | Tells GitHub Pages to serve files as-is | **Never edit** |
| `.gitignore` | Keeps secret `.env` files out of GitHub | **Never edit** |
| `RDA-DATA-SYNC.md` | Notes on the RDA data | Reference |
| `index.html`, `landing.html`, `app.html` | Landing/entry pages + old variants | Developers |
| `option-1/2/3`, `theme-a/b`, `design-system`, `sample-report` | **Old design experiments — not live** | Ignore |

**Files that should never be modified casually:** `CNAME`, `.nojekyll`, `.gitignore`.

---

# 12. Backup & Recovery System

**Database backups:** Supabase automatically backs up your PostgreSQL database (daily on paid plans; check your Supabase plan's retention). You can also trigger manual backups and download them from **Supabase → Database → Backups**.

**File backups:** Not needed — Regulyze stores no user files.

**Code backups:** GitHub *is* the backup. Every change is version-history; you can roll back to any past version.

**Regulation data backup:** The Google Sheet — keep a duplicate copy and enable Google's version history (it's automatic in Google Sheets).

**Restore process (step by step):**
1. *Website broken by a bad change* → in GitHub, revert to the previous commit (a developer does this in 2 minutes), or restore the Sheet's earlier version.
2. *Database problem* → Supabase → Database → Backups → restore a chosen point-in-time.
3. *Edge function broken* → redeploy the previous code from `supabase/functions/` (it's all in GitHub history).

**Disaster recovery (worst case — everything lost):** As long as you control the **GitHub repo**, the **Supabase project**, the **domain**, and the **Google Sheet**, a developer can rebuild the live system in a day. Section 15 lists exactly what to safeguard.

---

# 13. Monitoring & Maintenance Checklist

**Daily**
- Open regulyze.in and run one test compliance check (is the site alive?).
- Glance at Admin → Activity for anything odd.

**Weekly**
- Check Razorpay dashboard: payments succeeding, no disputes.
- Check Supabase → Auth for unusual signup spikes.
- Confirm AI features work (upload a test label).

**Monthly**
- Review Anthropic (AI) usage/cost.
- Review Supabase usage vs. plan limits (database size, function calls).
- Verify a recent database backup exists.
- Review the user/plan list in Admin → Users.

**Quarterly**
- Rotate/refresh API keys (Razorpay, Anthropic, Resend, 2Factor) as good hygiene.
- Confirm regulation data is current (FSSAI updates) and bump `DB_Version`.
- Review who has `is_admin`.
- Renew domain if due.

---

# 14. Founder Operations Manual

**1. Things you must NEVER touch**
- The 7 edge functions' code, the database structure, `CNAME`, `.nojekyll`, the Service Role key. Changing these wrongly can take the whole system down.

**2. Things you CAN safely do**
- Everything in the **Admin panel** (`/admin/`): manage users, plans, coupons, view activity.
- Edit the **Google Sheet** to update regulations (then bump `DB_Version`).

**3. Update website content (text/wording):** This requires a developer (it's inside `app/index.html`). It's a small change but not a click-to-edit CMS.

**4. Update plans & pricing:** Prices appear in **two** places that must match — the website (`PLANS` in `app/index.html`) and the server (`PRICE_PAISE` in `create-order` and `verify-payment`). A developer must change both together. (This is a known risk — see Section 16.)

**5. Add users:** Admin → Users → Add User (creates an account with a chosen plan).

**6. Remove/suspend users:** Admin → Users → set status to **suspended** (blocks them). Full deletion is done in Supabase.

**7. Manage subscriptions/plans:** Admin → Users → change a user's plan; or issue a coupon.

**8. Manage reports:** Reports aren't stored as files — each user's checks live in their History. Admins see usage via Activity.

**9. Manage AI settings:** Requires a developer (prompts/model live in code).

**10. Manage integrations/keys:** Supabase → Edge Functions → Secrets. Be careful and confirm the right project.

---

# 15. Business Continuity Guide (if the developer disappears)

A new developer can take over if you hand them access to these. **Collect and safeguard this list now:**

**Accounts / credentials checklist**
- ☐ **GitHub** account that owns `taruntps/nutra-checker` (the code).
- ☐ **Supabase** account that owns project `afttrokqchfcpjcekuyh` (backend, database, all secrets).
- ☐ **Domain registrar** login for `regulyze.in` (DNS control).
- ☐ **Razorpay** account (payments + the live keys).
- ☐ **Anthropic** account (AI billing + `ANTHROPIC_API_KEY`).
- ☐ **Resend** account (email).
- ☐ **2Factor.in** account (SMS) + DLT registration.
- ☐ **Google** account that owns the regulation **Sheet** and the **Google Cloud OAuth** client (Sign-in).

**Services checklist:** GitHub Pages, Supabase, Razorpay, Anthropic, Resend, 2Factor, Google.
**Infrastructure checklist:** the repo, the Supabase project, the domain DNS, the Google Sheet.

**Handover steps for a new developer:**
1. Get added to the GitHub repo and the Supabase project.
2. Read `CLAUDE.md` (it's the technical map).
3. Confirm all 7 edge functions are ACTIVE and all secrets are set in Supabase.
4. Confirm DNS points to GitHub Pages and the domain isn't expiring.
5. They're productive immediately — there's no complex build to learn.

---

# 16. Technical Debt & Risks

| Risk | Why it matters | Recommendation |
|---|---|---|
| **Single 7,000-line file** | One file holds the whole app; one careless edit can break everything; everything shares one namespace. | Long-term: split into modules. Short-term: always test after edits. |
| **Pricing in 2 places** | Website price and server price must match by hand. | Move to a single source, or document a strict "change both" rule. |
| **Google Sheet + proxy dependency** | The CORS "proxy" services (allorigins/corsproxy) are free and unreliable; if they're down, regulations won't load. | Move regulation data into Supabase, or use a paid reliable proxy. |
| **Manual deployments** | Edge functions/DB are deployed by hand; easy to forget or hit the wrong project (happened this session). | A deployment checklist; ideally CI automation. |
| **Two Supabase projects exist** | Keys/SQL were pasted into the wrong project ("TPS Cert") repeatedly. | Clearly label projects; always verify `afttrokqchfcpjcekuyh`. |
| **No automated tests** | Nothing automatically catches breakage. | Add basic checks before big changes. |
| **AI cost exposure** | AI is pay-per-use behind a login; abuse is limited but possible. | Monitor Anthropic usage; add per-user AI rate limits if it grows. |

**Security posture is otherwise strong** (this session hardened payments, OTP, passwords, permissions).

---

# 17. Future Scaling Plan

The architecture (GitHub Pages + Supabase) scales well with little effort early on.

- **100 users:** No changes needed. Current free/low tiers handle this comfortably.
- **1,000 users:** Likely move Supabase to a paid tier (more database + function capacity). Replace the Google-Sheet-via-proxy with a proper data source for reliability. Watch AI costs.
- **10,000 users:** Paid Supabase with read scaling; move regulation data fully into the database; add caching; add automated deployments and monitoring/alerting; consider splitting the single HTML file.
- **100,000 users:** Dedicated database resources, a real CDN strategy, background job processing, per-user rate limits, a proper observability stack, and likely a small engineering team. The frontend (static file on a CDN) scales almost infinitely; the database and AI are the cost/scale pressure points.

---

# 18. Final Founder Dashboard (one-page summary)

```
PRODUCT:   Regulyze — FSSAI nutraceutical compliance checker (regulyze.in)
OWNER CO:  TPS Xperts Group

WEBSITE (frontend)
  • Tech: single HTML file, no framework
  • Host: GitHub Pages  (repo: taruntps/nutra-checker, branch main)
  • Deploy: push to GitHub → live in ~2 min

BACKEND (7 cloud programs / Supabase Edge Functions)
  • ai-suggest, extract-ingredients  → AI (Claude)
  • create-order, verify-payment      → Razorpay
  • send-otp, verify-otp-custom        → OTP (2Factor + Resend)
  • admin-create-user                  → admin
  • Deploy: MANUAL in Supabase dashboard

DATABASE (Supabase PostgreSQL — project afttrokqchfcpjcekuyh)
  • Tables: profiles, history, coupons, otp_sessions,
            processed_payments, activity
  • Backups: automatic (Supabase)

REGULATION DATA
  • Google Sheet (public) — edit + bump DB_Version to publish

AI
  • Anthropic Claude (claude-sonnet-4-6) — pay per use

INTEGRATIONS & KEYS (stored in Supabase → Edge Functions → Secrets)
  • Anthropic ANTHROPIC_API_KEY
  • Razorpay  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET   (live: rzp_live_)
  • 2Factor   TWOFACTOR_API_KEY (needs DLT approval)
  • Resend    RESEND_API_KEY
  • Google    Sheet ID + OAuth Client ID (public, in code)

DOMAIN / SSL
  • regulyze.in (CNAME file + DNS) — https automatic via GitHub Pages

ROLES
  • Regular user  |  Admin (is_admin=true)  |  status: active/suspended

PLANS
  • Free (5)  Basic ₹499 (10)  Pro ₹1499 (50)
  • Monthly ₹2999 (unlimited)  Unlimited ₹9999 (unlimited)

ADMIN PANEL: regulyze.in/admin  → Users · Activity · Coupons

MUST-SAFEGUARD ACCOUNTS:
  GitHub · Supabase · Domain registrar · Razorpay ·
  Anthropic · Resend · 2Factor · Google (Sheet + OAuth)

TOP RISKS:
  1) Google-Sheet proxy reliability
  2) Pricing in 2 places (website + server)
  3) Manual deploys / wrong-project mistakes

DAILY CHECK: open site, run 1 test check, glance at Admin→Activity
```

---

*End of report. Nothing in the system was changed to produce this document.*
