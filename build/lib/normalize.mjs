// Normalize raw tab data → ingredient entity model.
// Evergreen, framework-extensible, data-driven, EXPLICIT field mapping.
import {
  TAB_ROLES, FIELD_MAP, ENRICH_MAP, NAME_KEY_PATTERNS, SERIAL_PATTERNS,
  FRAMEWORKS, PRIMARY_FRAMEWORK, QUALITY,
} from "../config.mjs";
import { BOTANICAL_CANON } from "../botanical-canon.mjs";

// Plant-part vocabulary: the scientific name in a botanical synonym/name ends
// where the first of these "part" tokens begins (e.g. "Withania somnifera Root").
const PART_TOKENS = [
  "Root", "Roots", "Rhizome", "Leaf", "Leaves", "Fruit", "Seed", "Seeds",
  "Flower", "Flowers", "Bark", "Gum", "Aerial", "Whole plant", "Whole",
  "Plant", "Stem", "Stems", "Pulp", "Oil", "Kernel", "Tuber", "Tuberous",
  "Bulb", "Resin", "Oleoresin", "Wood", "Heart wood", "Heartwood", "Pod",
  "Pods", "Peel", "Rind", "Latex", "Bud", "Shoot", "Shoots", "Sprout",
  "Stigma", "Style", "Stamen", "Petal", "Grain", "Nut", "Berry", "Husk",
  "Branch", "Stalk", "Corm", "Frond", "Sap", "Pericarp", "Calyx", "Tender",
  "Stolon", "Nira", "Butter", "Dried", "Extract", "Inflorescence", "Arial",
];
// Finds the plant-part descriptor anywhere in a string (case-insensitive), so a
// part can be lifted out of "… rhizome powder/extract" or "(L.) Moench. Fruit/Root".
const PART_FIND = new RegExp("\\b(" + PART_TOKENS.join("|") + ")\\b", "i");

// Split a botanical string into {sci, part}. The scientific name is the leading
// binomial — Capitalized genus + lowercase species (allowing "species1/species2"
// and hyphenated species) — and everything after is treated as the part/prep
// descriptor. Returns null if there is no plausible binomial (never corrupts data).
function splitSciPart(s) {
  const v = norm(s);
  const m = v.match(/^([A-Z][a-z]+)\s+([a-z][a-z-]{2,}(?:\/[a-z][a-z-]{2,})*)\b(.*)$/);
  if (!m) return null;
  const sci = `${m[1]} ${m[2]}`;
  const rest = (m[3] || "").trim();
  const pm = rest.match(PART_FIND);
  let part = "";
  if (pm) {
    part = rest.slice(pm.index).trim().replace(/^[\s,.;:/()-]+/, "");
    part = part.charAt(0).toUpperCase() + part.slice(1);
  }
  return { sci, part };
}

// Case-insensitive dedupe preserving first-seen casing.
function dedupeCI(arr) {
  const seen = new Set(), out = [];
  for (const x of arr) { const k = String(x).toLowerCase(); if (k && !seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}

// Parse a flat FSSAI limit string into structured dosage rows.
// "Root: 3-6 g (as powder); Extract: 0.5-1 g" → [{form:"Root", dose:"3-6 g (as powder)"}, …]
// A plain limit with no "form:" labels → single {form:"", dose:<string>}.
function parseDosageForms(limit) {
  const v = norm(limit);
  if (!v) return [];
  const parts = v.split(";").map((x) => x.trim()).filter(Boolean);
  const rows = [];
  for (const p of parts) {
    const m = p.match(/^([A-Za-z][A-Za-z /()]*?):\s*(.+)$/);
    if (m) rows.push({ form: m[1].trim(), dose: m[2].trim() });
    else rows.push({ form: "", dose: p });
  }
  return rows;
}

export function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}
const norm = (s) => String(s == null ? "" : s).trim();
const isNumeric = (s) => /^[\d.]+$/.test(norm(s));

// Primary-category priority: actives outrank additives when an ingredient
// legitimately appears in multiple categories (multi-category tagging).
const CATEGORY_PRIORITY = [
  "vitamin", "mineral", "amino-acid", "nucleotide",
  "botanical", "probiotic", "prebiotic", "additive", "other",
];
const pickPrimary = (cats) =>
  [...cats].sort((a, b) => CATEGORY_PRIORITY.indexOf(a) - CATEGORY_PRIORITY.indexOf(b))[0];

// INS food-additive numbers are bare numerics in source — present as "INS 950".
const fmtSynonym = (v) => (/^\d{3,4}[a-z]?$/i.test(norm(v)) ? `INS ${norm(v)}` : norm(v));

// Fallback name detection (only if a tab has no explicit FIELD_MAP entry).
export function detectNameKey(keys) {
  const usable = keys.filter((k) => k && !SERIAL_PATTERNS.some((p) => p.test(k)));
  for (const pat of NAME_KEY_PATTERNS) {
    const hit = usable.find((k) => pat.test(k));
    if (hit) return hit;
  }
  return usable[0] || keys[0];
}
function nameKeyFor(tab, keys) {
  return FIELD_MAP[tab]?.name && keys.includes(FIELD_MAP[tab].name)
    ? FIELD_MAP[tab].name : detectNameKey(keys);
}

function splitList(v) {
  return norm(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
}

// Synonym index: canonicalNameLower -> Set(synonyms), from conversions + Trade_Name_Mapper.
function buildSynonymIndex(tabs) {
  const syn = {};
  const add = (canonical, s) => {
    const c = norm(canonical), v = norm(s);
    if (!c || !v || c.toLowerCase() === v.toLowerCase()) return;
    (syn[c.toLowerCase()] ||= new Set()).add(v);
  };
  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    const rows = tabs[tab]?.rows || [];
    if (meta.role === "synonym") {
      for (const r of rows) {
        const g = r.Generic_Name || "";
        if (!g) continue;
        if (r.Trade_Brand_Name) add(g, r.Trade_Brand_Name);
        splitList(r.Synonyms).forEach((e) => add(g, e));
      }
    }
    if (meta.role === "enrichment" && meta.kind === "conversion") {
      const m = ENRICH_MAP.conversion;
      for (const r of rows) if (r[m.parent] && r[m.salt]) add(r[m.parent], r[m.salt]);
    }
  }
  return syn;
}

// Prohibited names from Not_Permitted_Ingredients.
function buildProhibited(tabs) {
  const set = new Map();
  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    if (meta.role !== "status") continue;
    for (const r of (tabs[tab]?.rows || [])) {
      const name = norm(r.Ingredient_Name || r[detectNameKey(Object.keys(r))]);
      if (name && !isNumeric(name)) set.set(name.toLowerCase(), { tab, reason: norm(r.Reason || "") });
    }
  }
  return set;
}

// RDA enrichment: ICMR-NIN 2020 reference intakes, keyed by RDA_Key/nutrient_key.
function buildRdaIndex(tabs) {
  const idx = {};
  const G = [["Adult man", "sed_men_65kg"], ["Adult woman", "sed_women_55kg"],
    ["Pregnant", "pregnant_65kg"], ["Lactating", "lactating_55kg"], ["Child (1–3 yr)", "child_1_3y_12.9kg"]];
  for (const r of (tabs["RDA_2020"]?.rows || [])) {
    const key = norm(r.nutrient_key);
    if (!key) continue;
    const groups = G.map(([label, col]) => ({ label, value: norm(r[col]) })).filter((g) => g.value);
    if (!groups.length) continue;
    idx[key.toLowerCase()] = { unit: norm(r.uom), source: norm(r.source) || "ICMR-NIN RDA 2020", groups };
  }
  return idx;
}

// FSSR_Permitted enrichment: limit / conditions / synonyms by ingredient name.
function buildPermittedEnrichment(tabs) {
  const map = new Map(); // nameLower -> {limit, conditions, synonyms[]}
  const m = ENRICH_MAP.permitted;
  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    if (!(meta.role === "enrichment" && meta.kind === "permitted")) continue;
    for (const r of (tabs[tab]?.rows || [])) {
      const name = norm(r[m.name]);
      if (!name) continue;
      map.set(name.toLowerCase(), {
        limit: norm(r[m.limit]), conditions: norm(r[m.conditions]),
        synonyms: splitList(r[m.synonyms]),
      });
    }
  }
  return map;
}

export function normalize(snapshot) {
  const { tabs } = snapshot;
  const synonymIndex = buildSynonymIndex(tabs);
  const prohibited = buildProhibited(tabs);
  const permitted = buildPermittedEnrichment(tabs);
  const rdaIndex = buildRdaIndex(tabs);

  const entities = new Map();
  const anomalies = [];
  const tabColumns = {};

  for (const [tab, meta] of Object.entries(TAB_ROLES)) {
    const rows = tabs[tab]?.rows || [];
    if (rows.length) {
      const keys = Object.keys(rows[0]);
      tabColumns[tab] = { role: meta.role, nameKey: meta.role === "entity" ? nameKeyFor(tab, keys) : "—", columns: keys };
    }
    if (meta.role !== "entity") continue;

    const fmap = FIELD_MAP[tab] || {};
    const updatedAt = tabs[tab]?.updated_at || null;

    for (const r of rows) {
      const keys = Object.keys(r);
      const nameKey = nameKeyFor(tab, keys);
      const name = norm(r[nameKey]);
      if (!name || name.length < QUALITY.minNameLen) { anomalies.push({ tab, issue: "missing/short name" }); continue; }
      if (QUALITY.rejectNumericNames && isNumeric(name)) { anomalies.push({ tab, issue: "numeric name (mis-mapped column?)", name }); continue; }

      const slug = slugify(name);
      if (!slug) { anomalies.push({ tab, issue: "empty slug", name }); continue; }

      let e = entities.get(slug);
      if (!e) {
        e = {
          slug, name, domain: "nutraceutical",
          category: meta.category, _cats: new Set([meta.category]),
          identity: {}, synonyms: [], summary: "",
          status: [], related: [], faq: [],
          provenance: { source_tabs: [], db_updated_at: updatedAt },
        };
        entities.set(slug, e);
      } else if (!e._cats.has(meta.category)) {
        e._cats.add(meta.category); // multi-category tagging
        anomalies.push({ tab, issue: "multi-category", name, categories: [...e._cats] });
      }
      if (!e.provenance.source_tabs.includes(tab)) e.provenance.source_tabs.push(tab);
      if (fmap.rdaKey && r[fmap.rdaKey] && !e._rdaKey) e._rdaKey = norm(r[fmap.rdaKey]);

      // common name
      if (fmap.common && r[fmap.common] && !e.identity.common_name) e.identity.common_name = norm(r[fmap.common]);

      // primary-framework status
      let st = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
      if (!st) {
        st = {
          framework: PRIMARY_FRAMEWORK, framework_label: FRAMEWORKS[PRIMARY_FRAMEWORK].label,
          status: "permitted", limit: "", conditions: "",
          source_ref: FRAMEWORKS[PRIMARY_FRAMEWORK].source_default,
          last_reviewed: updatedAt ? updatedAt.slice(0, 10) : null,
          version: updatedAt ? `db-${updatedAt.slice(0, 10)}` : "db-unknown",
        };
        e.status.push(st);
      }
      if (fmap.limit && r[fmap.limit] && !st.limit) st.limit = norm(r[fmap.limit]);

      // synonyms from mapped columns (INS numbers formatted as "INS 950")
      for (const col of (fmap.synonyms || [])) {
        for (const v of splitList(r[col])) { const s = fmtSynonym(v); if (s && !e.synonyms.includes(s)) e.synonyms.push(s); }
      }
    }
  }

  // Cross-source enrichment: conversions/trade synonyms + FSSR_Permitted; prohibited overrides.
  for (const e of entities.values()) {
    const key = e.name.toLowerCase();
    const idx = synonymIndex[key];
    if (idx) for (const s of idx) if (!e.synonyms.includes(s)) e.synonyms.push(s);

    const pe = permitted.get(key);
    if (pe) {
      const st = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
      if (st) { if (!st.limit && pe.limit) st.limit = pe.limit; if (!st.conditions && pe.conditions) st.conditions = pe.conditions; }
      for (const s of pe.synonyms) if (s && !e.synonyms.includes(s)) e.synonyms.push(s);
    }

    const pr = prohibited.get(key);
    if (pr) {
      const st = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
      if (st) { st.status = "prohibited"; if (pr.reason) st.conditions = pr.reason; }
    }

    const rk = (e._rdaKey || "").toLowerCase();
    if (rk && rdaIndex[rk]) e.rda = rdaIndex[rk];
    delete e._rdaKey;
  }

  // Resolve multi-category tagging → primary SEO category + categories[]
  for (const e of entities.values()) {
    e.categories = [...e._cats];
    e.category = pickPrimary(e._cats);
    delete e._cats;
  }

  // Botanical enrichment + related-ingredient computation (operates on the entity
  // array — also runnable standalone on the committed dataset for sample review).
  enrichBotanicals([...entities.values()]);

  return {
    entities: [...entities.values()].sort((a, b) => a.name.localeCompare(b.name)),
    synonymIndex, prohibited: [...prohibited.keys()], anomalies, tabColumns,
  };
}

// ── Botanical enrichment (display/SEO layer — never mutates source name) ──────
// Scientific name + plant part are auto-extracted for ALL botanicals from the
// source (leading synonym, else the regulatory name itself). The curated canon
// supplies an English/common name + curated relationships for high-demand herbs.
// Also computes the related-ingredient lists for every entity.
export function enrichBotanicals(list) {
  for (const e of list) {
    if (e.category !== "botanical" && e.category !== "nutraceutical") continue;
    const canon = BOTANICAL_CANON[e.slug] || null;

    // 1. scientific name + plant part — try synonyms first, then the name.
    //    A curated sci/part override wins (for entries the auto-rule reads poorly).
    let sci = "", part = "";
    for (const s of [...e.synonyms, e.name]) {
      const sp = splitSciPart(s);
      if (sp) { sci = sp.sci; part = sp.part; break; }
    }
    if (canon && canon.sci !== undefined) sci = canon.sci;
    if (canon && canon.part != null) part = canon.part;
    if (sci) {
      e.botanical = { scientificName: sci, part };
      e.genus = sci.split(/\s+/)[0];
      // The raw "Genus species Part" synonym is now structured — drop it as a
      // synonym so the synonym list stays clean (sci name shown as its own field).
      e.synonyms = e.synonyms.filter((s) => splitSciPart(s) === null);
    } else {
      e.botanical = { scientificName: "", part: "" };
    }

    // 2. English/common display name (priority: curated → Official Common → name).
    //    Source name is always preserved in e.name + provenance.
    //    "—" is a placeholder value in the database meaning "no common name" — skip it.
    const rawCommon = e.identity.common_name && e.identity.common_name !== "—" ? String(e.identity.common_name) : "";
    const officialCommon = rawCommon ? rawCommon.split(/[;,/]/)[0].trim() : "";
    e.displayName = (canon && canon.english) || officialCommon || e.name;
    e.regulatoryName = e.name; // explicit: original FSSAI terminology, always kept

    // 3. alternate names for schema + "also known as" (curated + common + sci).
    const alts = new Set();
    if (canon) for (const a of (canon.alsoCalled || [])) alts.add(a);
    if (e.identity.common_name)
      for (const a of String(e.identity.common_name).split(/[;,/]/)) { const t = a.trim(); if (t) alts.add(t); }
    if (sci) alts.add(sci);
    for (const s of e.synonyms) alts.add(s);
    // never repeat the display name as its own alternate; dedupe case-insensitively
    const aLower = e.displayName.toLowerCase();
    e.altNames = dedupeCI([...alts].filter((a) => a && a.toLowerCase() !== aLower));

    // 4. structured dosage forms from the FSSAI limit string.
    const st = e.status.find((s) => s.framework === PRIMARY_FRAMEWORK);
    e.dosageForms = parseDosageForms(st ? st.limit : "");

    if (canon) e._curatedRelated = canon.related || [];
  }

  // ── Related ingredients ─────────────────────────────────────────────────────
  // Non-botanical: up to 6 siblings in the same primary category (unchanged).
  // Botanical priority (per approved spec): curated → same genus → same schedule
  // (regulatory grouping) → alphabetical fallback. Never random.
  const byCat = {};
  for (const e of list) (byCat[e.category] ||= []).push(e.slug);
  const byGenus = {};
  for (const e of list)
    if (e.category === "botanical" && e.genus) (byGenus[e.genus.toLowerCase()] ||= []).push(e.slug);
  const bySchedule = {};
  for (const e of list)
    if (e.category === "botanical")
      for (const t of e.provenance.source_tabs) (bySchedule[t] ||= []).push(e.slug);

  // Deterministic fallback ordering for botanical relationships (alphabetical by
  // name). Non-botanical categories keep their existing insertion-order related
  // lists untouched, so already-published pages are unaffected.
  const nameBySlug = {};
  for (const e of list) nameBySlug[e.slug] = e.name;
  const sortByName = (arr) => arr.sort((a, b) => (nameBySlug[a] || a).localeCompare(nameBySlug[b] || b));
  if (byCat.botanical) sortByName(byCat.botanical);
  for (const k of Object.keys(byGenus)) sortByName(byGenus[k]);
  for (const k of Object.keys(bySchedule)) sortByName(bySchedule[k]);

  const slugSet = new Set(list.map((e) => e.slug));
  const bySlug = Object.fromEntries(list.map((e) => [e.slug, e]));
  const dispOf = (s) => (bySlug[s] && (bySlug[s].displayName || bySlug[s].name)) || s;
  const hasSci = (s) => !!(bySlug[s] && bySlug[s].botanical && bySlug[s].botanical.scientificName);
  for (const e of list) {
    if (e.category !== "botanical") {
      e.related = (byCat[e.category] || []).filter((s) => s !== e.slug).slice(0, 6);
      continue;
    }
    const out = [];
    // Dedupe by display name AND by scientific name, so the same herb listed under
    // two schedules (identical English name, or identical binomial like two
    // "Curcuma longa" entries) never appears twice — while distinct species that
    // share a common name (e.g. the three Asparagus "Shatavari" species) are kept.
    const sciKey = (s) => (bySlug[s] && bySlug[s].botanical && bySlug[s].botanical.scientificName || "").toLowerCase();
    const seenNames = new Set([(e.displayName || e.name).toLowerCase()]);
    const seenSci = new Set([sciKey(e.slug)].filter(Boolean));
    // skipIsolates: in fallback tiers, keep links herb-to-herb (drop isolated
    // compounds that share a schedule but have no botanical/scientific name).
    const push = (s, skipIsolates) => {
      if (!s || s === e.slug || !slugSet.has(s) || out.includes(s)) return;
      const n = dispOf(s).toLowerCase(), sk = sciKey(s);
      if (seenNames.has(n) || (sk && seenSci.has(sk))) return;
      if (skipIsolates && !hasSci(s)) return;
      seenNames.add(n); if (sk) seenSci.add(sk); out.push(s);
    };
    // 1. curated relationships
    for (const s of (e._curatedRelated || [])) { push(s, false); if (out.length >= 6) break; }
    // 2. same genus/family
    if (out.length < 6 && e.genus)
      for (const s of (byGenus[e.genus.toLowerCase()] || [])) { push(s, false); if (out.length >= 6) break; }
    // 3. same regulatory grouping (schedule/tab) — herb-to-herb only
    if (out.length < 6)
      for (const t of e.provenance.source_tabs)
        for (const s of (bySchedule[t] || [])) { push(s, true); if (out.length >= 6) break; }
    // 4. alphabetical fallback within category — herb-to-herb only
    if (out.length < 6)
      for (const s of (byCat[e.category] || [])) { push(s, true); if (out.length >= 6) break; }
    e.related = out.slice(0, 6);
    delete e._curatedRelated;
  }
  return list;
}
