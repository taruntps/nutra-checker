# RDA / Regulatory Data — Sync Rules

How the app sources regulatory data, and the rules that keep the Google Sheet
and the app in agreement.

## Where data comes from (precedence)

1. **On startup** the app pre-loads `REG.rda` from a hardcoded `RDA_BASELINE`
   table (so it works instantly / offline).
2. **`loadAll()`** fetches the Google Sheet tabs (`RDA_2020`, `Vitamin_Conversions`,
   `Mineral_Conversions`, all `Sched_*`, etc.). On success the sheet **overwrites**
   the in-memory values — **the sheet wins.**
3. `getRDA()` reads the sheet-backed values first and only falls back to
   `RDA_BASELINE` if a value is missing or the fetch failed.

## RULE 1 — Bump `DB_Version` on EVERY sheet edit ⚠️ (most important)

The app only force-refreshes the cached sheet data when the **`DB_Version`** tab
value changes (otherwise clients keep their copy for up to a 6-hour TTL).

> **After editing ANY tab in the Google Sheet, change `DB_Version`**
> (e.g. `1.0 → 1.1 → 1.2 …`). If you don't, your change will not reach users
> until their cache expires.

## RULE 2 — Keep `RDA_BASELINE` in sync with `RDA_2020`

`RDA_BASELINE` (in `app/index.html`) is the offline fallback. It is now synced to
the `RDA_2020` sheet (incl. full-precision folic acid = folate ÷ 1.7 DFE). If you
materially change RDA numbers in the sheet, also update `RDA_BASELINE` so a
fetch-failure never serves stale numbers. When the app is running on the fallback
(sheet didn't load), the RDA Checker shows an **"offline RDA values"** notice.

## RULE 3 — RDA-Checker ingredient list / conversion factors

- **RDA numbers**: sheet-driven (see above).
- **Conversion factors** for salt forms: the RDA Checker now adopts the factor
  from `Vitamin_Conversions` / `Mineral_Conversions` whenever the salt name in the
  sheet matches the app's ingredient name (normalised). Change a factor in the
  sheet → it applies. (If the names differ, the built-in factor is kept — it never
  applies a wrong factor.)
- **Adding a brand-new ingredient / salt form** that does not already exist in the
  app's RDA-Checker catalogue (`RDC_ING`) still requires a code update **unless** a
  shared key is added (see below). This is deliberate: auto-matching by free-text
  name would risk duplicate or mis-mapped entries in a regulatory calculation.

### To make "add an ingredient in the sheet → it appears" fully automatic
Add a stable identifier column to `Vitamin_Conversions` / `Mineral_Conversions`
(e.g. `app_key` = the `nutrient_key`, plus a unique `salt_id`). The RDA Checker can
then build its salt list from the sheet by that key with no name-matching ambiguity.
Ask the dev to wire `RDC_ING` to that key once the column exists.
