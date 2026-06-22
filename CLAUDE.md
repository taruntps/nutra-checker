# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full pipeline: fetch from Supabase → normalize → validate → render HTML + sitemap
npm run generate
# or
node build/generate.mjs

# Offline build (use this in CI or when Supabase is unreachable):
# Reads committed data/ingredients.json, applies enrichment, renders all pages
node build/generate-local.mjs
```

CI runs via GitHub Actions (`.github/workflows/ingredients.yml`) — **manual trigger only**, never automatic. It always pushes results to the `data/ingredients-refresh` review branch; human approval is required before merging to `main`.

> Note: `package.json` only wires `generate` (full pipeline). The offline build (`generate-local.mjs`) and previews (`build/preview.mjs`) are run directly with `node`, not via npm scripts.

## Two layers in one repo

This repo is both a **generated pipeline** and a **hand-maintained static front-end**, served together via GitHub Pages (custom domain in `CNAME`, `.nojekyll` present).

| Layer | Owns | Edited by |
|---|---|---|
| **Generated** | `/ingredients/**` (817 pages), `sitemap.xml` | Never by hand — run `generate-local.mjs` and commit its output |
| **Hand-maintained** | `index.html` (homepage), `app/index.html` (SaaS app), `explore-ingredients/`, `terms/`, `privacy/`, `sample-report/`, `admin/`, `404.html` | Edited directly as raw HTML |

Both layers share `design-system/assets/` (CSS, logos). `index.html` carries its own inline `<style>`; the generated ingredient pages use `design-system/assets/ingredients.css`.

## Architecture

The pipeline is a Node 22 ESM-only static site generator with no build tools or frameworks — vanilla HTML string templates throughout.

### Data flow

```
Supabase regulation_data table
    ↓ build/lib/fetch.mjs       — paginated anon-key REST reads (read-only)
Raw tab rows (per Supabase tab name, e.g. Schedule_II, Sched_I_Vitamins)
    ↓ build/lib/normalize.mjs   — tab rows → entity model; field mapping from config
Normalized entities array
    ↓ build/botanical-canon.mjs — curated English names, sci names, related-slug clusters
Enriched entities
    ↓ build/lib/validate.mjs    — quality gates; hard errors block rendering entirely
    ↓ build/lib/render.mjs      — entity → HTML (hub, category, ingredient page, search, directory)
/ingredients/**/*.html + sitemap.xml (committed to repo, served via GitHub Pages)
```

### Key files

| File | Role |
|---|---|
| `build/config.mjs` | **Single source of truth** — frameworks, tab roles, field maps, publish categories |
| `build/lib/normalize.mjs` | Tab rows → entity model; `enrichBotanicals()` applies botanical canon |
| `build/lib/render.mjs` | All HTML templates; `head()` injects analytics; `renderIngredient/Category/Hub()` |
| `build/botanical-canon.mjs` | Curated display names, scientific names, related-slug clusters for botanicals |
| `build/generate-local.mjs` | Offline entry point; also contains `EXCLUDED_SLUGS` denylist and cross-schedule dedup logic |
| `data/ingredients.json` | Committed normalized snapshot (1110 entities); source for offline builds |

### Entity model shape

```js
{
  slug, name, displayName,      // displayName = curated English name when set
  category,                     // "vitamin" | "mineral" | "amino-acid" | "botanical" | etc.
  synonyms, altNames,
  status: [{ framework, status, limit, conditions, source_ref }],
  botanical: { scientificName, part },
  rda: { groups: [{ label, value }], unit },
  dosageForms: [{ form, dose }],
  related: [...slugs],
  provenance: { source_tabs: [...] }
}
```

## Configuration-driven design

**Adding a new category or framework = config change only** — no structural code changes.

- `FRAMEWORKS` / `TAB_ROLES` / `FIELD_MAP` in `config.mjs` control what gets fetched and how
- `PUBLISH_CATEGORIES` (or `PUBLISH` env var) controls which categories render to `/ingredients/`
- `botanical-canon.mjs` controls curated display names and "related" clusters for botanicals
- Adding a Supabase tab requires: a `TAB_ROLES` entry + a `FIELD_MAP` entry in `config.mjs`

## Critical constraints

- **Supabase is read-only.** No writes, no schema changes, no RLS modifications.
- **No changes to Google Sheets structure or Apps Script sync.**
- **No auto-deployment.** Workflow always pushes to review branch; merge to `main` is manual.
- **Validation errors hard-block rendering.** If `validate()` returns `errors > 0`, pages are not written and the process exits 1.
- **`EXCLUDED_SLUGS` denylist** in `generate-local.mjs` filters test/erroneous records before rendering.
- **Cross-schedule deduplication**: when Schedule II and Schedule III entities share a display name, the Schedule III variant's `displayName` is qualified with its preparation form (Extract, Powder, Oil, etc.).
- **`data/ingredients.json` is committed** and must be kept in sync with any offline rebuild — after running `generate-local.mjs`, commit the enriched JSON alongside the HTML pages.

## Front-end & auth model

- **`app/index.html`** — the entire SaaS app in one file: Supabase Auth (sign in / up / forgot password), dashboard, formulation checks, history. Supabase session lives in `localStorage` under `sb-afttrokqchfcpjcekuyh-auth-token`. Logged-in nav exposes an **Ingredients** tab linking to the live `/ingredients/` hub.
- **Ingredient pages are fully public.** Hub, category, detail, search and directory pages have **no login gate** — this is deliberate, to preserve Google SEO. Do not re-add client-side auth guards to generated pages.
- **`explore-ingredients/index.html`** is a hand-maintained **dummy preview** that mirrors the real hub but is `noindex` and routes *every* CTA to `/app/?auth=signin`. It is the homepage's anonymous-visitor entry point (header + footer "Ingredients" links point here, **not** to `/ingredients/`). It is intentionally outside `/ingredients/` so the generator never touches it and it stays out of `sitemap.xml`.
- The homepage header collapses to a **hamburger drawer** below 900px (`.burger` / `.mob-nav` in `index.html`).
- **Decoupling rule:** the ingredient site is read-only and fully independent of the operational compliance engine — never wire ingredient pages to Supabase writes or app state.

## Analytics

GA4 (`G-5EV0X8LPMN`) and Microsoft Clarity (`xadtpvu8h4`) are injected in `render.mjs` `head()` for generated pages, and inlined in every hand-maintained static page (`index.html`, `app/index.html`, `explore-ingredients/index.html`, `terms/`, `privacy/`). **Any new static page needs both snippets added manually.**
